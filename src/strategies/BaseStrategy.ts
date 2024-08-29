import { BaseStrategyConfig } from "../models/types";
import { BaseConnector } from "../connectors/BaseConnector";
import { Logger } from "../utils/logger";

export abstract class BaseStrategy {
    protected logger: Logger;
    protected interval: NodeJS.Timeout | null = null;

    constructor(
        protected config: BaseStrategyConfig,
        protected sourceConnector: BaseConnector,
        protected targetConnector: BaseConnector
    ) {
        this.logger = new Logger(this.constructor.name);
    }

    setConnectors(sourceConnector: BaseConnector, targetConnector: BaseConnector): void {
        this.sourceConnector = sourceConnector;
        this.targetConnector = targetConnector;
    }

    protected async registerMarkets(): Promise<void> {
        await this.sourceConnector.registerMarket(this.config.source.market_id);
        await this.targetConnector.registerMarket(this.config.target.market_id);
    }

    async init(): Promise<void> {
        await this.registerMarkets();
    }

    abstract run(): Promise<void>;

    start(): void {
        if (this.config.enabled) {
            this.init().then(() => {
                this.interval = setInterval(() => this.run(), this.config.period);
                this.logger.info(`Strategy ${this.config.id} started with interval ${this.config.period}ms`);
            }).catch(error => {
                this.logger.error(`Failed to initialize strategy ${this.config.id}:`, error);
            });
        } else {
            this.logger.info(`Strategy ${this.config.id} is disabled`);
        }
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.logger.info(`Strategy ${this.config.id} stopped`);
        }
    }
}