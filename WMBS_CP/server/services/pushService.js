const webpush = require('web-push');

let isConfigured = false;

function configureWebPush() {
  if (isConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@wmbs.local';
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isConfigured = true;
    return true;
  } catch (_) {
    return false;
  }
}

async function sendPushForNotification(notification, models) {
  if (!notification || !models || !configureWebPush()) return;
  const user = await models.User.findByPk(notification.user_id, { attributes: ['id', 'role', 'name'] });
  if (!user || user.role !== 'customer') return;

  await models.PushSubscription.sync();
  const subscriptions = await models.PushSubscription.findAll({
    where: { user_id: user.id, is_active: true },
    attributes: ['id', 'endpoint', 'p256dh', 'auth']
  });
  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    title: notification.title || 'WMBS',
    body: notification.message || 'You have a new notification.',
    link: notification.link || '/customer/notifications',
    tag: 'wmbs-' + String(notification.id || Date.now())
  });

  await Promise.all(subscriptions.map(async (sub) => {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    try {
      await webpush.sendNotification(pushSub, payload);
    } catch (err) {
      const code = err && (err.statusCode || err.status_code);
      if (code === 404 || code === 410) {
        await sub.update({ is_active: false }).catch(() => {});
      }
    }
  }));
}

module.exports = {
  configureWebPush,
  sendPushForNotification
};
