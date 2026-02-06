const pool = require('../config/db');

module.exports = {
    async findByTripAndUser(tripId, userId) {
        const {rows} = await pool.query(
            'SELECT * FROM trip_participants WHERE trip_id = $1 AND user_id = $2',
            [tripId, userId]
        );
        return rows[0] || null;
    },

    async findByTrip(tripId) {
        const {rows} = await pool.query(
            `SELECT tp.*, u.wallet_address, u.username
             FROM trip_participants tp
             JOIN users u ON tp.user_id = u.id
             WHERE tp.trip_id = $1
             ORDER BY tp.joined_at`,
            [tripId]
        );
        return rows;
    },

    async create(tripId, userId) {
        const {rows} = await pool.query(
            `INSERT INTO trip_participants (trip_id, user_id)
             VALUES ($1, $2)
             RETURNING *`,
            [tripId, userId]
        );
        return rows[0];
    },

    async updateAmount(tripId, userId, amount) {
        const {rows} = await pool.query(
            `UPDATE trip_participants SET contributed_amount = $3
             WHERE trip_id = $1 AND user_id = $2
             RETURNING *`,
            [tripId, userId, amount]
        );
        return rows[0] || null;
    },

    async updateStatus(tripId, userId, status) {
        const {rows} = await pool.query(
            `UPDATE trip_participants SET status = $3
             WHERE trip_id = $1 AND user_id = $2
             RETURNING *`,
            [tripId, userId, status]
        );
        return rows[0] || null;
    },
};
