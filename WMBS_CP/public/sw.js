self.addEventListener('push', function(event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'WMBS', body: event.data ? String(event.data.text()) : 'You have a new notification.' };
  }

  var title = payload.title || 'WMBS';
  var options = {
    body: payload.body || 'You have a new notification.',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: { link: payload.link || '/customer/notifications' },
    tag: payload.tag || 'wmbs-push'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var link = (event.notification.data && event.notification.data.link) || '/customer/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i];
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
      return null;
    })
  );
});
