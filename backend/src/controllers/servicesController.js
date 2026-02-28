const serviceModel = require('../models/serviceModel');
const businessModel = require('../models/businessModel');

module.exports = {
    async create(req, res, next) {
        try {
            const {business_id, name, description, price, image_url, location, schedule, contact_info, location_data} = req.body;

            if (!business_id || !name || price === undefined) {
                return res.status(400).json({error: 'Required: business_id, name, price'});
            }

            // Verify business exists and user owns it
            const business = await businessModel.findById(business_id);
            if (!business) {
                return res.status(404).json({error: 'Business not found'});
            }
            if (business.owner_id !== req.user.id) {
                return res.status(403).json({error: 'Only the business owner can add services'});
            }

            // Compute location display string from location_data
            const computedLocation = location_data
                ? [location_data.address, location_data.city, location_data.country].filter(Boolean).join(', ')
                : (location || null);

            const service = await serviceModel.create(
                business_id, name, description || null, price, image_url || null, computedLocation,
                schedule || null, contact_info || null, location_data || null
            );

            res.status(201).json(service);
        } catch (err) {
            next(err);
        }
    },

    async getAll(req, res, next) {
        try {
            const {q, category, min_price, max_price, business_id, location} = req.query;
            const hasFilters = q || category || min_price || max_price || business_id || location;
            const services = hasFilters
                ? await serviceModel.findFiltered({q, category, min_price, max_price, business_id, location})
                : await serviceModel.findAll();
            res.json(services);
        } catch (err) {
            next(err);
        }
    },

    async getById(req, res, next) {
        try {
            const service = await serviceModel.findById(req.params.id);
            if (!service) {
                return res.status(404).json({error: 'Service not found'});
            }
            res.json(service);
        } catch (err) {
            next(err);
        }
    },

    async getByBusiness(req, res, next) {
        try {
            const services = await serviceModel.findByBusiness(req.params.id);
            res.json(services);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            const service = await serviceModel.findById(req.params.id);
            if (!service) {
                return res.status(404).json({error: 'Service not found'});
            }

            // Verify ownership
            const business = await businessModel.findById(service.business_id);
            if (business.owner_id !== req.user.id) {
                return res.status(403).json({error: 'Only the business owner can update services'});
            }

            const allowed = ['name', 'description', 'price', 'image_url', 'location', 'active', 'schedule', 'contact_info', 'location_data'];
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

            // Sync location display string from location_data
            if (req.body.location_data) {
                const ld = req.body.location_data;
                fields.location = [ld.address, ld.city, ld.country].filter(Boolean).join(', ');
            }

            const updated = await serviceModel.update(req.params.id, fields);
            res.json(updated);
        } catch (err) {
            next(err);
        }
    },
};
