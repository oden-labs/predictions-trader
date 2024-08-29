import strategies from '../config/prod';
import { ConfigService } from "./utils/ConfigService";
import { PolymarketConnector } from "./connectors/polymarket/polymarket";
import { DriftConnector } from "./connectors/drift/drift";
import { ArbStrategy } from "./strategies/arb";
import { BaseConnector } from "./connectors/BaseConnector";
import { StrategyType, ArbStrategyConfig } from "./models/types";

const configService = new ConfigService();

function createConnector(connectorId: string): BaseConnector {
    switch (connectorId) {
        case 'polymarket':
            return new PolymarketConnector(configService);
        case 'drift':
            return new DriftConnector(configService);
        default:
            throw new Error(`Unknown connector: ${connectorId}`);
    }
}

async function main() {
    const connectors: Record<string, BaseConnector> = {};

    // Create and initialize all connectors
    for (const strategy of strategies) {
        if (!connectors[strategy.source.connector_id]) {
            connectors[strategy.source.connector_id] = createConnector(strategy.source.connector_id);
        }
        if (!connectors[strategy.target.connector_id]) {
            connectors[strategy.target.connector_id] = createConnector(strategy.target.connector_id);
        }
    }

    // Initialize all connectors
    await Promise.all(Object.values(connectors).map(connector => connector.init()));

    // Initialize and start strategies
    for (const strategyConfig of strategies) {
        const sourceConnector = connectors[strategyConfig.source.connector_id];
        const targetConnector = connectors[strategyConfig.target.connector_id];

        if (strategyConfig.type == StrategyType.ARBITRAGE) {
            const arbConfig = strategyConfig as ArbStrategyConfig;
            const strategy = new ArbStrategy(arbConfig);
            strategy.setConnectors(sourceConnector, targetConnector);
            strategy.start();
        }
    }
}

main().catch(console.error);
