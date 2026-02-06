const { SorobanRpc } = require('@stellar/stellar-sdk');

const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const server = new SorobanRpc.Server(rpcUrl);

const CONTRACT_ID = process.env.CONTRACT_ID;
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const NATIVE_TOKEN_ID = process.env.NATIVE_TOKEN_ID;

module.exports = { server, CONTRACT_ID, NETWORK_PASSPHRASE, NATIVE_TOKEN_ID };
