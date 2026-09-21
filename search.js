module.exports = async (req, res) => {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  const target = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error("DuckDuckGo returned HTTP " + response.status);
    }

    const html = await response.text();
    const results = [];

    // Parse each result link directly. This avoids relying on a fragile
    // outer <div> match that can swallow multiple results.
    const linkRegex = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) && results.length < 10) {
      let url = match[1]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"');

      const title = match[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();

      if (url.startsWith("//")) url = "https:" + url;

      if (url.startsWith("/l/?")) {
        try {
          const redirectUrl = new URL("https://html.duckduckgo.com" + url);
          const realUrl = redirectUrl.searchParams.get("uddg");
          if (realUrl) url = decodeURIComponent(realUrl);
        } catch {}
      }

      const afterLink = html.slice(linkRegex.lastIndex, linkRegex.lastIndex + 3000);
      const snippetMatch = afterLink.match(
        /<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
      ) || afterLink.match(
        /<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
      );

      const snippet = snippetMatch
        ? snippetMatch[1]
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&#x27;|&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim()
        : "";

      if (title && /^https?:\/\//i.test(url)) {
        results.push({ title, url, snippet });
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, query: q, results });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(502).json({
      ok: false,
      error: "The search service could not be reached. Please try again."
    });
  }
};
