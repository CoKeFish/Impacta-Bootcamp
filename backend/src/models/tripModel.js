const pool = require('../config/db');

module.exports = {
    async create(organizerId, name, description, targetAmount, minParticipants, penaltyPercent, deadline) {
        const { rows } = await pool.query(
            `INSERT INTO trips (organizer_id, name, description, target_amount, min_participants, penalty_percent, deadline, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
             RETURNING *`,
            [organizerId, name, description, targetAmount, minParticipants, penaltyPercent, deadline]
        );
        return rows[0];
    },

    async findAll() {
        const { rows } = await pool.query(
            `SELECT t.*, u.wallet_address as organizer_wallet, u.username as organizer_name
             FROM trips t
             JOIN users u ON t.organizer_id = u.id
             ORDER BY t.created_at DESC`
        );
        return rows;
    },

    async findById(id) {
        const { rows } = await pool.query(
            `SELECT t.*, u.wallet_address as organizer_wallet, u.username as organizer_name
             FROM trips t
             JOIN users u ON t.organizer_id = u.id
             WHERE t.id = $1`,
            [id]
        );
        return rows[0] || null;
    },

    async linkContract(id, contractTripId, txHash) {
        const { rows } = await pool.query(
            `UPDATE trips SET contract_trip_id = $2, status = 'funding', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, contractTripId]
        );
        return rows[0] || null;
    },

    async updateStatus(id, status) {
        const { rows } = await pool.query(
            `UPDATE trips SET status = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, status]
        );
        return rows[0] || null;
    },

    async updateFinancials(id, totalCollected, participantCount, status) {
        const { rows } = await pool.query(
            `UPDATE trips SET total_collected = $2, participant_count = $3, status = $4, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, totalCollected, participantCount, status]
        );
        return rows[0] || null;
    },
};
