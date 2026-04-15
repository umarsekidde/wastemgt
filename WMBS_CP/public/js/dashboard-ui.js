document.addEventListener('DOMContentLoaded', function () {
  // Dark mode toggle
  var darkToggle = document.getElementById('darkToggle');
  if (darkToggle) {
    var saved = window.localStorage.getItem('wmbs_dark_mode');
    if (saved === '1') document.body.classList.add('dark-mode');
    darkToggle.addEventListener('click', function () {
      document.body.classList.toggle('dark-mode');
      window.localStorage.setItem('wmbs_dark_mode', document.body.classList.contains('dark-mode') ? '1' : '0');
    });
  }

  // Sidebar toggle (show/hide dashboard navigation)
  var appShell = document.querySelector('.app-shell');
  var sidebarToggle = document.getElementById('sidebarToggle');
  if (appShell) {
    function applySidebarState() {
      if (window.innerWidth <= 1024) {
        appShell.classList.add('sidebar-collapsed');
      } else {
        appShell.classList.remove('sidebar-collapsed');
      }
    }

    // Initial state based on current width
    applySidebarState();

    // Update on resize so shrinking the window also collapses the sidebar
    window.addEventListener('resize', function () {
      applySidebarState();
    });

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function () {
        appShell.classList.toggle('sidebar-collapsed');
      });
    }
  }

  // KPI count-up animation
  var counters = document.querySelectorAll('[data-countup]');
  counters.forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-countup')) || 0;
    var duration = 900;
    var start = 0;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var value = Math.floor(progress * (target - start) + start);
      el.textContent = value.toLocaleString();
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  });
});

function formatElapsedTime(input) {
  if (!input) return 'now';
  var date = new Date(input);
  if (!Number.isFinite(date.getTime())) return 'now';
  var diffMs = Math.max(0, Date.now() - date.getTime());
  var mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return mins + 'm';
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h';
  return Math.floor(hours / 24) + 'd';
}

function removeToast(toast) {
  if (!toast) return;
  toast.classList.remove('show');
  setTimeout(function () { toast.remove(); }, 250);
}

// Toast helper (supports string and rich object format)
window.wmbsNotify = function (payload) {
  var isRich = payload && typeof payload === 'object';
  var autoCloseMs = isRich ? Number(payload.autoCloseMs || 0) : 3000;
  var toast = document.createElement('div');
  toast.className = 'wmbs-toast';
  if (isRich && payload.position === 'top') {
    toast.classList.add('wmbs-toast-top');
  }
  if (!isRich) {
    toast.textContent = payload || 'Action completed';
  } else {
    var source = payload.source || 'WMBS';
    var avatarText = payload.avatarText || source.charAt(0) || 'W';
    var timeText = payload.time || formatElapsedTime(payload.createdAt);
    var title = payload.title || 'Notification';
    var message = payload.message || 'You have a new notification.';
    toast.classList.add('wmbs-toast-card');
    toast.innerHTML = '' +
      '<div class="wmbs-toast-head">' +
      '  <div class="wmbs-toast-meta">' +
      '    <span>' + source + '</span>' +
      '    <span class="wmbs-toast-app-dot"></span>' +
      '    <span>' + timeText + '</span>' +
      '  </div>' +
      '  <span class="wmbs-toast-avatar">' + avatarText + '</span>' +
      '</div>' +
      '<div class="wmbs-toast-title"></div>' +
      '<div class="wmbs-toast-message"></div>' +
      '<div class="wmbs-toast-actions">' +
      '  <button type="button" class="wmbs-toast-action" data-action="dismiss">Dismiss</button>' +
      '  <button type="button" class="wmbs-toast-action" data-action="open">Open</button>' +
      '</div>';
    toast.querySelector('.wmbs-toast-title').textContent = title;
    toast.querySelector('.wmbs-toast-message').textContent = message;

    toast.querySelector('[data-action="dismiss"]').addEventListener('click', function () {
      removeToast(toast);
    });
    toast.querySelector('[data-action="open"]').addEventListener('click', function () {
      if (payload.link) window.location.href = payload.link;
      removeToast(toast);
    });
  }
  document.body.appendChild(toast);
  setTimeout(function () { toast.classList.add('show'); }, 10);
  if (autoCloseMs > 0) {
    setTimeout(function () {
      removeToast(toast);
    }, autoCloseMs);
  }
};

