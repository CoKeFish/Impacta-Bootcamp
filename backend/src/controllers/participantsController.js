const participantModel = require('../models/participantModel');
const tripModel = require('../models/tripModel');
const transactionModel = require('../models/transactionModel');
const sorobanService = require('../services/sorobanService');

module.exports = {
    // POST /api/trips/:id/join - Join a trip (off-chain)
    // Requires: requireAuth + loadTrip
    async join(req, res, next) {
        try {
            const trip = req.trip;

            // Check if already joined
            const existing = await participantModel.findByTripAndUser(trip.id, req.user.id);
            if (existing) {
                return res.status(409).json({ error: 'Already joined this trip', participant: existing });
            }

            const participant = await participantModel.create(trip.id, req.user.id);
            res.status(201).json(participant);
        } catch (err) {
            next(err);
        }
    },

    // POST /api/trips/:id/contribute - Submit contribute XDR
    // Requires: requireAuth + loadTrip
    async recordContribution(req, res, next) {
        try {
            const { signed_xdr, amount } = req.body;
            if (!signed_xdr || !amount) {
                return res.status(400).json({ error: 'Required: signed_xdr, amount' });
            }

            const trip = req.trip;

            // Auto-join if not a participant yet
            let participant = await participantModel.findByTripAndUser(trip.id, req.user.id);
            if (!participant) {
                participant = await participantModel.create(trip.id, req.user.id);
            }

            // Submit to Soroban
            const result = await sorobanService.submitTx(signed_xdr);

            // Record transaction
            await transactionModel.create(
                trip.id, req.user.id, result.hash,
                'contribution', amount, result.ledger, null
            );

            // Update cache
            const newAmount = parseFloat(participant.contributed_amount) + parseFloat(amount);
            await participantModel.updateAmount(trip.id, req.user.id, newAmount);

            // Refresh trip state from on-chain
            try {
                const state = await sorobanService.getTripState(Number(trip.contract_trip_id));
                if (state) {
                    const status = state.status?.toLowerCase() || trip.status;
                    await tripModel.updateFinancials(
                        trip.id, state.total_collected || 0,
                        state.participant_count || 0, status
                    );
                }
            } catch (e) {
                // On-chain sync failed, cache may be stale
            }

            const updatedTrip = await tripModel.findById(trip.id);
            res.json({ tx_hash: result.hash, contributed: newAmount, trip: updatedTrip });
        } catch (err) {
            next(err);
        }
    },

    // POST /api/trips/:id/withdraw - Submit withdraw XDR
    // Requires: requireAuth + loadTrip
    async recordWithdrawal(req, res, next) {
        try {
            const { signed_xdr } = req.body;
            if (!signed_xdr) {
                return res.status(400).json({ error: 'signed_xdr is required' });
            }

            const trip = req.trip;
            const participant = await participantModel.findByTripAndUser(trip.id, req.user.id);
            if (!participant) {
                return res.status(404).json({ error: 'Not a participant of this trip' });
            }

            // Submit to Soroban
            const result = await sorobanService.submitTx(signed_xdr);

            await transactionModel.create(
                trip.id, req.user.id, result.hash,
                'withdrawal', participant.contributed_amount, result.ledger, null
            );

            await participantModel.updateStatus(trip.id, req.user.id, 'withdrawn');
            await participantModel.updateAmount(trip.id, req.user.id, 0);

            // Refresh trip state
            try {
                const state = await sorobanService.getTripState(Number(trip.contract_trip_id));
                if (state) {
                    const status = state.status?.toLowerCase() || trip.status;
                    await tripModel.updateFinancials(
                        trip.id, state.total_collected || 0,
                        state.participant_count || 0, status
                    );
                }
            } catch (e) {
                // On-chain sync failed
            }

            const updatedTrip = await tripModel.findById(trip.id);
            res.json({ tx_hash: result.hash, trip: updatedTrip });
        } catch (err) {
            next(err);
        }
    },

    // GET /api/trips/:id/participants - List participants (public)
    async list(req, res, next) {
        try {
            const trip = await tripModel.findById(req.params.id);
            if (!trip) {
                return res.status(404).json({ error: 'Trip not found' });
            }
            const participants = await participantModel.findByTrip(trip.id);
            res.json(participants);
        } catch (err) {
            next(err);
        }
    },
};
