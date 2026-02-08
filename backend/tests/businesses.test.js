const request = require('supertest');
const app = require('../src/app');
const {beginTransaction, rollbackTransaction} = require('./dbHelper');
const {loginWithNewWallet, createTestBusiness} = require('./helpers');

beforeEach(async () => {
    await beginTransaction();
    jest.clearAllMocks();
});
afterEach(() => rollbackTransaction());

describe('Businesses - Public', () => {
    test('GET /api/businesses returns array', async () => {
        const res = await request(app).get('/api/businesses');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/businesses includes created business', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);

        const res = await request(app).get('/api/businesses');
        expect(res.status).toBe(200);
        expect(res.body.some((b) => b.id === business.id)).toBe(true);
    });

    test('GET /api/businesses/:id returns business', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);

        const res = await request(app).get(`/api/businesses/${business.id}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(business.id);
        expect(res.body.owner_wallet).toBeDefined();
    });

    test('GET /api/businesses/:id non-existent returns 404', async () => {
        const res = await request(app).get('/api/businesses/99999');
        expect(res.status).toBe(404);
    });
});

describe('Businesses - Protected', () => {
    test('POST /api/businesses with auth creates business', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);

        expect(business.id).toBeDefined();
        expect(business.name).toContain('Test Business');
        expect(business.category).toBe('hotel');
    });

    test('POST /api/businesses without auth returns 401', async () => {
        const res = await request(app)
            .post('/api/businesses')
            .send({name: 'No Auth Business'});
        expect(res.status).toBe(401);
    });

    test('POST /api/businesses missing name returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/businesses')
            .set('Authorization', `Bearer ${token}`)
            .send({category: 'hotel'});
        expect(res.status).toBe(400);
    });

    test('PUT /api/businesses/:id as owner succeeds', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);

        const res = await request(app)
            .put(`/api/businesses/${business.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({name: 'Updated Business Name'});

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Business Name');
    });

    test('PUT /api/businesses/:id as non-owner returns 403', async () => {
        const owner = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, owner.token);
        const other = await loginWithNewWallet(app);

        const res = await request(app)
            .put(`/api/businesses/${business.id}`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({name: 'Hacked Name'});
        expect(res.status).toBe(403);
    });
});

describe('Businesses - Services', () => {
    test('GET /api/businesses/:id/services returns services', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);

        // Create a service for this business
        await request(app)
            .post('/api/services')
            .set('Authorization', `Bearer ${token}`)
            .send({
                business_id: business.id,
                name: 'Test Service',
                price: 100,
            });

        const res = await request(app).get(`/api/businesses/${business.id}/services`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
    });
});
