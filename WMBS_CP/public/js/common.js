window.wmbs = window.wmbs || {};
window.wmbs.getCookie = function(name) {
  var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return v ? v.pop() : '';
};

(function() {
  function initPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach(function(cb) {
      if (cb._wmbsBound) return;
      cb._wmbsBound = true;
      var id = cb.getAttribute('data-toggle-password');
      var input = id ? document.getElementById(id) : cb.closest('.password-wrap') && cb.closest('.password-wrap').querySelector('input[type="password"], input[type="text"]');
      if (!input) return;
      cb.addEventListener('change', function() {
        input.type = this.checked ? 'text' : 'password';
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPasswordToggles);
  else initPasswordToggles();
})();

(function() {
  var overlay = null;
  var logoutHref = null;

  function getDialog() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'wmbs-dialog-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="wmbs-dialog">' +
      '<p class="wmbs-dialog-title">Are you sure?</p>' +
      '<div class="wmbs-dialog-actions">' +
      '<button type="button" class="btn btn-secondary" data-action="no">No</button>' +
      '<button type="button" class="btn btn-primary" data-action="yes">Yes</button>' +
      '</div></div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeDialog();
    });
    overlay.querySelector('[data-action="no"]').addEventListener('click', closeDialog);
    overlay.querySelector('[data-action="yes"]').addEventListener('click', function() {
      var href = logoutHref;
      closeDialog();
      if (href) window.location.href = href;
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function openDialog(href) {
    logoutHref = href;
    var el = getDialog();
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
  }

  function closeDialog() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    logoutHref = null;
  }

  function initLogoutConfirm() {
    document.addEventListener('click', function(e) {
      var link = e.target && (e.target.closest ? e.target.closest('a[href*="/auth/logout"]') : null);
      if (!link || link.getAttribute('href').indexOf('/auth/logout') === -1) return;
      e.preventDefault();
      openDialog(link.getAttribute('href'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLogoutConfirm);
  else initLogoutConfirm();
})();
