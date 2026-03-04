const db = require('../models');
const { generateToken } = require('../middleware/auth');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const { auditLog } = require('../middleware/auditLog');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

exports.getLogin = (req, res) => {
  if (req.user) return redirectByRole(req.user.role, res);
  res.render('auth/login', { title: 'Login', error: null, csrfToken: res.locals.csrfToken, query: req.query });
};

exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.User.findOne({ where: { email: (email || '').toLowerCase() } });
    if (!user) {
      return res.render('auth/login', { title: 'Login', error: 'Invalid email or password', csrfToken: res.locals.csrfToken, query: req.query });
    }
    if (!user.is_active) {
      return res.render('auth/login', { title: 'Login', error: 'Account is deactivated. Please contact support.', csrfToken: res.locals.csrfToken, query: req.query });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      return res.render('auth/login', { title: 'Login', error: 'Invalid email or password', csrfToken: res.locals.csrfToken, query: req.query });
    }
    const token = generateToken(user.id, user.role);
    const cookieOpts = { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'strict' };
    res.cookie('wmbs_token_' + user.role, token, cookieOpts);
    res.cookie('token', token, cookieOpts);
    db.AuditLog.create({ action: 'LOGIN', performed_by: user.id, ip_address: req.ip }).catch((e) => console.error('AuditLog create failed:', e.message));
    return redirectByRole(user.role, res);
  } catch (err) {
    console.error('Login error:', err);
    res.render('auth/login', { title: 'Login', error: 'Login failed', csrfToken: res.locals.csrfToken, query: req.query });
  }
};

exports.getRegister = async (req, res) => {
  try {
    const divisions = await db.Division.findAll({ where: { is_active: true }, order: [['name']] });
    return res.render('auth/register', { title: 'Register', divisions, error: null, csrfToken: res.locals.csrfToken });
  } catch (err) {
    console.error('getRegister error:', err.message);
    return res.status(500).render('errors/setup', { title: 'Setup Required', appUrl: process.env.APP_URL || '' });
  }
};

exports.postRegister = async (req, res) => {
  try {
    const existing = await db.User.findOne({ where: { email: req.body.email.toLowerCase() } });
    if (existing) {
      const divisions = await db.Division.findAll({ where: { is_active: true } });
      return res.render('auth/register', { title: 'Register', divisions, error: 'Email already registered', csrfToken: res.locals.csrfToken });
    }
    if (!req.body.division_id) {
      const divisions = await db.Division.findAll({ where: { is_active: true } });
      return res.render('auth/register', { title: 'Register', divisions, error: 'Please select your division', csrfToken: res.locals.csrfToken });
    }
    const company = await db.Company.findOne({ where: { division_id: req.body.division_id, is_active: true } });
    await db.User.create({
      name: req.body.name,
      email: req.body.email.toLowerCase(),
      password: req.body.password,
      role: 'customer',
      phone: req.body.phone || null,
      address: req.body.address || null,
      division_id: req.body.division_id,
      company_id: company ? company.id : null
    });
    res.redirect('/auth/login?registered=1');
  } catch (err) {
    console.error('postRegister error:', err);
    let divisions = [];
    try {
      divisions = await db.Division.findAll({ where: { is_active: true }, order: [['name']] });
    } catch (_) {}
    return res.render('auth/register', { title: 'Register', divisions, error: 'Registration failed. Please try again.', csrfToken: res.locals.csrfToken });
  }
};

exports.logout = (req, res) => {
  const referer = req.get('Referer') || '';
  const pathRole = (referer.match(/\/(superadmin|admin|collector|customer)(\/|$)/) || [])[1];
  if (req.user) {
    db.AuditLog.create({ action: 'LOGOUT', performed_by: req.user.id, ip_address: req.ip }).catch(() => {});
    res.clearCookie('wmbs_token_' + req.user.role);
  }
  if (pathRole) res.clearCookie('wmbs_token_' + pathRole);
  res.clearCookie('token');
  res.redirect('/auth/login');
};

function redirectByRole(role, res) {
  const routes = { superadmin: '/superadmin', admin: '/admin', collector: '/collector', customer: '/customer' };
  res.redirect(routes[role] || '/auth/login');
}

exports.getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password', error: null, success: null, csrfToken: res.locals.csrfToken });
};

exports.postForgotPassword = async (req, res) => {
  try {
    const user = await db.User.findOne({ where: { email: req.body.email.toLowerCase() } });
    const token = crypto.randomBytes(32).toString('hex');
    if (user) {
      user.reset_token = token;
      user.reset_token_expires = new Date(Date.now() + 3600000);
      await user.save();
      await emailService.sendPasswordReset(user.email, `${APP_URL}/auth/reset-password?token=${token}`);
    }
    res.render('auth/forgot-password', { title: 'Forgot Password', error: null, success: 'If that email exists, we sent a reset link.', csrfToken: res.locals.csrfToken });
  } catch (err) {
    console.error(err);
    res.render('auth/forgot-password', { title: 'Forgot Password', error: 'Request failed', success: null, csrfToken: res.locals.csrfToken });
  }
};

exports.getResetPassword = (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect('/auth/forgot-password');
  res.render('auth/reset-password', { title: 'Reset Password', token, error: null, csrfToken: res.locals.csrfToken });
};

exports.postResetPassword = async (req, res) => {
  try {
    const user = await db.User.findOne({
      where: {
        reset_token: req.body.token,
        reset_token_expires: { [db.Sequelize.Op.gt]: new Date() }
      }
    });
    if (!user) {
      return res.render('auth/reset-password', { title: 'Reset Password', token: req.body.token, error: 'Invalid or expired token', csrfToken: res.locals.csrfToken });
    }
    user.password = req.body.password;
    user.reset_token = null;
    user.reset_token_expires = null;
    await user.save();
    res.redirect('/auth/login?reset=1');
  } catch (err) {
    console.error(err);
    res.render('auth/reset-password', { title: 'Reset Password', token: req.body.token, error: 'Reset failed', csrfToken: res.locals.csrfToken });
  }
};
