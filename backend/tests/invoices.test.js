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

// ─── My Invoices (dashboard) ────────────────────────────────────────────────

describe('Invoices - My Invoices', () => {
    test('GET /api/invoices/my returns paginated invoices for organizer', async () => {
        const {token} = await loginWithNewWallet(app);
        await createTestInvoice(app, token);

        const res = await request(app)
            .get('/api/invoices/my')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.total).toBe(1);
        expect(res.body.data[0].user_role).toBe('organizer');
    });

    test('GET /api/invoices/my includes invoices where user is participant', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        const res = await request(app)
            .get('/api/invoices/my')
            .set('Authorization', `Bearer ${participant.token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].user_role).toBe('participant');
    });

    test('GET /api/invoices/my without auth returns 401', async () => {
        const res = await request(app).get('/api/invoices/my');
        expect(res.status).toBe(401);
    });
});

// ─── Detail (auth + access) ─────────────────────────────────────────────────

describe('Invoices - Detail', () => {
    test('GET /api/invoices/:id as organizer returns invoice with items', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        const res = await request(app)
            .get(`/api/invoices/${invoice.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(invoice.id);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items.length).toBe(2);
    });

    test('GET /api/invoices/:id as participant returns invoice', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const participant = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/invoices/${invoice.id}/join`)
            .set('Authorization', `Bearer ${participant.token}`);

        const res = await request(app)
            .get(`/api/invoices/${invoice.id}`)
            .set('Authorization', `Bearer ${participant.token}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(invoice.id);
    });

    test('GET /api/invoices/:id as non-participant returns 403', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const stranger = await loginWithNewWallet(app);

        const res = await request(app)
            .get(`/api/invoices/${invoice.id}`)
            .set('Authorization', `Bearer ${stranger.token}`);

        expect(res.status).toBe(403);
    });

    test('GET /api/invoices/:id non-existent returns 404', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .get('/api/invoices/99999')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    test('GET /api/invoices/:id without auth returns 401', async () => {
        const res = await request(app).get('/api/invoices/1');
        expect(res.status).toBe(401);
    });

    test('GET /api/invoices/abc invalid ID returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .get('/api/invoices/abc')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
});

// ─── Create Invoice ─────────────────────────────────────────────────────────

describe('Invoices - Create', () => {
    test('POST /api/invoices creates invoice with items', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        expect(invoice.id).toBeDefined();
        expect(invoice.status).toBe('draft');
        expect(parseFloat(invoice.total_amount)).toBe(1000);
        expect(invoice.items.length).toBe(2);
    });

    test('POST /api/invoices calculates total from items', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token, [
            {description: 'A', amount: 300, recipient_wallet: 'GABC'},
            {description: 'B', amount: 700, recipient_wallet: 'GDEF'},
        ]);

        expect(parseFloat(invoice.total_amount)).toBe(1000);
    });

    test('POST /api/invoices validates deadline is in the future', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Past deadline',
                items: [{description: 'X', amount: 100}],
                deadline: new Date(Date.now() - 86400000).toISOString(),
            });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('future');
    });

    test('POST /api/invoices missing items returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${token}`)
            .send({name: 'Missing items', deadline: new Date(Date.now() + 86400000).toISOString()});
        expect(res.status).toBe(400);
    });

    test('POST /api/invoices without auth returns 401', async () => {
        const res = await request(app)
            .post('/api/invoices')
            .send({
                name: 'No Auth',
                items: [{description: 'X', amount: 100}],
                deadline: new Date(Date.now() + 86400000).toISOString(),
            });
        expect(res.status).toBe(401);
    });
});

// ─── Link Contract ──────────────────────────────────────────────────────────

describe('Invoices - Link Contract', () => {
    test('POST link-contract as organizer succeeds', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash-001', ledger: 12345, returnValue: 42,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.contract_invoice_id).toBe(42);
        expect(res.body.status).toBe('funding');
    });

    test('POST link-contract already linked returns 409', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash-002', ledger: 12345, returnValue: 1,
        });

        await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'xdr-1'});

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'xdr-2'});
        expect(res.status).toBe(409);
    });

    test('POST link-contract as non-organizer returns 403', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const other = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(403);
    });
});

