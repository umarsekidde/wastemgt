const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { requireCustomer } = require('../middleware/roleCheck');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate, requireCustomer);

router.get('/', customerController.dashboard);
router.get('/my-requests', customerController.myRequests);
router.post('/request-pickup', validate(schemas.wasteRequest), customerController.requestPickup);
router.post('/requests/:id/cancel', customerController.cancelRequest);
router.put('/requests/:id', customerController.modifyRequest);
router.get('/complaints', customerController.complaints);
router.post('/complaints', validate(schemas.complaint), customerController.createComplaint);
router.post('/complaints/:id/reply', customerController.replyComplaint);
router.get('/notifications', customerController.notifications);
router.get('/api/notifications/latest', notificationController.latestForCurrentUser);
router.post('/api/notifications/:id/read', notificationController.markReadForCurrentUser);
router.get('/api/push/public-key', notificationController.pushPublicKey);
router.post('/api/push/subscribe', notificationController.subscribePush);
router.post('/api/push/unsubscribe', notificationController.unsubscribePush);
router.get('/payment-history', customerController.paymentHistory);
router.get('/invoice/:id/download', customerController.downloadInvoice);

module.exports = router;
