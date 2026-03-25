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
  baseUrl: isLive ? 'https://pay.pesapal.com' : 'https://cybqa.pesapal.com'
};

