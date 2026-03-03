/**
 * Stateless JWT auth: each request is authenticated by the token in cookie/header.
 * Multiple users can be logged in at the same time (different browsers/devices);
 * we do not invalidate other sessions when a user logs in.
 */
const jwt = require('jsonwebtoken');
const db = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'wmbs-jwt-secret-change-in-production';

const ROLES = ['superadmin', 'admin', 'collector', 'customer'];

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  const pathRole = (req.path.match(/^\/(superadmin|admin|collector|customer)(\/|$)/) || [])[1]
    || (req.path.startsWith('/payment') ? 'customer' : null);
  if (pathRole && req.cookies) return req.cookies['wmbs_token_' + pathRole];
  for (const role of ROLES) {
    if (req.cookies && req.cookies['wmbs_token_' + role]) return req.cookies['wmbs_token_' + role];
  }
  return req.query?.token || null;
}

const authenticate = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      return res.redirect('/auth/login');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.User.findByPk(decoded.userId, {
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expires'] },
      include: [{ model: db.Division, as: 'Division', attributes: ['id', 'name', 'code'] }]
    });

    if (!user || !user.is_active) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Invalid or inactive account' });
      }
      ROLES.forEach((r) => res.clearCookie('wmbs_token_' + r));
      return res.redirect('/auth/login');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Token expired' });
      }
      ROLES.forEach((r) => res.clearCookie('wmbs_token_' + r));
      return res.redirect('/auth/login');
    }
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    res.clearCookie('token');
    ROLES.forEach((r) => res.clearCookie('wmbs_token_' + r));
    return res.redirect('/auth/login');
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.User.findByPk(decoded.userId, {
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expires'] }
    });
    if (user && user.is_active) req.user = user;
    next();
  } catch {
    next();
  }
};

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { authenticate, optionalAuth, generateToken, JWT_SECRET };
