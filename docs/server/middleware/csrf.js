const csrf = require('csurf');

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600
  }
});

const csrfErrorHandler = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
  }
  res.status(403).render('errors/403', { title: 'Invalid Request' });
};

const getCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
};

module.exports = { csrfProtection, csrfErrorHandler, getCsrfToken };
