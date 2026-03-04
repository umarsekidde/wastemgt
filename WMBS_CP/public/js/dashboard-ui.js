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

// Simple toast helper
window.wmbsNotify = function (message) {
  var toast = document.createElement('div');
  toast.className = 'wmbs-toast';
  toast.textContent = message || 'Action completed';
  document.body.appendChild(toast);
  setTimeout(function () { toast.classList.add('show'); }, 10);
  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () { toast.remove(); }, 250);
  }, 3000);
};

