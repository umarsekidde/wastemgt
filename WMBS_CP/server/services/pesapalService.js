const crypto = require('crypto');
const pesapalConfig = require('../config/pesapal');

const NOT_CONFIGURED_MESSAGE =
  'Pesapal payments are not configured. Set PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_CALLBACK_URL and PESAPAL_IPN_ID in .env.';

function isPesapalConfigured() {
  return !!(
    pesapalConfig.consumerKey &&
    pesapalConfig.consumerSecret &&
    pesapalConfig.callbackUrl &&
    pesapalConfig.ipnId
  );
}

function ensurePesapalConfigured() {
  if (!isPesapalConfigured()) throw new Error(NOT_CONFIGURED_MESSAGE);
}

async function requestToken() {
  ensurePesapalConfigured();
  const url = `${pesapalConfig.baseUrl}/pesapalv3/api/Auth/RequestToken`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      consumer_key: pesapalConfig.consumerKey,
      consumer_secret: pesapalConfig.consumerSecret
    })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.token) {
    throw new Error(data?.message || 'Pesapal authentication failed');
  }
  return data.token;
}

async function submitOrderRequest({ merchantReference, amount, currency, description, billingAddress, callbackUrl, cancellationUrl, paymentMethod }) {
  ensurePesapalConfigured();
  const token = await requestToken();
  const url = `${pesapalConfig.baseUrl}/pesapalv3/api/Transactions/SubmitOrderRequest`;

  const safeDesc = String(description || 'WMBS Waste Payment').slice(0, 100);
  const id = String(merchantReference || crypto.randomUUID()).slice(0, 50);

  const payload = {
    id,
    currency: currency || 'UGX',
    amount: Number(amount),
    description: safeDesc,
    callback_url: callbackUrl || pesapalConfig.callbackUrl,
    notification_id: pesapalConfig.ipnId,
    cancellation_url: cancellationUrl || pesapalConfig.cancellationUrl,
    billing_address: billingAddress
  };

  // Not all Pesapal accounts expose channel forcing. Keep as metadata-only if provided.
  if (paymentMethod) payload.redirect_mode = 'TOP_WINDOW';

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error?.message || data?.message || 'Pesapal order submission failed');
  }
  // Expected: order_tracking_id, merchant_reference, redirect_url
  return data;
}

async function getTransactionStatus(orderTrackingId) {
  ensurePesapalConfigured();
  const token = await requestToken();
  const url = `${pesapalConfig.baseUrl}/pesapalv3/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.message || 'Pesapal status check failed');
  }
  return data;
}

function mapPesapalStatusToLocal(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'COMPLETED') return 'success';
  if (s === 'FAILED' || s === 'INVALID') return 'failed';
  if (s === 'REVERSED') return 'failed';
  return 'pending';
}

module.exports = {
  NOT_CONFIGURED_MESSAGE,
  isPesapalConfigured,
  requestToken,
  submitOrderRequest,
  getTransactionStatus,
  mapPesapalStatusToLocal
};

