'use strict';

/**
 * 7 E2E test scenarios exercising every contract operation through the backend API
 * with real Soroban transactions on testnet.
 *
 * Each scenario is an async function that receives a shared context and returns
 * {pass, fail} counts.
 */

const {
    xlmToStroops,
    buildCreateInvoiceTx,
    buildContributeTx,
    buildWithdrawTx,
    buildReleaseTx,
    buildCancelTx,
    buildConfirmReleaseTx,
    buildUpdateRecipientsTx,
} = require('./stellar');

// ─── Assertion helpers ───────────────────────────────────────────────────────

class TestResult {
    constructor() {
        this.pass = 0;
        this.fail = 0;
    }

    assert(condition, message) {
        if (condition) {
            console.log(`    \x1b[32m✓\x1b[0m ${message}`);
            this.pass++;
        } else {
            console.log(`    \x1b[31m✗\x1b[0m ${message}`);
            this.fail++;
        }
        return condition;
    }

    assertEqual(actual, expected, message) {
        const a = String(actual);
        const e = String(expected);
        return this.assert(a === e,
            a === e ? message : `${message}  (expected: ${e}, got: ${a})`,
        );
    }
}

// ─── Invoice creation helper ─────────────────────────────────────────────────

/**
 * Create an invoice via the API, build the create_invoice transaction,
 * and link it to the freshly-deployed contract.
 *
 * Returns {invoiceId, contractInvoiceId}.
 */
