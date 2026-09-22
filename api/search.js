module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  try {
    // DuckDuckGo's public Instant Answer API is no-key and works from serverless functions.
    const ddgUrl =
      "https://api.duckduckgo.com/?q=" +
      encodeURIComponent(q) +
      "&format=json&no_html=1&skip_disambig=0";

    const response = await fetch(ddgUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "czX-Proxy/1.0"
      }
    });

    if (!response.ok) {
      throw new Error("DuckDuckGo HTTP " + response.status);
    }

    const data = await response.json();
    const results = [];

    if (data.AbstractURL && (data.AbstractText || data.Heading)) {
      results.push({
        title: data.Heading || q,
        url: data.AbstractURL,
        snippet: data.AbstractText || ""
      });
    }

    function addTopic(item) {
      if (!item || !item.FirstURL || !item.Text || results.length >= 10) return;
      if (results.some(r => r.url === item.FirstURL)) return;

      results.push({
        title: item.Text.split(" - ")[0].trim(),
        url: item.FirstURL,
        snippet: item.Text
      });
    }

    for (const item of data.RelatedTopics || []) {
      if (results.length >= 10) break;

      if (Array.isArray(item.Topics)) {
        for (const sub of item.Topics) {
          addTopic(sub);
          if (results.length >= 10) break;
        }
      } else {
        addTopic(item);
      }
    }

    // If DuckDuckGo returns no Instant Answer results, use Wikipedia's
    // public search API so the czX search page still works without a key.
    if (results.length === 0) {
      const wikiUrl =
        "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
        encodeURIComponent(q) +
        "&srlimit=10&format=json&origin=*";

      const wikiResponse = await fetch(wikiUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "czX-Proxy/1.0"
        }
      });

      if (wikiResponse.ok) {
        const wiki = await wikiResponse.json();

        for (const item of wiki.query?.search || []) {
          if (results.length >= 10) break;

          const snippet = String(item.snippet || "")
            .replace(/<[^>]+>/g, "")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, "&");

          results.push({
            title: item.title,
            url:
              "https://en.wikipedia.org/wiki/" +
              encodeURIComponent(item.title.replace(/ /g, "_")),
            snippet
          });
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
    console.error("czX search error:", error);
    return res.status(502).json({
      ok: false,
      error: "The DuckDuckGo search service is temporarily unavailable."
    });
  }
};
