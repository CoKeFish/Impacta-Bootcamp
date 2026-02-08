const pool = require('../config/db');

module.exports = {
    async create(invoiceId, userId, txHash, type, amount, ledgerSequence, eventData) {
        const {rows} = await pool.query(
            `INSERT INTO transactions (invoice_id, user_id, tx_hash, type, amount, ledger_sequence, event_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [invoiceId, userId, txHash, type, amount, ledgerSequence, eventData]
        );
        return rows[0];
    },

    async findByInvoice(invoiceId) {
        const {rows} = await pool.query(
            `SELECT tx.*, u.wallet_address, u.username
             FROM transactions tx
             JOIN users u ON tx.user_id = u.id
             WHERE tx.invoice_id = $1
             ORDER BY tx.created_at DESC`,
            [invoiceId]
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
