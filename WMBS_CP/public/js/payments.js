(function() {
  function getCsrf() {
    var el = document.querySelector('input[name="_csrf"]');
    return el ? el.value : '';
  }

  var requestForm = document.getElementById('requestForm');
  if (requestForm) {
    requestForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var form = e.target;
      var data = {
        address: form.address.value,
        subscription_type: form.subscription_type.value,
        scheduled_date: form.scheduled_date.value || null,
        scheduled_time_slot: form.scheduled_time_slot ? form.scheduled_time_slot.value : null,
        _csrf: getCsrf()
      };
      fetch('/customer/request-pickup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'csrf-token': data._csrf
        },
        body: JSON.stringify(data)
      }).then(function(r) {
        return r.json().then(function(d) {
          if (!r.ok) throw new Error(d.message || 'Request failed');
          return d;
        });
      }).then(function(d) {
        if (d.success) location.reload();
        else alert(d.message || 'Failed');
      }).catch(function(e) { alert(e.message || 'Request failed'); });
    });
  }

  document.querySelectorAll('.cancel-request').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-id');
      if (!id || !confirm('Cancel this request?')) return;
      var csrf = getCsrf();
      fetch('/customer/requests/' + id + '/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'csrf-token': csrf
        },
        body: JSON.stringify({ _csrf: csrf })
      }).then(function(r) {
        return r.json().then(function(d) {
          if (!r.ok) throw new Error(d.message || 'Cancel failed');
          return d;
        });
      }).then(function(d) {
        if (d.success) location.reload();
        else alert(d.message || 'Cancel failed');
      }).catch(function(e) { alert(e.message || 'Cancel failed'); });
    });
  });

  document.querySelectorAll('.pay-request').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var requestId = this.getAttribute('data-id');
      var amount = parseFloat(this.getAttribute('data-amount'), 10) || 20000;
      if (!requestId) return;
      var csrf = getCsrf();
      fetch('/payment/initialize', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'csrf-token': csrf
        },
        body: JSON.stringify({ request_id: parseInt(requestId, 10), amount: amount, _csrf: csrf })
      }).then(function(r) {
        return r.json().then(function(d) {
          if (!r.ok) throw new Error(d.message || 'Payment failed');
          return d;
        });
      }).then(function(d) {
        if (d.success && d.link) window.location.href = d.link;
        else alert(d.message || 'Payment failed');
      }).catch(function(e) { alert(e.message || 'Payment failed'); });
    });
  });
})();
