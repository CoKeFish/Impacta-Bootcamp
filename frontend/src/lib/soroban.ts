/**
 * Soroban transaction builder utilities.
 *
 * Flow: build unsigned tx → simulate → assemble → sign with Freighter → return signed XDR.
 * The backend then submits the signed XDR to the Soroban RPC.
 */
import {Address, Contract, nativeToScVal, Networks, SorobanRpc, TransactionBuilder, xdr,} from '@stellar/stellar-sdk';
import {signTransaction} from '@stellar/freighter-api';

// ─── Config ─────────────────────────────────────────────────────────────────

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const SOROBAN_RPC_URL =
    import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
    import.meta.env.VITE_NETWORK_PASSPHRASE || Networks.TESTNET;
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || '';
const XLM_SAC_ADDRESS = import.meta.env.VITE_XLM_SAC_ADDRESS || '';

const DEV_MOCK_XDR = 'AAAAAgAAAADEV_MOCK_SIGNED_XDR_FOR_TESTING_ONLY';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert user-facing XLM amount to stroops (7 decimal places → i128). */
export function xlmToStroops(amount: number | string): bigint {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return BigInt(Math.round(num * 10_000_000));
}

/** Convert stroops back to user-facing XLM string. */
export function stroopsToXlm(stroops: bigint): string {
    const num = Number(stroops) / 10_000_000;
    return num.toFixed(7);
}

/** Encode a Recipient struct {address: Address, amount: i128} as ScVal. */
function recipientToScVal(address: string, amount: bigint): xdr.ScVal {
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

// ─── Core transaction builder ───────────────────────────────────────────────

/**
 * Build, simulate, and assemble a contract call transaction.
 * Returns the unsigned XDR string ready for Freighter signing.
 */
async function buildContractTx(
    callerAddress: string,
    method: string,
    args: xdr.ScVal[],
): Promise<string> {
    // Dev mode: return mock XDR without hitting Soroban RPC
    if (DEV_MODE) {
        console.info(`[DevMode] Mock buildContractTx: ${method}(${callerAddress.slice(0, 8)}...)`);
        return DEV_MOCK_XDR;
    }

    if (!CONTRACT_ID) {
        throw new Error(
            'Contract ID not configured. Set VITE_CONTRACT_ID in your environment.',
        );
    }

    const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
    const account = await server.getAccount(callerAddress);
    const contract = new Contract(CONTRACT_ID);

    const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(method, ...args))
        .setTimeout(60)
        .build();

    const simulated = await server.simulateTransaction(transaction);

    if (SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(
            `Simulation failed: ${JSON.stringify(simulated.error)}`,
        );
    }

    const prepared = SorobanRpc.assembleTransaction(
        transaction,
        simulated,
    ).build();

    return prepared.toXDR();
}

// ─── Sign with Freighter ────────────────────────────────────────────────────

/**
 * Sign an XDR transaction string with Freighter wallet.
 * Returns the signed XDR.
 */
export async function signWithFreighter(
    unsignedXdr: string,
    walletAddress: string,
): Promise<string> {
    // Dev mode: skip Freighter, return XDR as-is (mock signed)
    if (DEV_MODE) {
        console.info(`[DevMode] Mock signWithFreighter for ${walletAddress.slice(0, 8)}...`);
        return unsignedXdr;
    }

    const result = await signTransaction(unsignedXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress,
    });

    if (result.error) {
        throw new Error(
            result.error.message || 'Failed to sign transaction with Freighter',
        );
    }

    return result.signedTxXdr;
}

// ─── Contract operations ────────────────────────────────────────────────────

/**
 * Build create_invoice transaction (links an off-chain invoice to the contract).
 */
