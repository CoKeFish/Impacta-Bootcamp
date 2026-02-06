const pool = require('../config/db');

module.exports = {
    async findByWallet(walletAddress) {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE wallet_address = $1',
            [walletAddress]
        );
        return rows[0] || null;
    },

    async findById(id) {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return rows[0] || null;
    },

    async create(walletAddress, username) {
        const { rows } = await pool.query(
            'INSERT INTO users (wallet_address, username) VALUES ($1, $2) RETURNING *',
            [walletAddress, username]
        );
        return rows[0];
    },
};
