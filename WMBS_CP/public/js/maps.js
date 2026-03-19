/* WMBS maps use Leaflet (OpenStreetMap). No API key required. */
var KAMPALA = [0.3476, 32.5825];
var MAP_POLL_INTERVAL_MS = 15000;

function initSuperAdminMap(containerId, initialTrucks, divisionFilterEl, lastUpdateEl) {
  var container = document.getElementById(containerId);
  if (!container || typeof L === 'undefined') return;
  var map = L.map(containerId).setView(KAMPALA, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  var markers = {};
  var isFetching = false;
  var poller = null;
  function fetchTrucks() {
    if (isFetching || document.hidden) return;
    isFetching = true;
    var url = '/superadmin/api/truck-locations';
    if (divisionFilterEl && divisionFilterEl.value) url += '?division_id=' + divisionFilterEl.value;
    fetch(url, { credentials: 'include' }).then(function(r) { return r.json(); }).then(function(data) {
      if (!data.success || !data.trucks) return;
      data.trucks.forEach(function(t) {
        var lat = parseFloat(t.lat), lng = parseFloat(t.lng);
        if (isNaN(lat) || isNaN(lng)) return;
        var pos = [lat, lng];
        if (markers[t.id]) {
          markers[t.id].setLatLng(pos);
        } else {
          var m = L.marker(pos).addTo(map);
          m.bindTooltip((t.truckNumber || t.name) + ' - ' + (t.division || ''), { permanent: false });
          markers[t.id] = m;
        }
      });
      if (lastUpdateEl) lastUpdateEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }).catch(function() {}).finally(function() { isFetching = false; });
  }
  if (divisionFilterEl) divisionFilterEl.addEventListener('change', fetchTrucks);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) fetchTrucks();
  });
  fetchTrucks();
  poller = setInterval(fetchTrucks, MAP_POLL_INTERVAL_MS);
  void poller;
}

function initAdminMap(containerId, lastUpdateEl) {
  var container = document.getElementById(containerId);
  if (!container || typeof L === 'undefined') return;
  var map = L.map(containerId).setView(KAMPALA, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var truckMarkers = {};
  var pickupMarkers = {};
  var isFetching = false;
  var poller = null;

  var customerIcon = L.divIcon({
    className: 'wmbs-pickup-marker',
    html: '<span class="wmbs-pickup-dot"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  function fetchLocations() {
    if (isFetching || document.hidden) return;
    isFetching = true;
    fetch('/admin/api/truck-locations', { credentials: 'include' }).then(function(r) { return r.json(); }).then(function(data) {
      if (!data.success) return;

      if (data.trucks && data.trucks.length) {
        data.trucks.forEach(function(t) {
          var lat = parseFloat(t.lat), lng = parseFloat(t.lng);
          if (isNaN(lat) || isNaN(lng)) return;
          var pos = [lat, lng];
          var key = 'truck-' + t.id;
          if (truckMarkers[key]) {
            truckMarkers[key].setLatLng(pos);
          } else {
            var m = L.marker(pos).addTo(map);
            m.bindTooltip('Collector: ' + (t.truckNumber || t.name) + ' - ' + (t.status || ''), { permanent: false });
            truckMarkers[key] = m;
          }
        });
      }

      if (data.pickups && data.pickups.length) {
        var currentPickupKeys = {};
        data.pickups.forEach(function(p) {
          var lat = parseFloat(p.lat), lng = parseFloat(p.lng);
          if (isNaN(lat) || isNaN(lng)) return;
          var pos = [lat, lng];
          var key = 'pickup-' + p.id;
          currentPickupKeys[key] = true;
          if (pickupMarkers[key]) {
            pickupMarkers[key].setLatLng(pos);
          } else {
            var m = L.marker(pos, { icon: customerIcon }).addTo(map);
            var tip = (p.customerName || 'Customer') + ' – ' + (p.address || '').substring(0, 50) + (p.address && p.address.length > 50 ? '…' : '') + ' [' + (p.status || '') + ']';
            m.bindTooltip(tip, { permanent: false });
            pickupMarkers[key] = m;
          }
        });
        Object.keys(pickupMarkers).forEach(function(k) {
          if (!currentPickupKeys[k]) {
            map.removeLayer(pickupMarkers[k]);
            delete pickupMarkers[k];
          }
        });
      }

      if (lastUpdateEl) lastUpdateEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }).catch(function() {}).finally(function() { isFetching = false; });
  }

  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) fetchLocations();
  });
  fetchLocations();
  poller = setInterval(fetchLocations, MAP_POLL_INTERVAL_MS);
  void poller;
}
