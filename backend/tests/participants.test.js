const request = require('supertest');
const app = require('../src/app');
const { beginTransaction, rollbackTransaction } = require('./dbHelper');
const { loginWithNewWallet, createTestTrip } = require('./helpers');
const sorobanService = require('../src/services/sorobanService');

jest.mock('../src/services/sorobanService');

beforeEach(async () => {
    await beginTransaction();
    jest.clearAllMocks();
    sorobanService.getTripState.mockResolvedValue(null);
});
afterEach(() => rollbackTransaction());

// ─── Join ────────────────────────────────────────────────────────────────────

describe('Participants - Join', () => {
    test('POST /join creates participant', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/trips/${trip.id}/join`)
            .set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(201);
        expect(res.body.trip_id).toBe(trip.id);
        expect(res.body.user_id).toBe(user.user.id);
    });

    test('POST /join duplicate returns 409', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/trips/${trip.id}/join`)
            .set('Authorization', `Bearer ${user.token}`);

        const res = await request(app)
            .post(`/api/trips/${trip.id}/join`)
            .set('Authorization', `Bearer ${user.token}`);
        expect(res.status).toBe(409);
    });

    test('POST /join without auth returns 401', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);

        const res = await request(app).post(`/api/trips/${trip.id}/join`);
        expect(res.status).toBe(401);
    });

    test('GET /participants returns list', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/trips/${trip.id}/join`)
            .set('Authorization', `Bearer ${user.token}`);

        const res = await request(app).get(`/api/trips/${trip.id}/participants`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
    });
});

// ─── Contribute ──────────────────────────────────────────────────────────────

describe('Participants - Contribute', () => {
    test('POST /contribute records contribution', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/trips/${trip.id}/join`)
            .set('Authorization', `Bearer ${user.token}`);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'contrib-hash-001',
            ledger: 12345,
            returnValue: null,
        });

        const res = await request(app)
            .post(`/api/trips/${trip.id}/contribute`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({ signed_xdr: 'fake-xdr', amount: 100 });

        expect(res.status).toBe(200);
        expect(res.body.tx_hash).toBe('contrib-hash-001');
    });

    test('POST /contribute auto-joins if not participant', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'autojoin-hash-001',
            ledger: 12345,
            returnValue: null,
        });

        const res = await request(app)
            .post(`/api/trips/${trip.id}/contribute`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({ signed_xdr: 'fake-xdr', amount: 50 });

        expect(res.status).toBe(200);
        expect(res.body.tx_hash).toBe('autojoin-hash-001');
    });

    test('POST /contribute without XDR returns 400', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/trips/${trip.id}/contribute`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({ amount: 100 });
        expect(res.status).toBe(400);
    });
});

// ─── Withdraw ────────────────────────────────────────────────────────────────

describe('Participants - Withdraw', () => {
    test('POST /withdraw records withdrawal', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/trips/${trip.id}/join`)
            .set('Authorization', `Bearer ${user.token}`);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'withdraw-hash-001',
            ledger: 12346,
            returnValue: null,
        });

        const res = await request(app)
            .post(`/api/trips/${trip.id}/withdraw`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({ signed_xdr: 'fake-withdraw-xdr' });

        expect(res.status).toBe(200);
        expect(res.body.tx_hash).toBe('withdraw-hash-001');
    });

    test('POST /withdraw non-participant returns 404', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const other = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/trips/${trip.id}/withdraw`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({ signed_xdr: 'fake-xdr' });
        expect(res.status).toBe(404);
    });

    test('POST /withdraw without XDR returns 400', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const user = await loginWithNewWallet(app);

        await request(app)
            .post(`/api/trips/${trip.id}/join`)
            .set('Authorization', `Bearer ${user.token}`);

        const res = await request(app)
            .post(`/api/trips/${trip.id}/withdraw`)
            .set('Authorization', `Bearer ${user.token}`)
            .send({});
        expect(res.status).toBe(400);
    });
});
