/**
 * Transaction-based test isolation.
 *
 * Every test runs inside BEGIN / ROLLBACK so the database
 * is never modified between tests.  Works because all models
 * go through the shared `pool` singleton.
 */
const pool = require('../src/config/db');

let client;
let originalQuery;

async function beginTransaction() {
    client = await pool.connect();
    await client.query('BEGIN');
    originalQuery = pool.query;
    // Redirect all pool.query calls to the transactional client
    pool.query = (...args) => client.query(...args);
}

async function rollbackTransaction() {
    await client.query('ROLLBACK');
    pool.query = originalQuery;
    client.release();
}

module.exports = {beginTransaction, rollbackTransaction, pool};
