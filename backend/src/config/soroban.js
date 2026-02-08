const {rpc} = require('@stellar/stellar-sdk');

const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(rpcUrl);

const CONTRACT_ID = process.env.CONTRACT_ID;
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

module.exports = {server, CONTRACT_ID, NETWORK_PASSPHRASE};
