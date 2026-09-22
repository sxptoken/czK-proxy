module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml"
  };

  try {
    let html = "";
    let lastError = null;

    // Try DuckDuckGo's HTML endpoint first, then its lightweight endpoint.
    const endpoints = [
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q),
      "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q)
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers,
          redirect: "follow"
        });

        if (response.ok) {
          html = await response.text();
          if (html && html.length > 500) break;
        } else {
          lastError = new Error("DuckDuckGo HTTP " + response.status);
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!html) {
      throw lastError || new Error("DuckDuckGo returned no data");
    }

    const results = [];
    const seen = new Set();

    function decode(value) {
      return value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/<[^>]*>/g, "")
        .trim();
    }

    // Standard DuckDuckGo HTML results.
    const standard = /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = standard.exec(html)) && results.length < 10) {
      let target = match[1];
      const title = decode(match[2]);

      const uddg = target.match(/[?&]uddg=([^&]+)/i);
      if (uddg) {
        try { target = decodeURIComponent(uddg[1]); } catch (_) {}
      }

      if (target.startsWith("//")) target = "https:" + target;

      if (/^https?:\/\//i.test(target) && title && !seen.has(target)) {
        seen.add(target);
        results.push({ title, url: target, snippet: "" });
      }
    }

    // DuckDuckGo Lite uses result-link anchors.
    if (!results.length) {
      const lite = /<a[^>]*class=["'][^"']*result-link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

      while ((match = lite.exec(html)) && results.length < 10) {
        let target = match[1];
        const title = decode(match[2]);

        if (target.startsWith("//")) target = "https:" + target;

        if (/^https?:\/\//i.test(target) && title && !seen.has(target)) {
          seen.add(target);
          results.push({ title, url: target, snippet: "" });
        }
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      query: q,
      results
    });
  } catch (error) {
    console.error("czX DuckDuckGo error:", error);

    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo could not be reached from the Vercel server."
    });
  }
};
