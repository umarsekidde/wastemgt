const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 400,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev && process.env.RATE_LIMIT_DISABLE === '1'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 10,
  message: { success: false, message: 'Too many login attempts, try again later' },
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'API rate limit exceeded' }
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100
});

module.exports = { generalLimiter, authLimiter, apiLimiter, webhookLimiter };