export async function buildCreateInvoiceTx(params: {
    organizer: string;
    targetAmount: bigint;
    minParticipants: number;
    deadline: number; // Unix timestamp in seconds
    penaltyPercent: number;
    recipients: Array<{ address: string; amount: bigint }>;
    autoRelease: boolean;
}): Promise<string> {
    const tokenAddress = XLM_SAC_ADDRESS;
    if (!tokenAddress) {
        throw new Error(
            'Token SAC address not configured. Set VITE_XLM_SAC_ADDRESS in your environment.',
        );
    }

    const args = [
        new Address(params.organizer).toScVal(),                             // organizer
        new Address(tokenAddress).toScVal(),                                 // token
        nativeToScVal(params.targetAmount, {type: 'i128'}),                  // target_amount
        nativeToScVal(params.minParticipants, {type: 'u32'}),                // min_participants
        nativeToScVal(BigInt(params.deadline), {type: 'u64'}),               // deadline
        nativeToScVal(params.penaltyPercent, {type: 'u32'}),                 // penalty_percent
        xdr.ScVal.scvVec(                                                    // recipients
            params.recipients.map((r) => recipientToScVal(r.address, r.amount)),
        ),
        nativeToScVal(params.autoRelease, {type: 'bool'}),                   // auto_release
    ];

    return buildContractTx(params.organizer, 'create_invoice', args);
}

/**
 * Build contribute transaction.
 */
export async function buildContributeTx(params: {
    tripId: number;
    participant: string;
    amount: bigint;
}): Promise<string> {
    const args = [
        nativeToScVal(BigInt(params.tripId), {type: 'u64'}),     // trip_id
        new Address(params.participant).toScVal(),                // participant
        nativeToScVal(params.amount, {type: 'i128'}),            // amount
    ];

    return buildContractTx(params.participant, 'contribute', args);
}

/**
 * Build withdraw transaction.
 */
export async function buildWithdrawTx(params: {
    tripId: number;
    participant: string;
}): Promise<string> {
    const args = [
        nativeToScVal(BigInt(params.tripId), {type: 'u64'}),     // trip_id
        new Address(params.participant).toScVal(),                // participant
    ];

    return buildContractTx(params.participant, 'withdraw', args);
}

/**
 * Build confirm_release transaction.
 */
export async function buildConfirmReleaseTx(params: {
    tripId: number;
    participant: string;
}): Promise<string> {
    const args = [
        nativeToScVal(BigInt(params.tripId), {type: 'u64'}),     // trip_id
        new Address(params.participant).toScVal(),                // participant
    ];

    return buildContractTx(params.participant, 'confirm_release', args);
}

/**
 * Build release transaction (organizer only).
 */
export async function buildReleaseTx(params: {
    tripId: number;
    organizer: string;
}): Promise<string> {
    const args = [
        nativeToScVal(BigInt(params.tripId), {type: 'u64'}),     // trip_id
    ];

    return buildContractTx(params.organizer, 'release', args);
}

/**
 * Build update_recipients transaction (organizer only).
 */
export async function buildUpdateRecipientsTx(params: {
    tripId: number;
    organizer: string;
    recipients: Array<{ address: string; amount: bigint }>;
}): Promise<string> {
    const args = [
        nativeToScVal(BigInt(params.tripId), {type: 'u64'}),     // trip_id
        xdr.ScVal.scvVec(                                        // new_recipients
            params.recipients.map((r) => recipientToScVal(r.address, r.amount)),
        ),
    ];

    return buildContractTx(params.organizer, 'update_recipients', args);
}

/**
 * Build cancel transaction (organizer only).
 */
export async function buildCancelTx(params: {
    tripId: number;
    organizer: string;
}): Promise<string> {
    const args = [
        nativeToScVal(BigInt(params.tripId), {type: 'u64'}),     // trip_id
    ];

    return buildContractTx(params.organizer, 'cancel', args);
}

/**
 * Build claim_deadline transaction (anyone can call).
 */
export async function buildClaimDeadlineTx(params: {
    tripId: number;
    caller: string;
}): Promise<string> {
    const args = [
        nativeToScVal(BigInt(params.tripId), {type: 'u64'}),     // trip_id
    ];

    return buildContractTx(params.caller, 'claim_deadline', args);
}

// ─── High-level helpers ─────────────────────────────────────────────────────

/**
 * Build + sign a contract operation in one step.
 * Returns the signed XDR ready for the backend.
 */
export async function buildAndSign(
    buildFn: () => Promise<string>,
    walletAddress: string,
): Promise<string> {
    const unsignedXdr = await buildFn();
    return signWithFreighter(unsignedXdr, walletAddress);
}
