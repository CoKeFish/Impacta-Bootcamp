const tripModel = require('../models/tripModel');
const transactionModel = require('../models/transactionModel');
const sorobanService = require('../services/sorobanService');

module.exports = {
    // POST /api/trips - Create trip draft in DB
    async create(req, res, next) {
        try {
            const {name, description, target_amount, min_participants, penalty_percent, deadline} = req.body;

            if (!name || !target_amount || !min_participants || !deadline) {
                return res.status(400).json({
                    error: 'Required: name, target_amount, min_participants, deadline',
                });
            }

            // Use authenticated user (from JWT)
            const trip = await tripModel.create(
                req.user.id, name, description || null,
                target_amount, min_participants,
                penalty_percent || 10, deadline
            );

            res.status(201).json(trip);
        } catch (err) {
            next(err);
        }
    },

    // GET /api/trips - List all trips
    async getAll(req, res, next) {
        try {
            const trips = await tripModel.findAll();
            res.json(trips);
        } catch (err) {
            next(err);
        }
    },

    // GET /api/trips/:id - Get trip detail
    async getById(req, res, next) {
        try {
            const trip = await tripModel.findById(req.params.id);
            if (!trip) {
                return res.status(404).json({error: 'Trip not found'});
            }

            // If linked to contract, optionally refresh on-chain state
            if (trip.contract_trip_id !== null) {
                try {
                    const state = await sorobanService.getTripState(Number(trip.contract_trip_id));
                    if (state) {
                        trip.onchain = state;
                    }
                } catch (e) {
                    trip.onchain_error = e.message;
                }
            }

            res.json(trip);
        } catch (err) {
            next(err);
        }
    },

    // POST /api/trips/:id/link-contract - Submit create_trip XDR and link
    // Requires: requireAuth + loadTrip + requireOrganizer
    async linkContract(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const trip = req.trip;
            if (trip.contract_trip_id !== null) {
                return res.status(409).json({error: 'Trip already linked to contract'});
            }

            const result = await sorobanService.submitTx(signed_xdr);
            const contractTripId = result.returnValue;

            const updated = await tripModel.linkContract(trip.id, contractTripId);

            await transactionModel.create(
                trip.id, req.user.id, result.hash,
                'create_trip', 0, result.ledger, {contract_trip_id: contractTripId}
            );

            res.json({...updated, tx_hash: result.hash, contract_trip_id: contractTripId});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/trips/:id/release - Submit release XDR
    // Requires: requireAuth + loadTrip + requireOrganizer
    async release(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const trip = req.trip;
            const result = await sorobanService.submitTx(signed_xdr);
            const updated = await tripModel.updateStatus(trip.id, 'released');

            await transactionModel.create(
                trip.id, req.user.id, result.hash,
                'release', trip.total_collected || 0, result.ledger, null
            );

            res.json({...updated, tx_hash: result.hash});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/trips/:id/cancel - Submit cancel XDR
    // Requires: requireAuth + loadTrip + requireOrganizer
    async cancel(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const trip = req.trip;
            const result = await sorobanService.submitTx(signed_xdr);
            const updated = await tripModel.updateStatus(trip.id, 'cancelled');

            await transactionModel.create(
                trip.id, req.user.id, result.hash,
                'cancel', 0, result.ledger, null
            );

            res.json({...updated, tx_hash: result.hash});
        } catch (err) {
            next(err);
        }
    },
};
