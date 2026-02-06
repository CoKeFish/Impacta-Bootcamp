const Minio = require('minio');

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'minio',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKETS = {
    IMAGES: 'images',
};

async function initBuckets() {
    for (const bucket of Object.values(BUCKETS)) {
        const exists = await minioClient.bucketExists(bucket);
        if (!exists) {
            await minioClient.makeBucket(bucket);
            console.log(`Bucket "${bucket}" created`);
        }
    }
}

module.exports = {minioClient, BUCKETS, initBuckets};
