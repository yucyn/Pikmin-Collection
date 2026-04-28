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

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    locationText: `${lat}, ${lng}`,
    lat,
    lng,
    country: detectCountryFromCoordinates(lat, lng)
  };
}

function createGoogleMapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function createGoogleMapEmbedUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
}

function isInBounds(lat, lng, bounds) {
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

function detectCountryFromCoordinates(lat, lng) {
  const countryRules = [
    {
      name: "台灣",
      bounds: [{ minLat: 21.8, maxLat: 25.4, minLng: 119.3, maxLng: 122.1 }]
    },
    {
      name: "日本",
      bounds: [{ minLat: 24.0, maxLat: 46.2, minLng: 122.0, maxLng: 146.5 }]
    },
    {
      name: "香港",
      bounds: [{ minLat: 22.1, maxLat: 22.6, minLng: 113.8, maxLng: 114.5 }]
    },
    {
      name: "埃及",
      bounds: [{ minLat: 22.0, maxLat: 32.2, minLng: 24.5, maxLng: 37.0 }]
    },
    {
      name: "希臘",
      bounds: [{ minLat: 34.0, maxLat: 42.2, minLng: 19.0, maxLng: 30.5 }]
    },
    {
      name: "哥倫比亞",
      bounds: [{ minLat: -4.5, maxLat: 13.5, minLng: -79.5, maxLng: -66.5 }]
    },
    {
      name: "紐西蘭",
      bounds: [{ minLat: -47.8, maxLat: -33.8, minLng: 166.0, maxLng: 179.9 }]
    },
    {
      name: "阿根廷",
      bounds: [{ minLat: -56.0, maxLat: -21.5, minLng: -74.0, maxLng: -53.0 }]
    },
    {
      name: "杜拜",
      bounds: [{ minLat: 24.7, maxLat: 25.5, minLng: 54.7, maxLng: 55.7 }]
    },
    {
      name: "布拉格",
      bounds: [{ minLat: 49.9, maxLat: 50.2, minLng: 14.2, maxLng: 14.8 }]
    },
    {
      name: "斯洛維尼亞",
      bounds: [{ minLat: 45.4, maxLat: 46.9, minLng: 13.3, maxLng: 16.7 }]
    },
    {
      name: "英國",
      bounds: [{ minLat: 49.8, maxLat: 60.9, minLng: -8.7, maxLng: 1.9 }]
    },
    {
      name: "義大利",
      bounds: [{ minLat: 35.4, maxLat: 47.2, minLng: 6.5, maxLng: 18.9 }]
    },
    {
      name: "冰島",
      bounds: [{ minLat: 63.0, maxLat: 66.8, minLng: -25.0, maxLng: -13.0 }]
    },
    {
      name: "德國",
      bounds: [{ minLat: 47.2, maxLat: 55.2, minLng: 5.8, maxLng: 15.2 }]
    },
    {
      name: "土耳其",
      bounds: [{ minLat: 35.8, maxLat: 42.2, minLng: 25.5, maxLng: 45.0 }]
    },
    {
      name: "美國",
      bounds: [
        // 美國本土
        { minLat: 24.0, maxLat: 49.8, minLng: -125.0, maxLng: -66.5 },
        // 阿拉斯加
        { minLat: 51.0, maxLat: 72.0, minLng: -170.0, maxLng: -129.0 },
        // 夏威夷
        { minLat: 18.5, maxLat: 22.5, minLng: -161.0, maxLng: -154.0 }
      ]
    },
    {
      name: "韓國",
      bounds: [{ minLat: 33.0, maxLat: 38.8, minLng: 124.0, maxLng: 132.0 }]
    }
  ];

  const matchedCountry = countryRules.find(rule =>
    rule.bounds.some(bounds => isInBounds(lat, lng, bounds))
  );

  return matchedCountry ? matchedCountry.name : "全球";
}
