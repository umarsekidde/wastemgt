(function() {
  var mapEl = document.getElementById('collectorMap');
  var startBtn = document.getElementById('startRouteBtn');
  var endBtn = document.getElementById('endRouteBtn');
  var statusEl = document.getElementById('trackingStatus');
  var watchId = null;
  var map = null;
  var myMarker = null;
  var pathCoordinates = [];

  function sendLocation(lat, lng, speed, heading) {
    var csrf = document.getElementById('csrfToken');
    var headers = { 'Content-Type': 'application/json' };
    if (csrf && csrf.value) headers['CSRF-Token'] = csrf.value;
    fetch('/collector/api/update-location', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify({ latitude: lat, longitude: lng, speed: speed || 0, heading: heading || null })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.success && statusEl) statusEl.textContent = 'GPS: Sent at ' + new Date().toLocaleTimeString();
    }).catch(function() { if (statusEl) statusEl.textContent = 'GPS: Error sending'; });
  }

  var KAMPALA = [0.3476, 32.5825];

  function onPosition(pos) {
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    var speed = pos.coords.speed != null ? pos.coords.speed * 3.6 : 0;
    var heading = pos.coords.heading;
    sendLocation(lat, lng, speed, heading);
    pathCoordinates.push({ lat: lat, lng: lng });
    if (map && myMarker) {
      myMarker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    }
  }

  function initMap() {
    if (!mapEl || map) return;
    if (typeof L === 'undefined') {
      setTimeout(initMap, 300);
      return;
    }
    map = L.map('collectorMap').setView(KAMPALA, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(p) {
        var lat = p.coords.latitude, lng = p.coords.longitude;
        map.setView([lat, lng], 15);
        myMarker = L.marker([lat, lng]).addTo(map);
        myMarker.bindTooltip('My truck', { permanent: false });
      }, function() {});
    }
  }

  if (startBtn) {
    startBtn.addEventListener('click', function() {
      if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
      startBtn.style.display = 'none';
      if (endBtn) endBtn.style.display = 'inline-block';
      pathCoordinates = [];
      initMap();
      watchId = navigator.geolocation.watchPosition(onPosition, function() { if (statusEl) statusEl.textContent = 'GPS: Error'; }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
      if (statusEl) statusEl.textContent = 'GPS: Tracking...';
      fetch('/collector/api/start-route', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }).then(function(r) { return r.json(); }).catch(function() {});
    });
  }

  if (endBtn) {
    endBtn.addEventListener('click', function() {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      endBtn.style.display = 'none';
      if (startBtn) startBtn.style.display = 'inline-block';
      if (statusEl) statusEl.textContent = 'GPS: Stopped';
      fetch('/collector/api/end-route', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }).then(function(r) { return r.json(); }).catch(function() {});
    });
  }

  var categoryNotices = {
    industrial: 'Industrial waste: keep hazardous and non-hazardous materials separated.',
    commercial: 'Commercial waste: ensure no household waste is mixed in this batch.',
    household: 'Household waste: confirm bags are sealed before recording final weight.',
    agricultural: 'Agricultural waste: keep organic residue separated for proper handling.'
  };

  document.querySelectorAll('.job-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = this.closest('.job-item');
      if (!item) return;
      var form = item.querySelector('.proof-form');
      if (form && form.classList.contains('proof-form')) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  });

  document.querySelectorAll('.proof-form select[name="waste_category"]').forEach(function(selectEl) {
    selectEl.addEventListener('change', function() {
      var form = this.closest('.proof-form');
      if (!form) return;
      var noticeEl = form.querySelector('.category-notice');
      if (!noticeEl) return;
      noticeEl.textContent = categoryNotices[this.value] || 'Choose a category to see a short handling notice.';
    });
  });

  document.querySelectorAll('.proof-form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var jobItem = form.closest('.job-item');
      var id = jobItem ? jobItem.dataset.id : null;
      if (!id) return;
      var fd = new FormData(form);
      fd.append('_csrf', document.getElementById('csrfToken').value);
      fetch('/collector/api/complete-job/' + id, { method: 'POST', credentials: 'include', body: fd }).then(function(r) { return r.json(); }).then(function(d) { if (d.success) location.reload(); else alert(d.message || 'Failed'); }).catch(function() { alert('Failed'); });
    });
  });

  if (document.getElementById('emergencyBtn')) {
    document.getElementById('emergencyBtn').addEventListener('click', function() {
      var msg = prompt('Brief description of emergency:') || 'Emergency reported';
      fetch('/collector/api/emergency', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'CSRF-Token': (document.getElementById('csrfToken') || {}).value || '' }, body: JSON.stringify({ message: msg }) }).then(function(r) { return r.json(); }).then(function(d) { if (d.success) alert('Reported'); else alert(d.message || 'Failed'); });
    });
  }

  setInterval(function() {
    if (document.hidden) return;
    if (watchId != null && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(onPosition, function() {}, { enableHighAccuracy: true, maximumAge: 5000 });
    }
  }, 15000);
})();
