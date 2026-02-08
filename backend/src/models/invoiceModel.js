const pool = require('../config/db');

module.exports = {
    async create(organizerId, name, description, totalAmount, minParticipants, penaltyPercent, deadline, opts = {}) {
        const {rows} = await pool.query(
            `INSERT INTO invoices (organizer_id, name, description, total_amount, min_participants,
                                   penalty_percent, deadline, icon, token_address, auto_release, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
             RETURNING *`,
            [
                organizerId, name, description, totalAmount, minParticipants, penaltyPercent, deadline,
                opts.icon || null, opts.token_address || null, opts.auto_release || false,
            ]
        );
        return rows[0];
    },

    async findAll({page = 1, limit = 20} = {}) {
        const offset = (page - 1) * Math.min(limit, 100);
        const {rows} = await pool.query(
            `SELECT i.id, i.name, i.description, i.icon, i.status, i.total_amount, i.total_collected,
                    i.participant_count, i.deadline, i.created_at,
                    u.wallet_address as organizer_wallet, u.username as organizer_name
             FROM invoices i
             JOIN users u ON i.organizer_id = u.id
             ORDER BY i.created_at DESC
             LIMIT $1 OFFSET $2`,
            [Math.min(limit, 100), offset]
        );
        return rows;
    },

    async findById(id) {
        const {rows} = await pool.query(
            `SELECT i.*, u.wallet_address as organizer_wallet, u.username as organizer_name
             FROM invoices i
             JOIN users u ON i.organizer_id = u.id
             WHERE i.id = $1`,
            [id]
        );
        return rows[0] || null;
    },

    async findByUser(userId, {page = 1, limit = 20} = {}) {
        const offset = (page - 1) * Math.min(limit, 100);
        const {rows} = await pool.query(
            `SELECT DISTINCT i.id, i.name, i.description, i.icon, i.status, i.total_amount,
                    i.total_collected, i.participant_count, i.deadline, i.created_at,
                    u.wallet_address as organizer_wallet, u.username as organizer_name,
                    CASE WHEN i.organizer_id = $1 THEN 'organizer' ELSE 'participant' END as user_role
             FROM invoices i
             JOIN users u ON i.organizer_id = u.id
             LEFT JOIN invoice_participants ip ON ip.invoice_id = i.id AND ip.user_id = $1
             WHERE i.organizer_id = $1 OR ip.user_id = $1
             ORDER BY i.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, Math.min(limit, 100), offset]
        );
        return rows;
    },

    async countByUser(userId) {
        const {rows} = await pool.query(
            `SELECT COUNT(DISTINCT i.id)::int as total
             FROM invoices i
             LEFT JOIN invoice_participants ip ON ip.invoice_id = i.id AND ip.user_id = $1
             WHERE i.organizer_id = $1 OR ip.user_id = $1`,
            [userId]
        );
        return rows[0].total;
    },

    async count() {
        const {rows} = await pool.query('SELECT COUNT(*)::int as total FROM invoices');
        return rows[0].total;
    },

    async linkContract(id, contractInvoiceId) {
        const {rows} = await pool.query(
            `UPDATE invoices SET contract_invoice_id = $2, status = 'funding', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, contractInvoiceId]
        );
        return rows[0] || null;
    },

    async updateStatus(id, status) {
        const {rows} = await pool.query(
            `UPDATE invoices SET status = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, status]
        );
        return rows[0] || null;
    },

    async updateFinancials(id, totalCollected, participantCount, status) {
        const {rows} = await pool.query(
            `UPDATE invoices SET total_collected = $2, participant_count = $3, status = $4, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, totalCollected, participantCount, status]
        );
        return rows[0] || null;
    },

    async updateTotalAmount(id, totalAmount) {
        const {rows} = await pool.query(
            `UPDATE invoices SET total_amount = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, totalAmount]
        );
        return rows[0] || null;
    },

    async incrementVersion(id) {
        const {rows} = await pool.query(
            `UPDATE invoices SET version = version + 1, confirmation_count = 0, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return rows[0] || null;
    },

    async incrementConfirmationCount(id) {
        const {rows} = await pool.query(
            `UPDATE invoices SET confirmation_count = confirmation_count + 1, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return rows[0] || null;
    },
};
