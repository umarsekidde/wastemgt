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
