const crypto = require('crypto');
const flwConfig = require('../config/flutterwave');

const NOT_CONFIGURED_MESSAGE = 'Payments are not configured. Set FLW_SECRET_KEY and FLW_PUBLIC_KEY in .env. Get keys from dashboard.flutterwave.com.';

function isPaymentConfigured() {
  return !!(flwConfig.secretKey && flwConfig.secretKey !== 'your-flutterwave-secret-key');
}

function ensureKeys() {
  if (!isPaymentConfigured()) {
    throw new Error(NOT_CONFIGURED_MESSAGE);
  }
}

const getAuthHeader = () => ({
  Authorization: `Bearer ${flwConfig.secretKey}`,
  'Content-Type': 'application/json'
});

const verifyWebhookSignature = (signature) => {
  if (!flwConfig.webhookSecret) return true;
  const hash = crypto.createHash('sha256').update(flwConfig.webhookSecret).digest('hex');
  return hash === signature;
};

async function initializePayment({ tx_ref, amount, currency, customer, customizations, meta = {} }) {
  ensureKeys();
  const response = await fetch(`${flwConfig.baseUrl}/payments`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({
      tx_ref,
      amount: Number(amount),
      currency: currency || flwConfig.currency,
      country: flwConfig.country,
      payment_options: 'mobilemoneyuganda',
      customer: {
        email: customer.email,
        name: customer.name,
        phonenumber: customer.phone || customer.phonenumber
      },
      customizations: customizations || { title: 'WMBS Payment', logo: '' },
      meta
    })
  });

  const data = await response.json();
  if (!data.status || data.status !== 'success') {
    const msg = (data.message || '').toLowerCase();
    if (msg.includes('invalid') && msg.includes('authorization')) {
      throw new Error('Payment gateway is misconfigured. Please set valid Flutterwave keys (FLW_SECRET_KEY, FLW_PUBLIC_KEY) in the server .env. Get keys from dashboard.flutterwave.com.');
    }
    throw new Error(data.message || 'Failed to initialize payment');
  }
  return data.data;
}

async function verifyTransaction(id) {
  ensureKeys();
  const response = await fetch(`${flwConfig.baseUrl}/transactions/${id}/verify`, {
    method: 'GET',
    headers: getAuthHeader()
  });
  const data = await response.json();
  if (!data.status || data.status !== 'success') {
    throw new Error(data.message || 'Verification failed');
  }
  return data.data;
}

module.exports = {
  initializePayment,
  verifyTransaction,
  verifyWebhookSignature,
  getAuthHeader,
  isPaymentConfigured,
  NOT_CONFIGURED_MESSAGE
};
