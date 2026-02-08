const request = require('supertest');
const app = require('../src/app');
const {beginTransaction, rollbackTransaction} = require('./dbHelper');
const {loginWithNewWallet, createTestInvoice} = require('./helpers');
const sorobanService = require('../src/services/sorobanService');

jest.mock('../src/services/sorobanService');

beforeEach(async () => {
    await beginTransaction();
    jest.clearAllMocks();
    sorobanService.getTripState.mockResolvedValue(null);
    sorobanService.getPenalty.mockResolvedValue(null);
});
afterEach(() => rollbackTransaction());

// ─── Join ───────────────────────────────────────────────────────────────────

describe('Invoice Participants - Join', () => {
    test('POST /api/invoices/:id/join adds participant', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        expect(res.status).toBe(201);
        expect(res.body.invoice_id).toBe(invoice.id);
        expect(res.body.user_id).toBe(participant.user.id);
    });

    test('POST /api/invoices/:id/join duplicate returns 409', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);
        expect(res.status).toBe(409);
    });

    test('POST /api/invoices/:id/join without auth returns 401', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/join`);
        expect(res.status).toBe(401);
    });
});

// ─── Contribute ─────────────────────────────────────────────────────────────

describe('Invoice Participants - Contribute', () => {
    test('POST /api/invoices/:id/contribute records contribution', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash', ledger: 100, returnValue: 0,
        });
        await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${organizer.token}`)
            .send({signed_xdr: 'fake-xdr'});

        const participant = await loginWithNewWallet(app);
        sorobanService.submitTx.mockResolvedValue({
            hash: 'contrib-hash-001', ledger: 101, returnValue: null,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/contribute`)
            .set('Authorization', `Bearer ${participant.token}`)
            .send({signed_xdr: 'fake-contrib-xdr', amount: 250});

        expect(res.status).toBe(200);
        expect(res.body.tx_hash).toBe('contrib-hash-001');
        expect(res.body.contributed).toBe(250);
    });

    test('POST /api/invoices/:id/contribute auto-joins participant', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'contrib-hash-002', ledger: 102, returnValue: null,
        });

        const participant = await loginWithNewWallet(app);
        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/contribute`)
            .set('Authorization', `Bearer ${participant.token}`)
            .send({signed_xdr: 'fake-xdr', amount: 100});

        expect(res.status).toBe(200);

        // Verify participant was auto-joined (organizer can list)
        const listRes = await request(app)
            .get(`/api/invoices/${invoice.id}/participants`)
            .set('Authorization', `Bearer ${organizer.token}`);
        expect(listRes.body.some((p) => p.user_id === participant.user.id)).toBe(true);
    });

    test('POST /api/invoices/:id/contribute missing fields returns 400', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/contribute`)
            .set('Authorization', `Bearer ${participant.token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(400);
    });
});

// ─── Withdraw ───────────────────────────────────────────────────────────────

describe('Invoice Participants - Withdraw', () => {
    test('POST /api/invoices/:id/withdraw records withdrawal', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'withdraw-hash-001', ledger: 103, returnValue: null,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/withdraw`)
            .set('Authorization', `Bearer ${participant.token}`)
            .send({signed_xdr: 'fake-withdraw-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.tx_hash).toBe('withdraw-hash-001');
    });

    test('POST /api/invoices/:id/withdraw non-participant returns 404', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const stranger = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/withdraw`)
            .set('Authorization', `Bearer ${stranger.token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(404);
    });
});

// ─── Confirm Release ─────────────────────────────────────────────────────────

describe('Invoice Participants - Confirm Release', () => {
    test('POST /api/invoices/:id/confirm records release confirmation', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/confirm`)
            .set('Authorization', `Bearer ${participant.token}`);

        expect(res.status).toBe(200);
        expect(res.body.participant.confirmed_release).toBe(true);
        expect(res.body.confirmation_count).toBe(1);
    });

    test('POST /api/invoices/:id/confirm with signed_xdr submits on-chain', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'confirm-hash-001', ledger: 200, returnValue: null,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/confirm`)
            .set('Authorization', `Bearer ${participant.token}`)
            .send({signed_xdr: 'fake-confirm-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.participant.confirmed_release).toBe(true);
        expect(sorobanService.submitTx).toHaveBeenCalledWith('fake-confirm-xdr');
    });

    test('POST /api/invoices/:id/confirm duplicate returns 409', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        await request(app)
            .post(`/api/invoices/${invoice.id}/confirm`)
            .set('Authorization', `Bearer ${participant.token}`);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/confirm`)
            .set('Authorization', `Bearer ${participant.token}`);
        expect(res.status).toBe(409);
    });

    test('POST /api/invoices/:id/confirm non-participant returns 404', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const stranger = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/confirm`)
            .set('Authorization', `Bearer ${stranger.token}`);
        expect(res.status).toBe(404);
    });

    test('Confirmation count increments per participant', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const p1 = await loginWithNewWallet(app);
        const p2 = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${p1.token}`);
        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${p2.token}`);

        const res1 = await request(app)
            .post(`/api/invoices/${invoice.id}/confirm`)
            .set('Authorization', `Bearer ${p1.token}`);
        expect(res1.body.confirmation_count).toBe(1);

        const res2 = await request(app)
            .post(`/api/invoices/${invoice.id}/confirm`)
            .set('Authorization', `Bearer ${p2.token}`);
        expect(res2.body.confirmation_count).toBe(2);
    });
});

// ─── List Participants ──────────────────────────────────────────────────────

describe('Invoice Participants - List', () => {
    test('GET /api/invoices/:id/participants as organizer returns participants', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const p1 = await loginWithNewWallet(app);
        const p2 = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${p1.token}`);
        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${p2.token}`);

        const res = await request(app)
            .get(`/api/invoices/${invoice.id}/participants`)
            .set('Authorization', `Bearer ${organizer.token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].wallet_address).toBeDefined();
    });

    test('GET /api/invoices/:id/participants non-existent returns 404', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .get('/api/invoices/99999/participants')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    test('GET /api/invoices/:id/participants without auth returns 401', async () => {
        const res = await request(app).get('/api/invoices/1/participants');
        expect(res.status).toBe(401);
    });
});
