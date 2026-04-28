function cleanLocationText(text) {
  return String(text || "").replace(/[()]/g, "").trim();
}

function parseLocation(text) {
  const cleaned = cleanLocationText(text);
  const parts = cleaned.split(",");

  if (parts.length !== 2) return null;

  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return {
    locationText: `${lat}, ${lng}`,
    lat,
    lng
  };
}

function createGoogleMapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function createGoogleMapEmbedUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
}
