'use strict';

/**
 * Stellar/Soroban utilities for E2E integration tests.
 *
 * Provides: keypair generation, Friendbot funding, contract deployment via SDK,
 * and transaction builders for every contract operation (ported from frontend/src/lib/soroban.ts).
 */

const {
    Keypair, rpc: SorobanRpc, TransactionBuilder,
    xdr, Address, Contract, nativeToScVal, StrKey, Operation,
} = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

// ─── Constants ───────────────────────────────────────────────────────────────

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const NATIVE_TOKEN_SAC = process.env.NATIVE_TOKEN_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// ─── Singleton RPC Server ────────────────────────────────────────────────────

let _server;

function getServer() {
    if (!_server) _server = new SorobanRpc.Server(RPC_URL);
    return _server;
}

// ─── Keypair helpers ─────────────────────────────────────────────────────────

function generateKeypair() {
    return Keypair.random();
}

/**
 * Fund an account via Stellar Testnet Friendbot.
 * Each call gives the account 10 000 XLM.
 */
function fundAccount(publicKey) {
    return new Promise((resolve, reject) => {
        https.get(`${FRIENDBOT_URL}?addr=${publicKey}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`Friendbot ${res.statusCode} for ${publicKey.slice(0, 12)}…: ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}

// ─── Conversion helpers ──────────────────────────────────────────────────────

/** XLM (number) → stroops (BigInt).  1 XLM = 10 000 000 stroops. */
function xlmToStroops(amount) {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return BigInt(Math.round(num * 10_000_000));
}

function stroopsToXlm(stroops) {
    return (Number(stroops) / 10_000_000).toFixed(7);
}

// ─── Low-level Soroban transaction submit ────────────────────────────────────

/**
 * Build a Soroban transaction from a single Operation, simulate, assemble,
 * sign with `keypair`, submit, and poll until confirmed.
 * Returns the full getTransaction result.
 */
async function submitSorobanOp(keypair, operation) {
    const server = getServer();
    const account = await server.getAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
        fee: '10000000',
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(operation)
        .setTimeout(300)
        .build();

    const sim = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
        throw new Error(`Simulation error: ${JSON.stringify(sim.error)}`);
    }

    const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
    prepared.sign(keypair);

    const sendResult = await server.sendTransaction(prepared);
    if (sendResult.status === 'ERROR') {
        throw new Error(`sendTransaction error: ${JSON.stringify(sendResult.errorResult)}`);
    }

    // Poll for confirmation (up to 60 s)
    const hash = sendResult.hash;
    let result;
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        result = await server.getTransaction(hash);
        if (result.status !== 'NOT_FOUND') break;
    }

    if (!result || result.status === 'NOT_FOUND') {
        throw new Error(`Transaction ${hash} not confirmed after 60 s`);
    }
    if (result.status === 'FAILED') {
        throw new Error(`Transaction ${hash} failed on-chain`);
    }

    return result;
}

// ─── Contract deployment via SDK ─────────────────────────────────────────────

/**
 * Deploy a fresh Soroban contract to testnet.
 *
 * 1. Upload WASM bytes  →  gets stored, hash = SHA-256(wasm)
 * 2. Deploy an instance  →  contract ID computed deterministically from deployer+salt
 *
 * @param {Keypair} adminKeypair  – funded account that pays for deploy
 * @param {string}  wasmPath      – absolute path to the compiled .wasm file
 * @returns {string} contract ID (C… address)
 */
async function deployContract(adminKeypair, wasmPath) {
    const wasmBuffer = fs.readFileSync(wasmPath);
    const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest();

    // ── Step 1: upload WASM ──────────────────────────────────────────────
    console.log('  Uploading WASM to testnet…');
    const uploadOp = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasmBuffer),
        auth: [],
    });
    await submitSorobanOp(adminKeypair, uploadOp);
    console.log('  WASM uploaded');

    // ── Step 2: deploy contract instance ─────────────────────────────────
    console.log('  Creating contract instance…');
    const salt = crypto.randomBytes(32);

    const idPreimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
            address: new Address(adminKeypair.publicKey()).toScAddress(),
            salt,
        }),
    );

    // Build the deploy operation — try V2 (Protocol 22+) first, fall back to V1
    let deployOp;
    if (xdr.CreateContractArgsV2) {
        deployOp = Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeCreateContractV2(
                new xdr.CreateContractArgsV2({
                    contractIdPreimage: idPreimage,
                    executable: xdr.ContractExecutable.contractExecutableWasm(wasmHash),
                    constructorArgs: [],
                }),
            ),
            auth: [],
        });
    } else {
        deployOp = Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeCreateContract(
                new xdr.CreateContractArgs({
                    contractIdPreimage: idPreimage,
                    executable: xdr.ContractExecutable.contractExecutableWasm(wasmHash),
                }),
            ),
            auth: [],
        });
    }

    await submitSorobanOp(adminKeypair, deployOp);

    // Compute contract ID deterministically: SHA-256(HashIdPreimage::ContractId)
    const networkId = crypto.createHash('sha256')
        .update(Buffer.from(NETWORK_PASSPHRASE))
        .digest();

    const contractIdPreimage = xdr.HashIdPreimage.envelopeTypeContractId(
        new xdr.HashIdPreimageContractId({networkId, contractIdPreimage: idPreimage}),
    );

    const contractIdHash = crypto.createHash('sha256')
        .update(contractIdPreimage.toXDR())
        .digest();

    const contractId = StrKey.encodeContract(contractIdHash);
    console.log(`  Contract deployed: ${contractId}`);
    return contractId;
}

