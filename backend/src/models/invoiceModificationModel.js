const pool = require('../config/db');

module.exports = {
    async create(invoiceId, version, changeSummary, itemsSnapshot) {
        const {rows} = await pool.query(
            `INSERT INTO invoice_modifications (invoice_id, version, change_summary, items_snapshot)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [invoiceId, version, changeSummary, JSON.stringify(itemsSnapshot)]
        );
        return rows[0];
    },

    async findByInvoice(invoiceId) {
        const {rows} = await pool.query(
            `SELECT * FROM invoice_modifications
             WHERE invoice_id = $1
             ORDER BY version DESC`,
            [invoiceId]
        );
        return rows;
    },
};
