const invoiceModel = require('../models/invoiceModel');
const invoiceItemModel = require('../models/invoiceItemModel');
const invoiceModificationModel = require('../models/invoiceModificationModel');
const transactionModel = require('../models/transactionModel');
const sorobanService = require('../services/sorobanService');
const logger = require('../config/logger');

// Validate amount: finite positive number
function parseAmount(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
        return null;
    }
    return num;
}

module.exports = {
    // POST /api/invoices
    async create(req, res, next) {
        try {
            const {
                name, description, items, min_participants,
                penalty_percent, deadline, icon, token_address, auto_release,
            } = req.body;

            if (!name || !items || !items.length || !deadline) {
                return res.status(400).json({
                    error: 'Required: name, items (array with at least one item), deadline',
                });
            }

            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                return res.status(400).json({error: 'Invalid deadline format'});
            }
            if (deadlineDate <= new Date()) {
                return res.status(400).json({error: 'Deadline must be in the future'});
            }

            for (const item of items) {
                if (!item.description || parseAmount(item.amount) === null) {
                    return res.status(400).json({error: 'Each item must have a description and valid positive amount'});
                }
            }

            const totalAmount = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
            if (totalAmount <= 0) {
                return res.status(400).json({error: 'Total amount must be positive'});
            }

            const invoice = await invoiceModel.create(
                req.user.id, name, description || null,
                totalAmount, min_participants || 1,
                penalty_percent !== undefined ? penalty_percent : 10,
                deadline,
                {icon, token_address, auto_release}
            );

            const itemsWithOrder = items.map((item, idx) => ({
                ...item,
                sort_order: item.sort_order !== undefined ? item.sort_order : idx,
            }));
            const createdItems = await invoiceItemModel.createMany(invoice.id, itemsWithOrder);

            logger.info({
                invoiceId: invoice.id,
                userId: req.user.id,
                totalAmount,
                itemCount: items.length
            }, 'Invoice created');
            res.status(201).json({...invoice, items: createdItems});
        } catch (err) {
            next(err);
        }
    },

    // GET /api/invoices/my
    async getMyInvoices(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const [invoices, total] = await Promise.all([
                invoiceModel.findByUser(req.user.id, {page, limit}),
                invoiceModel.countByUser(req.user.id),
            ]);
            res.json({data: invoices, total, page, limit});
        } catch (err) {
            next(err);
        }
    },

    // GET /api/invoices/:id
    async getById(req, res, next) {
        try {
            const invoice = req.invoice;
            invoice.items = await invoiceItemModel.findByInvoice(invoice.id);

            if (invoice.contract_invoice_id !== null) {
                try {
                    const state = await sorobanService.getTripState(Number(invoice.contract_invoice_id));
                    if (state) {
                        invoice.onchain = state;
                    }
                } catch (e) {
                    logger.warn({invoiceId: invoice.id, err: e.message}, 'Failed to fetch on-chain state');
                    invoice.onchain_error = 'Unable to fetch on-chain state';
                }
            }

            res.json(invoice);
        } catch (err) {
            next(err);
        }
    },

    // POST /api/invoices/:id/link-contract
    async linkContract(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const invoice = req.invoice;
            if (invoice.contract_invoice_id !== null) {
                return res.status(409).json({error: 'Invoice already linked to contract'});
            }

            const result = await sorobanService.submitTx(signed_xdr);
            const contractInvoiceId = result.returnValue;

            const updated = await invoiceModel.linkContract(invoice.id, contractInvoiceId);

            await transactionModel.create(
                invoice.id, req.user.id, result.hash,
                'create', 0, result.ledger, {contract_invoice_id: contractInvoiceId}
            );

            logger.info({invoiceId: invoice.id, contractInvoiceId, txHash: result.hash}, 'Invoice linked to contract');
            res.json({...updated, tx_hash: result.hash, contract_invoice_id: contractInvoiceId});
        } catch (err) {
            next(err);
        }
    },

    // PUT /api/invoices/:id/items
    async updateItems(req, res, next) {
        try {
            const {items, change_summary, signed_xdr} = req.body;

            if (!items || !items.length) {
                return res.status(400).json({error: 'Required: items (array with at least one item)'});
            }

            for (const item of items) {
                if (!item.description || parseAmount(item.amount) === null) {
                    return res.status(400).json({error: 'Each item must have a description and valid positive amount'});
                }
            }

            const invoice = req.invoice;

            if (invoice.contract_invoice_id !== null && !signed_xdr) {
                return res.status(400).json({
                    error: 'signed_xdr required for invoices linked to contract (update_recipients)',
                });
            }

            let txHash = null;
            if (signed_xdr) {
                const result = await sorobanService.submitTx(signed_xdr);
                txHash = result.hash;

                await transactionModel.create(
                    invoice.id, req.user.id, result.hash,
                    'update_recipients', 0, result.ledger,
                    {change_summary: change_summary || 'Items updated'}
                );
            }

            const currentItems = await invoiceItemModel.findByInvoice(invoice.id);

            const itemsWithOrder = items.map((item, idx) => ({
                ...item,
                sort_order: item.sort_order !== undefined ? item.sort_order : idx,
            }));
            const newItems = await invoiceItemModel.replaceAll(invoice.id, itemsWithOrder);

            const newTotal = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
            await invoiceModel.updateTotalAmount(invoice.id, newTotal);

            const updated = await invoiceModel.incrementVersion(invoice.id);

            await invoiceModificationModel.create(
                invoice.id, updated.version,
                change_summary || 'Items updated',
                currentItems
            );

            logger.info({
                invoiceId: invoice.id,
                version: updated.version,
                itemCount: items.length,
                newTotal
            }, 'Invoice items updated');

            const response = {...updated, items: newItems};
            if (txHash) response.tx_hash = txHash;
            res.json(response);
        } catch (err) {
            next(err);
        }
    },

    // POST /api/invoices/:id/release
    async release(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const invoice = req.invoice;
            if (!['funding', 'completed'].includes(invoice.status)) {
                return res.status(400).json({error: 'Can only release invoices in funding or completed status'});
            }

            const result = await sorobanService.submitTx(signed_xdr);
            const updated = await invoiceModel.updateStatus(invoice.id, 'released');

            await transactionModel.create(
                invoice.id, req.user.id, result.hash,
                'release', invoice.total_collected || 0, result.ledger, null
            );

            logger.info({
                invoiceId: invoice.id,
                txHash: result.hash,
                amount: invoice.total_collected
            }, 'Invoice released');
            res.json({...updated, tx_hash: result.hash});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/invoices/:id/cancel
    async cancel(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const invoice = req.invoice;
            if (!['draft', 'funding', 'completed'].includes(invoice.status)) {
                return res.status(400).json({error: 'Can only cancel invoices in draft, funding, or completed status'});
            }

            const result = await sorobanService.submitTx(signed_xdr);
            const updated = await invoiceModel.updateStatus(invoice.id, 'cancelled');

            await transactionModel.create(
                invoice.id, req.user.id, result.hash,
                'cancel', 0, result.ledger, null
            );

            logger.info({
                invoiceId: invoice.id,
                txHash: result.hash,
                previousStatus: invoice.status
            }, 'Invoice cancelled');
            res.json({...updated, tx_hash: result.hash});
        } catch (err) {
            next(err);
        }
    },

    // POST /api/invoices/:id/claim-deadline
    async claimDeadline(req, res, next) {
        try {
            const {signed_xdr} = req.body;
            if (!signed_xdr) {
                return res.status(400).json({error: 'signed_xdr is required'});
            }

            const invoice = req.invoice;
            if (invoice.contract_invoice_id === null) {
                return res.status(400).json({error: 'Invoice not linked to contract'});
            }

            const result = await sorobanService.submitTx(signed_xdr);
            const updated = await invoiceModel.updateStatus(invoice.id, 'cancelled');

            await transactionModel.create(
                invoice.id, req.user.id, result.hash,
                'claim_deadline', 0, result.ledger, null
            );

            logger.info({
                invoiceId: invoice.id,
                txHash: result.hash,
                claimedBy: req.user.id
            }, 'Invoice deadline claimed');
            res.json({...updated, tx_hash: result.hash});
        } catch (err) {
            next(err);
        }
    },
};
