/**
 * Geocode an address using OpenStreetMap Nominatim (no API key).
 * Use sparingly; Nominatim allows ~1 request/second.
 */
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || address.trim().length === 0) return null;
  const q = encodeURIComponent(address.trim());
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WMBS-WasteManagement/1.0' }
    });
    const data = await res.json();
    if (Array.isArray(data) && data[0] && data[0].lat != null && data[0].lon != null) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

module.exports = { geocodeAddress };
