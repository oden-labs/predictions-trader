import { Orderbook, ArbStrategyConfig } from "../models/types";
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
    this.logger.info(`Drift balance: ${sourceBalance} USDC`);
    this.logger.info(`Polymarket balance: ${targetBalance} USDC`);

    let totalProfit = 0;
    let driftCapitalRequired = 0;
    let polymarketCapitalRequired = 0;

    // Check Drift bids against Polymarket asks
    for (const sourceBid of sourceOrderbook.bids) {
      for (const polyAsk of targetOrderbook.asks) {
        if (sourceBid.price > polyAsk.price) {
          const maxSizeByBalance = Math.min(
            sourceBalance / sourceBid.price,
            targetBalance / polyAsk.price
          );
          const size = Math.min(sourceBid.size, polyAsk.size, maxSizeByBalance);
          const profit = (1 - (sourceBid.price + polyAsk.price)) * size;
          if (profit > 0) {
            polymarketCapitalRequired += polyAsk.price * size;
            driftCapitalRequired += sourceBid.price * size;
            totalProfit += profit;
            this.logger.info(`Opportunity: Buy ${size} NO tokens on Polymarket at ${polyAsk.price} and BUY ${size} YES tokens on Drift at ${sourceBid.price}. Profit: ${profit}`);
          }
        }
      }
    }

    // Check Polymarket bids against Drift asks
    for (const polyBid of targetOrderbook.bids) {
      for (const driftAsk of sourceOrderbook.asks) {
        if (polyBid.price > driftAsk.price) {
          const maxSizeByBalance = Math.min(
            sourceBalance / driftAsk.price,
            targetBalance / polyBid.price
          );
          const size = Math.min(polyBid.size, driftAsk.size, maxSizeByBalance);
          const profit = (polyBid.price - driftAsk.price) * size;
          if (profit > 0) {
            driftCapitalRequired += driftAsk.price * size;
            polymarketCapitalRequired += polyBid.price * size; // Capital required for shorting on Polymarket
            totalProfit += profit;
            this.logger.info(`Opportunity: Long ${size} on Drift at ${driftAsk.price}, Short on Polymarket at ${polyBid.price}. Profit: ${profit}`);
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
      this.logger.info(`Capital required on Drift: ${driftCapitalRequired}`);
      this.logger.info(`Capital required on Polymarket: ${polymarketCapitalRequired}`);
      this.logger.info(`Total capital required: ${(driftCapitalRequired + polymarketCapitalRequired)}`);
      this.logger.info(`ROI: ${((totalProfit / (driftCapitalRequired + polymarketCapitalRequired)) * 100)}%`);
    }
  }
}