import { Orderbook, Side } from "../models/types";

export interface IConnector {
  init(): Promise<void>;
  fetchOrderbook(marketId: string): Promise<Orderbook>;
  isInitialized(): Boolean;
  createLimitOrder(marketId: string, price: number, size: number, side: Side): Promise<void>;
  createFOKOrder(marketId: string, price: number, size: number, side: Side): Promise<void>;
  fetchUSDCBalance(): Promise<number>;
}

