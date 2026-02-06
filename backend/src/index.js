const app = require('./app');
const pool = require('./config/db');
const { initBuckets } = require('./config/minio');

const PORT = process.env.PORT || 3000;

async function init() {
    try {
        await pool.query('SELECT 1');
        console.log('Connected to PostgreSQL');

        await initBuckets();
        console.log('Connected to MinIO');
    } catch (error) {
        console.error('Initialization error:', error.message);
        process.exit(1);
    }
}

init().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`CoTravel API running on http://localhost:${PORT}`);
    });
});
