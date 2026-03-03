const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { requireCustomer } = require('../middleware/roleCheck');
const { validate, schemas } = require('../middleware/validate');

router.use(authenticate, requireCustomer);

router.post('/initialize', validate(schemas.paymentInit), paymentController.initializePayment);
router.get('/verify', paymentController.verifyPayment);

module.exports = router;