// ─── Contract transaction builders ───────────────────────────────────────────

/** Encode a Soroban Recipient struct {address, amount} as ScVal. */
function recipientToScVal(address, amount) {
    return xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('address'),
            val: new Address(address).toScVal(),
        }),
        new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('amount'),
            val: nativeToScVal(amount, {type: 'i128'}),
        }),
    ]);
}

/**
 * Build, simulate, assemble, and **sign** a contract-call transaction.
 * Returns the signed XDR (base64 string) ready for the backend's `submitTx`.
 */
async function buildAndSignContractTx(callerKeypair, contractId, method, args) {
    const server = getServer();
    const account = await server.getAccount(callerKeypair.publicKey());
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
        fee: '10000000',
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(method, ...args))
        .setTimeout(300)
        .build();

    const sim = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
        throw new Error(`Simulation failed for ${method}: ${JSON.stringify(sim.error)}`);
    }

    const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
    prepared.sign(callerKeypair);

    return prepared.toXDR();
}

// ─── High-level builders (one per contract function) ─────────────────────────

async function buildCreateInvoiceTx(organizerKeypair, contractId, params) {
    const args = [
        new Address(organizerKeypair.publicKey()).toScVal(),       // organizer
        new Address(NATIVE_TOKEN_SAC).toScVal(),                   // token
        nativeToScVal(params.targetAmount, {type: 'i128'}),        // target_amount
        nativeToScVal(params.minParticipants, {type: 'u32'}),      // min_participants
        nativeToScVal(BigInt(params.deadline), {type: 'u64'}),     // deadline
        nativeToScVal(params.penaltyPercent, {type: 'u32'}),       // penalty_percent
        xdr.ScVal.scvVec(                                          // recipients
            params.recipients.map(r => recipientToScVal(r.address, r.amount)),
        ),
        nativeToScVal(params.autoRelease, {type: 'bool'}),         // auto_release
    ];
    return buildAndSignContractTx(organizerKeypair, contractId, 'create_invoice', args);
}

async function buildContributeTx(participantKeypair, contractId, tripId, amountStroops) {
    const args = [
        nativeToScVal(BigInt(tripId), {type: 'u64'}),
        new Address(participantKeypair.publicKey()).toScVal(),
        nativeToScVal(amountStroops, {type: 'i128'}),
    ];
    return buildAndSignContractTx(participantKeypair, contractId, 'contribute', args);
}

async function buildWithdrawTx(participantKeypair, contractId, tripId) {
    const args = [
        nativeToScVal(BigInt(tripId), {type: 'u64'}),
        new Address(participantKeypair.publicKey()).toScVal(),
    ];
    return buildAndSignContractTx(participantKeypair, contractId, 'withdraw', args);
}

async function buildReleaseTx(organizerKeypair, contractId, tripId) {
    const args = [nativeToScVal(BigInt(tripId), {type: 'u64'})];
    return buildAndSignContractTx(organizerKeypair, contractId, 'release', args);
}

async function buildCancelTx(organizerKeypair, contractId, tripId) {
    const args = [nativeToScVal(BigInt(tripId), {type: 'u64'})];
    return buildAndSignContractTx(organizerKeypair, contractId, 'cancel', args);
}

async function buildConfirmReleaseTx(participantKeypair, contractId, tripId) {
    const args = [
        nativeToScVal(BigInt(tripId), {type: 'u64'}),
        new Address(participantKeypair.publicKey()).toScVal(),
    ];
    return buildAndSignContractTx(participantKeypair, contractId, 'confirm_release', args);
}

async function buildUpdateRecipientsTx(organizerKeypair, contractId, tripId, recipients) {
    const args = [
        nativeToScVal(BigInt(tripId), {type: 'u64'}),
        xdr.ScVal.scvVec(
            recipients.map(r => recipientToScVal(r.address, r.amount)),
        ),
    ];
    return buildAndSignContractTx(organizerKeypair, contractId, 'update_recipients', args);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    // Keypair / account
    generateKeypair,
    fundAccount,
    // Conversions
    xlmToStroops,
    stroopsToXlm,
    // RPC
    getServer,
    // Deployment
    deployContract,
    // Transaction builders
    buildAndSignContractTx,
    buildCreateInvoiceTx,
    buildContributeTx,
    buildWithdrawTx,
    buildReleaseTx,
    buildCancelTx,
    buildConfirmReleaseTx,
    buildUpdateRecipientsTx,
    recipientToScVal,
    // Constants
    NATIVE_TOKEN_SAC,
    NETWORK_PASSPHRASE,
};
