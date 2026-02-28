const request = require('supertest');
const app = require('../src/app');
const {beginTransaction, rollbackTransaction} = require('./dbHelper');
const {loginWithNewWallet, createTestBusiness, createTestService} = require('./helpers');

beforeEach(async () => {
    await beginTransaction();
    jest.clearAllMocks();
});
afterEach(() => rollbackTransaction());

// ─── Auth Guard ──────────────────────────────────────────────────────────────

describe('Cart - Auth Guard', () => {
    test('GET /api/cart without auth returns 401', async () => {
        const res = await request(app).get('/api/cart');
        expect(res.status).toBe(401);
    });

    test('POST /api/cart/items without auth returns 401', async () => {
        const res = await request(app).post('/api/cart/items').send({service_id: 1});
        expect(res.status).toBe(401);
    });

    test('POST /api/cart/checkout without auth returns 401', async () => {
        const res = await request(app).post('/api/cart/checkout').send({name: 'Test'});
        expect(res.status).toBe(401);
    });
});

// ─── CRUD Operations ─────────────────────────────────────────────────────────

describe('Cart - CRUD', () => {
    test('GET /api/cart returns empty cart initially', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .get('/api/cart')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.count).toBe(0);
    });

    test('POST /api/cart/items adds a service to cart', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        const res = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: service.id});

        expect(res.status).toBe(201);
        expect(res.body.service_id).toBe(service.id);
        expect(res.body.quantity).toBe(1);
    });

    test('POST /api/cart/items with invalid service returns 404', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: 99999});

        expect(res.status).toBe(404);
    });

    test('POST /api/cart/items without service_id returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
    });

    test('POST /api/cart/items upserts when adding same service', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: service.id, quantity: 2});

        const res = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: service.id, quantity: 3});

        expect(res.status).toBe(201);
        expect(res.body.quantity).toBe(5);
    });

    test('PUT /api/cart/items/:id updates quantity', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        const addRes = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: service.id});

        const res = await request(app)
            .put(`/api/cart/items/${addRes.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({quantity: 5});

        expect(res.status).toBe(200);
        expect(res.body.quantity).toBe(5);
    });

    test('PUT /api/cart/items/:id with quantity < 1 returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        const addRes = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: service.id});

        const res = await request(app)
            .put(`/api/cart/items/${addRes.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({quantity: 0});

        expect(res.status).toBe(400);
    });

    test('DELETE /api/cart/items/:id removes item', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        const addRes = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: service.id});

        const res = await request(app)
            .delete(`/api/cart/items/${addRes.body.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const cartRes = await request(app)
            .get('/api/cart')
            .set('Authorization', `Bearer ${token}`);
        expect(cartRes.body.count).toBe(0);
    });

    test('DELETE /api/cart clears all items', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const s1 = await createTestService(app, token, business.id);
        const s2 = await createTestService(app, token, business.id);

        await request(app).post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: s1.id});
        await request(app).post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: s2.id});

        const res = await request(app)
            .delete('/api/cart')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);

        const cartRes = await request(app)
            .get('/api/cart')
            .set('Authorization', `Bearer ${token}`);
        expect(cartRes.body.count).toBe(0);
    });
});

// ─── Ownership Checks ────────────────────────────────────────────────────────

describe('Cart - Ownership', () => {
    test('PUT /api/cart/items/:id of another user returns 403', async () => {
        const user1 = await loginWithNewWallet(app);
        const user2 = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, user1.token);
        const service = await createTestService(app, user1.token, business.id);

        const addRes = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${user1.token}`)
            .send({service_id: service.id});

        const res = await request(app)
            .put(`/api/cart/items/${addRes.body.id}`)
            .set('Authorization', `Bearer ${user2.token}`)
            .send({quantity: 5});

        expect(res.status).toBe(403);
    });

    test('DELETE /api/cart/items/:id of another user returns 403', async () => {
        const user1 = await loginWithNewWallet(app);
        const user2 = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, user1.token);
        const service = await createTestService(app, user1.token, business.id);

        const addRes = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${user1.token}`)
            .send({service_id: service.id});

        const res = await request(app)
            .delete(`/api/cart/items/${addRes.body.id}`)
            .set('Authorization', `Bearer ${user2.token}`);

        expect(res.status).toBe(403);
    });
});

// ─── Checkout ────────────────────────────────────────────────────────────────

describe('Cart - Checkout', () => {
    test('POST /api/cart/checkout creates invoice from cart', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        const service = await createTestService(app, token, business.id);

        await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${token}`)
            .send({service_id: service.id, quantity: 2});

        const res = await request(app)
            .post('/api/cart/checkout')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Checkout Invoice',
                deadline: new Date(Date.now() + 86400000).toISOString(),
            });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Checkout Invoice');
        expect(res.body.status).toBe('draft');
        expect(parseFloat(res.body.total_amount)).toBe(1000); // 500 * 2

        // Cart should be empty after checkout
        const cartRes = await request(app)
            .get('/api/cart')
            .set('Authorization', `Bearer ${token}`);
        expect(cartRes.body.count).toBe(0);
    });

    test('POST /api/cart/checkout with empty cart returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/cart/checkout')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Empty Cart Checkout',
                deadline: new Date(Date.now() + 86400000).toISOString(),
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/empty/i);
    });

    test('POST /api/cart/checkout without name returns 400', async () => {
        const {token} = await loginWithNewWallet(app);
        const res = await request(app)
            .post('/api/cart/checkout')
            .set('Authorization', `Bearer ${token}`)
            .send({deadline: new Date(Date.now() + 86400000).toISOString()});

        expect(res.status).toBe(400);
    });
});

// ─── Service Filters ─────────────────────────────────────────────────────────

describe('Services - Filters', () => {
    test('GET /api/services?category=hotel filters by category', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        await createTestService(app, token, business.id);

        const res = await request(app).get('/api/services?category=hotel');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    test('GET /api/services?min_price=100&max_price=600 filters by price', async () => {
        const {token} = await loginWithNewWallet(app);
        const business = await createTestBusiness(app, token);
        await createTestService(app, token, business.id); // price=500

        const res = await request(app).get('/api/services?min_price=100&max_price=600');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);

        const resNone = await request(app).get('/api/services?min_price=1000');
        expect(resNone.body.length).toBe(0);
    });

    test('GET /api/businesses/categories returns distinct categories', async () => {
        const {token} = await loginWithNewWallet(app);
        await createTestBusiness(app, token);

        const res = await request(app).get('/api/businesses/categories');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toContain('hotel');
    });
});
