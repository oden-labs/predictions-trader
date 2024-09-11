import { PolymarketConnector } from '../../src/connectors/polymarket/polymarket';
import { ConfigService } from '../../src/utils/ConfigService';
import { Order, Side } from '../../src/models/types';

describe('PolymarketConnector', () => {
  let polymarketConnector: PolymarketConnector;
  let configService: ConfigService;
  const marketId = 'will-donald-trump-win-the-2024-us-presidential-election';
  const price = 0.01;
  const size = 5;
  const side = Side.BUY;
  let openOrders: Order[];


  beforeAll(async () => {
    configService = new ConfigService();
    polymarketConnector = new PolymarketConnector(configService, 'Polymarket');
    await polymarketConnector.init();
  });

  test('should register a market successfully', async () => {
    await expect(polymarketConnector.registerMarket(marketId)).resolves.not.toThrow();
  });

  test('should fetch orderbook', async () => {
    const orderbook = await polymarketConnector.fetchOrderbook(marketId);
    expect(orderbook).toHaveProperty('bids');
    expect(orderbook).toHaveProperty('asks');
  });

  test('should create multiple limit orders', async () => {
    let result = await polymarketConnector.createLimitOrder(marketId, price, size, side);
    expect(result).toBe(true);
    result = await polymarketConnector.createLimitOrder(marketId, price, size, side);
    expect(result).toBe(true);
    result = await polymarketConnector.createLimitOrder(marketId, price, size, side);
    expect(result).toBe(true);
    result = await polymarketConnector.createLimitOrder(marketId, price, size, side);
    expect(result).toBe(true);
    result = await polymarketConnector.createLimitOrder(marketId, price, size, side);
    expect(result).toBe(true);

  });

  test('should fetch USDC balance', async () => {
    const balance = await polymarketConnector.fetchUSDCBalance();
    expect(typeof balance).toBe('number');
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  test('should fetch open orders', async () => {
    openOrders = await polymarketConnector.fetchOpenOrders();
    expect(Array.isArray(openOrders)).toBe(true);
  });

  test('should cancel an order', async () => {
    const orderId = openOrders[0].id;
    const result = await polymarketConnector.cancelOrder(orderId);
    expect(result).toBe(true);
    openOrders = openOrders.filter(order => order.id !== orderId);
  });


  test('should cancel multiple orders', async () => {
    const orderIds = openOrders.slice(0, 3).map(order => order.id);
    const results = await polymarketConnector.cancelMultipleOrders(orderIds);
    expect(typeof results).toBe('object');
    orderIds.forEach(id => {
      expect(results).toHaveProperty(id);
      expect(results[id]).toBe(true);
    });
    openOrders = openOrders.filter(order => !orderIds.includes(order.id));
  });



  test('should cancel market orders', async () => {
    const results = await polymarketConnector.cancelOrdersOfMarket(marketId);
    expect(typeof results).toBe('object');
    Object.values(results).forEach(value => {
      expect(typeof value).toBe(true);
    });
  });

});
