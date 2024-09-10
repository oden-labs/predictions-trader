import { ethers } from "ethers";
import { ApiKeyCreds, Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { POLYMARKET_HOST, POLYGON_USDC_ADDRESS, POLYGON_USDC_DECIMALS } from "../../constants";
import { Orderbook, Order } from "../../models/types";
import { BaseConnector } from "../BaseConnector";
import { ConfigService } from "../../utils/ConfigService";
import axios from "axios";

export class PolymarketConnector extends BaseConnector {
    private wallet: ethers.Wallet;
    private marketData: { [slug: string]: { yesTokenId: string, noTokenId: string } } = {};

    //Blockchain Balance
    private polygonRPCURL: string;

    //Polymarket Setup
    private creds!: ApiKeyCreds;
    private clobClient: ClobClient;
    private proxyAddress: string;

    constructor(private config: ConfigService, connectorName: string) {
        super(connectorName);
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
        return resp;
    }

    async registerMarket(marketSlug: string): Promise<void> {
        this.assertInitialized();
        try {
            const resp = await axios.get(`https://gamma-api.polymarket.com/markets?slug=${marketSlug}`);
            if (!resp.data || resp.data.length === 0) {
                throw new Error(`No market data found for slug: ${marketSlug}`);
            }
            const responseData = resp.data[0];
            if (!responseData.clobTokenIds) {
                throw new Error(`No CLOB token IDs found for market: ${marketSlug}`);
            }
            const clobTokenIds = JSON.parse(responseData.clobTokenIds);
            if (!Array.isArray(clobTokenIds) || clobTokenIds.length !== 2) {
                throw new Error(`Invalid CLOB token IDs format for market: ${marketSlug}`);
            }

            this.marketData[marketSlug] = {
                yesTokenId: clobTokenIds[0],
                noTokenId: clobTokenIds[1]
            };

            this.logger.info(`Successfully registered market: ${marketSlug}`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(`Network error while registering market ${marketSlug}: ${error.message}`);
            } else if (error instanceof Error) {
                this.logger.error(`Error registering market ${marketSlug}: ${error.message}`);
            } else {
                this.logger.error(`Unknown error while registering market ${marketSlug}`);
            }
            throw error;
        }
    }


    async fetchOrderbook(marketID: string): Promise<Orderbook> {
        try {
            let tokenID: string;
            if (this.marketData[marketID] == undefined) {
                this.logger.error("Error when fetching market data.", new Error(`Market ${marketID} not registered.`));
                return { bids: [], asks: [] };
            }
            tokenID = this.marketData[marketID].yesTokenId;
            const resp = await this.clobClient.getOrderBook(tokenID);
            if (resp) {
                const orderbook: Orderbook = {
                    bids: resp.bids
                        .map(bid => ({ price: Number(bid.price), size: Number(bid.size) }))
                        .sort((a, b) => b.price - a.price),
                    asks: resp.asks
                        .map(ask => ({ price: Number(ask.price), size: Number(ask.size) }))
                        .sort((a, b) => a.price - b.price)
                };
                return orderbook;
            }
            else throw new Error("Failed to fetch orderbook from Polymarket");
        } catch (error: any) {
            this.logger.error("Failed to fetch orderbook from Polymarket", error);
            return { bids: [], asks: [] };
        }
    }

    async fetchOpenOrders(): Promise<Order[]> {
        const resp = await this.clobClient.getOpenOrders();
        return resp.map(order => this.translatePolymarketOrder(order))
            .filter((order): order is Order => order !== null);
    }

    private translatePolymarketOrder(polyOrder: any): Order | null {
        const marketData = Object.values(this.marketData).find(
            data => data.yesTokenId === polyOrder.asset_id || data.noTokenId === polyOrder.asset_id
        );

        if (!marketData) {
            this.logger.info(`Disregarding order ID: ${polyOrder.id} as it does not match any registered markets.`);
            return null;
        }

        if (polyOrder.side === 'SELL') {
            this.logger.info(`Disregarding order ID: ${polyOrder.id} as it is a sell order.`);
            return null;
        }

        const side = polyOrder.asset_id === marketData.yesTokenId ? Side.BUY : Side.SELL;

        return {
            id: polyOrder.id,
            status: polyOrder.status === 'LIVE' ? 'OPEN' : polyOrder.status,
            side: side,
            price: Number(polyOrder.price),
            size: Number(polyOrder.original_size),
            filledSize: Number(polyOrder.size_matched) || 0,
            marketId: Object.keys(this.marketData).find(key => this.marketData[key] === marketData) || '',
            expiry: Number(polyOrder.expiration) || 0,
            orderType: polyOrder.order_type || 'LIMIT'
        };
    }

    async createLimitOrder(marketId: string, price: number, size: number, side: Side): Promise<boolean> {
        this.assertInitialized();
        try {
            let tokenID: string;
            if (this.marketData[marketId] == undefined) {
                this.logger.error("Error when fetching market data.", new Error(`Market ${marketId} not registered.`));
                return false;
            }
            if (side == Side.BUY) {
                tokenID = this.marketData[marketId].yesTokenId;
            }
            else {
                tokenID = this.marketData[marketId].noTokenId;
            }

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
            return true;
        } catch (error: any) {
            this.logger.error("Failed to create order on Polymarket", error);
            return false;
        }
    }

    async fetchUSDCBalance(): Promise<number> {
        const provider = new ethers.providers.JsonRpcProvider(this.polygonRPCURL);
        const tokenABI = ['function balanceOf(address) view returns (uint256)'];
        const tokenContract = new ethers.Contract(POLYGON_USDC_ADDRESS, tokenABI, provider);
        const balance = await tokenContract.balanceOf(this.proxyAddress);
        return (Number(balance) / Number(POLYGON_USDC_DECIMALS));
    }

    async createFOKOrder(marketId: string, price: number, size: number, side: Side): Promise<boolean> {
        try {
            let tokenID: string;
            if (this.marketData[marketId] == undefined) {
                this.logger.error("Error when fetching market data.", new Error(`Market ${marketId} not registered.`));
                return false;
            }
            if (side == Side.BUY) {
                tokenID = this.marketData[marketId].yesTokenId;
            }
            else {
                tokenID = this.marketData[marketId].noTokenId;
            }

            const order = await this.clobClient.createOrder({
                tokenID,
                price,
                side: Side.BUY, //We hardcode side to buy because Polymarket has NO tokens in a different orderbook
                size
            }
            );

            this.logger.info("Created Order" + order);

            const resp = await this.clobClient.postOrder(order, OrderType.FOK);
            this.logger.info("Response: " + resp);
            return true;
        } catch (error: any) {
            console.error("Failed to create order on Polymarket", error);
            return false;
        }
    }
}
