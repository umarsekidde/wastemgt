const db = require('../models');

const auditLog = (action, entityType = null, entityId = null) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
      res.send = originalSend;
      (async () => {
        try {
          if (req.user) {
            await db.AuditLog.create({
              action,
              entity_type: entityType,
              entity_id: entityId ?? (req.body?.id || req.params?.id),
              performed_by: req.user.id,
              ip_address: req.ip || req.connection?.remoteAddress,
              user_agent: req.get('User-Agent'),
              details: req.body && Object.keys(req.body).length ? { body: req.body } : null
            });
          }
        } catch (err) {
          console.error('Audit log error:', err.message);
        }
      })();
      return originalSend.call(this, data);
    };
    next();
  };
};

module.exports = { auditLog };
