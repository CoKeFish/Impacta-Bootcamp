const router = require('express').Router();
const invoicesCtrl = require('../controllers/invoicesController');
const invoiceParticipantsCtrl = require('../controllers/invoiceParticipantsController');
const {
    requireAuth,
    requireInvoiceOrganizer,
    requireInvoiceAccess,
    loadInvoice,
    validateId
} = require('../middleware/auth');

// My invoices (dashboard)
router.get('/my', requireAuth, invoicesCtrl.getMyInvoices);

// Detail (auth required, scoped to organizer/participant/admin)
router.get('/:id', validateId, requireAuth, loadInvoice, requireInvoiceAccess, invoicesCtrl.getById);
router.get('/:id/participants', validateId, requireAuth, loadInvoice, requireInvoiceAccess, invoiceParticipantsCtrl.list);

// Create
router.post('/', requireAuth, invoicesCtrl.create);

// Participant actions
router.post('/:id/join', validateId, requireAuth, loadInvoice, invoiceParticipantsCtrl.join);
router.post('/:id/contribute', validateId, requireAuth, loadInvoice, invoiceParticipantsCtrl.recordContribution);
router.post('/:id/withdraw', validateId, requireAuth, loadInvoice, invoiceParticipantsCtrl.recordWithdrawal);
router.post('/:id/confirm', validateId, requireAuth, loadInvoice, invoiceParticipantsCtrl.confirmRelease);

// Organizer only
router.post('/:id/link-contract', validateId, requireAuth, loadInvoice, requireInvoiceOrganizer, invoicesCtrl.linkContract);
router.put('/:id/items', validateId, requireAuth, loadInvoice, requireInvoiceOrganizer, invoicesCtrl.updateItems);
router.post('/:id/release', validateId, requireAuth, loadInvoice, requireInvoiceOrganizer, invoicesCtrl.release);
router.post('/:id/cancel', validateId, requireAuth, loadInvoice, requireInvoiceOrganizer, invoicesCtrl.cancel);

// Deadline claim (any authenticated user)
router.post('/:id/claim-deadline', validateId, requireAuth, loadInvoice, invoicesCtrl.claimDeadline);

module.exports = router;
