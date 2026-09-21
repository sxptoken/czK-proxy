function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value) {
  return decode(
    String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export default async function handler(req, res) {
  const q = String(req.query?.q || "").trim();

  if (!q) {
    return res.status(400).json({
      ok: false,
      error: "Missing search query."
    });
  }

  const target =
    "https://html.duckduckgo.com/html/?q=" +
    encodeURIComponent(q);

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "DuckDuckGo could not be reached right now."
      });
    }

    const html = await response.text();

    const results = [];
    const blocks = html.split(/<div[^>]+class=["'][^"']*result[^"']*["'][^>]*>/i);

    for (const block of blocks) {
      if (results.length >= 10) break;

      const linkMatch = block.match(
        /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      );

      if (!linkMatch) continue;

      let url = decode(linkMatch[1]);
      const title = stripHtml(linkMatch[2]);

      const snippetMatch = block.match(
        /<(?:a|div)[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i
      );

      const snippet = stripHtml(snippetMatch ? snippetMatch[1] : "");

      if (url.startsWith("//")) {
        url = "https:" + url;
      }

      if (url.startsWith("/l/?")) {
        try {
          const parsed = new URL("https://duckduckgo.com" + url);
          const redirected = parsed.searchParams.get("uddg");
          if (redirected) url = decodeURIComponent(redirected);
        } catch {}
      }

      if (title && /^https?:\/\//i.test(url)) {
        results.push({ title, url, snippet });
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      query: q,
      results
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: "Search proxy error."
    });
  }
}
