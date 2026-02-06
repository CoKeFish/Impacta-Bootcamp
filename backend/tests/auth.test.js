const request = require('supertest');
const {Keypair} = require('@stellar/stellar-sdk');
const app = require('../src/app');
const {beginTransaction, rollbackTransaction} = require('./dbHelper');
const {loginWithNewWallet, signChallenge} = require('./helpers');

beforeEach(() => beginTransaction());
afterEach(() => rollbackTransaction());

// ─── Challenge ───────────────────────────────────────────────────────────────

describe('Auth - Challenge', () => {
    test('GET /api/auth/challenge with wallet returns challenge string', async () => {
        const wallet = Keypair.random().publicKey();
        const res = await request(app)
            .get('/api/auth/challenge')
            .query({wallet});

        expect(res.status).toBe(200);
        expect(res.body.challenge).toMatch(/^CoTravel Login: /);
    });

    test('GET /api/auth/challenge without wallet returns 400', async () => {
        const res = await request(app).get('/api/auth/challenge');
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('Auth - Login', () => {
    test('POST /api/auth/login with valid signature returns JWT', async () => {
        const keypair = Keypair.random();
        const wallet = keypair.publicKey();

        const challengeRes = await request(app)
            .get('/api/auth/challenge')
            .query({wallet});

        const signature = signChallenge(challengeRes.body.challenge, keypair);

        const res = await request(app)
            .post('/api/auth/login')
            .send({wallet, signature});

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.wallet_address).toBe(wallet);
    });

    test('POST /api/auth/login creates new user on first login', async () => {
        const {user, wallet} = await loginWithNewWallet(app);
        expect(user.wallet_address).toBe(wallet);
        expect(user.id).toBeDefined();
    });

    test('POST /api/auth/login same wallet returns same user', async () => {
        const keypair = Keypair.random();
        const wallet = keypair.publicKey();

        // First login
        let cr = await request(app).get('/api/auth/challenge').query({wallet});
        let sig = signChallenge(cr.body.challenge, keypair);
        const first = await request(app).post('/api/auth/login').send({wallet, signature: sig});

        // Second login
        cr = await request(app).get('/api/auth/challenge').query({wallet});
        sig = signChallenge(cr.body.challenge, keypair);
        const second = await request(app).post('/api/auth/login').send({wallet, signature: sig});

        expect(first.body.user.id).toBe(second.body.user.id);
    });

    test('POST /api/auth/login without wallet/signature returns 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({});
        expect(res.status).toBe(400);
    });

    test('POST /api/auth/login without prior challenge returns 400', async () => {
        const keypair = Keypair.random();
        const wallet = keypair.publicKey();
        const signature = signChallenge('no-challenge', keypair);

        const res = await request(app)
            .post('/api/auth/login')
            .send({wallet, signature});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('No challenge found');
    });

    test('POST /api/auth/login with invalid signature returns 401', async () => {
        const keypair = Keypair.random();
        const wallet = keypair.publicKey();

        // Get real challenge
        const cr = await request(app).get('/api/auth/challenge').query({wallet});

        // Sign with a different keypair (wrong key)
        const wrong = Keypair.random();
        const badSig = signChallenge(cr.body.challenge, wrong);

        const res = await request(app)
            .post('/api/auth/login')
            .send({wallet, signature: badSig});
        expect(res.status).toBe(401);
    });

    test('POST /api/auth/login with tampered signature returns 401', async () => {
        const keypair = Keypair.random();
        const wallet = keypair.publicKey();

        // Get real challenge
        await request(app).get('/api/auth/challenge').query({wallet});

        // Send garbage as signature
        const res = await request(app)
            .post('/api/auth/login')
            .send({wallet, signature: 'not-valid-base64-signature'});
        expect(res.status).toBe(401);
    });

    test('POST /api/auth/login unsupported provider returns 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({provider: 'twitter', token: 'abc'});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Unsupported provider');
    });
});

// ─── Me ──────────────────────────────────────────────────────────────────────

describe('Auth - Me', () => {
    test('GET /api/auth/me with valid JWT returns user', async () => {
        const {token, wallet} = await loginWithNewWallet(app);
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.wallet_address).toBe(wallet);
    });

    test('GET /api/auth/me without token returns 401', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});
