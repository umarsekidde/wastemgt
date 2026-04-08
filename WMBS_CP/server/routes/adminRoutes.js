const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');

router.use(authenticate, requireAdmin);

router.get('/', adminController.dashboard);
router.get('/collectors', adminController.collectors);
router.post('/collectors', adminController.addCollector);
router.post('/assign-collector', adminController.assignCollector);
router.get('/requests', adminController.requests);
router.post('/requests/:id/approve', adminController.approveRequest);
router.get('/api/truck-locations', adminController.getTruckLocations);
router.get('/api/notifications/latest', notificationController.latestForCurrentUser);
router.get('/revenue', adminController.revenue);
router.get('/customers', adminController.customers);
router.get('/performance', adminController.performance);
router.get('/invoice/:id', adminController.generateInvoice);

module.exports = router;
