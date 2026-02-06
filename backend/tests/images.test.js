const request = require('supertest');
const app = require('../src/app');
const { beginTransaction, rollbackTransaction } = require('./dbHelper');
const { minioClient, BUCKETS, initBuckets } = require('../src/config/minio');

// Track uploaded files for manual MinIO cleanup (can't rollback object storage)
let uploadedFiles = [];

beforeAll(async () => {
    await initBuckets();
});

beforeEach(async () => {
    await beginTransaction();
    uploadedFiles = [];
});

afterEach(async () => {
    for (const filename of uploadedFiles) {
        try {
            await minioClient.removeObject(BUCKETS.IMAGES, filename);
        } catch (_) { /* ignore cleanup errors */ }
    }
    await rollbackTransaction();
});

describe('Images', () => {
    test('POST /images/upload uploads image to MinIO', async () => {
        const res = await request(app)
            .post('/images/upload')
            .attach('image', Buffer.from('fake-png-data'), 'test-img.png');

        expect(res.status).toBe(201);
        expect(res.body.image).toBeDefined();
        expect(res.body.image.filename).toBeDefined();
        expect(res.body.url).toContain('/images/');
        uploadedFiles.push(res.body.image.filename);
    });

    test('POST /images/upload without file returns 400', async () => {
        const res = await request(app).post('/images/upload');
        expect(res.status).toBe(400);
    });

    test('GET /images/:filename returns image stream', async () => {
        // Upload first
        const upload = await request(app)
            .post('/images/upload')
            .attach('image', Buffer.from('fake-png-data'), 'stream-test.png');
        const filename = upload.body.image.filename;
        uploadedFiles.push(filename);

        const res = await request(app).get(`/images/${filename}`);
        expect(res.status).toBe(200);
    });

    test('GET /images/:filename non-existent returns 404', async () => {
        const res = await request(app).get('/images/does-not-exist-12345.png');
        expect(res.status).toBe(404);
    });

    test('GET /images returns list', async () => {
        const res = await request(app).get('/images');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
