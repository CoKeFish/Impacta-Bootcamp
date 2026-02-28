const router = require('express').Router();
const businessesCtrl = require('../controllers/businessesController');
const servicesCtrl = require('../controllers/servicesController');
const {requireAuth, loadBusiness, requireBusinessOwner, validateId} = require('../middleware/auth');

// Public (catalog)
router.get('/categories', businessesCtrl.getCategories);
router.get('/locations', businessesCtrl.getLocations);
router.get('/', businessesCtrl.getAll);
router.get('/:id', validateId, businessesCtrl.getById);
router.get('/:id/services', validateId, servicesCtrl.getByBusiness);

// My businesses (dashboard)
router.get('/my/list', requireAuth, businessesCtrl.getMyBusinesses);

// Protected
router.post('/', requireAuth, businessesCtrl.create);
router.put('/:id', validateId, requireAuth, loadBusiness, requireBusinessOwner, businessesCtrl.update);

module.exports = router;
