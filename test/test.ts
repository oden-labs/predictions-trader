import { PolymarketConnector } from "../src/connectors/polymarket/polymarket";
import { DriftConnector } from "../src/connectors/drift/drift";
import { ConfigService } from "../src/utils/ConfigService";
import { Side } from "../src/models/types";
const configService = new ConfigService();

async function testPolymarket() {
  const polymarketConnector = new PolymarketConnector(configService);
  await polymarketConnector.init();
  await polymarketConnector.createLimitOrder("21742633143463906290569050155826241533067272736897614950488156847949938836455", 0.01, 5, Side.BUY);
  await polymarketConnector.fetchUSDCBalance();
}

async function testDrift() {
  const driftConnector = new DriftConnector(configService);
  await driftConnector.init();
  await driftConnector.createLimitOrder("TRUMP-WIN-2024-BET", 0.01, 4, Side.BUY);
  console.log(await driftConnector.fetchUSDCBalance());
}

testPolymarket();
testDrift();