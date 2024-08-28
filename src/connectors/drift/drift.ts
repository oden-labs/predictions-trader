import { Connection, Keypair } from "@solana/web3.js";
import { Wallet, MainnetPerpMarkets, DriftClient, OrderType, PositionDirection } from "@drift-labs/sdk";
import dotenv from 'dotenv';
import path from 'path';
import bs58 from 'bs58';
import { DRIFT_HOST } from '../../constants'
import axios from 'axios';
import { Orderbook, OrderLevel } from "../../models/types";


dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export class DriftConnector {

    private driftClient: DriftClient;
    private initialized: boolean = false;
    private perpPricePrecision: number = 1e6;
    private perpSizePrecision: number = 1e9;

    constructor() {
        //Load enviornment variables
        const connection = new Connection(process.env.SOLANA_RPC_URL || "");
        const solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY;

        //Ensure environment variables are set
        if (!solanaPrivateKey || connection === null) {
            throw new Error('Private key or RPC URL not found in the env file');
        }

        //Initialize the wallet
        const privateKeyBuffer = bs58.decode(solanaPrivateKey);
        const keypair = Keypair.fromSecretKey(privateKeyBuffer);
        const wallet = new Wallet(keypair);
        console.log("Initialized Solana wallet with public key: " + wallet.publicKey);
        this.initialized = false;


        //Initialize the Drift Client
        this.driftClient = new DriftClient({
            connection,
            wallet,
            env: 'mainnet-beta',
            accountSubscription: {
                type: 'websocket',
            }
        });
    }

    async init() {
        console.log("Subscribing to Drift...");
        await this.driftClient.subscribe();
        this.initialized = true;
        console.log("Subscribed to Drift!");
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    //Functions to interact with the Drift API
    private getMarketIndex(symbol: string): number | undefined {
        const market = MainnetPerpMarkets.find(market => market.symbol === symbol);
        return market ? market.marketIndex : undefined;
    }


    async fetchOrderbook(marketName: string): Promise<Orderbook> {
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
        } catch (error) {
            console.error('Error fetching orderbook:', error);
            throw error;
        }
    }

    async placeLimitOrder(marketName: string, /* side: PositionDirection, */ price: number, size: number) {
        if (!this.isInitialized) {
            console.log("Cannot create orders as Drift is not initialized yet.");
            return;
        }
        const marketIndex = this.getMarketIndex(marketName);
        if (!marketIndex) {
            console.log(`Market ${marketName} not found.`);
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
        console.log("Order placed on DRIFT for market: ", marketName, "with price: ", price, "and size: ", size, ".  Transaction hash: ", txHash);;
    }
}
