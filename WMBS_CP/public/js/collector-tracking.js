(function() {
  var mapEl = document.getElementById('collectorMap');
  var startBtn = document.getElementById('startRouteBtn');
  var endBtn = document.getElementById('endRouteBtn');
  var statusEl = document.getElementById('trackingStatus');
  var watchId = null;
  var map = null;
  var myMarker = null;
  var requestMarkers = [];
  var requestMarkerById = {};
  var routeLine = null;
  var currentPosition = null;
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
    currentPosition = { lat: lat, lng: lng };
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

    // Plot assigned request pickup points for this collector.
    var assignedRequests = Array.isArray(window.collectorAssignedRequests) ? window.collectorAssignedRequests : [];
    var requestBounds = [];
    assignedRequests.forEach(function(req) {
      var lat = parseFloat(req.latitude);
      var lng = parseFloat(req.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      var marker = L.circleMarker([lat, lng], {
        radius: 7,
        color: '#0f766e',
        fillColor: '#14b8a6',
        fillOpacity: 0.85,
        weight: 2
      }).addTo(map);
      marker.bindTooltip(
        'Request #' + req.id + ' - ' + (req.customerName || 'Customer') + '<br>' +
        (req.address || '') + '<br>Status: ' + (req.status || '-'),
        { permanent: false, direction: 'top' }
      );
      requestMarkers.push(marker);
      requestMarkerById[String(req.id)] = marker;
      requestBounds.push([lat, lng]);
    });

    if (requestBounds.length) {
      map.fitBounds(requestBounds, { padding: [30, 30], maxZoom: 14 });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(p) {
        var lat = p.coords.latitude, lng = p.coords.longitude;
        currentPosition = { lat: lat, lng: lng };
        if (!requestBounds.length) map.setView([lat, lng], 15);
        myMarker = L.marker([lat, lng]).addTo(map);
        myMarker.bindTooltip('My truck', { permanent: false });
      }, function() {});
    }
  }

  function drawRouteToRequest(targetLat, targetLng) {
    if (!map) return;
    function renderRouteFrom(fromLat, fromLng) {
      var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
        encodeURIComponent(fromLng) + ',' + encodeURIComponent(fromLat) + ';' +
        encodeURIComponent(targetLng) + ',' + encodeURIComponent(targetLat) +
        '?overview=full&geometries=geojson';

      fetch(osrmUrl).then(function(r) { return r.json(); }).then(function(data) {
        if (routeLine) map.removeLayer(routeLine);
        var points = null;
        if (data && data.routes && data.routes.length && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
          points = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
        } else {
          points = [[fromLat, fromLng], [targetLat, targetLng]];
        }
        routeLine = L.polyline(points, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [30, 30], maxZoom: 16 });
        if (statusEl) statusEl.textContent = 'GPS: Route ready';
      }).catch(function() {
        if (routeLine) map.removeLayer(routeLine);
        routeLine = L.polyline([[fromLat, fromLng], [targetLat, targetLng]], { color: '#2563eb', weight: 4, dashArray: '8,8' }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [30, 30], maxZoom: 16 });
        if (statusEl) statusEl.textContent = 'GPS: Route preview (straight line)';
      });
    }

    if (currentPosition && Number.isFinite(currentPosition.lat) && Number.isFinite(currentPosition.lng)) {
      renderRouteFrom(currentPosition.lat, currentPosition.lng);
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocation is required to follow route on the system map.');
      return;
    }

    navigator.geolocation.getCurrentPosition(function(pos) {
      var fromLat = pos.coords.latitude;
      var fromLng = pos.coords.longitude;
      currentPosition = { lat: fromLat, lng: fromLng };
      if (map && myMarker) {
        myMarker.setLatLng([fromLat, fromLng]);
      } else if (map) {
        myMarker = L.marker([fromLat, fromLng]).addTo(map);
        myMarker.bindTooltip('My truck', { permanent: false });
      }
      renderRouteFrom(fromLat, fromLng);
    }, function() {
      alert('Unable to get current location. Please allow location access.');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
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

  document.querySelectorAll('.route-job-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-id');
      var lat = parseFloat(this.getAttribute('data-lat'));
      var lng = parseFloat(this.getAttribute('data-lng'));
      if (isNaN(lat) || isNaN(lng)) return alert('This request has no valid map location.');
      initMap();
      drawRouteToRequest(lat, lng);
      var marker = requestMarkerById[id];
      if (marker && marker.openTooltip) marker.openTooltip();
    });
  });

  document.querySelectorAll('.job-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = this.closest('.job-item');
      if (!item) return;
      var form = item.querySelector('.proof-form');
      if (form && form.classList.contains('proof-form')) form.style.display = form.style.display === 'none' ? 'block' : 'none';
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
      fetch('/collector/api/complete-job/' + id, { method: 'POST', credentials: 'include', body: fd }).then(function(r) { return r.json(); }).then(function(d) {
        if (d.success) {
          alert('Weight recorded. Bill updated for customer.');
          location.reload();
        } else alert(d.message || 'Failed');
      }).catch(function() { alert('Failed'); });
    });
  });

  document.querySelectorAll('.confirm-complete-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (this.getAttribute('data-paid') !== '1') {
        alert('Customer payment is not confirmed yet.');
        return;
      }
      var form = this.closest('.proof-form');
      var item = this.closest('.job-item');
      var id = item ? item.dataset.id : null;
      if (!id || !form) return;
      var fd = new FormData(form);
      fd.append('_csrf', document.getElementById('csrfToken').value);
      fetch('/collector/api/confirm-complete/' + id, { method: 'POST', credentials: 'include', body: fd }).then(function(r) { return r.json(); }).then(function(d) {
        if (d.success) window.location.href = '/collector/finished';
        else alert(d.message || 'Failed');
      }).catch(function() { alert('Failed'); });
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
