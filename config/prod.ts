import { StrategyType, BaseStrategyConfig } from '../src/models/types';

const strategies: BaseStrategyConfig[] = [
    {
        id: 'arb-poly-drift-trump2024',
        type: StrategyType.ARBITRAGE,
        enabled: true,
        period: 3000,
        source: {
            connector_id: 'polymarket',
            market_id: 'will-donald-trump-win-the-2024-us-presidential-election',
        },
        target: {
            connector_id: 'drift',
            market_id: 'TRUMP-WIN-2024-BET',
        },
        params: {
            balance_perc: 1,
            min_spread: 0.01,
        },
    }
];

export default strategies;