// ─── Update Items ───────────────────────────────────────────────────────────

describe('Invoices - Update Items', () => {
    test('PUT items updates draft invoice (no XDR needed)', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        const res = await request(app)
            .put(`/api/invoices/${invoice.id}/items`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                items: [
                    {description: 'New Item 1', amount: 600, recipient_wallet: 'GAAA'},
                    {description: 'New Item 2', amount: 400, recipient_wallet: 'GBBB'},
                ],
                change_summary: 'Changed items',
            });

        expect(res.status).toBe(200);
        expect(res.body.version).toBe(1);
        expect(parseFloat(res.body.total_amount)).toBe(1000);
        expect(res.body.items.length).toBe(2);
    });

    test('PUT items on linked invoice requires signed_xdr', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash', ledger: 100, returnValue: 5,
        });
        await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});

        const res = await request(app)
            .put(`/api/invoices/${invoice.id}/items`)
            .set('Authorization', `Bearer ${token}`)
            .send({items: [{description: 'X', amount: 500}]});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('signed_xdr required');
    });

    test('PUT items on linked invoice with XDR succeeds', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash', ledger: 100, returnValue: 5,
        });
        await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});

        sorobanService.submitTx.mockResolvedValue({
            hash: 'update-hash', ledger: 101, returnValue: null,
        });
        const res = await request(app)
            .put(`/api/invoices/${invoice.id}/items`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                items: [{description: 'Updated', amount: 800}],
                signed_xdr: 'fake-update-xdr',
                change_summary: 'Reduced items',
            });

        expect(res.status).toBe(200);
        expect(res.body.version).toBe(1);
        expect(res.body.tx_hash).toBe('update-hash');
    });

    test('PUT items as non-organizer returns 403', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const other = await loginWithNewWallet(app);

        const res = await request(app)
            .put(`/api/invoices/${invoice.id}/items`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({items: [{description: 'X', amount: 100}]});
        expect(res.status).toBe(403);
    });

    test('PUT items empty items returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        const res = await request(app)
            .put(`/api/invoices/${invoice.id}/items`)
            .set('Authorization', `Bearer ${token}`)
            .send({items: []});
        expect(res.status).toBe(400);
    });
});

// ─── Release & Cancel ───────────────────────────────────────────────────────

describe('Invoices - Release & Cancel', () => {
    test('POST release on funding invoice succeeds', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        // Link to contract to move to 'funding' status
        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash', ledger: 100, returnValue: 1,
        });
        await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});

        sorobanService.submitTx.mockResolvedValue({
            hash: 'release-hash-001', ledger: 12346, returnValue: null,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/release`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-release-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('released');
    });

    test('POST release on draft invoice returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'release-hash', ledger: 100, returnValue: null,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/release`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('funding');
    });

    test('POST cancel as organizer succeeds', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'cancel-hash-001', ledger: 12347, returnValue: null,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-cancel-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('cancelled');
    });

    test('POST release as non-organizer returns 403', async () => {
        const organizer = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, organizer.token);
        const other = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/release`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(403);
    });
});

// ─── Claim Deadline ──────────────────────────────────────────────────────────

describe('Invoices - Claim Deadline', () => {
    test('POST claim-deadline on linked invoice succeeds', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash', ledger: 100, returnValue: 10,
        });
        await request(app)
            .post(`/api/invoices/${invoice.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});

        sorobanService.submitTx.mockResolvedValue({
            hash: 'deadline-hash-001', ledger: 12348, returnValue: null,
        });

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/claim-deadline`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-deadline-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('cancelled');
        expect(res.body.tx_hash).toBe('deadline-hash-001');
    });

    test('POST claim-deadline on unlinked invoice returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const invoice = await createTestInvoice(app, token);

        const res = await request(app)
            .post(`/api/invoices/${invoice.id}/claim-deadline`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(400);
    });
});
