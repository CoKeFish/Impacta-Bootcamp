const pool = require('../config/db');

module.exports = {
    async create(ownerId, name, category, description, logoUrl, walletAddress, contactEmail) {
        const {rows} = await pool.query(
            `INSERT INTO businesses (owner_id, name, category, description, logo_url, wallet_address, contact_email)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [ownerId, name, category, description, logoUrl, walletAddress, contactEmail]
        );
        return rows[0];
    },

    async findAll({page = 1, limit = 20} = {}) {
        const offset = (page - 1) * Math.min(limit, 100);
        const {rows} = await pool.query(
            `SELECT b.*, u.wallet_address as owner_wallet, u.username as owner_name
             FROM businesses b
             JOIN users u ON b.owner_id = u.id
             WHERE b.active = true
             ORDER BY b.created_at DESC
             LIMIT $1 OFFSET $2`,
            [Math.min(limit, 100), offset]
        );
        return rows;
    },

    async count() {
        const {rows} = await pool.query('SELECT COUNT(*)::int as total FROM businesses WHERE active = true');
        return rows[0].total;
    },

    async findById(id) {
        const {rows} = await pool.query(
            `SELECT b.*, u.wallet_address as owner_wallet, u.username as owner_name
             FROM businesses b
             JOIN users u ON b.owner_id = u.id
             WHERE b.id = $1`,
            [id]
        );
        return rows[0] || null;
    },

    async findByOwner(ownerId) {
        const {rows} = await pool.query(
            `SELECT * FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC`,
            [ownerId]
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
            `UPDATE businesses SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        return rows[0] || null;
    },
};
