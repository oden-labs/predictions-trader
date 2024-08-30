import { Orderbook, ArbStrategyConfig, Side } from "../models/types";
import { BaseStrategy } from "./BaseStrategy";
import {
  BaseConnector

} from "../connectors/BaseConnector";
export class ArbStrategy extends BaseStrategy {
  private arbStrategyConfig: ArbStrategyConfig;

  constructor(config: ArbStrategyConfig, protected sourceConnector: BaseConnector,
    protected targetConnector: BaseConnector
  ) {
    super(config, sourceConnector, targetConnector);
    this.arbStrategyConfig = config;
  }

  async init() {
    super.init();
    this.logger.info("Initialized " + this.arbStrategyConfig.id);
  }

  async run() {
    if (!this.sourceConnector.isInitialized() || !this.targetConnector.isInitialized()) {
      this.logger.error("Connectors are not initialized yet. Waiting for initialization...");
      return;
    }
    const sourceOrderbook: Orderbook = await this.sourceConnector.fetchOrderbook(this.arbStrategyConfig.source.market_id);
    const targetOrderbook: Orderbook = await this.targetConnector.fetchOrderbook(this.arbStrategyConfig.target.market_id);

    const sourceBalance = await this.sourceConnector.fetchUSDCBalance();
    const targetBalance = await this.targetConnector.fetchUSDCBalance();

    this.logger.info("Checking for arbitrage opportunities...");
    this.logger.info(`${this.sourceConnector.name} USDC balance: ${sourceBalance}`);
    this.logger.info(`${this.targetConnector.name} USDC balance: ${targetBalance}`);

    let totalProfit = 0;
    // Check source exchange bids against target exchange asks
    for (const sourceBid of sourceOrderbook.bids) {
      for (const targetAsk of targetOrderbook.asks) {
        if (sourceBid.price > targetAsk.price) {
          const maxSizeByBalance = Math.min(
            sourceBalance / sourceBid.price,
            targetBalance / targetAsk.price
          );
          const size = Math.min(sourceBid.size, targetAsk.size, maxSizeByBalance);
          const profit = (1 - (sourceBid.price + targetAsk.price)) * size;
          if (profit > 0) {
            this.logger.info(`Opportunity: Buy ${size} NO tokens on ${this.targetConnector.name} at ${targetAsk.price} and BUY ${size} YES tokens on ${this.sourceConnector.name} at ${sourceBid.price}. Profit: ${profit}`);

            //Buy low in target exchange and sell high in source exchange -> ezpz
            if (await this.targetConnector.createFOKOrder(this.arbStrategyConfig.target.market_id, targetAsk.price, size, Side.BUY)) {
              this.logger.error("Error while placing sell order on source connector! Buy order was successful but sell order failed.");
            }
            else {
              const sellOrderStatus = await this.sourceConnector.createFOKOrder(this.arbStrategyConfig.source.market_id, sourceBid.price, size, Side.SELL);
              if (!sellOrderStatus) {
                this.logger.error("Error while placing sell order on source connector! Buy order was successful but sell order failed.");
              }
              else {
                this.logger.info(`SUCCESS!: Bought ${size} NO tokens on ${this.targetConnector.name} at ${targetAsk.price} and BUY ${size} YES tokens on ${this.sourceConnector.name} at ${sourceBid.price}. Profit: ${profit}`);
              }
            }

            totalProfit += profit;
          }
        }
      }
    }

    // Check target exchange bids against source exchange asks
    for (const targetBid of targetOrderbook.bids) {
      for (const sourceAsk of sourceOrderbook.asks) {
        if (targetBid.price > sourceAsk.price) {
          const maxSizeByBalance = Math.min(
            sourceBalance / sourceAsk.price,
            targetBalance / targetBid.price
          );
          const size = Math.min(targetBid.size, sourceAsk.size, maxSizeByBalance);
          const profit = (targetBid.price - sourceAsk.price) * size;
          if (profit > 0) {
            //Buy low in the source exchange and sell high in the target exchange -> ezpz
            totalProfit += profit;
            this.logger.info(`Opportunity: Buy ${size} on ${this.sourceConnector.name} at ${sourceAsk.price}, and sell on ${this.targetConnector.name} at ${targetBid.price}. Profit: ${profit}`);
            //Buy low in source exchange and sell high in target exchange -> ezpz
            if (await this.sourceConnector.createFOKOrder(this.arbStrategyConfig.source.market_id, sourceAsk.price, size, Side.SELL)) {
              this.logger.error("Error while placing sell order on source connector! Buy order was successful but sell order failed.");
            }
            else {
              const sellOrderStatus = await this.targetConnector.createFOKOrder(this.arbStrategyConfig.source.market_id, targetBid.price, size, Side.SELL);
              if (!sellOrderStatus) {
                this.logger.error("Error while placing sell order on source connector! Buy order was successful but sell order failed.");
              }
              else {
                this.logger.info(`Success! Bought ${size} on ${this.sourceConnector.name} at ${sourceAsk.price}, and sold on ${this.targetConnector.name} at ${targetBid.price}. Profit: ${profit}`);
              }
            }

          }
        }
      }
    }

    if (totalProfit == 0) {
      this.logger.info("No arbitrage opportunities found.");
      return;
    }

    else {
      this.logger.info(`Total potential profit: ${totalProfit}`);
    }
  }
}