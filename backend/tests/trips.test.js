const request = require('supertest');
const app = require('../src/app');
const {beginTransaction, rollbackTransaction} = require('./dbHelper');
const {loginWithNewWallet, createTestTrip} = require('./helpers');
const sorobanService = require('../src/services/sorobanService');

jest.mock('../src/services/sorobanService');

beforeEach(async () => {
    await beginTransaction();
    jest.clearAllMocks();
    // getTripState is called in getById when trip is linked to a contract
    sorobanService.getTripState.mockResolvedValue(null);
});
afterEach(() => rollbackTransaction());

// ─── Public endpoints ────────────────────────────────────────────────────────

describe('Trips - Public', () => {
    test('GET /api/trips returns array', async () => {
        const res = await request(app).get('/api/trips');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/trips includes created trip', async () => {
        const {token} = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, token);

        const res = await request(app).get('/api/trips');
        expect(res.status).toBe(200);
        expect(res.body.some((t) => t.id === trip.id)).toBe(true);
    });

    test('POST /api/trips with auth creates draft', async () => {
        const {token} = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, token);

        expect(trip.id).toBeDefined();
        expect(trip.status).toBe('draft');
    });

    test('POST /api/trips missing fields returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/trips')
            .set('Authorization', `Bearer ${token}`)
            .send({name: 'Incomplete'});
        expect(res.status).toBe(400);
    });

    test('POST /api/trips without auth returns 401', async () => {
        const res = await request(app)
            .post('/api/trips')
            .send({
                name: 'No Auth',
                target_amount: 1000,
                min_participants: 2,
                deadline: new Date().toISOString(),
            });
        expect(res.status).toBe(401);
    });

    test('GET /api/trips/:id returns trip', async () => {
        const {token} = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, token);

        const res = await request(app).get(`/api/trips/${trip.id}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(trip.id);
    });

    test('GET /api/trips/:id non-existent returns 404', async () => {
        const res = await request(app).get('/api/trips/99999');
        expect(res.status).toBe(404);
    });
});

// ─── Link Contract ───────────────────────────────────────────────────────────

describe('Trips - Link Contract', () => {
    test('POST link-contract as organizer succeeds', async () => {
        const {token} = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash-001',
            ledger: 12345,
            returnValue: 1,
        });

        const res = await request(app)
            .post(`/api/trips/${trip.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.contract_trip_id).toBe(1);
        expect(res.body.tx_hash).toBe('link-hash-001');
    });

    test('POST link-contract without XDR returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, token);

        const res = await request(app)
            .post(`/api/trips/${trip.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });

    test('POST link-contract already linked returns 409', async () => {
        const {token} = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, token);

        sorobanService.submitTx.mockResolvedValue({
            hash: 'link-hash-002',
            ledger: 12345,
            returnValue: 1,
        });

        await request(app)
            .post(`/api/trips/${trip.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'xdr-1'});

        const res = await request(app)
            .post(`/api/trips/${trip.id}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'xdr-2'});
        expect(res.status).toBe(409);
    });

    test('POST link-contract as non-organizer returns 403', async () => {
        const organizer = await loginWithNewWallet(app);
        const trip = await createTestTrip(app, organizer.token);
        const other = await loginWithNewWallet(app);

        const res = await request(app)
            .post(`/api/trips/${trip.id}/link-contract`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(403);
    });
});

// ─── Release & Cancel ────────────────────────────────────────────────────────

describe('Trips - Release & Cancel', () => {
    let token, trip;

    beforeEach(async () => {
        const auth = await loginWithNewWallet(app);
        token = auth.token;
        trip = await createTestTrip(app, token);
    });

    test('POST release as organizer succeeds', async () => {
        sorobanService.submitTx.mockResolvedValue({
            hash: 'release-hash-001',
            ledger: 12346,
            returnValue: null,
        });

        const res = await request(app)
            .post(`/api/trips/${trip.id}/release`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-release-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.tx_hash).toBe('release-hash-001');
        expect(res.body.status).toBe('released');
    });

    test('POST release as non-organizer returns 403', async () => {
        const other = await loginWithNewWallet(app);
        const res = await request(app)
            .post(`/api/trips/${trip.id}/release`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(403);
    });

    test('POST cancel as organizer succeeds', async () => {
        sorobanService.submitTx.mockResolvedValue({
            hash: 'cancel-hash-001',
            ledger: 12347,
            returnValue: null,
        });

        const res = await request(app)
            .post(`/api/trips/${trip.id}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: 'fake-cancel-xdr'});

        expect(res.status).toBe(200);
        expect(res.body.tx_hash).toBe('cancel-hash-001');
        expect(res.body.status).toBe('cancelled');
    });

    test('POST cancel as non-organizer returns 403', async () => {
        const other = await loginWithNewWallet(app);
        const res = await request(app)
            .post(`/api/trips/${trip.id}/cancel`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({signed_xdr: 'fake-xdr'});
        expect(res.status).toBe(403);
    });
});
