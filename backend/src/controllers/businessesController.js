const businessModel = require('../models/businessModel');

module.exports = {
    async create(req, res, next) {
        try {
            const {name, category, description, logo_url, wallet_address, contact_email, location, schedule, contact_info, location_data} = req.body;

            if (!name) {
                return res.status(400).json({error: 'Required: name'});
            }

            // Sync contact_email from contact_info for backward compat
            const syncedEmail = contact_info?.email || contact_email || null;

            // Compute location display string from location_data
            const computedLocation = location_data
                ? [location_data.address, location_data.city, location_data.country].filter(Boolean).join(', ')
                : (location || null);

            const business = await businessModel.create(
                req.user.id, name, category || null,
                description || null, logo_url || null,
                wallet_address || null, syncedEmail,
                computedLocation, schedule || null, contact_info || null,
                location_data || null
            );

            res.status(201).json(business);
        } catch (err) {
            next(err);
        }
    },

    async getCategories(req, res, next) {
        try {
            const categories = await businessModel.findDistinctCategories();
            res.json(categories);
        } catch (err) {
            next(err);
        }
    },

    async getLocations(req, res, next) {
        try {
            const locations = await businessModel.findDistinctLocations();
            res.json(locations);
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
            const allowed = ['name', 'category', 'description', 'logo_url', 'wallet_address', 'contact_email', 'location', 'active', 'schedule', 'contact_info', 'location_data'];
            const fields = {};
            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    if (key === 'schedule' || key === 'contact_info' || key === 'location_data') {
                        fields[key] = req.body[key] ? JSON.stringify(req.body[key]) : null;
                    } else {
                        fields[key] = req.body[key];
                    }
                }
            }

            // Sync contact_email from contact_info for backward compat
            if (fields.contact_info && req.body.contact_info?.email) {
                fields.contact_email = req.body.contact_info.email;
            }

            // Sync location display string from location_data
            if (req.body.location_data) {
                const ld = req.body.location_data;
                fields.location = [ld.address, ld.city, ld.country].filter(Boolean).join(', ');
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
