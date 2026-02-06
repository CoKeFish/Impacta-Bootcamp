const router = require('express').Router();
const ctrl = require('../controllers/usersController');

router.post('/', ctrl.create);
router.get('/:wallet', ctrl.getByWallet);

module.exports = router;
