require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const env = (process.env.PESAPAL_ENV || process.env.NODE_ENV || 'development').toLowerCase();
const isLive = env === 'live' || env === 'production';

module.exports = {
  env: isLive ? 'live' : 'sandbox',
  consumerKey: process.env.PESAPAL_CONSUMER_KEY,
  consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
  ipnId: process.env.PESAPAL_IPN_ID || null,
  callbackUrl: process.env.PESAPAL_CALLBACK_URL,
  cancellationUrl: process.env.PESAPAL_CANCELLATION_URL || process.env.APP_URL || '',
  // Pesapal uses different path prefixes for sandbox vs live
  // Sandbox: https://cybqa.pesapal.com/pesapalv3/api/...
  // Live:    https://pay.pesapal.com/v3/api/...
  apiBaseUrl: isLive ? 'https://pay.pesapal.com/v3/api' : 'https://cybqa.pesapal.com/pesapalv3/api'
};

