import { Orderbook, Side } from "../models/types";

export interface IConnector {
  init(): Promise<void>;
  fetchOrderbook(marketId: string): Promise<Orderbook>;
  isInitialized(): Boolean;
  createLimitOrder(marketId: string, price: number, size: number, side: Side): Promise<boolean>;
  createFOKOrder(marketId: string, price: number, size: number, side: Side): Promise<boolean>;
  fetchUSDCBalance(): Promise<number>;
}

