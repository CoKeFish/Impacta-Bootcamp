const request = require('supertest');
const app = require('../src/app');
const { beginTransaction, rollbackTransaction } = require('./dbHelper');

beforeEach(() => beginTransaction());
afterEach(() => rollbackTransaction());

describe('Health Checks', () => {
    test('GET / returns API running message', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('CoTravel API running');
        expect(res.body.version).toBe('1.0.0');
    });

    test('GET /health returns DB connected', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('connected');
    });
});
