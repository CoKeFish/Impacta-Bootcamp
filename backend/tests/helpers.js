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
 * Create a business registered by the given user.
 * Returns the business object from the response body.
 */
async function createTestBusiness(app, token) {
    const res = await request(app)
        .post('/api/businesses')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: 'Test Business ' + Date.now(),
            category: 'hotel',
            description: 'Test business for integration tests',
            wallet_address: Keypair.random().publicKey(),
            contact_email: 'test@example.com',
        });

    return res.body;
}

/**
 * Create a service for a given business.
 * Returns the service object from the response body.
 */
async function createTestService(app, token, businessId) {
    const res = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
            business_id: businessId,
            name: 'Test Service ' + Date.now(),
            description: 'Test service',
            price: 500,
        });

    return res.body;
}

/**
 * Create an invoice with items.
 * Returns the invoice object from the response body.
 */
async function createTestInvoice(app, token, items) {
    const defaultItems = items || [
        {description: 'Item 1', amount: 500, recipient_wallet: Keypair.random().publicKey()},
        {description: 'Item 2', amount: 500, recipient_wallet: Keypair.random().publicKey()},
    ];

    const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: 'Test Invoice ' + Date.now(),
            description: 'Integration test invoice',
            items: defaultItems,
            min_participants: 2,
            penalty_percent: 10,
            deadline: new Date(Date.now() + 86400000).toISOString(),
        });

    return res.body;
}

module.exports = {
    loginWithNewWallet, signChallenge,
    createTestBusiness, createTestService, createTestInvoice,
};
