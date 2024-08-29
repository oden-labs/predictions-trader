export interface OrderLevel {
  price: number;
  size: number;
}

export interface Orderbook {
  bids: OrderLevel[];
  asks: OrderLevel[];
}

export enum Side {
  BUY = "BUY",
  SELL = "SELL"
}

export enum StrategyType {
  ARBITRAGE = 'arbitrage',
  MARKET_MAKING = 'marketMaking',
}

export interface ArbStrategyConfig extends BaseStrategyConfig {
  params: {
    balance_perc: number;
    min_spread: number;
  };
}


export interface BaseStrategyConfig {
  id: string;
  type: StrategyType;
  enabled: boolean;
  period: number;
  source: {
    connector_id: string;
    market_id: string;
  };
  target: {
    connector_id: string;
    market_id: string;
  };
  params: Record<string, any>; 
}