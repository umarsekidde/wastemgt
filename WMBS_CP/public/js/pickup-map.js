/**
 * Customer pickup request: map to choose collection location.
 * Click on map to set pickup point; lat/lng and address (reverse-geocoded) are sent with the request.
 * Uses a fast tile layer and updateWhenIdle to reduce lag during zoom/pan.
 */
(function() {
  var KAMPALA = [0.3476, 32.5825];
  var mapEl = document.getElementById('pickupMap');
  var latEl = document.getElementById('pickupLat');
  var lngEl = document.getElementById('pickupLng');
  var addressEl = document.getElementById('pickupAddress');
  var coordsEl = document.getElementById('pickupCoordinates');
  if (!mapEl || typeof L === 'undefined') return;

  var map, marker, reverseGeocodeTimeout;
  function initMap() {
    map = L.map('pickupMap', { preferCanvas: true }).setView(KAMPALA, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 2,
      updateWhenIdle: true,
      keepBuffer: 2
    }).addTo(map);
    marker = null;
    reverseGeocodeTimeout = null;
    map.on('click', onMapClick);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.style.marginTop = '8px';
    btn.textContent = 'Use my current location';
    btn.addEventListener('click', onUseLocation);
    mapEl.parentNode.insertBefore(btn, mapEl.nextSibling);
  }
  function onMapClick(e) {
    setLocation(e.latlng.lat, e.latlng.lng);
  }
  function onUseLocation() {
    if (!navigator.geolocation) { alert('Geolocation is not supported'); return; }
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        setLocation(pos.coords.latitude, pos.coords.longitude);
        btn.disabled = false;
        btn.textContent = 'Use my current location';
      },
      function() {
        alert('Could not get your location. Please click on the map to set the pickup point.');
        btn.disabled = false;
        btn.textContent = 'Use my current location';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }
  function setLocation(lat, lng) {
    if (latEl) latEl.value = lat;
    if (lngEl) lngEl.value = lng;
    if (coordsEl) coordsEl.value = lat + ', ' + lng;
    if (marker) marker.setLatLng([lat, lng]);
    else marker = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], map.getZoom());
    reverseGeocode(lat, lng);
  }

  function reverseGeocode(lat, lng) {
    if (reverseGeocodeTimeout) clearTimeout(reverseGeocodeTimeout);
    reverseGeocodeTimeout = setTimeout(function() {
      var url = 'https://nominatim.openstreetmap.org/reverse?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&format=json';
      fetch(url, { headers: { 'User-Agent': 'WMBS-WasteManagement/1.0' } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (addressEl && data && data.display_name) addressEl.value = data.display_name;
        })
        .catch(function() {});
    }, 300);
  }

  if (requestAnimationFrame) requestAnimationFrame(initMap);
  else setTimeout(initMap, 0);
})();
