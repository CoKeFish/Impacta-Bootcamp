const {Keypair} = require('@stellar/stellar-sdk');
const crypto = require('crypto');
const request = require('supertest');

/**
 * Sign a challenge message following SEP-0053 (same as Freighter's signMessage).
 * 1. Prepend "Stellar Signed Message:\n"
 * 2. SHA-256 hash the concatenated bytes
 * 3. Ed25519 sign the hash
 * Returns base64-encoded signature.
 */
function signChallenge(message, keypair) {
    const prefix = Buffer.from('Stellar Signed Message:\n', 'utf-8');
    const messageBytes = Buffer.from(message, 'utf-8');
    const encodedMessage = Buffer.concat([prefix, messageBytes]);
    const messageHash = crypto.createHash('sha256').update(encodedMessage).digest();
    return keypair.sign(messageHash).toString('base64');
}

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
        .query({wallet});

    const message = challengeRes.body.challenge;

    // 2. Sign challenge (SEP-0053)
    const signature = signChallenge(message, keypair);

    // 3. Login
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({wallet, signature});

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

module.exports = {loginWithNewWallet, createTestTrip, signChallenge};
