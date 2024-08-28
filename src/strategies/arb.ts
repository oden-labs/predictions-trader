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
  
  let totalProfit = 0;
  let driftCapitalRequired = 0;
  let polymarketCapitalRequired = 0;

  // Check Drift bids against Polymarket asks
  for (const driftBid of driftOrderbook.bids) {
    for (const polyAsk of polymarketOrderbook.asks) {
      if (driftBid.price > polyAsk.price) {
        const size = Math.min(driftBid.size, polyAsk.size);
        const profit = (1 - (driftBid.price + polyAsk.price)) * size;
        polymarketCapitalRequired += polyAsk.price * size;
        driftCapitalRequired += driftBid.price * size;
        totalProfit += profit;
        logger.info(`Opportunity: Buy NO ${size} on Polymarket at ${polyAsk.price}, Short on Drift at ${driftBid.price}. Profit: ${profit}`);
      }
    }
  }

  // Check Polymarket bids against Drift asks
  for (const polyBid of polymarketOrderbook.bids) {
    for (const driftAsk of driftOrderbook.asks) {
      if (polyBid.price > driftAsk.price) {
        const size = Math.min(polyBid.size, driftAsk.size);
        const profit = (polyBid.price - driftAsk.price) * size;
        driftCapitalRequired += driftAsk.price * size;
        polymarketCapitalRequired += polyBid.price * size; // Capital required for shorting on Polymarket
        totalProfit += profit;
        logger.info(`Opportunity: Long ${size} on Drift at ${driftAsk.price}, Short on Polymarket at ${polyBid.price}. Profit: ${profit}`);
      }
    }
  }

  console.log(`Total potential profit: ${totalProfit.toFixed(4)}`);
  console.log(`Capital required on Drift: ${driftCapitalRequired.toFixed(4)}`);
  console.log(`Capital required on Polymarket: ${polymarketCapitalRequired.toFixed(4)}`);
  console.log(`Total capital required: ${(driftCapitalRequired + polymarketCapitalRequired)}`);
  console.log(`ROI: ${((totalProfit / (driftCapitalRequired + polymarketCapitalRequired)) * 100)}%`);
}


async function fetchBalance(connector: BaseConnector) {
  console.log("USDCe Balance: " + await connector.fetchUSDCBalance());
}

async function startArbitrage() {
  await initializeConnectors();
}

startArbitrage();