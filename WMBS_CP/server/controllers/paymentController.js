const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const flutterwaveService = require('../services/flutterwaveService');
const pesapalService = require('../services/pesapalService');
const emailService = require('../services/emailService');

function generateInvoiceNumber() {
  return 'INV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function notifyCollectorPaymentConfirmed(payment) {
  if (!payment || !payment.request_id) return;
  const wasteRequest = await db.WasteRequest.findByPk(payment.request_id, { attributes: ['id', 'assigned_collector_id'] });
  if (!wasteRequest || !wasteRequest.assigned_collector_id) return;
  const collector = await db.Collector.findByPk(wasteRequest.assigned_collector_id, { attributes: ['user_id'] });
  if (!collector || !collector.user_id) return;
  await db.Notification.create({
    user_id: collector.user_id,
    title: 'Payment confirmed',
    message: `Payment for request #${wasteRequest.id} is confirmed. You can now complete this job.`,
    type: 'payment',
    link: '/collector'
  }).catch(() => {});
}

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

async function notifyAdminAndCollector(payment) {
  await Promise.all([
    notifyCollectorPaymentConfirmed(payment),
    notifyAdminPaymentConfirmed(payment)
  ]);
}

exports.initializePayment = async (req, res) => {
  try {
    const provider = String(process.env.PAYMENT_PROVIDER || 'flutterwave').toLowerCase();
    if (provider === 'pesapal') {
      if (!pesapalService.isPesapalConfigured()) {
        return res.status(503).json({ success: false, message: pesapalService.NOT_CONFIGURED_MESSAGE });
      }
    } else {
      if (!flutterwaveService.isPaymentConfigured()) {
        return res.status(503).json({ success: false, message: flutterwaveService.NOT_CONFIGURED_MESSAGE });
      }
    }

    const { request_id, amount, phone, email, payment_method } = req.body;
    const wasteRequest = await db.WasteRequest.findOne({ where: { id: request_id, customer_id: req.user.id } });
    if (!wasteRequest) return res.status(404).json({ success: false, message: 'Request not found' });
    const normalizedPhone = String(phone || req.user.phone || '').trim();
    if (!normalizedPhone) return res.status(400).json({ success: false, message: 'Phone number is required for Mobile Money.' });
    const customerEmail = String(email || req.user.email || '').trim();
    const selectedMethod = payment_method === 'airtel_money' ? 'airtel_money' : 'mtn_momo';

    const amt = parseFloat(amount) || parseFloat(wasteRequest.amount) || 0;
    if (amt <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const existingPending = await db.Payment.findOne({ where: { request_id, user_id: req.user.id, status: 'pending' } });
    if (existingPending) {
      if (provider === 'pesapal') {
        const billing = {
          email_address: customerEmail,
          phone_number: normalizedPhone,
          country_code: 'UG',
          first_name: String(req.user.name || 'Customer').split(' ')[0] || 'Customer',
          last_name: String(req.user.name || 'Customer').split(' ').slice(1).join(' ') || 'WMBS'
        };
        const submit = await pesapalService.submitOrderRequest({
          merchantReference: existingPending.invoice_number || String(existingPending.id),
          amount: amt,
          currency: 'UGX',
          description: `WMBS Waste Payment for Request #${request_id}`,
          billingAddress: billing,
          paymentMethod: selectedMethod
        });
        existingPending.metadata = { ...(existingPending.metadata || {}), provider: 'pesapal', orderTrackingId: submit.order_tracking_id, merchantReference: submit.merchant_reference };
        await existingPending.save();
        return res.json({ success: true, link: submit.redirect_url, paymentId: existingPending.id });
      } else {
        const init = await flutterwaveService.initializePayment({
          tx_ref: existingPending.flutterwave_tx_id || existingPending.id + '-' + Date.now(),
          amount: amt,
          customer: { email: customerEmail, name: req.user.name, phone: normalizedPhone },
          meta: { request_id, user_id: req.user.id, payment_id: existingPending.id, payment_method: selectedMethod }
        });
        return res.json({ success: true, link: init.link, paymentId: existingPending.id });
      }
    }

    const invoiceNumber = generateInvoiceNumber();
    const payment = await db.Payment.create({
      user_id: req.user.id,
      request_id,
      amount: amt,
      status: 'pending',
      invoice_number: invoiceNumber,
      payment_method: selectedMethod
    });

    if (provider === 'pesapal') {
      const billing = {
        email_address: customerEmail,
        phone_number: normalizedPhone,
        country_code: 'UG',
        first_name: String(req.user.name || 'Customer').split(' ')[0] || 'Customer',
        last_name: String(req.user.name || 'Customer').split(' ').slice(1).join(' ') || 'WMBS'
      };
      const submit = await pesapalService.submitOrderRequest({
        merchantReference: invoiceNumber,
        amount: amt,
        currency: 'UGX',
        description: `WMBS Waste Payment for Request #${request_id}`,
        billingAddress: billing,
        paymentMethod: selectedMethod
      });
      payment.metadata = { ...(payment.metadata || {}), provider: 'pesapal', orderTrackingId: submit.order_tracking_id, merchantReference: submit.merchant_reference };
      await payment.save();
      return res.json({ success: true, link: submit.redirect_url, paymentId: payment.id });
    } else {
      const txRef = payment.id + '-' + uuidv4().slice(0, 8);
      const init = await flutterwaveService.initializePayment({
        tx_ref: txRef,
        amount: amt,
        customer: { email: customerEmail, name: req.user.name, phone: normalizedPhone },
        meta: { request_id, user_id: req.user.id, payment_id: payment.id, payment_method: selectedMethod }
      });

      payment.flutterwave_tx_id = txRef;
      await payment.save();

      return res.json({ success: true, link: init.link, paymentId: payment.id });
    }
  } catch (err) {
    if (err.message !== flutterwaveService.NOT_CONFIGURED_MESSAGE && err.message !== pesapalService.NOT_CONFIGURED_MESSAGE) {
      console.error(err);
    }
    res.status(400).json({ success: false, message: err.message || 'Failed to initialize payment' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { transaction_id } = req.query;
    if (!transaction_id) return res.status(400).json({ success: false, message: 'transaction_id required' });
    const data = await flutterwaveService.verifyTransaction(transaction_id);
    const payment = await db.Payment.findOne({
      where: { flutterwave_tx_id: data.tx_ref, user_id: req.user.id }
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (data.status === 'successful') {
      payment.status = 'success';
      await payment.save();
      await notifyAdminAndCollector(payment);
      await emailService.sendPaymentSuccess(req.user.email, payment.amount, payment.invoice_number).catch(() => {});
    } else {
      payment.status = 'failed';
      await payment.save();
    }
    res.redirect('/customer?payment=' + (data.status === 'successful' ? 'success' : 'failed'));
  } catch (err) {
    console.error(err);
    res.redirect('/customer?payment=failed');
  }
};

exports.pesapalCallback = async (req, res) => {
  try {
    const orderTrackingId = req.query.OrderTrackingId || req.query.orderTrackingId;
    const merchantRef = req.query.OrderMerchantReference || req.query.orderMerchantReference;
    if (!orderTrackingId) return res.redirect('/customer?payment=failed');

    const status = await pesapalService.getTransactionStatus(orderTrackingId);
    const localStatus = pesapalService.mapPesapalStatusToLocal(status?.payment_status_description || status?.payment_status);

    const payment = await db.Payment.findOne({
      where: { user_id: req.user.id, invoice_number: merchantRef || undefined },
      order: [['created_at', 'DESC']]
    });
    const fallbackPayment = !payment
      ? await db.Payment.findOne({
          where: {
            user_id: req.user.id,
            metadata: db.sequelize.where(db.sequelize.json('metadata.orderTrackingId'), orderTrackingId)
          },
          order: [['created_at', 'DESC']]
        })
      : null;
    const pay = payment || fallbackPayment;
    if (!pay) return res.redirect('/customer?payment=failed');

    if (localStatus === 'success') {
      pay.status = 'success';
      await pay.save();
      await notifyAdminAndCollector(pay);
      await emailService.sendPaymentSuccess(req.user.email, pay.amount, pay.invoice_number).catch(() => {});
      return res.redirect('/customer?payment=success');
    }
    if (localStatus === 'failed') {
      pay.status = 'failed';
      await pay.save();
      return res.redirect('/customer?payment=failed');
    }
    return res.redirect('/customer?payment=pending');
  } catch (err) {
    console.error(err);
    return res.redirect('/customer?payment=failed');
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const requestId = parseInt(req.body.request_id, 10);
    if (!requestId) return res.status(400).json({ success: false, message: 'request_id is required' });
    const wasteRequest = await db.WasteRequest.findOne({ where: { id: requestId, customer_id: req.user.id } });
    if (!wasteRequest) return res.status(404).json({ success: false, message: 'Request not found' });
    const payment = await db.Payment.findOne({
      where: { request_id: requestId, user_id: req.user.id },
      order: [['created_at', 'DESC']]
    });
    if (!payment) return res.status(404).json({ success: false, message: 'No payment found for this request.' });
    if (payment.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment is not yet confirmed. Please complete Mobile Money prompt first.' });
    }
    await notifyAdminAndCollector(payment);
    return res.json({ success: true, message: 'Payment confirmed successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Unable to confirm payment' });
  }
};
