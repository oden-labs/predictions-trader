import { StrategyType, BaseStrategyConfig } from '../src/models/types';

const strategies: BaseStrategyConfig[] = [
    {
        id: 'arb-michigan-presidential-election',
        type: StrategyType.ARBITRAGE,
        enabled: true,
        period: 5000,
        source: {
            connector_id: 'polymarket',
            market_id: 'will-a-democrat-win-michigan-presidential-election',
        },
        target: {
            connector_id: 'drift',
            market_id: 'DEMOCRATS-WIN-MICHIGAN-BET',
        },
        params: {
        },
    },
    {
        id: 'arb-trump-win',
        type: StrategyType.ARBITRAGE,
        enabled: true,
        period: 5000,
        source: {
            connector_id: 'polymarket',
            market_id: 'will-donald-trump-win-the-2024-us-presidential-election',
        },
        target: {
            connector_id: 'drift',
            market_id: 'TRUMP-WIN-2024-BET',
        },
        params: {
        },
    },
    {
        id: 'arb-kamala-popular-vote',
        type: StrategyType.ARBITRAGE,
        enabled: true,
        period: 5000,
        source: {
            connector_id: 'polymarket',
            market_id: 'will-kamala-harris-win-the-popular-vote-in-the-2024-presidential-election',
        },
        target: {
            connector_id: 'drift',
            market_id: 'KAMALA-POPULAR-VOTE-2024-BET',
        },
        params: {
        },
    },
    {
        id: 'arb-fed-cut',
        type: StrategyType.ARBITRAGE,
        enabled: true,
        period: 5000,
        source: {
            connector_id: 'polymarket',
            market_id: 'fed-decreases-interest-rates-by-50-bps-after-september-2024-meeting',
        },
        target: {
            connector_id: 'drift',
            market_id: 'FED-CUT-50-SEPT-2024-BET',
        },
        params: {
        },
    },
    {
        id: 'arb-republican-popular-vote-and-presidency',
        type: StrategyType.ARBITRAGE,
        enabled: true,
        period: 5000,
        source: {
            connector_id: 'polymarket',
            market_id: 'will-a-republican-win-the-popular-vote-and-the-presidency',
        },
        target: {
            connector_id: 'drift',
            market_id: 'REPUBLICAN-POPULAR-AND-WIN-BET',
        },
        params: {
        },
    }
];

export default strategies;