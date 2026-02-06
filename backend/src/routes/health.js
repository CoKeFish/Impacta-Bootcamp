const router = require('express').Router();
const pool = require('../config/db');
const {minioClient} = require('../config/minio');

router.get('/', async (req, res) => {
    const health = {status: 'ok', database: 'disconnected', storage: 'disconnected'};

    try {
        await pool.query('SELECT 1');
        health.database = 'connected';
    } catch (error) {
        health.status = 'error';
        health.database_error = error.message;
    }

    try {
        await minioClient.listBuckets();
        health.storage = 'connected';
    } catch (error) {
        health.status = 'error';
        health.storage_error = error.message;
    }

    const statusCode = health.status === 'ok' ? 200 : 500;
    res.status(statusCode).json(health);
});

module.exports = router;
