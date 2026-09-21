module.exports = async (req, res) => {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  const targets = [
    "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q),
    "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q)
  ];

  try {
    let response = null;
    let html = "";

    for (const target of targets) {
      try {
        const r = await fetch(target, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml"
          }
        });

        if (r.ok) {
          const body = await r.text();
          if (body && body.length > 500) {
            response = r;
            html = body;
            break;
          }
        }
      } catch (e) {
        console.error("Search provider attempt failed:", e);
      }
    }

    if (!response || !html) {
      throw new Error("No DuckDuckGo search response");
    }

    const results = [];

    // DuckDuckGo HTML version.
    const htmlRegex = /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = htmlRegex.exec(html)) && results.length < 10) {
      let url = decode(match[1]);
      const title = clean(match[2]);

      if (url.startsWith("//")) url = "https:" + url;
      url = unwrap(url);

      if (title && /^https?:\/\//i.test(url)) {
        const nearby = html.slice(match.index, match.index + 5000);
        const snippetMatch =
          nearby.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);

        results.push({
          title,
          url,
          snippet: snippetMatch ? clean(snippetMatch[1]) : ""
        });
      }
    }

    // DuckDuckGo Lite version fallback.
    if (!results.length) {
      const liteRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = liteRegex.exec(html)) && results.length < 10) {
        let url = decode(match[1]);
        const title = clean(match[2]);

        if (url.startsWith("//")) url = "https:" + url;
        url = unwrap(url);

        if (
          title &&
          url &&
          /^https?:\/\//i.test(url) &&
          !/duckduckgo\.com/i.test(url)
        ) {
          results.push({ title, url, snippet: "" });
        }
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

function clean(value) {
  return decode(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unwrap(url) {
  try {
    if (url.startsWith("/l/?")) {
      const u = new URL("https://html.duckduckgo.com" + url);
      return u.searchParams.get("uddg")
        ? decodeURIComponent(u.searchParams.get("uddg"))
        : url;
    }
    if (url.includes("uddg=")) {
      const u = new URL(url);
      const real = u.searchParams.get("uddg");
      if (real) return decodeURIComponent(real);
    }
  } catch {}
  return url;
}
