const db = require('../models');
const flutterwaveService = require('../services/flutterwaveService');
const emailService = require('../services/emailService');

exports.flutterwaveWebhook = async (req, res) => {
  const signature = req.headers['verif-hash'] || req.headers['x-verif-hash'];
  if (signature && !flutterwaveService.verifyWebhookSignature(signature)) {
    return res.status(401).send('Invalid signature');
  }

  res.status(200).send('OK');

  const event = req.body.event;
  const data = req.body.data || req.body;

  if (event === 'charge.completed' || data?.status === 'successful') {
    const txId = data.id || data.tx_id;
    const txRef = data.tx_ref;
    try {
      const payment = await db.Payment.findOne({ where: { flutterwave_tx_id: txRef } });
      if (payment && payment.status === 'pending') {
        payment.status = 'success';
        await payment.save();
        const user = await db.User.findByPk(payment.user_id);
        if (user) await emailService.sendPaymentSuccess(user.email, payment.amount, payment.invoice_number).catch(() => {});
      }
    } catch (err) {
      console.error('Webhook process error:', err);
    }
  }

  if (event === 'charge.failed' || data?.status === 'failed') {
    const txRef = data.tx_ref;
    try {
      await db.Payment.update({ status: 'failed' }, { where: { flutterwave_tx_id: txRef } });
    } catch (err) {
      console.error('Webhook failed update:', err);
    }
  }
};
