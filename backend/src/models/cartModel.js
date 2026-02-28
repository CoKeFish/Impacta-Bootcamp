const pool = require('../config/db');

module.exports = {
    async findByUser(userId) {
        const {rows} = await pool.query(
            `SELECT ci.*, s.name as service_name, s.description as service_description,
                    s.price, s.image_url, s.active as service_active,
                    b.id as business_id, b.name as business_name, b.wallet_address as business_wallet
             FROM cart_items ci
             JOIN services s ON ci.service_id = s.id
             JOIN businesses b ON s.business_id = b.id
             WHERE ci.user_id = $1
             ORDER BY ci.added_at DESC`,
            [userId]
        );
        return rows;
    },

    async countByUser(userId) {
        const {rows} = await pool.query(
            `SELECT COALESCE(SUM(quantity), 0)::int as total
             FROM cart_items
             WHERE user_id = $1`,
            [userId]
        );
        return rows[0].total;
    },

    async addItem(userId, serviceId, quantity = 1) {
        const {rows} = await pool.query(
            `INSERT INTO cart_items (user_id, service_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, service_id)
             DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, added_at = NOW()
             RETURNING *`,
            [userId, serviceId, quantity]
        );
        return rows[0];
    },

    async findById(id) {
        const {rows} = await pool.query(
            `SELECT ci.*, s.name as service_name, s.price
             FROM cart_items ci
             JOIN services s ON ci.service_id = s.id
             WHERE ci.id = $1`,
            [id]
        );
        return rows[0] || null;
    },

    async updateQuantity(id, quantity) {
        const {rows} = await pool.query(
            `UPDATE cart_items SET quantity = $2 WHERE id = $1 RETURNING *`,
            [id, quantity]
        );
        return rows[0] || null;
    },

    async removeItem(id) {
        const {rows} = await pool.query(
            `DELETE FROM cart_items WHERE id = $1 RETURNING *`,
            [id]
        );
        return rows[0] || null;
    },

    async clearByUser(userId) {
        const {rowCount} = await pool.query(
            `DELETE FROM cart_items WHERE user_id = $1`,
            [userId]
        );
        return rowCount;
    },
};
