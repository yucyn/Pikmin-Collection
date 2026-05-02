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
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

function detectCountryFromCoordinates(lat, lng) {
  const rules = [
    // 優先判定範圍較小或具體的城市/國家
    { name: "澳門", bounds: [{ minLat: 22.1, maxLat: 22.25, minLng: 113.5, maxLng: 113.65 }] },
    { name: "香港", bounds: [{ minLat: 22.1, maxLat: 22.6, minLng: 113.8, maxLng: 114.5 }] },
    { name: "新加坡", bounds: [{ minLat: 1.1, maxLat: 1.5, minLng: 103.6, maxLng: 104.1 }] },
    { name: "杜拜", bounds: [{ minLat: 24.7, maxLat: 25.5, minLng: 54.7, maxLng: 55.7 }] },
    { name: "布拉格", bounds: [{ minLat: 49.9, maxLat: 50.2, minLng: 14.2, maxLng: 14.8 }] },
    
    // 亞洲
    { name: "韓國", bounds: [{ minLat: 33.0, maxLat: 38.8, minLng: 124.0, maxLng: 132.0 }] },
    { name: "台灣", bounds: [{ minLat: 21.8, maxLat: 25.4, minLng: 119.3, maxLng: 122.1 }] },
    { name: "越南", bounds: [{ minLat: 8.3, maxLat: 23.4, minLng: 102.1, maxLng: 109.5 }] },
    { name: "菲律賓", bounds: [{ minLat: 4.5, maxLat: 21.2, minLng: 116.9, maxLng: 126.7 }] },
    { name: "泰國", bounds: [{ minLat: 5.6, maxLat: 20.5, minLng: 97.3, maxLng: 105.7 }] },
    { name: "馬來西亞", bounds: [{ minLat: 0.8, maxLat: 7.0, minLng: 99.6, maxLng: 119.3 }] },
    { name: "印度", bounds: [{ minLat: 8.0, maxLat: 35.5, minLng: 68.1, maxLng: 97.4 }] },
    { name: "印尼", bounds: [{ minLat: -11.1, maxLat: 6.1, minLng: 95.0, maxLng: 141.1 }] },
    { name: "日本", bounds: [{ minLat: 24.0, maxLat: 46.2, minLng: 122.0, maxLng: 146.5 }] },
    { name: "蒙古", bounds: [{ minLat: 41.5, maxLat: 52.2, minLng: 87.7, maxLng: 119.9 }] },

    // 歐洲 - 具體國家優先
    { name: "葡萄牙", bounds: [{ minLat: 36.8, maxLat: 42.2, minLng: -9.6, maxLng: -6.1 }] },
    { name: "義大利", bounds: [{ minLat: 35.4, maxLat: 47.2, minLng: 6.5, maxLng: 18.9 }] },
    { name: "瑞士", bounds: [{ minLat: 45.8, maxLat: 47.9, minLng: 5.9, maxLng: 10.5 }] },
    { name: "芬蘭", bounds: [{ minLat: 59.5, maxLat: 70.1, minLng: 19.1, maxLng: 31.6 }] },
    { name: "荷蘭", bounds: [{ minLat: 50.7, maxLat: 53.6, minLng: 3.3, maxLng: 7.3 }] },
    { name: "奧地利", bounds: [{ minLat: 46.3, maxLat: 49.1, minLng: 9.4, maxLng: 17.0 }] },
    { name: "斯洛維尼亞", bounds: [{ minLat: 45.4, maxLat: 46.9, minLng: 13.3, maxLng: 16.7 }] },
    { name: "希臘", bounds: [{ minLat: 34.0, maxLat: 42.2, minLng: 19.0, maxLng: 30.5 }] },
    { name: "冰島", bounds: [{ minLat: 63.0, maxLat: 66.8, minLng: -25.0, maxLng: -13.0 }] },

    // 歐洲 - 廣域國家放後面
    { name: "西班牙", bounds: [{ minLat: 35.9, maxLat: 43.8, minLng: -9.4, maxLng: 4.4 }] },
    { name: "法國", bounds: [{ minLat: 41.3, maxLat: 51.1, minLng: -5.2, maxLng: 9.6 }] },
    { name: "挪威", bounds: [{ minLat: 57.9, maxLat: 80.7, minLng: 4.4, maxLng: 31.3 }] },
    { name: "英國", bounds: [{ minLat: 49.8, maxLat: 60.9, minLng: -8.7, maxLng: 1.9 }] },
    { name: "德國", bounds: [{ minLat: 47.2, maxLat: 55.2, minLng: 5.8, maxLng: 15.2 }] },
    { name: "土耳其", bounds: [{ minLat: 35.8, maxLat: 42.2, minLng: 25.5, maxLng: 45.0 }] },

    // 美洲與其他
    { name: "美國", bounds: [
      { minLat: 24.0, maxLat: 49.8, minLng: -125.0, maxLng: -66.5 },
      { minLat: 51.0, maxLat: 72.0, minLng: -170.0, maxLng: -129.0 },
      { minLat: 18.5, maxLat: 22.5, minLng: -161.0, maxLng: -154.0 }
    ]},
    { name: "加拿大", bounds: [{ minLat: 41.6, maxLat: 83.2, minLng: -141.1, maxLng: -52.6 }] },
    { name: "墨西哥", bounds: [{ minLat: 14.5, maxLat: 32.8, minLng: -118.5, maxLng: -86.7 }] },
    { name: "哥倫比亞", bounds: [{ minLat: -4.5, maxLat: 13.5, minLng: -79.5, maxLng: -66.5 }] },
    { name: "巴西", bounds: [{ minLat: -33.8, maxLat: 5.3, minLng: -74.0, maxLng: -34.7 }] },
    { name: "阿根廷", bounds: [{ minLat: -56.0, maxLat: -21.5, minLng: -74.0, maxLng: -53.0 }] },
    { name: "智利", bounds: [
      { minLat: -55.7, maxLat: -17.5, minLng: -75.7, maxLng: -66.9 },
      { minLat: -27.2, maxLat: -27.0, minLng: -109.5, maxLng: -109.2 }
    ]},
    { name: "澳洲", bounds: [{ minLat: -43.7, maxLat: -10.6, minLng: 113.3, maxLng: 153.6 }] },
    { name: "紐西蘭", bounds: [{ minLat: -47.8, maxLat: -33.8, minLng: 166.0, maxLng: 179.9 }] },
    { name: "埃及", bounds: [{ minLat: 22.0, maxLat: 32.2, minLng: 24.5, maxLng: 37.0 }] },
    { name: "馬紹爾群島", bounds: [{ minLat: 4.5, maxLat: 15.0, minLng: 160.8, maxLng: 172.2 }] }
  ];

  const matched = rules.find(rule => rule.bounds.some(bounds => isInBounds(lat, lng, bounds)));
  return matched ? matched.name : "全球";
}
