import { BaseStrategyConfig } from "../models/types";
import { BaseConnector } from "../connectors/BaseConnector";
import { Logger } from "../utils/logger";

export abstract class BaseStrategy {
    protected logger: Logger;
    protected interval: NodeJS.Timeout | null = null;
    protected sourceConnector: BaseConnector;
    protected targetConnector: BaseConnector;

    constructor(protected config: BaseStrategyConfig) {
        this.logger = new Logger(config.id);
    }

    setConnectors(sourceConnector: BaseConnector, targetConnector: BaseConnector): void {
        this.sourceConnector = sourceConnector;
        this.targetConnector = targetConnector;
    }

    abstract init(): Promise<void>;
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