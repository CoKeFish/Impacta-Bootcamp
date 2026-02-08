'use strict';

/**
 * HTTP API client for E2E integration tests.
 *
 * Wraps supertest calls to the Express app.  Provides:
 * - SEP-0053 challenge-response authentication
 * - Business / Service CRUD
 * - Invoice CRUD + every on-chain operation
 */

const request = require('supertest');
const crypto = require('crypto');

// ─── SEP-0053 challenge signing ──────────────────────────────────────────────

/**
 * Sign a challenge message exactly like Freighter / SEP-0053:
 *   SHA-256("Stellar Signed Message:\n" + message)  →  Ed25519 sign  →  base64
 */
function signChallenge(message, keypair) {
    const prefix = Buffer.from('Stellar Signed Message:\n', 'utf-8');
    const messageBytes = Buffer.from(message, 'utf-8');
    const encodedMessage = Buffer.concat([prefix, messageBytes]);
    const messageHash = crypto.createHash('sha256').update(encodedMessage).digest();
    return keypair.sign(messageHash).toString('base64');
}

// ─── ApiClient ───────────────────────────────────────────────────────────────

class ApiClient {
    /**
     * @param {Express.Application} app – the Express app object (used by supertest)
     */
    constructor(app) {
        this.app = app;
    }

    // ── Authentication ───────────────────────────────────────────────────

    /** Challenge-response auth. Returns {token, user}. */
    async authenticate(keypair) {
        const wallet = keypair.publicKey();

        const challengeRes = await request(this.app)
            .get('/api/auth/challenge')
            .query({wallet})
            .expect(200);

        const signature = signChallenge(challengeRes.body.challenge, keypair);

        const loginRes = await request(this.app)
            .post('/api/auth/login')
            .send({wallet, signature})
            .expect(200);

        return {token: loginRes.body.token, user: loginRes.body.user};
    }

    // ── Businesses ───────────────────────────────────────────────────────

    async createBusiness(token, data) {
        const res = await request(this.app)
            .post('/api/businesses')
            .set('Authorization', `Bearer ${token}`)
            .send(data);
        if (res.status >= 400) {
            throw new Error(`createBusiness ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    // ── Services ─────────────────────────────────────────────────────────

    async createService(token, data) {
        const res = await request(this.app)
            .post('/api/services')
            .set('Authorization', `Bearer ${token}`)
            .send(data);
        if (res.status >= 400) {
            throw new Error(`createService ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    // ── Invoices ─────────────────────────────────────────────────────────

    async createInvoice(token, data) {
        const res = await request(this.app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${token}`)
            .send(data);
        if (res.status >= 400) {
            throw new Error(`createInvoice ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async getInvoice(token, invoiceId) {
        const res = await request(this.app)
            .get(`/api/invoices/${invoiceId}`)
            .set('Authorization', `Bearer ${token}`);
        if (res.status >= 400) {
            throw new Error(`getInvoice ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async getParticipants(token, invoiceId) {
        const res = await request(this.app)
            .get(`/api/invoices/${invoiceId}/participants`)
            .set('Authorization', `Bearer ${token}`);
        if (res.status >= 400) {
            throw new Error(`getParticipants ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    // ── On-chain operations (require signed_xdr) ────────────────────────

    async linkContract(token, invoiceId, signedXdr) {
        const res = await request(this.app)
            .post(`/api/invoices/${invoiceId}/link-contract`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: signedXdr});
        if (res.status >= 400) {
            throw new Error(`linkContract ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async contribute(token, invoiceId, signedXdr, amount) {
        const res = await request(this.app)
            .post(`/api/invoices/${invoiceId}/contribute`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: signedXdr, amount});
        if (res.status >= 400) {
            throw new Error(`contribute ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async withdraw(token, invoiceId, signedXdr) {
        const res = await request(this.app)
            .post(`/api/invoices/${invoiceId}/withdraw`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: signedXdr});
        if (res.status >= 400) {
            throw new Error(`withdraw ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async release(token, invoiceId, signedXdr) {
        const res = await request(this.app)
            .post(`/api/invoices/${invoiceId}/release`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: signedXdr});
        if (res.status >= 400) {
            throw new Error(`release ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async cancel(token, invoiceId, signedXdr) {
        const res = await request(this.app)
            .post(`/api/invoices/${invoiceId}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: signedXdr});
        if (res.status >= 400) {
            throw new Error(`cancel ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async confirmRelease(token, invoiceId, signedXdr) {
        const res = await request(this.app)
            .post(`/api/invoices/${invoiceId}/confirm`)
            .set('Authorization', `Bearer ${token}`)
            .send({signed_xdr: signedXdr});
        if (res.status >= 400) {
            throw new Error(`confirmRelease ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async updateItems(token, invoiceId, data) {
        const res = await request(this.app)
            .put(`/api/invoices/${invoiceId}/items`)
            .set('Authorization', `Bearer ${token}`)
            .send(data);
        if (res.status >= 400) {
            throw new Error(`updateItems ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }

    async join(token, invoiceId) {
        const res = await request(this.app)
            .post(`/api/invoices/${invoiceId}/join`)
            .set('Authorization', `Bearer ${token}`);
        // 409 is OK (already joined)
        if (res.status >= 400 && res.status !== 409) {
            throw new Error(`join ${res.status}: ${JSON.stringify(res.body)}`);
        }
        return res.body;
    }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {ApiClient, signChallenge};
