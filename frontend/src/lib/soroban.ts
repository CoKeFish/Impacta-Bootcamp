/**
 * Soroban transaction builder utilities.
 *
 * Flow: build unsigned tx → simulate → assemble → sign with Freighter → return signed XDR.
 * The backend then submits the signed XDR to the Soroban RPC.
 */
import {
    Address,
    Contract,
    nativeToScVal,
    Networks,
    rpc as SorobanRpc,
    TransactionBuilder,
    xdr,
} from '@stellar/stellar-sdk';
import {signTransaction} from '@stellar/freighter-api';

// ─── Config ─────────────────────────────────────────────────────────────────

const SOROBAN_RPC_URL =
    import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
    import.meta.env.VITE_NETWORK_PASSPHRASE || Networks.TESTNET;
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || '';
const XLM_SAC_ADDRESS = import.meta.env.VITE_XLM_SAC_ADDRESS || '';

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

// ─── Soroban error parser ───────────────────────────────────────────────────

/**
 * Known contract panic messages → user-friendly error keys.
 * The contract panics with these exact strings; we match substrings.
 */
const CONTRACT_ERROR_MAP: Array<[RegExp, string]> = [
    // Status checks
    [/Cannot release: escrow not completed/i, 'soroban.errorNotCompleted'],
    [/Escrow is not accepting contributions/i, 'soroban.errorNotFunding'],
    [/Cannot withdraw in current status/i, 'soroban.errorCannotWithdraw'],
    [/Cannot cancel: already finalized/i, 'soroban.errorAlreadyFinalized'],
    [/Pool is not in Completed status/i, 'soroban.errorNotCompleted'],
    [/Pool uses auto-release/i, 'soroban.errorAutoRelease'],
    // Validation
    [/No balance to withdraw/i, 'soroban.errorNoBalance'],
    [/Only active participants can confirm/i, 'soroban.errorNotParticipant'],
    [/Participant already confirmed/i, 'soroban.errorAlreadyConfirmed'],
    [/Contribution would exceed target/i, 'soroban.errorExceedsTarget'],
    [/Deadline has passed/i, 'soroban.errorDeadlinePassed'],
    [/Amount must be positive/i, 'soroban.errorInvalidAmount'],
    [/Target amount must be positive/i, 'soroban.errorInvalidAmount'],
    [/Trip not found/i, 'soroban.errorTripNotFound'],
    [/Maximum number of participants/i, 'soroban.errorMaxParticipants'],
    // Generic Soroban VM errors (fallback patterns)
    [/UnreachableCodeReached/i, 'soroban.errorContractPanic'],
    [/Error\(WasmVm, InvalidAction\)/i, 'soroban.errorContractPanic'],
    [/Error\(WasmVm, MissingValue\)/i, 'soroban.errorMissingFunction'],
];

/**
 * Parse a raw Soroban simulation error into a user-friendly i18n key.
 * Falls back to a generic message with the contract method name.
 */
function parseSimulationError(rawError: string, _method: string): string {
    // Try to extract the data:["...", method] panic message from diagnostic events
    const dataMatch = rawError.match(/data:\[(?:\\)?"([^"\\]+)(?:\\)?"/);
    const panicMsg = dataMatch?.[1] || rawError;

    for (const [pattern, i18nKey] of CONTRACT_ERROR_MAP) {
        if (pattern.test(panicMsg) || pattern.test(rawError)) {
            return i18nKey;
        }
    }

    return 'soroban.errorGeneric';
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
        const raw = JSON.stringify(simulated.error);
        const i18nKey = parseSimulationError(raw, method);
        const err = new Error(i18nKey);
        (err as any).sorobanMethod = method;
        (err as any).sorobanRawError = raw;
        throw err;
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
    signer?: (xdr: string) => Promise<string>,
): Promise<string> {
    const unsignedXdr = await buildFn();
    if (signer) return signer(unsignedXdr);
    return signWithFreighter(unsignedXdr, walletAddress);
}
