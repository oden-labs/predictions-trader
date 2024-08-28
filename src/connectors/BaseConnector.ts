import { IConnector } from "../interfaces/IConnector";
import { Orderbook, Side } from "../models/types";
import { Logger } from "../utils/logger";

export abstract class BaseConnector implements IConnector {
    protected initialized: boolean = false;
    protected logger: Logger;

    constructor() {
        this.logger = new Logger(this.constructor.name);
    }

    abstract init(): Promise<void>;
    abstract fetchOrderbook(marketId: string): Promise<Orderbook>;
    abstract createLimitOrder(marketId: string, price: number, size: number, side: Side): Promise<void>;
    abstract createFOKOrder(marketId: string, price: number, size: number, side: Side): Promise<void>;
    abstract fetchUSDCBalance(): Promise<number>;

    isInitialized(): boolean {
        return this.initialized;
    }

    protected assertInitialized(): void {
        if (!this.initialized) {
            throw new Error(`${this.constructor.name} is not initialized`);
        }
    }
}