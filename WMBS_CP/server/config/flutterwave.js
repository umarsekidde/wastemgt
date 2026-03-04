require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  publicKey: process.env.FLW_PUBLIC_KEY,
  secretKey: process.env.FLW_SECRET_KEY,
  encryptionKey: process.env.FLW_ENCRYPTION_KEY,
  webhookSecret: process.env.FLW_WEBHOOK_SECRET || process.env.FLW_SECRET_KEY,
  baseUrl: process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3',
  currency: 'UGX',
  country: 'UG'
};
