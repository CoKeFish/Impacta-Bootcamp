const userModel = require('../models/userModel');
const businessModel = require('../models/businessModel');
const invoiceModel = require('../models/invoiceModel');
const logger = require('../config/logger');

module.exports = {
    // GET /api/admin/stats
    async getStats(req, res, next) {
        try {
            const [users, businesses, invoices] = await Promise.all([
                userModel.count(),
                businessModel.count(),
                invoiceModel.count(),
            ]);
            res.json({users, businesses, invoices});
        } catch (err) {
            next(err);
        }
    },

    // GET /api/admin/users?page=1&limit=50
    async getUsers(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
            const [users, total] = await Promise.all([
                userModel.findAll({page, limit}),
                userModel.count(),
            ]);
            res.json({data: users, total, page, limit});
        } catch (err) {
            next(err);
        }
    },

    // PUT /api/admin/users/:id/role  { role: "admin" | "user" }
    async updateUserRole(req, res, next) {
        try {
            const {role} = req.body;
            const validRoles = ['user', 'admin'];
            if (!role || !validRoles.includes(role)) {
                return res.status(400).json({error: `Role must be one of: ${validRoles.join(', ')}`});
            }

            const id = parseInt(req.params.id, 10);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({error: 'Invalid user ID'});
            }

            // Prevent admin from removing their own admin role
            if (id === req.user.id && role !== 'admin') {
                return res.status(400).json({error: 'Cannot remove your own admin role'});
            }

            const user = await userModel.updateRole(id, role);
            if (!user) {
                return res.status(404).json({error: 'User not found'});
            }
            logger.info({targetUserId: id, newRole: role, changedBy: req.user.id}, 'User role updated');
            res.json(user);
        } catch (err) {
            next(err);
        }
    },

    // GET /api/admin/businesses?page=1&limit=20
    async getBusinesses(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const [businesses, total] = await Promise.all([
                businessModel.findAll({page, limit}),
                businessModel.count(),
            ]);
            res.json({data: businesses, total, page, limit});
        } catch (err) {
            next(err);
        }
    },

    // GET /api/admin/invoices?page=1&limit=20
    async getInvoices(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const [invoices, total] = await Promise.all([
                invoiceModel.findAll({page, limit}),
                invoiceModel.count(),
            ]);
            res.json({data: invoices, total, page, limit});
        } catch (err) {
            next(err);
        }
    },
};
