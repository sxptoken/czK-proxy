module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) return res.status(400).json({ ok: false, error: "Missing search query." });

  try {
    const ddgUrl = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const response = await fetch("https://r.jina.ai/" + ddgUrl, {
      headers: { "Accept": "text/plain", "User-Agent": "czX-Proxy/1.0" }
    });

    if (!response.ok) throw new Error("Reader HTTP " + response.status);

    const body = await response.text();
    const results = [];
    const seen = new Set();

    let pos = 0;
    while (results.length < 10) {
      const open = body.indexOf("[", pos);
      if (open < 0) break;

      const closeTitle = body.indexOf("](", open + 1);
      if (closeTitle < 0) break;

      const closeUrl = body.indexOf(")", closeTitle + 2);
      if (closeUrl < 0) break;

      const title = body.slice(open + 1, closeTitle).trim();
      const resultUrl = body.slice(closeTitle + 2, closeUrl).trim();
      pos = closeUrl + 1;

      if (!title || !/^https?:\/\//i.test(resultUrl)) continue;
      if (/duckduckgo\.com/i.test(resultUrl)) continue;
      if (seen.has(resultUrl)) continue;

      seen.add(resultUrl);
      results.push({ title, url: resultUrl, snippet: "" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, query: q, results });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok: false,
      error: "The search service could not be reached from Vercel."
    });
  }
};
