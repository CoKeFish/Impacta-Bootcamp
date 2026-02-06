const request = require('supertest');
const { Keypair } = require('@stellar/stellar-sdk');
const app = require('../src/app');
const { beginTransaction, rollbackTransaction } = require('./dbHelper');

beforeEach(() => beginTransaction());
afterEach(() => rollbackTransaction());

describe('Users', () => {
    test('POST /api/users creates a new user', async () => {
        const wallet = Keypair.random().publicKey();
        const res = await request(app)
            .post('/api/users')
            .send({ wallet_address: wallet, username: 'testuser' });

        expect(res.status).toBe(201);
        expect(res.body.wallet_address).toBe(wallet);
        expect(res.body.username).toBe('testuser');
    });

    test('POST /api/users duplicate wallet returns 409', async () => {
        const wallet = Keypair.random().publicKey();
        await request(app).post('/api/users').send({ wallet_address: wallet });

        const res = await request(app)
            .post('/api/users')
            .send({ wallet_address: wallet });
        expect(res.status).toBe(409);
    });

    test('POST /api/users without wallet returns 400', async () => {
        const res = await request(app)
            .post('/api/users')
            .send({ username: 'noWallet' });
        expect(res.status).toBe(400);
    });

    test('GET /api/users/:wallet returns existing user', async () => {
        const wallet = Keypair.random().publicKey();
        await request(app)
            .post('/api/users')
            .send({ wallet_address: wallet, username: 'lookup' });

        const res = await request(app).get(`/api/users/${wallet}`);
        expect(res.status).toBe(200);
        expect(res.body.wallet_address).toBe(wallet);
    });

    test('GET /api/users/:wallet non-existent returns 404', async () => {
        const wallet = Keypair.random().publicKey();
        const res = await request(app).get(`/api/users/${wallet}`);
        expect(res.status).toBe(404);
    });
});
