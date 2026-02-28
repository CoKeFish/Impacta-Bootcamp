const cartModel = require('../models/cartModel');
const serviceModel = require('../models/serviceModel');
const invoiceModel = require('../models/invoiceModel');
const invoiceItemModel = require('../models/invoiceItemModel');

module.exports = {
    async getCart(req, res, next) {
        try {
            const items = await cartModel.findByUser(req.user.id);
            const count = await cartModel.countByUser(req.user.id);
            res.json({items, count});
        } catch (err) {
            next(err);
        }
    },

    async addItem(req, res, next) {
        try {
            const {service_id, quantity} = req.body;

            if (!service_id) {
                return res.status(400).json({error: 'Required: service_id'});
            }

            const service = await serviceModel.findById(service_id);
            if (!service) {
                return res.status(404).json({error: 'Service not found'});
            }
            if (!service.active) {
                return res.status(400).json({error: 'Service is not active'});
            }

            const item = await cartModel.addItem(req.user.id, service_id, quantity || 1);
            res.status(201).json(item);
        } catch (err) {
            next(err);
        }
    },

    async updateItem(req, res, next) {
        try {
            const {quantity} = req.body;

            if (!quantity || quantity < 1) {
                return res.status(400).json({error: 'Quantity must be at least 1'});
            }

            const item = await cartModel.findById(req.params.id);
            if (!item) {
                return res.status(404).json({error: 'Cart item not found'});
            }
            if (item.user_id !== req.user.id) {
                return res.status(403).json({error: 'Not your cart item'});
            }

            const updated = await cartModel.updateQuantity(req.params.id, quantity);
            res.json(updated);
        } catch (err) {
            next(err);
        }
    },

    async removeItem(req, res, next) {
        try {
            const item = await cartModel.findById(req.params.id);
            if (!item) {
                return res.status(404).json({error: 'Cart item not found'});
            }
            if (item.user_id !== req.user.id) {
                return res.status(403).json({error: 'Not your cart item'});
            }

            await cartModel.removeItem(req.params.id);
            res.json({message: 'Item removed'});
        } catch (err) {
            next(err);
        }
    },

    async clearCart(req, res, next) {
        try {
            await cartModel.clearByUser(req.user.id);
            res.json({message: 'Cart cleared'});
        } catch (err) {
            next(err);
        }
    },

    async checkout(req, res, next) {
        try {
            const {name, description, icon, deadline, min_participants, penalty_percent, auto_release} = req.body;

            if (!name || !deadline) {
                return res.status(400).json({error: 'Required: name, deadline'});
            }

            const cartItems = await cartModel.findByUser(req.user.id);
            if (cartItems.length === 0) {
                return res.status(400).json({error: 'Cart is empty'});
            }

            // Build invoice items from cart
            const invoiceItems = cartItems.map((ci, idx) => ({
                service_id: ci.service_id,
                description: ci.service_name,
                amount: parseFloat(ci.price) * ci.quantity,
                recipient_wallet: ci.business_wallet || null,
                sort_order: idx,
            }));

            const totalAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

            const invoice = await invoiceModel.create(
                req.user.id, name, description || null, totalAmount,
                min_participants || 1, penalty_percent || 10, deadline,
                {icon: icon || null, auto_release: auto_release || false}
            );

            await invoiceItemModel.createMany(invoice.id, invoiceItems);
            await cartModel.clearByUser(req.user.id);

            const result = await invoiceModel.findById(invoice.id);
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    },
};
