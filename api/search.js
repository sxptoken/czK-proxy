module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) return res.status(400).json({ ok: false, error: "Missing search query." });

  try {
    // If the search is asking for YouTube, give czX a real YouTube search
    // result instead of letting DuckDuckGo promote Wikipedia's article.
    if (/^youtube(?:\\s|$)/i.test(q)) {
      const youtubeQuery = q.replace(/^youtube\\s*/i, "").trim() || "trending";
      const youtubeUrl =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(youtubeQuery);

      return res.status(200).json({
        ok: true,
        query: q,
        results: [{
          title: "YouTube search: " + youtubeQuery,
          url: youtubeUrl,
          snippet: "Open YouTube search results for " + youtubeQuery + "."
        }]
      });
    }

    const target = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const readerUrl = "https://r.jina.ai/" + target;

    const response = await fetch(readerUrl, {
      headers: { "Accept": "text/plain", "User-Agent": "czX Search" }
    });

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: "DuckDuckGo search could not be reached." });
    }

    const text = await response.text();
    const results = [];
    const seen = new Set();
    const linkRegex = /\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g;
    let match;

    while ((match = linkRegex.exec(text)) && results.length < 10) {
      const title = match[1].replace(/\\\\/g, "").trim();
      const resultUrl = match[2].trim();

      if (!title || !resultUrl || seen.has(resultUrl)) continue;
      if (/duckduckgo\\.com/i.test(resultUrl)) continue;

      seen.add(resultUrl);

      const after = text.slice(match.index + match[0].length);
      const nextLine = after.split("\\n").find((line) => line.trim());
      const snippet = nextLine
        ? nextLine.replace(/^[-*#>\\s]+/, "")
            .replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, "$1")
            .trim()
            .slice(0, 300)
        : "";

      results.push({ title, url: resultUrl, snippet });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, query: q, results });
  } catch (error) {
    console.error("czX DuckDuckGo search error:", error);
    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo search could not be reached."
    });
  }
};