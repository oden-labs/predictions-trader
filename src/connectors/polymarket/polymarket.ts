import { ethers } from "ethers";
import { ApiKeyCreds, Chain, ClobClient, OrderType, Side } from "@polymarket/clob-client";
import dotenv from 'dotenv';
import path from 'path';
import { POLYMARKET_HOST } from "../../constants";

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

//Load enviornment variables
const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
if (!privateKey) {
    throw new Error("Private key not found in environment variables");
}

const proxyAddress = process.env.POLYMARKET_PROXY_WALLET;
if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS not found in environment variables");
}

//Initialize the wallet
const wallet = new ethers.Wallet(privateKey);
console.log("Initialized Ethereum wallet with address: " + wallet.address);

//Polymarket Setup
let creds: ApiKeyCreds;
let clobClient: ClobClient;

let isInitialized: boolean = false;

async function init() {
    console.log("Fetching  API creds from Polymarket...");
    clobClient = new ClobClient(POLYMARKET_HOST, Chain.POLYGON, wallet, undefined, 2, proxyAddress);
    await setSecrets();
    console.log("Successfully fetched API creds from Polymarket");
    clobClient = new ClobClient(POLYMARKET_HOST, Chain.POLYGON, wallet, creds, 2, proxyAddress);
    isInitialized = true;
}

init();

async function setSecrets() {
    const resp = await clobClient.createOrDeriveApiKey();
    creds.key = resp.key;
    creds.secret = resp.secret;
    creds.passphrase = resp.passphrase;
    console.log(creds);
    console.log(`Complete!`);
}


async function getTrades() {
    const resp = await clobClient.getTrades();
    console.log(resp);
}

export async function fetchOrderbook(tokenID: string) {
    try {
        const resp = await clobClient.getOrderBook(tokenID);
        console.log("Orderbook: ", resp);
        return resp;
    } catch (error) {
        console.error("Failed to fetch orderbook from Polymarket", error);
        throw new Error("Failed to fetch orderbook");
    }
}

export async function createGTCOrder(tokenID: string, amount: number, price: number, side: Side, isNegRisk: boolean) {
    try {
        console.log("Creating order with amount:", amount, "and price:", price);

        const order = await clobClient.createOrder({
            tokenID,
            price,
            side,
            size: amount,
            expiration: 0,
        },
            {
                negRisk: isNegRisk
            });

        console.log("Created Order", order);

        const resp = await clobClient.postOrder(order, OrderType.GTC);
        console.log(resp);

        return resp;
    } catch (error) {
        console.error("Failed to create order on Polymarket", error);
        return { success: false, errorMsg: "Internal server error" };
    }
}

export async function createFOKOrder(tokenID: string, amount: number, price: number, side: Side, isNegRisk: boolean) {
    try {
        const order = await clobClient.createOrder({
            tokenID,
            price,
            side,
            size: amount,
            expiration: 0,
        },
            {
                negRisk: isNegRisk
            }
        );

        console.log("Created Order", order);

        const resp = await clobClient.postOrder(order, OrderType.FOK);
        console.log(resp);

        return resp;
    } catch (error) {
        console.error("Failed to create order on Polymarket", error);
        return { success: false, errorMsg: "Internal server error" };
    }
}