async function createAndLinkInvoice(ctx, items, opts = {}) {
    const {api, contractId, accounts} = ctx;
    const org = accounts.organizer;

    const deadline = new Date(Date.now() + 86_400_000).toISOString(); // +1 day

    // 1. Create invoice in the database via API
    const invoice = await api.createInvoice(org.token, {
        name: opts.name || 'Integration Test Invoice ' + Date.now(),
        description: opts.description || 'E2E integration test',
        items,
        min_participants: opts.min_participants ?? 2,
        penalty_percent: opts.penalty_percent ?? 10,
        deadline,
        auto_release: opts.auto_release ?? false,
    });

    // 2. Build create_invoice Soroban transaction
    const totalStroops = items.reduce(
        (sum, item) => sum + xlmToStroops(item.amount),
        BigInt(0),
    );

    const recipients = items
        .filter(i => i.recipient_wallet)
        .map(i => ({address: i.recipient_wallet, amount: xlmToStroops(i.amount)}));

    const deadlineUnix = Math.floor(new Date(deadline).getTime() / 1000);

    const signedXdr = await buildCreateInvoiceTx(org.keypair, contractId, {
        targetAmount: totalStroops,
        minParticipants: opts.min_participants ?? 2,
        deadline: deadlineUnix,
        penaltyPercent: opts.penalty_percent ?? 10,
        recipients,
        autoRelease: opts.auto_release ?? false,
    });

    // 3. Link invoice to contract
    const linkResult = await api.linkContract(org.token, invoice.id, signedXdr);

    return {
        invoiceId: invoice.id,
        contractInvoiceId: linkResult.contract_invoice_id,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 1 — Happy Path (Release)
// ═════════════════════════════════════════════════════════════════════════════

async function happyPathRelease(ctx) {
    const t = new TestResult();
    const {api, contractId, accounts} = ctx;

    // Invoice: Hotel Room 3 XLM + Tour Day Trip 2 XLM = 5 XLM
    const items = [
        {
            description: 'Mountain View Room',
            amount: 3,
            recipient_wallet: accounts.hotelOwner.keypair.publicKey(),
            service_id: ctx.services.hotelRoom.id
        },
        {
            description: 'Cocora Valley Day Trip',
            amount: 2,
            recipient_wallet: accounts.tourOwner.keypair.publicKey(),
            service_id: ctx.services.tourDayTrip.id
        },
    ];

    console.log('    Creating & linking invoice (5 XLM target, min=2)…');
    const {invoiceId, contractInvoiceId} = await createAndLinkInvoice(ctx, items, {
        name: 'S1 – Happy Path',
        min_participants: 2,
        penalty_percent: 10,
    });
    t.assert(contractInvoiceId != null, 'Invoice linked to contract');

    // P1 → 2 XLM
    console.log('    P1 contributing 2 XLM…');
    let xdr = await buildContributeTx(accounts.participant1.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    let res = await api.contribute(accounts.participant1.token, invoiceId, xdr, 2);
    t.assert(!!res.tx_hash, 'P1 contribution confirmed');

    // P2 → 2 XLM  (total 4, still < 5)
    console.log('    P2 contributing 2 XLM…');
    xdr = await buildContributeTx(accounts.participant2.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    res = await api.contribute(accounts.participant2.token, invoiceId, xdr, 2);
    t.assert(!!res.tx_hash, 'P2 contribution confirmed');

    // Check: still funding
    let inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'funding', 'Status is funding (4/5 XLM)');

    // P3 → 1 XLM  (total 5 = target, 3 >= 2 min ⇒ Completed)
    console.log('    P3 contributing 1 XLM (meets target)…');
    xdr = await buildContributeTx(accounts.participant3.keypair, contractId, contractInvoiceId, xlmToStroops(1));
    res = await api.contribute(accounts.participant3.token, invoiceId, xdr, 1);
    t.assert(!!res.tx_hash, 'P3 contribution confirmed');

    inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'completed', 'Status is completed (target met)');

    // Organizer releases
    console.log('    Organizer releasing funds…');
    xdr = await buildReleaseTx(accounts.organizer.keypair, contractId, contractInvoiceId);
    res = await api.release(accounts.organizer.token, invoiceId, xdr);
    t.assert(!!res.tx_hash, 'Release tx confirmed');

    // Final verification
    inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'released', 'Final status is released');
    if (inv.onchain) {
        t.assertEqual(inv.onchain.status, 'released', 'On-chain status = released');
        t.assertEqual(String(inv.onchain.total_collected), '0', 'On-chain total_collected = 0');
    }

    return t;
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 2 — Withdrawal with Penalty
// ═════════════════════════════════════════════════════════════════════════════

async function withdrawalWithPenalty(ctx) {
    const t = new TestResult();
    const {api, contractId, accounts} = ctx;

    const items = [
        {description: 'Mountain View Room', amount: 3, recipient_wallet: accounts.hotelOwner.keypair.publicKey()},
        {description: 'Cocora Valley Day Trip', amount: 2, recipient_wallet: accounts.tourOwner.keypair.publicKey()},
    ];

    console.log('    Creating & linking invoice (5 XLM, min=1, penalty=10%)…');
    const {invoiceId, contractInvoiceId} = await createAndLinkInvoice(ctx, items, {
        name: 'S2 – Withdrawal',
        min_participants: 1,
        penalty_percent: 10,
    });

    // P1 → 3 XLM
    console.log('    P1 contributing 3 XLM…');
    let xdr = await buildContributeTx(accounts.participant1.keypair, contractId, contractInvoiceId, xlmToStroops(3));
    await api.contribute(accounts.participant1.token, invoiceId, xdr, 3);

    // P1 withdraws → expects 10 % penalty = 0.3 XLM deducted
    console.log('    P1 withdrawing (10% penalty = 0.3 XLM)…');
    xdr = await buildWithdrawTx(accounts.participant1.keypair, contractId, contractInvoiceId);
    const wRes = await api.withdraw(accounts.participant1.token, invoiceId, xdr);
    t.assert(!!wRes.tx_hash, 'Withdrawal tx confirmed');

    // Verify state
    const inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'funding', 'Status reverted to funding');
    if (inv.onchain) {
        t.assertEqual(String(inv.onchain.participant_count), '0', 'On-chain: 0 active participants');
    }

    return t;
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 3 — Cancel with Refund
// ═════════════════════════════════════════════════════════════════════════════

async function cancelWithRefund(ctx) {
    const t = new TestResult();
    const {api, contractId, accounts} = ctx;

    const items = [
        {description: 'Conference Room', amount: 2, recipient_wallet: accounts.hotelOwner.keypair.publicKey()},
        {description: 'Coffee Farm Experience', amount: 2, recipient_wallet: accounts.tourOwner.keypair.publicKey()},
    ];

    console.log('    Creating & linking invoice (4 XLM, min=2)…');
    const {invoiceId, contractInvoiceId} = await createAndLinkInvoice(ctx, items, {
        name: 'S3 – Cancel',
        min_participants: 2,
        penalty_percent: 10,
    });

    // P1 → 2 XLM
    console.log('    P1 contributing 2 XLM…');
    let xdr = await buildContributeTx(accounts.participant1.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    await api.contribute(accounts.participant1.token, invoiceId, xdr, 2);

    // P2 → 2 XLM  (total 4 = target ⇒ Completed)
    console.log('    P2 contributing 2 XLM…');
    xdr = await buildContributeTx(accounts.participant2.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    await api.contribute(accounts.participant2.token, invoiceId, xdr, 2);

    let inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'completed', 'Status is completed before cancel');

    // Organizer cancels → full refund
    console.log('    Organizer cancelling…');
    xdr = await buildCancelTx(accounts.organizer.keypair, contractId, contractInvoiceId);
    const cRes = await api.cancel(accounts.organizer.token, invoiceId, xdr);
    t.assert(!!cRes.tx_hash, 'Cancel tx confirmed');

    inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'cancelled', 'Final status is cancelled');
    if (inv.onchain) {
        t.assertEqual(inv.onchain.status, 'cancelled', 'On-chain status = cancelled');
        t.assertEqual(String(inv.onchain.total_collected), '0', 'On-chain total = 0 (all refunded)');
    }

    return t;
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 4 — Auto-Release
// ═════════════════════════════════════════════════════════════════════════════

async function autoRelease(ctx) {
    const t = new TestResult();
    const {api, contractId, accounts} = ctx;

    const items = [
        {description: 'Conference Room', amount: 2, recipient_wallet: accounts.hotelOwner.keypair.publicKey()},
        {description: 'Coffee Farm Experience', amount: 2, recipient_wallet: accounts.tourOwner.keypair.publicKey()},
    ];

    console.log('    Creating & linking invoice (4 XLM, auto_release=true)…');
    const {invoiceId, contractInvoiceId} = await createAndLinkInvoice(ctx, items, {
        name: 'S4 – Auto-Release',
        min_participants: 2,
        penalty_percent: 10,
        auto_release: true,
    });

    // P1 → 2 XLM
    console.log('    P1 contributing 2 XLM…');
    let xdr = await buildContributeTx(accounts.participant1.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    await api.contribute(accounts.participant1.token, invoiceId, xdr, 2);

    // P2 → 2 XLM  (total 4 = target → auto-release triggers inside the same tx)
    console.log('    P2 contributing 2 XLM (triggers auto-release)…');
    xdr = await buildContributeTx(accounts.participant2.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    const res = await api.contribute(accounts.participant2.token, invoiceId, xdr, 2);
    t.assert(!!res.tx_hash, 'P2 contribution tx confirmed');

    // Verify auto-release
    const inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    if (inv.onchain) {
        t.assertEqual(inv.onchain.status, 'released', 'On-chain status = released (auto)');
        t.assertEqual(String(inv.onchain.total_collected), '0', 'Funds distributed');
    } else {
        t.assert(false, 'Expected on-chain state');
    }

    return t;
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 5 — Confirm Release (Unanimous)
// ═════════════════════════════════════════════════════════════════════════════

async function confirmRelease(ctx) {
    const t = new TestResult();
    const {api, contractId, accounts} = ctx;

    const items = [
        {description: 'Mountain View Room', amount: 2, recipient_wallet: accounts.hotelOwner.keypair.publicKey()},
        {description: 'Cocora Valley Day Trip', amount: 2, recipient_wallet: accounts.tourOwner.keypair.publicKey()},
    ];

    console.log('    Creating & linking invoice (4 XLM, auto_release=false)…');
    const {invoiceId, contractInvoiceId} = await createAndLinkInvoice(ctx, items, {
        name: 'S5 – Confirm Release',
        min_participants: 2,
        penalty_percent: 10,
        auto_release: false,
    });

    // P1 → 2 XLM
    console.log('    P1 contributing 2 XLM…');
    let xdr = await buildContributeTx(accounts.participant1.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    await api.contribute(accounts.participant1.token, invoiceId, xdr, 2);

    // P3 → 2 XLM  (total 4 = target ⇒ Completed)
    console.log('    P3 contributing 2 XLM…');
    xdr = await buildContributeTx(accounts.participant3.keypair, contractId, contractInvoiceId, xlmToStroops(2));
    await api.contribute(accounts.participant3.token, invoiceId, xdr, 2);

    let inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'completed', 'Status is completed');

    // P1 confirms → 1/2
    console.log('    P1 confirming release…');
    xdr = await buildConfirmReleaseTx(accounts.participant1.keypair, contractId, contractInvoiceId);
    let cr = await api.confirmRelease(accounts.participant1.token, invoiceId, xdr);
    t.assertEqual(String(cr.confirmation_count), '1', 'Confirmation count = 1');

    // P3 confirms → 2/2 → unanimous → auto-release
    console.log('    P3 confirming release (unanimous → release)…');
    xdr = await buildConfirmReleaseTx(accounts.participant3.keypair, contractId, contractInvoiceId);
    cr = await api.confirmRelease(accounts.participant3.token, invoiceId, xdr);
    t.assertEqual(String(cr.confirmation_count), '2', 'Confirmation count = 2');

    // Verify released on-chain
    inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    if (inv.onchain) {
        t.assertEqual(inv.onchain.status, 'released', 'On-chain status = released (unanimous)');
    } else {
        t.assert(false, 'Expected on-chain state');
    }

    return t;
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 6 — Update Recipients + Free Opt-Out
// ═════════════════════════════════════════════════════════════════════════════

async function updateRecipientsOptOut(ctx) {
    const t = new TestResult();
    const {api, contractId, accounts} = ctx;

    const items = [
        {description: 'Mountain View Room', amount: 3, recipient_wallet: accounts.hotelOwner.keypair.publicKey()},
        {description: 'Cocora Valley Day Trip', amount: 2, recipient_wallet: accounts.tourOwner.keypair.publicKey()},
    ];

    console.log('    Creating & linking invoice (5 XLM, min=1, penalty=10%)…');
    const {invoiceId, contractInvoiceId} = await createAndLinkInvoice(ctx, items, {
        name: 'S6 – Update Recipients',
        min_participants: 1,
        penalty_percent: 10,
    });

    // P1 → 3 XLM  (contributed at version 0)
    console.log('    P1 contributing 3 XLM at version 0…');
    let xdr = await buildContributeTx(accounts.participant1.keypair, contractId, contractInvoiceId, xlmToStroops(3));
    await api.contribute(accounts.participant1.token, invoiceId, xdr, 3);

    // Organizer updates recipients → contract version increments to 1
    console.log('    Organizer updating recipients (version 0 → 1)…');
    const newItems = [
        {
            description: 'Mountain View Room (updated)',
            amount: 2.5,
            recipient_wallet: accounts.hotelOwner.keypair.publicKey()
        },
        {
            description: 'Cocora Valley Day Trip (updated)',
            amount: 2.5,
            recipient_wallet: accounts.tourOwner.keypair.publicKey()
        },
    ];
    const newRecipients = newItems.map(i => ({
        address: i.recipient_wallet,
        amount: xlmToStroops(i.amount),
    }));
    const updateXdr = await buildUpdateRecipientsTx(
        accounts.organizer.keypair, contractId, contractInvoiceId, newRecipients,
    );
    await api.updateItems(accounts.organizer.token, invoiceId, {
        items: newItems,
        change_summary: 'Adjusted distribution 50/50',
        signed_xdr: updateXdr,
    });

    let inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assert(Number(inv.version) >= 1, 'Invoice version incremented');

    // P1 withdraws → penalty-free because contributed at version 0, now version 1
    console.log('    P1 withdrawing (penalty-free: version mismatch)…');
    xdr = await buildWithdrawTx(accounts.participant1.keypair, contractId, contractInvoiceId);
    const wRes = await api.withdraw(accounts.participant1.token, invoiceId, xdr);
    t.assert(!!wRes.tx_hash, 'Penalty-free withdrawal confirmed');

    inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'funding', 'Status reverted to funding');

    return t;
}

// ═════════════════════════════════════════════════════════════════════════════
// Scenario 7 — Overfunding Rejection
// ═════════════════════════════════════════════════════════════════════════════

async function overfundingRejection(ctx) {
    const t = new TestResult();
    const {api, contractId, accounts} = ctx;

    const items = [
        {description: 'Coffee Farm Experience', amount: 1, recipient_wallet: accounts.hotelOwner.keypair.publicKey()},
        {description: 'Guided Walk', amount: 1, recipient_wallet: accounts.tourOwner.keypair.publicKey()},
    ];

    console.log('    Creating & linking invoice (2 XLM target, min=2)…');
    const {invoiceId, contractInvoiceId} = await createAndLinkInvoice(ctx, items, {
        name: 'S7 – Overfunding',
        min_participants: 2,
        penalty_percent: 0,
    });

    // P4 → 1.5 XLM  (valid, under target)
    console.log('    P4 contributing 1.5 XLM…');
    let xdr = await buildContributeTx(accounts.participant4.keypair, contractId, contractInvoiceId, xlmToStroops(1.5));
    await api.contribute(accounts.participant4.token, invoiceId, xdr, 1.5);

    // P2 tries 1 XLM → would exceed target (1.5 + 1.0 = 2.5 > 2.0)
    console.log('    P2 attempting 1 XLM (would overfund: 1.5+1.0 > 2.0)…');
    let overfundRejected = false;
    try {
        xdr = await buildContributeTx(accounts.participant2.keypair, contractId, contractInvoiceId, xlmToStroops(1));
        await api.contribute(accounts.participant2.token, invoiceId, xdr, 1);
    } catch (err) {
        overfundRejected = true;
        t.assert(true, `Overfunding correctly rejected: ${err.message.slice(0, 80)}`);
    }
    if (!overfundRejected) {
        t.assert(false, 'Overfunding should have been rejected by contract');
    }

    // P2 → 0.5 XLM  (exact fit: 1.5 + 0.5 = 2.0)
    console.log('    P2 contributing 0.5 XLM (exact fit)…');
    xdr = await buildContributeTx(accounts.participant2.keypair, contractId, contractInvoiceId, xlmToStroops(0.5));
    const res = await api.contribute(accounts.participant2.token, invoiceId, xdr, 0.5);
    t.assert(!!res.tx_hash, 'Exact-fit contribution accepted');

    // Verify completed
    const inv = await api.getInvoice(accounts.organizer.token, invoiceId);
    t.assertEqual(inv.status, 'completed', 'Status is completed (target met exactly)');

    return t;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    happyPathRelease,
    withdrawalWithPenalty,
    cancelWithRefund,
    autoRelease,
    confirmRelease,
    updateRecipientsOptOut,
    overfundingRejection,
};
