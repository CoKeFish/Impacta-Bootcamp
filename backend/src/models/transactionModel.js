const pool = require('../config/db');

module.exports = {
    async create(tripId, userId, txHash, type, amount, ledgerSequence, eventData) {
        const {rows} = await pool.query(
            `INSERT INTO transactions (trip_id, user_id, tx_hash, type, amount, ledger_sequence, event_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [tripId, userId, txHash, type, amount, ledgerSequence, eventData]
        );
        return rows[0];
    },

    async findByTrip(tripId) {
        const {rows} = await pool.query(
            `SELECT tx.*, u.wallet_address, u.username
             FROM transactions tx
             JOIN users u ON tx.user_id = u.id
             WHERE tx.trip_id = $1
             ORDER BY tx.created_at DESC`,
            [tripId]
        );
        return rows;
    },

    async findByHash(txHash) {
        const {rows} = await pool.query(
            'SELECT * FROM transactions WHERE tx_hash = $1',
            [txHash]
        );
        return rows[0] || null;
    },
};
