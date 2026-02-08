const pool = require('../config/db');

module.exports = {
    async create(invoiceId, userId) {
        const {rows} = await pool.query(
            `INSERT INTO invoice_participants (invoice_id, user_id)
             VALUES ($1, $2)
             RETURNING *`,
            [invoiceId, userId]
        );
        return rows[0];
    },

    async findByInvoiceAndUser(invoiceId, userId) {
        const {rows} = await pool.query(
            'SELECT * FROM invoice_participants WHERE invoice_id = $1 AND user_id = $2',
            [invoiceId, userId]
        );
        return rows[0] || null;
    },

    async findByInvoice(invoiceId) {
        const {rows} = await pool.query(
            `SELECT ip.*, u.wallet_address, u.username
             FROM invoice_participants ip
             JOIN users u ON ip.user_id = u.id
             WHERE ip.invoice_id = $1
             ORDER BY ip.joined_at`,
            [invoiceId]
        );
        return rows;
    },

    async updateAmount(invoiceId, userId, amount, version) {
        const {rows} = await pool.query(
            `UPDATE invoice_participants
             SET contributed_amount = $3, contributed_at_version = $4
             WHERE invoice_id = $1 AND user_id = $2
             RETURNING *`,
            [invoiceId, userId, amount, version]
        );
        return rows[0] || null;
    },

    async updateStatus(invoiceId, userId, status) {
        const {rows} = await pool.query(
            `UPDATE invoice_participants SET status = $3
             WHERE invoice_id = $1 AND user_id = $2
             RETURNING *`,
            [invoiceId, userId, status]
        );
        return rows[0] || null;
    },

    async updateConfirmedRelease(invoiceId, userId, confirmed) {
        const {rows} = await pool.query(
            `UPDATE invoice_participants SET confirmed_release = $3
             WHERE invoice_id = $1 AND user_id = $2
             RETURNING *`,
            [invoiceId, userId, confirmed]
        );
        return rows[0] || null;
    },

    async updatePenaltyAmount(invoiceId, userId, penaltyAmount) {
        const {rows} = await pool.query(
            `UPDATE invoice_participants SET penalty_amount = $3
             WHERE invoice_id = $1 AND user_id = $2
             RETURNING *`,
            [invoiceId, userId, penaltyAmount]
        );
        return rows[0] || null;
    },
};
