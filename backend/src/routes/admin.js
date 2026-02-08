const router = require('express').Router();
const {requireAuth, requireAdmin} = require('../middleware/auth');
const adminCtrl = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// Dashboard stats
router.get('/stats', adminCtrl.getStats);

// Users management
router.get('/users', adminCtrl.getUsers);
router.put('/users/:id/role', adminCtrl.updateUserRole);

// Businesses oversight
router.get('/businesses', adminCtrl.getBusinesses);

// Invoices oversight
router.get('/invoices', adminCtrl.getInvoices);

module.exports = router;
