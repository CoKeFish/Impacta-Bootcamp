const userModel = require('../models/userModel');

module.exports = {
    async create(req, res, next) {
        try {
            const {wallet_address, username} = req.body;
            if (!wallet_address) {
                return res.status(400).json({error: 'wallet_address is required'});
            }

            const existing = await userModel.findByWallet(wallet_address);
            if (existing) {
                return res.status(409).json({error: 'User already exists', user: existing});
            }

            const user = await userModel.create(wallet_address, username || null);
            res.status(201).json(user);
        } catch (err) {
            next(err);
        }
    },

    async getByWallet(req, res, next) {
        try {
            const user = await userModel.findByWallet(req.params.wallet);
            if (!user) {
                return res.status(404).json({error: 'User not found'});
            }
            res.json(user);
        } catch (err) {
            next(err);
        }
    },
};
