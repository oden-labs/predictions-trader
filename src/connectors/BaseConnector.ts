import { IConnector } from "../interfaces/IConnector";
import { Order, Orderbook, Side } from "../models/types";
import { Logger } from "../utils/logger";

export abstract class BaseConnector implements IConnector {
    protected initialized: boolean = false;
    protected logger: Logger;
    public name: string;

    constructor(connectorName: string) {
        this.logger = new Logger(this.constructor.name);
        this.name = connectorName;
    }

    abstract init(): Promise<void>;
    abstract fetchOrderbook(marketId: string): Promise<Orderbook>;
    abstract createLimitOrder(marketId: string, price: number, size: number, side: Side): Promise<boolean>;
    abstract createFOKOrder(marketId: string, price: number, size: number, side: Side): Promise<boolean>;
    abstract fetchUSDCBalance(): Promise<number>;
    abstract registerMarket(markets: string): Promise<boolean>;
    abstract fetchOpenOrders(): Promise<Order[]>;
    abstract cancelOrder(orderId: string): Promise<boolean>;
    abstract cancelMultipleOrders(orderId: string[]): Promise<{ [orderId: string]: boolean }>;
    abstract cancelOrdersOfMarket(marketId: string): Promise<{ [orderId: string]: boolean }>;

    isInitialized(): boolean {
        return this.initialized;
    }

    protected assertInitialized(): void {
        if (!this.initialized) {
            throw new Error(`${this.constructor.name} is not initialized`);
        }
    }
}
