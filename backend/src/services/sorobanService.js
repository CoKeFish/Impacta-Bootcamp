const {
    Contract,
    TransactionBuilder,
    SorobanRpc,
    Address,
    nativeToScVal,
    scValToNative,
    Account,
} = require('@stellar/stellar-sdk');
const { server, CONTRACT_ID, NETWORK_PASSPHRASE } = require('../config/soroban');

// Dummy source for read-only simulations (does not need to exist on-chain)
const DUMMY_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

// Convert BigInt values to strings for JSON serialization
function sanitize(obj) {
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(sanitize);
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, sanitize(v)])
        );
    }
    return obj;
}

// Execute a read-only contract call via simulation
async function callReadOnly(functionName, args = []) {
    const contract = new Contract(CONTRACT_ID);
    const account = new Account(DUMMY_SOURCE, '0');

    const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(functionName, ...args))
        .setTimeout(30)
        .build();

    const simResult = await server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
        throw new Error(`Simulation failed: ${simResult.error}`);
    }

    const retval = simResult.result?.retval;
    return retval ? sanitize(scValToNative(retval)) : null;
}

// Submit a signed XDR transaction and wait for confirmation
async function submitTx(signedXdr) {
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const sendResult = await server.sendTransaction(tx);

    if (sendResult.status === 'ERROR') {
        throw new Error(`sendTransaction failed: ${JSON.stringify(sendResult.errorResult)}`);
    }

    // Poll for confirmation
    const hash = sendResult.hash;
    let getResult;
    for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        getResult = await server.getTransaction(hash);
        if (getResult.status !== 'NOT_FOUND') break;
    }

    if (!getResult || getResult.status === 'NOT_FOUND') {
        throw new Error(`Transaction ${hash} not confirmed after 30s`);
    }

    if (getResult.status === 'FAILED') {
        throw new Error(`Transaction ${hash} failed`);
    }

    // Extract return value if any
    let returnValue = null;
    if (getResult.returnValue) {
        returnValue = sanitize(scValToNative(getResult.returnValue));
    }

    return {
        hash,
        ledger: getResult.ledger,
        returnValue,
    };
}

module.exports = {
    // Read-only contract queries
    async getTripCount() {
        return callReadOnly('get_trip_count');
    },

    async getAllTrips() {
        return callReadOnly('get_trips');
    },

    async getTripInfo(tripId) {
        return callReadOnly('get_trip', [
            nativeToScVal(tripId, { type: 'u64' }),
        ]);
    },

    async getTripState(tripId) {
        return callReadOnly('get_state', [
            nativeToScVal(tripId, { type: 'u64' }),
        ]);
    },

    async getBalance(tripId, walletAddress) {
        return callReadOnly('get_balance', [
            nativeToScVal(tripId, { type: 'u64' }),
            new Address(walletAddress).toScVal(),
        ]);
    },

    async getParticipants(tripId) {
        return callReadOnly('get_participants', [
            nativeToScVal(tripId, { type: 'u64' }),
        ]);
    },

    // Submit signed XDR
    submitTx,
    sanitize,
};
