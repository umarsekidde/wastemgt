(function() {
  var cfg = window.pushNotifyConfig || {};
  var publicKeyEndpoint = cfg.publicKeyEndpoint || '/customer/api/push/public-key';
  var subscribeEndpoint = cfg.subscribeEndpoint || '/customer/api/push/subscribe';
  var unsubscribeEndpoint = cfg.unsubscribeEndpoint || '/customer/api/push/unsubscribe';
  var serviceWorkerPath = cfg.serviceWorkerPath || '/sw.js';

  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function postJson(url, body) {
    var csrf = window.wmbs && typeof window.wmbs.getCookie === 'function' ? window.wmbs.getCookie('_csrf') : '';
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'csrf-token': csrf
      },
      body: JSON.stringify(body || {})
    }).catch(function() {});
  }

  function syncSubscription(registration, publicKey) {
    return registration.pushManager.getSubscription().then(function(existing) {
      if (Notification.permission !== 'granted') {
        if (existing) {
          return postJson(unsubscribeEndpoint, { endpoint: existing.endpoint }).then(function() {
            return existing.unsubscribe().catch(function() {});
          });
        }
        return null;
      }

      if (!publicKey) return null;
      if (existing) {
        return postJson(subscribeEndpoint, existing.toJSON());
      }

      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      }).then(function(sub) {
        return postJson(subscribeEndpoint, sub.toJSON());
      });
    });
  }

  navigator.serviceWorker.register(serviceWorkerPath).then(function(registration) {
    return fetch(publicKeyEndpoint, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    }).then(function(r) { return r.json(); })
      .then(function(data) {
        var key = data && data.success ? data.publicKey : '';
        if (!key) return null;
        if (Notification.permission === 'default') {
          return Notification.requestPermission().then(function() { return key; });
        }
        return key;
      })
      .then(function(key) {
        return syncSubscription(registration, key);
      });
  }).catch(function() {});
})();
