require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { generalLimiter, authLimiter } = require('./middleware/rateLimit');
const { csrfProtection, csrfErrorHandler, getCsrfToken } = require('./middleware/csrf');

const authRoutes = require('./routes/authRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const adminRoutes = require('./routes/adminRoutes');
const collectorRoutes = require('./routes/collectorRoutes');
const customerRoutes = require('./routes/customerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const pesapalService = require('./services/pesapalService');

const app = express();

// Required behind Render (or any reverse proxy): trust X-Forwarded-For so rate-limit and IP-based logic work
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'wmbs-cookie-secret'));
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  res.locals.appName = 'WMBS';
  res.locals.appUrl = process.env.APP_URL || '';
  res.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
  next();
});

app.use('/auth', authLimiter, csrfProtection, getCsrfToken, authRoutes);
app.use('/webhooks', webhookRoutes);
app.use((req, res, next) => {
  if (req.path.includes('/api/')) return next();
  csrfProtection(req, res, next);
});
app.use(getCsrfToken);
app.use('/superadmin', superadminRoutes);
app.use('/admin', adminRoutes);
app.use('/collector', collectorRoutes);
app.use('/customer', customerRoutes);
app.use('/payment', paymentRoutes);

app.use(csrfErrorHandler);

// One-time setup (sync + seed) when Shell is not available (e.g. Render free tier). Set SEED_SECRET in Render, visit once, then remove it.
app.get('/api/setup', (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }
  const db = require('./models');
  const { runSeed } = require('./config/seedLogic');
  db.sequelize.sync({ alter: process.env.DB_ALTER === 'true' })
    .then(() => runSeed())
    .then((result) => res.json({ ok: true, message: 'Setup complete. Log in with superadmin@wmbs.com / SuperAdmin@123', seed: result }))
    .catch((err) => {
      console.error('Setup failed:', err);
      res.status(500).json({ error: 'Setup failed', message: err.message });
    });
});

// Seed only (use if tables already exist).
app.get('/api/seed', (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { runSeed } = require('./config/seedLogic');
  runSeed()
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Seed failed:', err);
      res.status(500).json({ error: 'Seed failed', message: err.message });
    });
});

// One-time Pesapal IPN registration helper.
// Usage: /api/pesapal/register-ipn?secret=YOUR_SEED_SECRET
// Returns: { ok: true, ipn_id: "..." } -> set this as PESAPAL_IPN_ID in Render.
app.get('/api/pesapal/register-ipn', async (req, res) => {
  try {
    const secret = process.env.SEED_SECRET;
    if (!secret || req.query.secret !== secret) {
      return res.status(404).json({ error: 'Not found' });
    }
    const ipnUrl = `${req.protocol}://${req.get('host')}/webhooks/pesapal`;
    const result = await pesapalService.registerIpnUrl(ipnUrl);
    return res.json({ ok: true, ipn_id: result.ipn_id, url: result.url || ipnUrl, full: result });
  } catch (err) {
    console.error('Pesapal IPN registration failed:', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

app.get('/', (req, res) => {
  if (req.cookies?.token) return res.redirect('/auth/login');
  res.redirect('/auth/login');
});

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('errors/500', { title: 'Error' });
});

module.exports = app;
