import { PolymarketConnector } from "../src/connectors/polymarket/polymarket";
import { DriftConnector } from "../src/connectors/drift/drift";

async function testPolymarket()
{
  const polymarketConnector = new PolymarketConnector();
  await polymarketConnector.init();
  await polymarketConnector.getTrades();
}

async function testDrift()
{
  const driftConnector = new DriftConnector();
  await driftConnector.init();
  await driftConnector.placeLimitOrder("TRUMP-WIN-2024-BET", 0.1, 4); 
}

testPolymarket();
testDrift();