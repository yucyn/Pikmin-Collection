// V40：公告智慧轉發 API for Vercel
// 放置位置：/api/link-preview.js

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeHtml(match[1].trim());
  }
  return "";
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

function cleanText(text, maxLength = 180) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

export default async function handler(req, res) {
  const rawUrl = req.query.url;

  try {
    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).json({ error: "Missing url" });
    }

    const target = new URL(rawUrl);
    if (!["http:", "https:"].includes(target.protocol)) {
      return res.status(400).json({ error: "Invalid protocol" });
    }

    const response = await fetch(target.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 PikminCollectionBot/1.0",
        "accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      return res.status(200).json({ url: target.toString(), title: "", description: "", image: "" });
    }

    const html = (await response.text()).slice(0, 250000);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    const title = cleanText(
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title") ||
      (titleTag ? decodeHtml(titleTag[1]) : ""),
      90
    );

    const description = cleanText(
      extractMeta(html, "og:description") ||
      extractMeta(html, "twitter:description") ||
      extractMeta(html, "description"),
      160
    );

    const image = cleanText(
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image"),
      300
    );

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({
      url: target.toString(),
      title,
      description,
      image
    });
  } catch (err) {
    return res.status(200).json({ url: rawUrl || "", title: "", description: "", image: "" });
  }
}
