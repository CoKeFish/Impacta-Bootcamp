const pool = require('../config/db');

module.exports = {
    async create(businessId, name, description, price, imageUrl) {
        const {rows} = await pool.query(
            `INSERT INTO services (business_id, name, description, price, image_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [businessId, name, description, price, imageUrl || null]
        );
        return rows[0];
    },

    async findByBusiness(businessId) {
        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE s.business_id = $1 AND s.active = true
             ORDER BY s.name`,
            [businessId]
        );
        return rows;
    },

    async findById(id) {
        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE s.id = $1`,
            [id]
        );
        return rows[0] || null;
    },

    async findAll() {
        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE s.active = true AND b.active = true
             ORDER BY b.name, s.name`
        );
        return rows;
    },

    async search(query) {
        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE s.active = true AND b.active = true
               AND (s.name ILIKE $1 OR s.description ILIKE $1 OR b.name ILIKE $1)
             ORDER BY s.name`,
            [`%${query}%`]
        );
        return rows;
    },

    async update(id, fields) {
        const sets = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of Object.entries(fields)) {
            sets.push(`${key} = $${idx}`);
            values.push(value);
            idx++;
        }
        sets.push(`updated_at = NOW()`);
        values.push(id);

        const {rows} = await pool.query(
            `UPDATE services SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        return rows[0] || null;
    },
};
