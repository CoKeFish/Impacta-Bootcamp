const invoiceParticipantModel = require('../models/invoiceParticipantModel');
const invoiceModel = require('../models/invoiceModel');
const transactionModel = require('../models/transactionModel');
const sorobanService = require('../services/sorobanService');
const logger = require('../config/logger');

const STROOPS_PER_XLM = 10_000_000;

function stroopsToXlm(stroops) {
    return Number(stroops) / STROOPS_PER_XLM;
}

module.exports = {
    // POST /api/invoices/:id/join
    async join(req, res, next) {
        try {
            const invoice = req.invoice;

            const existing = await invoiceParticipantModel.findByInvoiceAndUser(invoice.id, req.user.id);
            if (existing) {
                if (existing.status === 'withdrawn') {
                    const reactivated = await invoiceParticipantModel.reactivate(invoice.id, req.user.id);
                    logger.info({invoiceId: invoice.id, userId: req.user.id}, 'Participant rejoined invoice');
                    return res.json(reactivated);
                }
                return res.status(409).json({error: 'Already joined this invoice', participant: existing});
            }

            const participant = await invoiceParticipantModel.create(invoice.id, req.user.id);
            logger.info({invoiceId: invoice.id, userId: req.user.id}, 'Participant joined invoice');
            res.status(201).json(participant);
        } catch (err) {
            next(err);
        }
    },

    // POST /api/invoices/:id/contribute
    async recordContribution(req, res, next) {
        try {
            const {signed_xdr, amount} = req.body;
            if (!signed_xdr || !amount) {
                return res.status(400).json({error: 'Required: signed_xdr, amount'});
            }

            const invoice = req.invoice;

            let participant = await invoiceParticipantModel.findByInvoiceAndUser(invoice.id, req.user.id);
            if (!participant) {
                participant = await invoiceParticipantModel.create(invoice.id, req.user.id);
                logger.info({invoiceId: invoice.id, userId: req.user.id}, 'Participant auto-joined via contribution');
            }

            const result = await sorobanService.submitTx(signed_xdr);

            await transactionModel.create(
                invoice.id, req.user.id, result.hash,
                'contribute', amount, result.ledger, null
            );

            const newAmount = parseFloat(participant.contributed_amount) + parseFloat(amount);
            await invoiceParticipantModel.updateAmount(
                invoice.id, req.user.id, newAmount, invoice.version
            );

            try {
                const state = await sorobanService.getTripState(Number(invoice.contract_invoice_id));
                if (state) {
                    const status = state.status?.toLowerCase() || invoice.status;
                    await invoiceModel.updateFinancials(
                        invoice.id, stroopsToXlm(state.total_collected || 0),
                        state.participant_count || 0, status
                    );
                }
            } catch (e) {
                logger.warn({invoiceId: invoice.id, err: e.message}, 'On-chain sync failed after contribution');
            }

            logger.info({
                invoiceId: invoice.id,
                userId: req.user.id,
                amount,
                txHash: result.hash
            }, 'Contribution recorded');

            const updatedInvoice = await invoiceModel.findById(invoice.id);
            res.json({tx_hash: result.hash, contributed: newAmount, invoice: updatedInvoice});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/invoices/:id/withdraw
    async recordWithdrawal(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const invoice = req.invoice;
            const participant = await invoiceParticipantModel.findByInvoiceAndUser(invoice.id, req.user.id);
            if (!participant) {
                return res.status(404).json({error: 'Not a participant of this invoice'});
            }

            const result = await sorobanService.submitTx(signed_xdr);

            await transactionModel.create(
                invoice.id, req.user.id, result.hash,
                'withdraw', participant.contributed_amount, result.ledger, null
            );

            await invoiceParticipantModel.updateStatus(invoice.id, req.user.id, 'withdrawn');
            await invoiceParticipantModel.updateAmount(invoice.id, req.user.id, 0, participant.contributed_at_version);

            try {
                if (invoice.contract_invoice_id !== null) {
                    const state = await sorobanService.getTripState(Number(invoice.contract_invoice_id));
                    if (state) {
                        const status = state.status?.toLowerCase() || invoice.status;
                        await invoiceModel.updateFinancials(
                            invoice.id, stroopsToXlm(state.total_collected || 0),
                            state.participant_count || 0, status
                        );
                    }

                    const penalty = await sorobanService.getPenalty(
                        Number(invoice.contract_invoice_id), req.user.wallet_address
                    );
                    if (penalty !== null) {
                        await invoiceParticipantModel.updatePenaltyAmount(
                            invoice.id, req.user.id, stroopsToXlm(penalty)
                        );
                    }
                }
            } catch (e) {
                logger.warn({invoiceId: invoice.id, err: e.message}, 'On-chain sync failed after withdrawal');
            }

            logger.info({invoiceId: invoice.id, userId: req.user.id, txHash: result.hash}, 'Withdrawal recorded');

            const updatedInvoice = await invoiceModel.findById(invoice.id);
            res.json({tx_hash: result.hash, invoice: updatedInvoice});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/invoices/:id/confirm
    async confirmRelease(req, res, next) {
        try {
            const invoice = req.invoice;
            const participant = await invoiceParticipantModel.findByInvoiceAndUser(invoice.id, req.user.id);
            if (!participant) {
                return res.status(404).json({error: 'Not a participant of this invoice'});
            }

            if (participant.confirmed_release) {
                return res.status(409).json({error: 'Already confirmed release'});
            }

            if (req.body.signed_xdr) {
                const result = await sorobanService.submitTx(req.body.signed_xdr);

                await transactionModel.create(
                    invoice.id, req.user.id, result.hash,
                    'confirm_release', 0, result.ledger, null
                );
            }

            const updated = await invoiceParticipantModel.updateConfirmedRelease(
                invoice.id, req.user.id, true
            );

            const updatedInvoice = await invoiceModel.incrementConfirmationCount(invoice.id);

            // Check if confirm_release triggered an auto-release on-chain
            // (happens when all participants have confirmed)
            let finalInvoice = updatedInvoice;
            if (invoice.pool_id != null) {
                try {
                    const onChainState = await sorobanService.getTripState(Number(invoice.pool_id));
                    if (onChainState && onChainState.status === 'released') {
                        finalInvoice = await invoiceModel.updateStatus(invoice.id, 'released');
                        logger.info({invoiceId: invoice.id}, 'Auto-release detected after confirm_release');
                    }
                } catch (syncErr) {
                    logger.warn({invoiceId: invoice.id, err: syncErr}, 'Failed to sync on-chain state after confirm_release');
                }
            }

            logger.info({
                invoiceId: invoice.id,
                userId: req.user.id,
                confirmationCount: finalInvoice.confirmation_count
            }, 'Release confirmed');

            res.json({
                participant: updated,
                confirmation_count: finalInvoice.confirmation_count,
                status: finalInvoice.status,
            });
        } catch (err) {
            next(err);
        }
    },

    // GET /api/invoices/:id/participants
    async list(req, res, next) {
        try {
            const invoice = await invoiceModel.findById(req.params.id);
            if (!invoice) {
                return res.status(404).json({error: 'Invoice not found'});
            }
            const participants = await invoiceParticipantModel.findByInvoice(invoice.id);
            res.json(participants);
        } catch (err) {
            next(err);
        }
    },
};
