const pool = require('../config/db');

module.exports = {
    async create(filename, mimetype, size, tripId, uploadedBy) {
        const {rows} = await pool.query(
            `INSERT INTO images (filename, mimetype, size, trip_id, uploaded_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [filename, mimetype, size, tripId || null, uploadedBy || null]
        );
        return rows[0];
    },

    async findAll() {
        const {rows} = await pool.query(
            'SELECT * FROM images ORDER BY created_at DESC'
        );
        return rows;
    },
};
