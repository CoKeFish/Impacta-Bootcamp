const pool = require('../config/db');

module.exports = {
    async createMany(invoiceId, items) {
        if (!items.length) return [];

        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const item of items) {
            placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`);
            values.push(
                invoiceId,
                item.service_id || null,
                item.description,
                item.amount,
                item.recipient_wallet || null,
                item.sort_order || 0
            );
            idx += 6;
        }

        const {rows} = await pool.query(
            `INSERT INTO invoice_items (invoice_id, service_id, description, amount, recipient_wallet, sort_order)
             VALUES ${placeholders.join(', ')}
             RETURNING *`,
            values
        );
        return rows;
    },

    async findByInvoice(invoiceId) {
        const {rows} = await pool.query(
            `SELECT ii.*, s.name as service_name, b.name as business_name
             FROM invoice_items ii
             LEFT JOIN services s ON ii.service_id = s.id
             LEFT JOIN businesses b ON s.business_id = b.id
             WHERE ii.invoice_id = $1
             ORDER BY ii.sort_order, ii.id`,
            [invoiceId]
        );
        return rows;
    },

    async replaceAll(invoiceId, items) {
        await pool.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

        if (!items.length) return [];

        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const item of items) {
            placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`);
            values.push(
                invoiceId,
                item.service_id || null,
                item.description,
                item.amount,
                item.recipient_wallet || null,
                item.sort_order || 0
            );
            idx += 6;
        }

        const {rows} = await pool.query(
            `INSERT INTO invoice_items (invoice_id, service_id, description, amount, recipient_wallet, sort_order)
             VALUES ${placeholders.join(', ')}
             RETURNING *`,
            values
        );
        return rows;
    },
};
