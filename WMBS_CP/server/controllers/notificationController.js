const db = require('../models');
const { Op } = require('sequelize');

exports.latestForCurrentUser = async (req, res) => {
  try {
    const afterId = parseInt(req.query.afterId, 10) || 0;
    const notifications = await db.Notification.findAll({
      where: {
        user_id: req.user.id,
        id: { [Op.gt]: afterId }
      },
      attributes: ['id', 'title', 'message', 'type', 'link', 'created_at'],
      order: [['id', 'ASC']],
      limit: 20
    });

    return res.json({
      success: true,
      notifications
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Unable to load notifications' });
  }
};

exports.pushPublicKey = async (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  return res.json({ success: true, publicKey: key });
};

exports.subscribePush = async (req, res) => {
  try {
    const endpoint = String(req.body.endpoint || '').trim();
    const p256dh = String((req.body.keys && req.body.keys.p256dh) || '').trim();
    const auth = String((req.body.keys && req.body.keys.auth) || '').trim();
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ success: false, message: 'Invalid push subscription payload' });
    }

    await db.PushSubscription.sync();
    const existing = await db.PushSubscription.findOne({ where: { user_id: req.user.id, endpoint } });
    if (existing) {
      await existing.update({
        p256dh,
        auth,
        is_active: true,
        user_agent: req.get('user-agent') || null,
        last_seen_at: new Date()
      });
    } else {
      await db.PushSubscription.create({
        user_id: req.user.id,
        endpoint,
        p256dh,
        auth,
        is_active: true,
        user_agent: req.get('user-agent') || null,
        last_seen_at: new Date()
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Unable to subscribe to push notifications' });
  }
};

exports.unsubscribePush = async (req, res) => {
  try {
    const endpoint = String(req.body.endpoint || '').trim();
    if (!endpoint) return res.status(400).json({ success: false, message: 'endpoint is required' });
    await db.PushSubscription.sync();
    await db.PushSubscription.update(
      { is_active: false, last_seen_at: new Date() },
      { where: { user_id: req.user.id, endpoint } }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Unable to unsubscribe push notifications' });
  }
};
