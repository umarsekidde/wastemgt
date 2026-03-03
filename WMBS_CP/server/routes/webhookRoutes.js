const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { webhookLimiter } = require('../middleware/rateLimit');

router.post('/flutterwave', webhookLimiter, express.json(), webhookController.flutterwaveWebhook);

module.exports = router;
