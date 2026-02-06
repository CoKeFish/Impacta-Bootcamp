const router = require('express').Router();
const authCtrl = require('../controllers/authController');
const {requireAuth} = require('../middleware/auth');

// Public (no auth needed)
router.get('/challenge', authCtrl.getChallenge);
router.post('/login', authCtrl.login);

// Protected (requires JWT)
router.get('/me', requireAuth, authCtrl.me);

module.exports = router;
