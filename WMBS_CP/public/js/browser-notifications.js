(function() {
  var cfg = window.browserNotifyConfig || {};
  var endpoint = cfg.endpoint;
  var storageKey = cfg.storageKey || 'wmbs_notify_last_id';
  var pollMs = Number(cfg.pollMs || 15000);
  var appTitle = cfg.appTitle || 'WMBS';
  var inAppPosition = cfg.inAppPosition || 'bottom';
  var showBacklogOnFirstLoad = !!cfg.showBacklogOnFirstLoad;
  var readEndpointBase = cfg.readEndpointBase || endpoint.replace(/\/notifications\/latest$/, '');

  if (!endpoint || typeof fetch !== 'function' || typeof window === 'undefined') return;

  var supported = ('Notification' in window);
  var isSecureContextLike = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  function getLastSeenId() {
    var v = parseInt(localStorage.getItem(storageKey), 10);
    return Number.isFinite(v) ? v : 0;
  }

  function setLastSeenId(id) {
    var n = parseInt(id, 10);
    if (Number.isFinite(n) && n > getLastSeenId()) {
      localStorage.setItem(storageKey, String(n));
    }
  }

  function showNativeNotification(item) {
    if (!supported || !isSecureContextLike) return;
    if (Notification.permission !== 'granted') return;
    var title = item.title || appTitle;
    var body = item.message || 'You have a new notification.';
    var n = new Notification(title, { body: body, tag: 'wmbs-' + String(item.id) });
    n.onclick = function() {
      markRead(item.id);
      window.focus();
      if (item.link) window.location.href = item.link;
      n.close();
    };
  }

  function markRead(id) {
    var n = parseInt(id, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    fetch(readEndpointBase + '/notifications/' + encodeURIComponent(n) + '/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    }).catch(function() {});
  }

  function showInAppNotification(item) {
    if (typeof window.wmbsNotify !== 'function') return;
    window.wmbsNotify({
      source: appTitle,
      avatarText: String(appTitle || 'W').charAt(0),
      title: item.title || appTitle,
      message: item.message || 'You have a new notification.',
      createdAt: item.created_at,
      link: item.link || '',
      position: inAppPosition,
      onDismiss: function() { markRead(item.id); },
      onOpen: function() { markRead(item.id); }
    });
  }

  function promptPermissionOnce() {
    if (!supported || !isSecureContextLike) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(function() {});
    }
  }

  function pollNotifications() {
    var afterId = getLastSeenId();
    fetch(endpoint + '?afterId=' + encodeURIComponent(afterId), {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data || !data.success || !Array.isArray(data.notifications)) return;
        data.notifications.forEach(function(item) {
          setLastSeenId(item.id);
          showInAppNotification(item);
          showNativeNotification(item);
        });
      })
      .catch(function() {});
  }

  // Initialize once without showing old backlog notifications:
  // first poll sets last seen id only if empty.
  function initializeBaseline() {
    if (getLastSeenId() > 0) return Promise.resolve();
    if (showBacklogOnFirstLoad) return Promise.resolve();
    return fetch(endpoint + '?afterId=0', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data || !data.success || !Array.isArray(data.notifications) || !data.notifications.length) return;
        var last = data.notifications[data.notifications.length - 1];
        setLastSeenId(last.id);
      })
      .catch(function() {});
  }

  promptPermissionOnce();
  initializeBaseline().then(function() {
    setInterval(pollNotifications, pollMs);
  });
})();
