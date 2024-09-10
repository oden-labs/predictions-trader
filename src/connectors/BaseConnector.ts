import { IConnector } from "../interfaces/IConnector";
import { Orderbook, Side } from "../models/types";
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
    abstract registerMarket(markets: string): Promise<void>;
    abstract fetchOpenOrders(): Promise<any>;

    isInitialized(): boolean {
        return this.initialized;
    }

    protected assertInitialized(): void {
        if (!this.initialized) {
            throw new Error(`${this.constructor.name} is not initialized`);
        }
    }
}
