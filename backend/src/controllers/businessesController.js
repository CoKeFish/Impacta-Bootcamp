const businessModel = require('../models/businessModel');

module.exports = {
    async create(req, res, next) {
        try {
            const {name, category, description, logo_url, wallet_address, contact_email} = req.body;

            if (!name) {
                return res.status(400).json({error: 'Required: name'});
            }

            const business = await businessModel.create(
                req.user.id, name, category || null,
                description || null, logo_url || null,
                wallet_address || null, contact_email || null
            );

            res.status(201).json(business);
        } catch (err) {
            next(err);
        }
    },

    async getAll(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const businesses = await businessModel.findAll({page, limit});
            res.json(businesses);
        } catch (err) {
            next(err);
        }
    },

    async getMyBusinesses(req, res, next) {
        try {
            const businesses = await businessModel.findByOwner(req.user.id);
            res.json(businesses);
        } catch (err) {
            next(err);
        }
    },

    async getById(req, res, next) {
        try {
            const business = await businessModel.findById(req.params.id);
            if (!business) {
                return res.status(404).json({error: 'Business not found'});
            }
            res.json(business);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            const allowed = ['name', 'category', 'description', 'logo_url', 'wallet_address', 'contact_email', 'active'];
            const fields = {};
            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    fields[key] = req.body[key];
                }
            }

            if (Object.keys(fields).length === 0) {
                return res.status(400).json({error: 'No fields to update'});
            }

            const updated = await businessModel.update(req.params.id, fields);
            if (!updated) {
                return res.status(404).json({error: 'Business not found'});
            }
            res.json(updated);
        } catch (err) {
            next(err);
        }
    },
};
