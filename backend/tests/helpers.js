const { Keypair } = require('@stellar/stellar-sdk');
const request = require('supertest');

/**
 * Generate a random Stellar wallet, complete the challenge-response
 * auth flow, and return { token, user, keypair, wallet }.
 */
async function loginWithNewWallet(app) {
    const keypair = Keypair.random();
    const wallet = keypair.publicKey();

    // 1. Get challenge
    const challengeRes = await request(app)
        .get('/api/auth/challenge')
        .query({ wallet });

    const message = challengeRes.body.challenge;

    // 2. Sign challenge
    const signature = keypair
        .sign(Buffer.from(message, 'utf-8'))
        .toString('base64');

    // 3. Login
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ wallet, signature });

    return {
        token: loginRes.body.token,
        user: loginRes.body.user,
        keypair,
        wallet,
    };
}

/**
 * Create a trip draft authenticated with the given token.
 * Returns the trip object from the response body.
 */
async function createTestTrip(app, token) {
    const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: 'Test Trip ' + Date.now(),
            description: 'Integration test trip',
            target_amount: 1000,
            min_participants: 2,
            penalty_percent: 10,
            deadline: new Date(Date.now() + 86400000).toISOString(),
        });

    return res.body;
}

module.exports = { loginWithNewWallet, createTestTrip };
