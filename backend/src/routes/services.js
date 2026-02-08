const router = require('express').Router();
const servicesCtrl = require('../controllers/servicesController');
const {requireAuth, validateId} = require('../middleware/auth');

// Public (catalog)
router.get('/', servicesCtrl.getAll);
router.get('/:id', validateId, servicesCtrl.getById);

// Protected
router.post('/', requireAuth, servicesCtrl.create);
router.put('/:id', validateId, requireAuth, servicesCtrl.update);

module.exports = router;
