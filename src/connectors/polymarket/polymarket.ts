import { ethers } from "ethers";
import { ApiKeyCreds, Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client";
import dotenv from 'dotenv';
import path from 'path';
import { POLYMARKET_HOST } from "../../constants";
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export class PolymarketConnector {
    private wallet: ethers.Wallet;

    //Polymarket Setup
    private creds!: ApiKeyCreds;
    private clobClient: ClobClient;
    private isInitialized: boolean = false;
    private proxyAddress: string;

    constructor() {
        const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("Private key not found in environment variables");
        }

        this.proxyAddress = process.env.POLYMARKET_PROXY_WALLET || "";
        if (!this.proxyAddress) {
            throw new Error("PROXY_ADDRESS not found in environment variables");
        }
        console.log("Proxy Address: ", this.proxyAddress);

        //Initialize the wallet
        this.wallet = new ethers.Wallet(privateKey);

        console.log("Initialized Ethereum wallet with address: " + this.wallet.address);
        this.clobClient = new ClobClient(POLYMARKET_HOST, Chain.POLYGON, this.wallet, undefined, 2, this.proxyAddress);
    }

    async init() {
        console.log("Fetching  API creds from Polymarket...");
        await this.setSecrets();
        console.log("Successfully fetched API creds from Polymarket");
        this.clobClient = new ClobClient(POLYMARKET_HOST, Chain.POLYGON, this.wallet, this.creds, 2, this.proxyAddress);
        this.isInitialized = true;
    }

    async setSecrets() {
        const resp = await this.clobClient.createOrDeriveApiKey();
        this.creds = {
            key: resp.key,
            secret: resp.secret,
            passphrase: resp.passphrase,
        };
    }

    async getTrades() {
        if (this.isInitialized === false) {
            throw new Error("Polymarket connector not initialized");
        }
        const resp = await this.clobClient.getTrades();
        console.log(resp);
    }

    async fetchOrderbook(tokenID: string) {
        try {
            const resp = await this.clobClient.getOrderBook(tokenID);
            console.log("Orderbook: ", resp);
            return resp;
        } catch (error) {
            console.error("Failed to fetch orderbook from Polymarket", error);
            throw new Error("Failed to fetch orderbook");
        }
    }

    async createGTCOrder(tokenID: string, amount: number, price: number, side: Side, isNegRisk: boolean) {
        try {
            console.log("Creating order with amount:", amount, "and price:", price);

            const order = await this.clobClient.createOrder({
                tokenID,
                price,
                side,
                size: amount,
                expiration: 0,
            },
                {
                    negRisk: isNegRisk
                });

            console.log("Created Order", order);

            const resp = await this.clobClient.postOrder(order, OrderType.GTC);
            console.log(resp);

            return resp;
        } catch (error) {
            console.error("Failed to create order on Polymarket", error);
            return { success: false, errorMsg: "Internal server error" };
        }
    }

    async createFOKOrder(tokenID: string, amount: number, price: number, side: Side, isNegRisk: boolean) {
        try {
            const order = await this.clobClient.createOrder({
                tokenID,
                price,
                side,
                size: amount,
                expiration: 0,
            },
                {
                    negRisk: isNegRisk
                }
            );

            console.log("Created Order", order);

            const resp = await this.clobClient.postOrder(order, OrderType.FOK);
            console.log(resp);

            return resp;
        } catch (error) {
            console.error("Failed to create order on Polymarket", error);
            return { success: false, errorMsg: "Internal server error" };
        }
    }
}
