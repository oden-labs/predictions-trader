import { Connection, Keypair } from "@solana/web3.js";
import { Wallet, MainnetPerpMarkets, DriftClient, OrderType, PositionDirection } from "@drift-labs/sdk";
import dotenv from 'dotenv';
import path from 'path';
import bs58 from 'bs58';
import { DRIFT_HOST } from '../../constants'
import axios from 'axios';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

//Load enviornment variables
const connection = new Connection(process.env.SOLANA_RPC_URL || "");
const solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY;

//Ensure environment variables are set
if (!solanaPrivateKey || connection === null) {
    throw new Error('Private key or RPC URL not found in the env file');
}

//Initialize the wallet
const privateKeyBuffer = bs58.decode(solanaPrivateKey);
const keypair = Keypair.fromSecretKey(privateKeyBuffer);
const wallet = new Wallet(keypair);
console.log("Initialized Solana wallet with public key: " + wallet.publicKey);
let isInitialized: boolean = false;


//Initialize the Drift Client
const driftClient = new DriftClient({
    connection,
    wallet,
    env: 'mainnet-beta',
    accountSubscription: {
        type: 'websocket',
    }
});


async function init() {
    console.log("Subscribing to Drift...");
    await driftClient.subscribe();
    isInitialized = true;
    console.log("Subscribed to Drift!");
}



//Functions to interact with the Drift API

function getMarketIndex(symbol: string): number | undefined {
    const market = MainnetPerpMarkets.find(market => market.symbol === symbol);
    return market ? market.marketIndex : undefined;
}

init();


export async function getOrderbook(marketName: string) {
    const depth = 10;
    const url = `${DRIFT_HOST}l2?marketName=${marketName}&depth=${depth}`;

    try {
        const response = await axios.get(url);
        const l2Orderbook = response.data;

        console.log(`L2 Orderbook for ${marketName}:`, l2Orderbook);
        return l2Orderbook;
    } catch (error) {
        console.error('Error fetching orderbook:', error);
        throw error;
    }
}

async function placeLimitOrder(marketName: string, side: PositionDirection, price: number, size: number) {
    if (!isInitialized) {
        console.log("Cannot create orders as Drift is not initialized yet.");
        return;
    }
    const marketIndex = getMarketIndex(marketName);
    if (!marketIndex) {
        console.log(`Market ${marketName} not found.`);
        return;
    }

    const orderParams = {
        orderType: OrderType.LIMIT,
        marketIndex: marketIndex,
        direction: side,
        baseAssetAmount: driftClient.convertToPerpPrecision(size),
        price: driftClient.convertToPricePrecision(price),
    }
    const txHash = await driftClient.placePerpOrder(orderParams);
    console.log("Order placed on DRIFT for market: ", marketName, "with price: ", price, "and size: ", size, ".  Transaction hash: ", txHash);;
}
