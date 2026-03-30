const db = require('../models');
const flutterwaveService = require('../services/flutterwaveService');
const pesapalService = require('../services/pesapalService');
const emailService = require('../services/emailService');

async function notifyAdminPaymentConfirmed(payment) {
  if (!payment || !payment.request_id) return;
  const wasteRequest = await db.WasteRequest.findByPk(payment.request_id, { attributes: ['id', 'division_id'] });
  if (!wasteRequest?.division_id) return;
  const company = await db.Company.findOne({ where: { division_id: wasteRequest.division_id, is_active: true }, attributes: ['admin_id'] });
  if (!company?.admin_id) return;
  await db.Notification.create({
    user_id: company.admin_id,
    title: 'Payment received',
    message: `Payment for request #${wasteRequest.id} has been confirmed.`,
    type: 'payment',
    link: '/admin/revenue'
  }).catch(() => {});
}

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
        const wasteRequest = await db.WasteRequest.findByPk(payment.request_id, { attributes: ['id', 'assigned_collector_id'] });
        if (wasteRequest && wasteRequest.assigned_collector_id) {
          const collector = await db.Collector.findByPk(wasteRequest.assigned_collector_id, { attributes: ['user_id'] });
          if (collector?.user_id) {
            await db.Notification.create({
              user_id: collector.user_id,
              title: 'Payment confirmed',
              message: `Payment for request #${wasteRequest.id} is confirmed. You can now complete this job.`,
              type: 'payment',
              link: '/collector'
            }).catch(() => {});
          }
        }
        const user = await db.User.findByPk(payment.user_id);
        if (user) await emailService.sendPaymentSuccess(user.email, payment.amount, payment.invoice_number).catch(() => {});
        await notifyAdminPaymentConfirmed(payment);
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

// Pesapal IPN handler (requires PESAPAL_IPN_ID registered with Pesapal).
// Pesapal typically sends OrderTrackingId and OrderMerchantReference as query parameters.
exports.pesapalIpn = async (req, res) => {
  res.status(200).send('OK');
  try {
    const orderTrackingId = req.query.OrderTrackingId || req.query.orderTrackingId;
    const merchantRef = req.query.OrderMerchantReference || req.query.orderMerchantReference;
    if (!orderTrackingId) return;

    const status = await pesapalService.getTransactionStatus(orderTrackingId);
    const localStatus = pesapalService.mapPesapalStatusToLocal(status?.payment_status_description || status?.payment_status);
    const payment = merchantRef
      ? await db.Payment.findOne({ where: { invoice_number: merchantRef }, order: [['created_at', 'DESC']] })
      : await db.Payment.findOne({
          where: {
            metadata: db.sequelize.where(db.sequelize.json('metadata.orderTrackingId'), orderTrackingId)
          },
          order: [['created_at', 'DESC']]
        });
    if (!payment) return;

    if (localStatus === 'success' && payment.status === 'pending') {
      payment.status = 'success';
      await payment.save();
      const wasteRequest = await db.WasteRequest.findByPk(payment.request_id, { attributes: ['id', 'assigned_collector_id'] });
      if (wasteRequest && wasteRequest.assigned_collector_id) {
        const collector = await db.Collector.findByPk(wasteRequest.assigned_collector_id, { attributes: ['user_id'] });
        if (collector?.user_id) {
          await db.Notification.create({
            user_id: collector.user_id,
            title: 'Payment confirmed',
            message: `Payment for request #${wasteRequest.id} is confirmed. You can now complete this job.`,
            type: 'payment',
            link: '/collector'
          }).catch(() => {});
        }
      }
      const user = await db.User.findByPk(payment.user_id);
      if (user) await emailService.sendPaymentSuccess(user.email, payment.amount, payment.invoice_number).catch(() => {});
      await notifyAdminPaymentConfirmed(payment);
    }

    if (localStatus === 'failed') {
      await db.Payment.update({ status: 'failed' }, { where: { id: payment.id } }).catch(() => {});
    }
  } catch (err) {
    console.error('Pesapal IPN error:', err.message);
  }
};
