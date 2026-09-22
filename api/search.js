module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  try {
    // Vercel can have trouble reaching DuckDuckGo directly. Jina Reader
    // fetches the DuckDuckGo HTML page server-side and returns readable text.
    const target =
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const readerUrl = "https://r.jina.ai/" + target;

    const response = await fetch(readerUrl, {
      headers: {
        "Accept": "text/plain",
        "User-Agent": "czX-Proxy/1.0"
      }
    });

    if (!response.ok) {
      throw new Error("Search fetch HTTP " + response.status);
    }

    const text = await response.text();
    const results = [];
    const seen = new Set();

    // Jina returns DuckDuckGo's page as markdown/text. Extract result links.
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(text)) && results.length < 10) {
      const title = match[1].replace(/\\([()[\]])/g, "$1").trim();
      let targetUrl = match[2].trim();

      if (
        !title ||
        !/^https?:\/\//i.test(targetUrl) ||
        /duckduckgo\.com/i.test(targetUrl) ||
        seen.has(targetUrl)
      ) {
        continue;
      }

      // Skip obvious navigation links.
      if (/^(Images|Videos|News|Maps|All|Settings|DuckDuckGo)$/i.test(title)) {
        continue;
      }

      seen.add(targetUrl);
      results.push({
        title,
        url: targetUrl,
        snippet: ""
      });
    }

    if (!results.length) {
      return res.status(200).json({
        ok: true,
        query: q,
        results: [],
        message: "DuckDuckGo returned no readable results."
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      query: q,
      results
    });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok: false,
      error: "The search service could not be reached from Vercel."
    });
  }
};
