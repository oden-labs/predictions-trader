import { BaseConnector } from "../BaseConnector";
import { ConfigService } from "../../utils/ConfigService";
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet, MainnetPerpMarkets, DriftClient, OrderType, PositionDirection, BulkAccountLoader } from "@drift-labs/sdk";
import bs58 from 'bs58';
import { DRIFT_HOST } from '../../constants'
import axios from 'axios';
import { Orderbook, Side } from "../../models/types";


export class DriftConnector extends BaseConnector {

    private driftClient: DriftClient;
    private perpPricePrecision: number = 1e6;
    private perpSizePrecision: number = 1e9;

    constructor(private config: ConfigService) {
        super();
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
            accountSubscription: {
                type: 'websocket',
                // accountLoader: new BulkAccountLoader(connection, 'confirmed', 1000)
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
    private getMarketIndex(symbol: string): number | undefined {
        this.assertInitialized();
        const market = MainnetPerpMarkets.find(market => market.symbol === symbol);
        return market ? market.marketIndex : undefined;
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

    async createFOKOrder(marketName: string, price: number, size: number, side: Side) {
        this.assertInitialized();
        throw ("Not implemented error");
    }

    async createLimitOrder(marketName: string, price: number, size: number, side: Side) {
        this.assertInitialized();
        const marketIndex = this.getMarketIndex(marketName);
        if (!marketIndex) {
            this.logger.error("Error when fetching market index.", new Error(`Market ${marketName} not found.`));
            return;
        }

        const orderParams = {
            orderType: OrderType.LIMIT,
            marketIndex: marketIndex,
            direction: PositionDirection.LONG,
            baseAssetAmount: this.driftClient.convertToPerpPrecision(size),
            price: this.driftClient.convertToPricePrecision(price),
        }
        const txHash = await this.driftClient.placePerpOrder(orderParams);
        this.logger.info("Order placed on DRIFT for market: " + marketName + "with price: " + price + "and size: " + size + ".  Transaction hash: " + txHash);;
    }
}
