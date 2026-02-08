const app = require('./app');
const pool = require('./config/db');
const {initBuckets} = require('./config/minio');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3000;

async function init() {
    try {
        await pool.query('SELECT 1');
        logger.info('Connected to PostgreSQL');

        await initBuckets();
        logger.info('Connected to MinIO');
    } catch (error) {
        logger.fatal({err: error}, 'Initialization failed');
        process.exit(1);
    }
}

init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        logger.info({port: PORT}, `CoTravel API running on http://localhost:${PORT}`);
    });
});
