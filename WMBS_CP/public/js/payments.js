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
      var addressVal = (form.address && form.address.value) ? form.address.value.trim() : '';
      var latEl = document.getElementById('pickupLat');
      var lngEl = document.getElementById('pickupLng');
      if ((latEl && latEl.value) && (lngEl && lngEl.value) && !addressVal)
        addressVal = 'Location selected on map (' + latEl.value + ', ' + lngEl.value + ')';
      var data = {
        address: addressVal,
        waste_category: form.waste_category.value,
        subscription_type: form.subscription_type.value,
        scheduled_date: form.scheduled_date.value || null,
        scheduled_time_slot: form.scheduled_time_slot ? form.scheduled_time_slot.value : null,
        _csrf: getCsrf()
      };
      if (latEl && latEl.value) data.latitude = parseFloat(latEl.value, 10);
      if (lngEl && lngEl.value) data.longitude = parseFloat(lngEl.value, 10);
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

  document.querySelectorAll('.confirm-payment').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var requestId = this.getAttribute('data-id');
      if (!requestId) return;
      var csrf = getCsrf();
      fetch('/payment/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'csrf-token': csrf
        },
        body: JSON.stringify({ request_id: parseInt(requestId, 10), _csrf: csrf })
      }).then(function(r) {
        return r.json().then(function(d) {
          if (!r.ok) throw new Error(d.message || 'Payment confirmation failed');
          return d;
        });
      }).then(function(d) {
        alert(d.message || 'Payment confirmed');
        location.reload();
      }).catch(function(e) { alert(e.message || 'Payment confirmation failed'); });
    });
  });
})();
