const pool = require('../config/db');

module.exports = {
    async create(businessId, name, description, price, imageUrl, location, schedule, contactInfo, locationData) {
        const {rows} = await pool.query(
            `INSERT INTO services (business_id, name, description, price, image_url, location, schedule, contact_info, location_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [businessId, name, description, price, imageUrl || null, location || null,
                schedule ? JSON.stringify(schedule) : null,
                contactInfo ? JSON.stringify(contactInfo) : null,
                locationData ? JSON.stringify(locationData) : null]
        );
        return rows[0];
    },

    async findByBusiness(businessId) {
        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet,
                    COALESCE(s.location, b.location) as effective_location,
                    COALESCE(s.location_data, b.location_data) as effective_location_data,
                    COALESCE(s.schedule, b.schedule) as effective_schedule,
                    COALESCE(s.contact_info, b.contact_info) as effective_contact_info
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
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet,
                    COALESCE(s.location, b.location) as effective_location,
                    COALESCE(s.location_data, b.location_data) as effective_location_data,
                    COALESCE(s.schedule, b.schedule) as effective_schedule,
                    COALESCE(s.contact_info, b.contact_info) as effective_contact_info,
                    b.schedule as business_schedule,
                    b.contact_info as business_contact_info,
                    b.location_data as business_location_data
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE s.id = $1`,
            [id]
        );
        return rows[0] || null;
    },

    async findAll() {
        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet,
                    COALESCE(s.location, b.location) as effective_location,
                    COALESCE(s.location_data, b.location_data) as effective_location_data,
                    COALESCE(s.schedule, b.schedule) as effective_schedule,
                    COALESCE(s.contact_info, b.contact_info) as effective_contact_info
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE s.active = true AND b.active = true
             ORDER BY b.name, s.name`
        );
        return rows;
    },

    async search(query) {
        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet,
                    COALESCE(s.location, b.location) as effective_location,
                    COALESCE(s.location_data, b.location_data) as effective_location_data,
                    COALESCE(s.schedule, b.schedule) as effective_schedule,
                    COALESCE(s.contact_info, b.contact_info) as effective_contact_info
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE s.active = true AND b.active = true
               AND (s.name ILIKE $1 OR s.description ILIKE $1 OR b.name ILIKE $1)
             ORDER BY s.name`,
            [`%${query}%`]
        );
        return rows;
    },

    async findFiltered({q, category, min_price, max_price, business_id, location} = {}) {
        const conditions = ['s.active = true', 'b.active = true'];
        const values = [];
        let idx = 1;

        if (q) {
            conditions.push(`(s.name ILIKE $${idx} OR s.description ILIKE $${idx} OR b.name ILIKE $${idx})`);
            values.push(`%${q}%`);
            idx++;
        }
        if (category) {
            conditions.push(`b.category = $${idx}`);
            values.push(category);
            idx++;
        }
        if (min_price !== undefined && min_price !== null) {
            conditions.push(`s.price >= $${idx}`);
            values.push(min_price);
            idx++;
        }
        if (max_price !== undefined && max_price !== null) {
            conditions.push(`s.price <= $${idx}`);
            values.push(max_price);
            idx++;
        }
        if (business_id) {
            conditions.push(`s.business_id = $${idx}`);
            values.push(business_id);
            idx++;
        }
        if (location) {
            conditions.push(`COALESCE(s.location, b.location) ILIKE $${idx}`);
            values.push(`%${location}%`);
            idx++;
        }

        const {rows} = await pool.query(
            `SELECT s.*, b.name as business_name, b.wallet_address as business_wallet, b.category as business_category,
                    COALESCE(s.location, b.location) as effective_location,
                    COALESCE(s.location_data, b.location_data) as effective_location_data,
                    COALESCE(s.schedule, b.schedule) as effective_schedule,
                    COALESCE(s.contact_info, b.contact_info) as effective_contact_info
             FROM services s
             JOIN businesses b ON s.business_id = b.id
             WHERE ${conditions.join(' AND ')}
             ORDER BY b.name, s.name`,
            values
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
