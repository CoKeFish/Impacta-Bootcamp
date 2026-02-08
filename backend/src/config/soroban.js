const {rpc} = require('@stellar/stellar-sdk');

const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(rpcUrl);

const CONTRACT_ID = process.env.CONTRACT_ID;
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

// Valid Ed25519 public key used as source account for read-only simulations.
// Does not need to exist on-chain — simulateTransaction never submits to the network.
const SIMULATION_SOURCE = 'GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH';

module.exports = {server, CONTRACT_ID, NETWORK_PASSPHRASE, SIMULATION_SOURCE};
