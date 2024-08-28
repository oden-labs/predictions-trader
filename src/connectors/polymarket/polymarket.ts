import { ethers } from "ethers";
import { ApiKeyCreds, Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { POLYMARKET_HOST, POLYGON_USDC_ADDRESS, POLYGON_USDC_DECIMALS } from "../../constants";
import { Orderbook } from "../../models/types";
import { BaseConnector } from "../BaseConnector";
import { ConfigService } from "../../utils/ConfigService";

export class PolymarketConnector extends BaseConnector {
    private wallet: ethers.Wallet;

    //Blockchain Balance
    private polygonRPCURL: string;

    //Polymarket Setup
    private creds!: ApiKeyCreds;
    private clobClient: ClobClient;
    private proxyAddress: string;

    constructor(private config: ConfigService) {
        super();
        const privateKey = this.config.get("ETHEREUM_PRIVATE_KEY");
        this.polygonRPCURL = this.config.get("POLYGON_RPC_URL");
        if (!privateKey) {
            this.logger.error("Private key not found in environment variables");
        }

        this.proxyAddress = this.config.get("POLYMARKET_PROXY_WALLET");
        if (!this.proxyAddress) {
            this.logger.error("PROXY_ADDRESS not found in environment variables");
        }

        this.logger.info("Proxy Address: " + this.proxyAddress);

        //Initialize the wallet
        this.wallet = new ethers.Wallet(privateKey);

        this.logger.info("Initialized Ethereum wallet with address: " + this.wallet.address);
        this.clobClient = new ClobClient(POLYMARKET_HOST, Chain.POLYGON, this.wallet, undefined, 2, this.proxyAddress);
    }

    async init(): Promise<void> {
        this.logger.info("Fetching  API creds from Polymarket...");
        await this.setSecrets();
        this.logger.info("Successfully fetched API creds from Polymarket");
        this.clobClient = new ClobClient(POLYMARKET_HOST, Chain.POLYGON, this.wallet, this.creds, 2, this.proxyAddress);
        this.initialized = true;
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
        this.assertInitialized();
        const resp = await this.clobClient.getTrades();
        console.log(resp);
    }

    async fetchOrderbook(tokenID: string): Promise<Orderbook> {
        try {
            const resp = await this.clobClient.getOrderBook(tokenID);
            const orderbook: Orderbook = {
                bids: resp.bids
                    .map(bid => ({ price: Number(bid.price), size: Number(bid.size) }))
                    .sort((a, b) => b.price - a.price),
                asks: resp.asks
                    .map(ask => ({ price: Number(ask.price), size: Number(ask.size) }))
                    .sort((a, b) => a.price - b.price)
            };
            return orderbook;
        } catch (error: any) {
            this.logger.error("Failed to fetch orderbook from Polymarket", error);
            throw error;
        }
    }

    async createLimitOrder(tokenID: string, price: number, size: number, side: Side) {
        this.assertInitialized();
        try {
            this.logger.info("Creating order with amount:" + size + "and price:" + price);

            const order = await this.clobClient.createOrder({
                tokenID,
                price,
                side,
                size,
                expiration: 0,
            });

            this.logger.info("Created Order" + order);

            const resp = await this.clobClient.postOrder(order, OrderType.GTC);
            this.logger.info(resp);

            return resp;
        } catch (error: any) {
            this.logger.error("Failed to create order on Polymarket", error);
        }
    }

    async fetchUSDCBalance(): Promise<number> {
        const provider = new ethers.providers.JsonRpcProvider(this.polygonRPCURL);
        const tokenABI = ['function balanceOf(address) view returns (uint256)'];
        const tokenContract = new ethers.Contract(POLYGON_USDC_ADDRESS, tokenABI, provider);
        const balance = await tokenContract.balanceOf(this.proxyAddress);
        return (Number(balance) / Number(POLYGON_USDC_DECIMALS));
    }

    async createFOKOrder(tokenID: string, price: number, size: number, side: Side) {
        try {
            const order = await this.clobClient.createOrder({
                tokenID,
                price,
                side,
                size
            }
            );

            console.log("Created Order", order);

            const resp = await this.clobClient.postOrder(order, OrderType.FOK);
            console.log(resp);

            return resp;
        } catch (error: any) {
            console.error("Failed to create order on Polymarket", error);
        }
    }
}
