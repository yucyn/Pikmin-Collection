function cleanLocationText(text) {
  return String(text || "").replace(/[()]/g, "").trim();
}

function parseLocation(text) {
  if (!text) return null;
  // 處理手機常見的全型逗號，並清理前後空白
  const cleaned = text.replace(/，/g, ",").replace(/[()]/g, "").trim();
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

const COUNTRY_KEYWORDS = {
  "台灣": ["台灣", "Taiwan", "ROC"],
  "日本": ["日本", "Japan"],
  "韓國": ["韓國", "Korea"],
  "香港": ["香港", "Hong Kong", "HK"],
  "澳門": ["澳門", "Macau"],
  "新加坡": ["新加坡", "Singapore"],
  "泰國": ["泰國", "Thailand"],
  "越南": ["越南", "Vietnam"],
  "馬來西亞": ["馬來西亞", "Malaysia"],
  "印尼": ["印尼", "Indonesia"],
  "菲律賓": ["菲律賓", "Philippines"],
  "澳洲": ["澳洲", "Australia"],
  "紐西蘭": ["紐西蘭", "New Zealand"],
  "美國": ["美國", "USA", "United States"],
  "加拿大": ["加拿大", "Canada"],
  "英國": ["英國", "UK", "United Kingdom"],
  "法國": ["法國", "France"],
  "德國": ["德國", "Germany"],
  "義大利": ["義大利", "Italy"],
  "西班牙": ["西班牙", "Spain"],
  "荷蘭": ["荷蘭", "Netherlands"],
  "瑞士": ["瑞士", "Switzerland"],
  "丹麥": ["丹麥", "Denmark"],
  "芬蘭": ["芬蘭", "Finland"],
  "挪威": ["挪威", "Norway"],
  "瑞典": ["瑞典", "Sweden"],
  "馬耳他": ["馬耳他", "Malta"],
  "捷克": ["捷克", "Czech"],
  "奧地利": ["奧地利", "Austria"],
  "比利時": ["比利時", "Belgium"],
  "希臘": ["希臘", "Greece"],
  "波蘭": ["波蘭", "Poland"],
  "土耳其": ["土耳其", "Turkey"],
  "烏克蘭": ["烏克蘭", "Ukraine"],
  "埃及": ["埃及", "Egypt"],
  "巴西": ["巴西", "Brazil"],
  "墨西哥": ["墨西哥", "Mexico"],
  "洪都拉斯": ["洪都拉斯", "Honduras"],
  "危地馬拉": ["危地馬拉", "Guatemala"],
  "薩爾瓦多": ["薩爾瓦多", "El Salvador"],
  "尼加拉瓜": ["尼加拉瓜", "Nicaragua"],
  "哥斯大黎加": ["哥斯大黎加", "Costa Rica"],
  "巴拿馬": ["巴拿馬", "Panama"],
  "南非": ["南非", "South Africa"],
  "沙烏地阿拉伯": ["沙烏地阿拉伯", "Saudi Arabia", "Saudi"]
};

/** V38 優化：透過 ISO 國家代碼直接映射，最準確且不分語言 */
const ISO_COUNTRY_MAP = {
  "tw": "台灣", "jp": "日本", "kr": "韓國", "hk": "香港", "mo": "澳門",
  "sg": "新加坡", "th": "泰國", "vn": "越南", "my": "馬來西亞", "id": "印尼",
  "ph": "菲律賓", "in": "印度", "au": "澳洲", "nz": "紐西蘭", "us": "美國",
  "ca": "加拿大", "gb": "英國", "fr": "法國", "de": "德國", "it": "義大利",
  "es": "西班牙", "nl": "荷蘭", "ch": "瑞士", "dk": "丹麥", "fi": "芬蘭",
  "no": "挪威", "se": "瑞典", "mt": "馬耳他", "cz": "捷克", "at": "奧地利",
  "be": "比利時", "gr": "希臘", "pl": "波蘭", "tr": "土耳其", "ua": "烏克蘭",
  "eg": "埃及", "br": "巴西", "mx": "墨西哥", "za": "南非", "cl": "智利",
  "ar": "阿根廷", "co": "哥倫比亞", "sa": "沙烏地阿拉伯"
};

function detectCountryFromText(addressText) {
  if (!addressText) return null;
  for (const [country, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keywords.some(k => addressText.includes(k))) {
      return country;
    }
  }
  return null;
}

function detectCountry(lat, lng, addressText, countryCode) {
  // 1. 優先使用 ISO 代碼 (來自 OSM API)
  if (countryCode) {
    const code = String(countryCode).toLowerCase();
    if (ISO_COUNTRY_MAP[code]) return ISO_COUNTRY_MAP[code];
  }

  // 2. 次之使用文字關鍵字比對
  const fromText = detectCountryFromText(addressText);
  if (fromText) return fromText;

  // 3. 最後使用座標邊界判定
  return detectCountryFromCoordinates(lat, lng);
}

function detectCountryFromCoordinates(lat, lng) {
  const rules = [
    { name: "澳門", bounds: [{ minLat: 22.1, maxLat: 22.25, minLng: 113.5, maxLng: 113.65 }] },
    { name: "香港", bounds: [{ minLat: 22.1, maxLat: 22.6, minLng: 113.8, maxLng: 114.5 }] },
    { name: "新加坡", bounds: [{ minLat: 1.1, maxLat: 1.5, minLng: 103.6, maxLng: 104.1 }] },
    { name: "杜拜", bounds: [{ minLat: 24.7, maxLat: 25.5, minLng: 54.7, maxLng: 55.7 }] },
    { name: "布拉格", bounds: [{ minLat: 49.9, maxLat: 50.2, minLng: 14.2, maxLng: 14.8 }] },
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
    { name: "瑞士", bounds: [{ minLat: 45.8, maxLat: 47.8, minLng: 5.9, maxLng: 10.5 }] },
    { name: "奧地利", bounds: [{ minLat: 46.3, maxLat: 49.1, minLng: 9.4, maxLng: 17.1 }] },
    { name: "斯洛維尼亞", bounds: [{ minLat: 45.4, maxLat: 46.9, minLng: 13.3, maxLng: 16.7 }] },
    { name: "荷蘭", bounds: [{ minLat: 50.7, maxLat: 53.6, minLng: 3.3, maxLng: 7.3 }] },
    { name: "比利時", bounds: [{ minLat: 49.5, maxLat: 51.5, minLng: 2.5, maxLng: 6.4 }] },
    { name: "捷克", bounds: [{ minLat: 48.5, maxLat: 51.1, minLng: 12.0, maxLng: 18.9 }] },
    { name: "丹麥", bounds: [{ minLat: 54.5, maxLat: 58.0, minLng: 8.0, maxLng: 15.2 }] },
    { name: "馬耳他", bounds: [{ minLat: 35.8, maxLat: 36.1, minLng: 14.2, maxLng: 14.6 }] },
    { name: "義大利", bounds: [{ minLat: 35.4, maxLat: 47.1, minLng: 6.6, maxLng: 18.6 }] },
    { name: "法國", bounds: [{ minLat: 41.3, maxLat: 51.1, minLng: -5.2, maxLng: 8.3 }] },
    { name: "英國", bounds: [{ minLat: 49.8, maxLat: 60.9, minLng: -8.7, maxLng: 1.9 }] },
    { name: "德國", bounds: [{ minLat: 47.2, maxLat: 55.1, minLng: 5.8, maxLng: 15.1 }] },
    { name: "西班牙", bounds: [{ minLat: 35.9, maxLat: 43.8, minLng: -9.4, maxLng: 4.4 }] },
    { name: "葡萄牙", bounds: [{ minLat: 36.8, maxLat: 42.2, minLng: -9.6, maxLng: -6.1 }] },
    { name: "芬蘭", bounds: [{ minLat: 59.7, maxLat: 70.1, minLng: 19.1, maxLng: 31.6 }] },
    { name: "挪威", bounds: [{ minLat: 57.9, maxLat: 71.2, minLng: 4.4, maxLng: 31.1 }] },
    { name: "瑞典", bounds: [{ minLat: 55.3, maxLat: 69.1, minLng: 11.0, maxLng: 24.2 }] },
    { name: "希臘", bounds: [{ minLat: 34.0, maxLat: 42.2, minLng: 19.0, maxLng: 30.5 }] },
    { name: "冰島", bounds: [{ minLat: 63.0, maxLat: 66.8, minLng: -25.0, maxLng: -13.0 }] },
    { name: "土耳其", bounds: [{ minLat: 35.8, maxLat: 42.2, minLng: 25.5, maxLng: 45.0 }] },
    { name: "烏克蘭", bounds: [{ minLat: 44.4, maxLat: 52.4, minLng: 22.1, maxLng: 40.2 }] },
    { name: "波蘭", bounds: [{ minLat: 49.0, maxLat: 54.9, minLng: 14.1, maxLng: 24.1 }] },
    { name: "俄羅斯", bounds: [{ minLat: 41.2, maxLat: 81.9, minLng: 19.6, maxLng: 179.9 }] },
    { name: "美國", bounds: [
      { minLat: 24.0, maxLat: 49.8, minLng: -125.0, maxLng: -66.5 },
      { minLat: 51.0, maxLat: 72.0, minLng: -170.0, maxLng: -129.0 },
      { minLat: 18.5, maxLat: 22.5, minLng: -161.0, maxLng: -154.0 }
    ]},
    { name: "加拿大", bounds: [{ minLat: 41.6, maxLat: 83.2, minLng: -141.1, maxLng: -52.6 }] },
    { name: "危地馬拉", bounds: [{ minLat: 13.7, maxLat: 17.8, minLng: -92.3, maxLng: -88.2 }] },
    { name: "洪都拉斯", bounds: [{ minLat: 13.0, maxLat: 16.5, minLng: -89.4, maxLng: -83.1 }] },
    { name: "薩爾瓦多", bounds: [{ minLat: 13.1, maxLat: 14.5, minLng: -90.2, maxLng: -87.7 }] },
    { name: "尼加拉瓜", bounds: [{ minLat: 10.7, maxLat: 15.1, minLng: -87.7, maxLng: -82.6 }] },
    { name: "哥斯大黎加", bounds: [{ minLat: 8.0, maxLat: 11.3, minLng: -86.0, maxLng: -82.5 }] },
    { name: "巴拿馬", bounds: [{ minLat: 7.2, maxLat: 9.7, minLng: -83.1, maxLng: -77.2 }] },
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
    { name: "馬紹爾群島", bounds: [{ minLat: 4.5, maxLat: 15.0, minLng: 160.8, maxLng: 172.2 }] },
    { name: "南非", bounds: [{ minLat: -34.8, maxLat: -22.1, minLng: 16.4, maxLng: 32.9 }] },
    { name: "沙烏地阿拉伯", bounds: [{ minLat: 16.5, maxLat: 32.5, minLng: 34.5, maxLng: 55.7 }] }
  ];

  const matched = rules.find(rule => rule.bounds.some(bounds => isInBounds(lat, lng, bounds)));
  return matched ? matched.name : "全球";
}

window.detectCountry = detectCountry;
window.detectCountryFromText = detectCountryFromText;
