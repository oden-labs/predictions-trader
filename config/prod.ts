import { StrategyType, BaseStrategyConfig } from '../src/models/types';

const strategies: BaseStrategyConfig[] = [
    {
        id: 'arb-poly-drift-trump2024',
        type: StrategyType.MARKET_MAKING,
        enabled: true,
        period: 3000,
        source: {
            connector_id: 'polymarket',
            market_id: '21742633143463906290569050155826241533067272736897614950488156847949938836455',
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
