/**
 * Customer pickup request: map to choose collection location.
 * Click on map to set pickup point; lat/lng and address (reverse-geocoded) are sent with the request.
 */
(function() {
  var KAMPALA = [0.3476, 32.5825];
  var mapEl = document.getElementById('pickupMap');
  var latEl = document.getElementById('pickupLat');
  var lngEl = document.getElementById('pickupLng');
  var addressEl = document.getElementById('pickupAddress');
  if (!mapEl || typeof L === 'undefined') return;

  var map = L.map('pickupMap').setView(KAMPALA, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var marker = null;
  var reverseGeocodeTimeout = null;

  function setLocation(lat, lng) {
    if (latEl) latEl.value = lat;
    if (lngEl) lngEl.value = lng;
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

  map.on('click', function(e) {
    setLocation(e.latlng.lat, e.latlng.lng);
  });

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary';
  btn.style.marginTop = '8px';
  btn.textContent = 'Use my current location';
  btn.addEventListener('click', function() {
    if (!navigator.geolocation) { alert('Geolocation is not supported'); return; }
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
  });
  mapEl.parentNode.insertBefore(btn, mapEl.nextSibling);
})();
