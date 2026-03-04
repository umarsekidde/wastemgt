const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');
const { requireCustomer } = require('../middleware/roleCheck');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate, requireCustomer);

router.get('/', customerController.dashboard);
router.post('/request-pickup', validate(schemas.wasteRequest), customerController.requestPickup);
router.post('/requests/:id/cancel', customerController.cancelRequest);
router.put('/requests/:id', customerController.modifyRequest);
router.get('/complaints', customerController.complaints);
router.post('/complaints', validate(schemas.complaint), customerController.createComplaint);
router.get('/notifications', customerController.notifications);
router.get('/payment-history', customerController.paymentHistory);
router.get('/invoice/:id/download', customerController.downloadInvoice);

module.exports = router;
