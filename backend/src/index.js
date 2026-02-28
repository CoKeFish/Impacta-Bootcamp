const app = require('./app');
const pool = require('./config/db');
const {initBuckets} = require('./config/minio');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3000;

async function waitFor(fn, label, retries = 10, delay = 3000) {
    for (let i = 1; i <= retries; i++) {
        try {
            await fn();
            logger.info(`Connected to ${label}`);
            return;
        } catch (err) {
            logger.warn({err, attempt: i, retries}, `Waiting for ${label}...`);
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function init() {
    try {
        await waitFor(() => pool.query('SELECT 1'), 'PostgreSQL');
        await waitFor(() => initBuckets(), 'MinIO');
    } catch (error) {
        logger.fatal({err: error}, 'Initialization failed after retries');
        process.exit(1);
    }
}

init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        logger.info({port: PORT}, `CoTravel API running on http://localhost:${PORT}`);
    });
});
