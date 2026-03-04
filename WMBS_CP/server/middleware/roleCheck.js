const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      return res.redirect('/auth/login');
    }

    const role = req.user.role;
    if (!allowedRoles.includes(role)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ success: false, message: 'Access denied for this role' });
      }
      return res.status(403).render('errors/403', { title: 'Access Denied' });
    }

    next();
  };
};

const requireSuperAdmin = requireRole('superadmin');
const requireAdmin = requireRole('admin');
const requireCollector = requireRole('collector');
const requireCustomer = requireRole('customer');
const requireAdminOrSuperAdmin = requireRole('superadmin', 'admin');
const requireSuperAdminOrAdmin = requireRole('superadmin', 'admin');

module.exports = {
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  requireCollector,
  requireCustomer,
  requireAdminOrSuperAdmin,
  requireSuperAdminOrAdmin
};
