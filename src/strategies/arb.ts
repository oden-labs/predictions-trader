import { PolymarketConnector } from "../connectors/polymarket/polymarket";
import { DriftConnector } from "../connectors/drift/drift";
import { Orderbook } from "../models/types";
import { Order } from "@drift-labs/sdk";

let polymarketConnector = new PolymarketConnector();
let driftConnector = new DriftConnector();

const driftMarketName = "TRUMP-WIN-2024-BET";
const polyMarketID = "21742633143463906290569050155826241533067272736897614950488156847949938836455";

async function initializeConnectors() {
  await polymarketConnector.init();
  await driftConnector.init();
}

async function checkArbitrage() {
  if (!polymarketConnector.isInitialized() || !driftConnector.isInitialized()) {
    console.log("Connectors not initialized yet. Waiting for initialization...");
    return;
  }
  const driftOrderbook: Orderbook = await driftConnector.fetchOrderbook(driftMarketName);
  const polymarketOrderbook: Orderbook = await polymarketConnector.fetchOrderbook(polyMarketID);

  console.log("Drift Orderbook: ", driftOrderbook);
  console.log("Polymarket Orderbook: ", polymarketOrderbook);

}

async function startArbCheck() {
  await initializeConnectors();
  setInterval(checkArbitrage, 3000);
}

startArbCheck();

