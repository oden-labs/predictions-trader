import { BaseConnector } from "../BaseConnector";
import { ConfigService } from "../../utils/ConfigService";
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet, BulkAccountLoader, MainnetPerpMarkets, DriftClient, OrderType, PositionDirection } from "@drift-labs/sdk";
import bs58 from 'bs58';
import { DRIFT_HOST } from '../../constants'
import axios from 'axios';
import { Orderbook, Side, Order } from "../../models/types";


export class DriftConnector extends BaseConnector {

    private marketData: { [slug: string]: { marketIndex: number } } = {};

    private driftClient: DriftClient;
    private perpPricePrecision: number = 1e6;
    private perpSizePrecision: number = 1e9;

    constructor(private config: ConfigService, connectorName: string) {
        super(connectorName);
        //Get enviornment variables
        const connection = new Connection(this.config.get("SOLANA_RPC_URL"));
        const solanaPrivateKey = this.config.get("SOLANA_PRIVATE_KEY");

        //Ensure environment variables are set
        if (!solanaPrivateKey || connection == null) {
            this.logger.error("Private key or RPC URL not found in config");
        }

        //Initialize the wallet
        const privateKeyBuffer = bs58.decode(solanaPrivateKey);
        const keypair = Keypair.fromSecretKey(privateKeyBuffer);
        const wallet = new Wallet(keypair);
        this.logger.info("Initialized Solana wallet with public key: " + wallet.publicKey);

        //Initialize the Drift Client
        this.driftClient = new DriftClient({
            connection,
            wallet,
            env: 'mainnet-beta',
            activeSubAccountId: 2,
            accountSubscription: {
                type: 'polling',
                accountLoader: new BulkAccountLoader(connection, 'confirmed', 1000)
            }
        });
    }

    async init(): Promise<void> {
        this.logger.info("Subscribing to Drift...");
        await this.driftClient.subscribe();
        this.logger.info("Subscribed to Drift!");
        this.initialized = true;
    }

    //Functions to interact with the Drift API

    async registerMarket(symbol: string): Promise<void> {
        this.assertInitialized();
        try {
            const market = MainnetPerpMarkets.find(market => market.symbol === symbol);
            if (!market) {
                throw new Error(`Market ${symbol} not found in MainnetPerpMarkets`);
            }
            if (typeof market.marketIndex !== 'number') {
                throw new Error(`Invalid market index for ${symbol}`);
            }
            this.marketData[symbol] = { marketIndex: market.marketIndex };
            this.logger.info(`Successfully registered market: ${symbol}`);
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error registering market ${symbol}: ${error.message}`);
            } else {
                this.logger.error(`Unknown error while registering market ${symbol}`);
            }
            throw error;
        }
    }


    public async fetchUSDCBalance(): Promise<number> {
        this.assertInitialized();
        const user = this.driftClient.getUser();
        const tokenBalance = Number(await user.getFreeCollateral()) / this.perpPricePrecision;
        return Number(tokenBalance);
    }

    async fetchOrderbook(marketName: string): Promise<Orderbook> {
        this.assertInitialized();
        const depth = 10;
        const url = `${DRIFT_HOST}l2?marketName=${marketName}&depth=${depth}`;

        try {
            const response = await axios.get(url);
            const l2Orderbook: any = response.data;

            // Scale down price and volume since Drift sends orderbook in precision values
            const scaledOrderbook: Orderbook = {
                bids: l2Orderbook.bids.map((bid: { price: string, size: string }) => ({
                    price: Number(bid.price) / this.perpPricePrecision,
                    size: Number(bid.size) / this.perpSizePrecision
                })),
                asks: l2Orderbook.asks.map((ask: { price: string, size: string }) => ({
                    price: Number(ask.price) / this.perpPricePrecision,
                    size: Number(ask.size) / this.perpSizePrecision
                }))
            };

            return scaledOrderbook;
        } catch (error: any) {
            this.logger.error('Error fetching orderbook:', error);
            return { bids: [], asks: [] };

        }
    }

    async fetchOpenOrders(): Promise<Order[]> {
        const user = this.driftClient.getUser();
        const openOrders = await user.getOpenOrders();
        return openOrders.map(order => this.translateDriftOrder(order))
            .filter((order): order is Order => order !== null);
    }

    private translateDriftOrder(driftOrder: any): Order | null {
        const side = driftOrder.direction.long ? Side.BUY : Side.SELL;
        const status = 'OPEN'; //Since we are fetching open orders, we can assume all orders are open
        const orderType = Object.keys(driftOrder.orderType)[0];

        const marketSlug = Object.keys(this.marketData).find(
            slug => this.marketData[slug].marketIndex === driftOrder.marketIndex
        );

        if (!marketSlug) {
            this.logger.info(`Disregarding order ID: ${driftOrder.orderId} as it does not match any registered markets.`);
            return null;
        }

        return {
            id: driftOrder.orderId.toString(),
            status: status,
            side: side,
            price: Number(driftOrder.price) / this.perpPricePrecision,
            size: Number(driftOrder.baseAssetAmount) / this.perpSizePrecision,
            filledSize: Number(driftOrder.baseAssetAmountFilled) / this.perpSizePrecision,
            marketId: marketSlug,
            expiry: Number(driftOrder.maxTs),
            orderType: orderType
        };
    }

    async createFOKOrder(marketName: string, price: number, size: number, side: Side): Promise<boolean> {
        this.assertInitialized();
        const position: PositionDirection = side === Side.BUY ? PositionDirection.LONG : PositionDirection.SHORT;
        const marketIndex = this.marketData[marketName].marketIndex;
        if (!marketIndex) {
            this.logger.error("Error when fetching market index.", new Error(`Market ${marketName} not registered.`));
            return false;
        }

        const orderParams = {
            orderType: OrderType.LIMIT,
            marketIndex: marketIndex,
            direction: position,
            baseAssetAmount: this.driftClient.convertToPerpPrecision(size),
            price: this.driftClient.convertToPerpPrecision(price),
            immediateOrCancel: true,
        }
        const txHash = await this.driftClient.placePerpOrder(orderParams);
        this.logger.info("Order placed on DRIFT for market: " + marketName + "with price: " + price + "and size: " + size + ".  Transaction hash: " + txHash);
        return true;
    }

    async createLimitOrder(marketName: string, price: number, size: number, side: Side) {
        this.assertInitialized();
        const marketIndex = this.marketData[marketName].marketIndex;
        if (!marketIndex) {
            this.logger.error("Error when fetching market data.", new Error(`Market ${marketName} not registered.`));
            return false;
        }

        const position: PositionDirection = side === Side.BUY ? PositionDirection.LONG : PositionDirection.SHORT;

        const orderParams = {
            orderType: OrderType.LIMIT,
            marketIndex: marketIndex,
            direction: position,
            baseAssetAmount: this.driftClient.convertToPerpPrecision(size),
            price: this.driftClient.convertToPricePrecision(price),
        }
        const txHash = await this.driftClient.placePerpOrder(orderParams);
        this.logger.info("Order placed on DRIFT for market: " + marketName + "with price: " + price + "and size: " + size + ".  Transaction hash: " + txHash);
        return true;
    }
}
