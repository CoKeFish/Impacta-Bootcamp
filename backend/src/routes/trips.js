const router = require('express').Router();
const tripsCtrl = require('../controllers/tripsController');
const participantsCtrl = require('../controllers/participantsController');
const {requireAuth, requireOrganizer, loadTrip} = require('../middleware/auth');

// Public (anyone can browse)
router.get('/', tripsCtrl.getAll);
router.get('/:id', tripsCtrl.getById);
router.get('/:id/participants', participantsCtrl.list);

// Protected (requires login)
router.post('/', requireAuth, tripsCtrl.create);
router.post('/:id/join', requireAuth, loadTrip, participantsCtrl.join);
router.post('/:id/contribute', requireAuth, loadTrip, participantsCtrl.recordContribution);
router.post('/:id/withdraw', requireAuth, loadTrip, participantsCtrl.recordWithdrawal);

// Organizer only
router.post('/:id/link-contract', requireAuth, loadTrip, requireOrganizer, tripsCtrl.linkContract);
router.post('/:id/release', requireAuth, loadTrip, requireOrganizer, tripsCtrl.release);
router.post('/:id/cancel', requireAuth, loadTrip, requireOrganizer, tripsCtrl.cancel);

module.exports = router;
