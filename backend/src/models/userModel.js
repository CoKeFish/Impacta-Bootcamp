const pool = require('../config/db');

module.exports = {
    async findByWallet(walletAddress) {
        const {rows} = await pool.query(
            'SELECT * FROM users WHERE wallet_address = $1',
            [walletAddress]
        );
        return rows[0] || null;
    },

    async findById(id) {
        const {rows} = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return rows[0] || null;
    },

    async findAll({page = 1, limit = 50} = {}) {
        const offset = (page - 1) * Math.min(limit, 100);
        const {rows} = await pool.query(
            'SELECT id, wallet_address, username, avatar_url, role, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [Math.min(limit, 100), offset]
        );
        return rows;
    },

    async count() {
        const {rows} = await pool.query('SELECT COUNT(*)::int as total FROM users');
        return rows[0].total;
    },

    async create(walletAddress, username) {
        const {rows} = await pool.query(
            'INSERT INTO users (wallet_address, username) VALUES ($1, $2) RETURNING *',
            [walletAddress, username]
        );
        return rows[0];
    },

    async updateRole(id, role) {
        const {rows} = await pool.query(
            'UPDATE users SET role = $2 WHERE id = $1 RETURNING *',
            [id, role]
        );
        return rows[0] || null;
    },
};
