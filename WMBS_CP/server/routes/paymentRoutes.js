const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireCustomer } = require('../middleware/roleCheck');
const { validate, schemas } = require('../middleware/validate');

router.post('/initialize', authenticate, requireCustomer, validate(schemas.paymentInit), paymentController.initializePayment);
router.post('/confirm', authenticate, requireCustomer, paymentController.confirmPayment);
router.get('/verify', optionalAuth, paymentController.verifyPayment);
router.get('/pesapal/callback', optionalAuth, paymentController.pesapalCallback);

module.exports = router;
