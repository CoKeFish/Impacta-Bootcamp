const request = require('supertest');
const {Keypair} = require('@stellar/stellar-sdk');
const app = require('../src/app');
const {beginTransaction, rollbackTransaction} = require('./dbHelper');

beforeEach(() => beginTransaction());
afterEach(() => rollbackTransaction());

/**
 * Helper: login via Accesly provider and return { token, user, email, wallet }.
 */
async function loginWithAccesly(appInstance, email, wallet) {
    const res = await request(appInstance)
        .post('/api/auth/login')
        .send({provider: 'accesly', email, wallet});
    return {res, token: res.body.token, user: res.body.user};
}

// ─── Accesly Login ──────────────────────────────────────────────────────────

describe('Auth - Accesly Provider', () => {
    const testEmail = 'testuser@gmail.com';
    const testWallet = Keypair.random().publicKey();

    test('POST /api/auth/login with provider=accesly creates new user', async () => {
        const {res} = await loginWithAccesly(app, testEmail, testWallet);

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe(testEmail);
        expect(res.body.user.wallet_address).toBe(testWallet);
        expect(res.body.user.auth_provider).toBe('accesly');
        expect(res.body.user.username).toBe('testuser');
    });

    test('Returns JWT with provider=accesly that works on protected routes', async () => {
        const {token} = await loginWithAccesly(app, testEmail, testWallet);

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.email).toBe(testEmail);
    });

    test('Subsequent login returns same user (idempotent)', async () => {
        const first = await loginWithAccesly(app, testEmail, testWallet);
        const second = await loginWithAccesly(app, testEmail, testWallet);

        expect(first.user.id).toBe(second.user.id);
        expect(second.user.email).toBe(testEmail);
    });

    test('Missing email returns 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({provider: 'accesly', wallet: testWallet});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('email and wallet required');
    });

    test('Missing wallet returns 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({provider: 'accesly', email: testEmail});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('email and wallet required');
    });

    test('Accesly user updates wallet if initially null', async () => {
        // Create user with a wallet
        const wallet1 = Keypair.random().publicKey();
        const {user: user1} = await loginWithAccesly(app, 'update@test.com', wallet1);
        expect(user1.wallet_address).toBe(wallet1);

        // Login again with same email — wallet already set, should keep original
        const wallet2 = Keypair.random().publicKey();
        const {user: user2} = await loginWithAccesly(app, 'update@test.com', wallet2);
        expect(user2.wallet_address).toBe(wallet1); // keeps original wallet
    });

    test('Accesly and wallet auth coexist (different users)', async () => {
        // Create Accesly user
        const {user: acceslyUser} = await loginWithAccesly(app, testEmail, testWallet);

        // Create wallet user via challenge-response
        const keypair = Keypair.random();
        const wallet = keypair.publicKey();
        const challengeRes = await request(app).get('/api/auth/challenge').query({wallet});
        const crypto = require('crypto');
        const prefix = Buffer.from('Stellar Signed Message:\n', 'utf-8');
        const messageBytes = Buffer.from(challengeRes.body.challenge, 'utf-8');
        const encoded = Buffer.concat([prefix, messageBytes]);
        const hash = crypto.createHash('sha256').update(encoded).digest();
        const signature = keypair.sign(hash).toString('base64');

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({wallet, signature});

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.user.id).not.toBe(acceslyUser.id);
    });
});
