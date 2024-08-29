import { PolymarketConnector } from "../connectors/polymarket/polymarket";
import { DriftConnector } from "../connectors/drift/drift";
import { Orderbook, OrderLevel } from "../models/types";
import { ConfigService } from "../utils/ConfigService";
import { BaseConnector } from "../connectors/BaseConnector";
import { Logger } from "../utils/logger";

const configService = new ConfigService();
const logger = new Logger("Arbitrage");

let polymarketConnector = new PolymarketConnector(configService);
let driftConnector = new DriftConnector(configService);

const driftMarketName = "TRUMP-WIN-2024-BET";
const polyMarketYESToken = "21742633143463906290569050155826241533067272736897614950488156847949938836455";
const polyMarketNOToken = "48331043336612883890938759509493159234755048973500640148014422747788308965732";

async function initializeConnectors() {
  await polymarketConnector.init();
  await driftConnector.init();
}

async function checkArbitrage() {
  if (!polymarketConnector.isInitialized() || !driftConnector.isInitialized()) {
    logger.error("Connectors are not initialized yet. Waiting for initialization...");
    return;
  }
  const driftOrderbook: Orderbook = await driftConnector.fetchOrderbook(driftMarketName);
  const polymarketOrderbook: Orderbook = await polymarketConnector.fetchOrderbook(polyMarketYESToken);

  const driftBalance = await driftConnector.fetchUSDCBalance();
  const polymarketBalance = await polymarketConnector.fetchUSDCBalance();

  logger.info("Checking for arbitrage opportunities...");
  logger.info(`Drift balance: ${driftBalance} USDC`);
  logger.info(`Polymarket balance: ${polymarketBalance} USDC`);

  let totalProfit = 0;
  let driftCapitalRequired = 0;
  let polymarketCapitalRequired = 0;

  // Check Drift bids against Polymarket asks
  for (const driftBid of driftOrderbook.bids) {
    for (const polyAsk of polymarketOrderbook.asks) {
      if (driftBid.price > polyAsk.price) {
        const maxSizeByBalance = Math.min(
          driftBalance / driftBid.price,
          polymarketBalance / polyAsk.price
        );
        const size = Math.min(driftBid.size, polyAsk.size, maxSizeByBalance);
        const profit = (1 - (driftBid.price + polyAsk.price)) * size;
        if (profit > 0) {
          polymarketCapitalRequired += polyAsk.price * size;
          driftCapitalRequired += driftBid.price * size;
          totalProfit += profit;
          logger.info(`Opportunity: Buy ${size} NO tokens on Polymarket at ${polyAsk.price} and BUY ${size} YES tokens on Drift at ${driftBid.price}. Profit: ${profit}`);
        }
      }
    }
  }

  // Check Polymarket bids against Drift asks
  for (const polyBid of polymarketOrderbook.bids) {
    for (const driftAsk of driftOrderbook.asks) {
      if (polyBid.price > driftAsk.price) {
        const maxSizeByBalance = Math.min(
          driftBalance / driftAsk.price,
          polymarketBalance / polyBid.price
        );
        const size = Math.min(polyBid.size, driftAsk.size, maxSizeByBalance);
        const profit = (polyBid.price - driftAsk.price) * size;
        if (profit > 0) {
          driftCapitalRequired += driftAsk.price * size;
          polymarketCapitalRequired += polyBid.price * size; // Capital required for shorting on Polymarket
          totalProfit += profit;
          logger.info(`Opportunity: Long ${size} on Drift at ${driftAsk.price}, Short on Polymarket at ${polyBid.price}. Profit: ${profit}`);
        }
      }
    }
  }

  if (totalProfit == 0) {
    logger.info("No arbitrage opportunities found.");
    return;
  }

  else {
    logger.info(`Total potential profit: ${totalProfit}`);
    logger.info(`Capital required on Drift: ${driftCapitalRequired}`);
    logger.info(`Capital required on Polymarket: ${polymarketCapitalRequired}`);
    logger.info(`Total capital required: ${(driftCapitalRequired + polymarketCapitalRequired)}`);
    logger.info(`ROI: ${((totalProfit / (driftCapitalRequired + polymarketCapitalRequired)) * 100)}%`);
  }
}

async function startArbitrage() {
  await initializeConnectors();

  // Check Arbitrage every 3 seconds
  setInterval(checkArbitrage, 3000);
}

startArbitrage();