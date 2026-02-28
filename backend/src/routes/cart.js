const router = require('express').Router();
const cartCtrl = require('../controllers/cartController');
const {requireAuth, validateId} = require('../middleware/auth');

router.get('/', requireAuth, cartCtrl.getCart);
router.post('/items', requireAuth, cartCtrl.addItem);
router.put('/items/:id', validateId, requireAuth, cartCtrl.updateItem);
router.delete('/items/:id', validateId, requireAuth, cartCtrl.removeItem);
router.delete('/', requireAuth, cartCtrl.clearCart);
router.post('/checkout', requireAuth, cartCtrl.checkout);

module.exports = router;
