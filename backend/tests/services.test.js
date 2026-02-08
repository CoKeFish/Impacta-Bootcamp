const request = require('supertest');
const app = require('../src/app');
const {beginTransaction, rollbackTransaction} = require('./dbHelper');
const {loginWithNewWallet, createTestBusiness, createTestService} = require('./helpers');

beforeEach(async () => {
    await beginTransaction();
    jest.clearAllMocks();
});
afterEach(() => rollbackTransaction());

describe('Services - Public', () => {
    test('GET /api/services returns array', async () => {
        const res = await request(app).get('/api/services');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/services includes created service', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        const res = await request(app).get('/api/services');
        expect(res.status).toBe(200);
        expect(res.body.some((s) => s.id === service.id)).toBe(true);
    });

    test('GET /api/services?q=test searches services', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        await createTestService(app, token, business.id);

        const res = await request(app).get('/api/services?q=Test+Service');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/services/:id returns service', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        const res = await request(app).get(`/api/services/${service.id}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(service.id);
        expect(res.body.business_name).toBeDefined();
    });

    test('GET /api/services/:id non-existent returns 404', async () => {
        const res = await request(app).get('/api/services/99999');
        expect(res.status).toBe(404);
    });
});

describe('Services - Protected', () => {
    test('POST /api/services creates service', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        expect(service.id).toBeDefined();
        expect(service.business_id).toBe(business.id);
        expect(service.price).toBeDefined();
    });

    test('POST /api/services missing fields returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/services')
            .set('Authorization', `Bearer ${token}`)
            .send({name: 'Incomplete'});
        expect(res.status).toBe(400);
    });

    test('POST /api/services by non-owner returns 403', async () => {
        const owner = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, owner.token);
        const other = await loginWithNewWallet(app);

        const res = await request(app)
            .post('/api/services')
            .set('Authorization', `Bearer ${other.token}`)
            .send({
                business_id: business.id,
                name: 'Unauthorized Service',
                price: 100,
            });
        expect(res.status).toBe(403);
    });

    test('PUT /api/services/:id updates service', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        const res = await request(app)
            .put(`/api/services/${service.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({name: 'Updated Service', price: 999});

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Service');
    });
});
