module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  try {
    const ddgUrl =
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);

    const response = await fetch(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; czX/1.0)",
        "Accept": "text/html"
      }
    });

    if (!response.ok) {
      throw new Error("DuckDuckGo returned HTTP " + response.status);
    }

    const html = await response.text();
    const results = [];
    const blockRegex = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = blockRegex.exec(html)) && results.length < 10) {
      let target = match[1];
      const title = match[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();

      if (target.startsWith("//")) target = "https:" + target;

      const clean = target.match(/uddg=([^&]+)/);
      if (clean) {
        try { target = decodeURIComponent(clean[1]); } catch (_) {}
      }

      if (/^https?:\/\//i.test(target) && title) {
        results.push({
          title,
          url: target,
          snippet: ""
        });
      }
    }

    // If DDG's HTML changes, use its public no-key API as a fallback.
    if (!results.length) {
      const apiResponse = await fetch(
        "https://api.duckduckgo.com/?q=" +
        encodeURIComponent(q) +
        "&format=json&no_html=1&skip_disambig=1",
        { headers: { "User-Agent": "czX/1.0" } }
      );

      if (apiResponse.ok) {
        const data = await apiResponse.json();

        if (data.AbstractURL) {
          results.push({
            title: data.Heading || q,
            url: data.AbstractURL,
            snippet: data.AbstractText || ""
          });
        }

        for (const item of data.RelatedTopics || []) {
          if (results.length >= 10) break;
          if (item.FirstURL && item.Text) {
            results.push({
              title: item.Text.split(" - ")[0].trim(),
              url: item.FirstURL,
              snippet: item.Text
            });
          }
        }
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      query: q,
      results: results.slice(0, 10)
    });
  } catch (error) {
    console.error("DuckDuckGo search error:", error);
    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo could not be reached."
    });
  }
};
