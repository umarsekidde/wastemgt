(function() {
  function getCsrf() {
    var el = document.querySelector('input[name="_csrf"]');
    return el ? el.value : '';
  }

  function setBtnLoading(btn, isLoading, loadingText) {
    if (!btn) return;
    if (isLoading) {
      if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = loadingText || 'Please wait...';
      return;
    }
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }

  function parseResponse(response) {
    return response.text().then(function(raw) {
      var data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_) {
        data = { message: raw || 'Request failed' };
      }
      if (!response.ok) throw new Error(data.message || 'Request failed');
      return data;
    });
  }

  function extractWeightFromNotes(notes) {
    if (!notes) return '';
    var match = String(notes).match(/Weight:\s*([0-9.]+)/i);
    return match ? match[1] : '';
  }

  var selectedPaymentMethod = 'mtn_momo';
  document.querySelectorAll('.payment-method-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.payment-method-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      selectedPaymentMethod = this.getAttribute('data-method') || 'mtn_momo';
    });
  });

  var closePanelBtn = document.getElementById('closePaymentPanelBtn');
  if (closePanelBtn) {
    closePanelBtn.addEventListener('click', function() {
      var panel = document.getElementById('wastePaymentPanel');
      if (panel) panel.style.display = 'none';
    });
  }

  var requestForm = document.getElementById('requestForm');
  if (requestForm) {
    requestForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var form = e.target;
      var submitBtn = form.querySelector('button[type="submit"]');
      setBtnLoading(submitBtn, true, 'Submitting...');
      var addressVal = (form.address && form.address.value) ? form.address.value.trim() : '';
      var latEl = document.getElementById('pickupLat');
      var lngEl = document.getElementById('pickupLng');
      if ((latEl && latEl.value) && (lngEl && lngEl.value) && !addressVal)
        addressVal = 'Location selected on map (' + latEl.value + ', ' + lngEl.value + ')';
      var data = {
        address: addressVal,
        waste_category: form.waste_category.value,
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
        return parseResponse(r);
      }).then(function(d) {
        if (d.success) location.reload();
        else alert(d.message || 'Failed');
      }).catch(function(e) { alert(e.message || 'Request failed'); })
        .finally(function() { setBtnLoading(submitBtn, false); });
    });
  }

  document.querySelectorAll('.cancel-request').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-id');
      if (!id || !confirm('Cancel this request?')) return;
      var csrf = getCsrf();
      setBtnLoading(this, true, 'Cancelling...');
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
        return parseResponse(r);
      }).then(function(d) {
        if (d.success) location.reload();
        else alert(d.message || 'Cancel failed');
      }).catch(function(e) { alert(e.message || 'Cancel failed'); })
        .finally(function() { setBtnLoading(btn, false); });
    });
  });

  document.querySelectorAll('.pay-request').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var requestId = this.getAttribute('data-id');
      var amount = parseFloat(this.getAttribute('data-amount'), 10) || 20000;
      var notes = this.getAttribute('data-notes') || '';
      if (!requestId) return;
      var panel = document.getElementById('wastePaymentPanel');
      if (panel) panel.style.display = 'block';
      var reqIdEl = document.getElementById('paymentRequestId');
      var priceEl = document.getElementById('paymentPrice');
      var totalEl = document.getElementById('paymentTotal');
      var weightEl = document.getElementById('paymentWeightKg');
      var phoneEl = document.getElementById('paymentPhone');
      var emailEl = document.getElementById('paymentEmail');
      if (reqIdEl) reqIdEl.value = requestId;
      if (priceEl) priceEl.textContent = amount.toFixed(2);
      if (totalEl) totalEl.textContent = amount.toFixed(2);
      if (weightEl) weightEl.textContent = extractWeightFromNotes(notes) || '-';
      if (phoneEl && !phoneEl.value) phoneEl.value = (document.getElementById('defaultCustomerPhone') || {}).value || '';
      if (emailEl && !emailEl.value) emailEl.value = (document.getElementById('defaultCustomerEmail') || {}).value || '';
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var payNowBtn = document.getElementById('payNowBtn');
  if (payNowBtn) {
    payNowBtn.addEventListener('click', function() {
      if (payNowBtn.disabled) return;
      var requestId = document.getElementById('paymentRequestId') ? document.getElementById('paymentRequestId').value : '';
      var amount = parseFloat((document.getElementById('paymentTotal') || {}).textContent || '0');
      var phone = (document.getElementById('paymentPhone') || {}).value || '';
      var email = (document.getElementById('paymentEmail') || {}).value || '';
      if (!requestId) return alert('Select a request to pay for.');
      if (!phone.trim()) return alert('Phone number is required.');
      setBtnLoading(payNowBtn, true, 'Initializing payment...');
      var csrf = getCsrf();
      fetch('/payment/initialize', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'csrf-token': csrf
        },
        body: JSON.stringify({
          request_id: parseInt(requestId, 10),
          amount: amount,
          phone: phone.trim(),
          email: email.trim() || null,
          payment_method: selectedPaymentMethod,
          _csrf: csrf
        })
      }).then(function(r) {
        return parseResponse(r);
      }).then(function(d) {
        if (d.success && d.link) window.location.href = d.link;
        else alert(d.message || 'Payment failed');
      }).catch(function(e) { alert(e.message || 'Payment failed'); })
        .finally(function() { setBtnLoading(payNowBtn, false); });
    });
  }

  document.querySelectorAll('.confirm-payment').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var requestId = this.getAttribute('data-id');
      if (!requestId) return;
      var csrf = getCsrf();
      setBtnLoading(this, true, 'Confirming...');
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
        return parseResponse(r);
      }).then(function(d) {
        alert(d.message || 'Payment confirmed');
        location.reload();
      }).catch(function(e) { alert(e.message || 'Payment confirmation failed'); })
        .finally(function() { setBtnLoading(btn, false); });
    });
  });
})();
