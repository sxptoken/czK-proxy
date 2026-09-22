module.exports = async (req, res) => {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  try {
    const results = [];

    // DuckDuckGo's public Instant Answer endpoint does not require an API key.
    try {
      const ddgUrl =
        "https://api.duckduckgo.com/?q=" +
        encodeURIComponent(q) +
        "&format=json&no_html=1&skip_disambig=1";

      const response = await fetch(ddgUrl, {
        headers: { "User-Agent": "czX Search/1.0" }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.AbstractURL && data.AbstractText) {
          results.push({
            title: data.Heading || q,
            url: data.AbstractURL,
            snippet: data.AbstractText
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
          } else if (Array.isArray(item.Topics)) {
            for (const sub of item.Topics) {
              if (results.length >= 10) break;
              if (sub.FirstURL && sub.Text) {
                results.push({
                  title: sub.Text.split(" - ")[0].trim(),
                  url: sub.FirstURL,
                  snippet: sub.Text
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("DuckDuckGo API failed:", error);
    }

    // Reliable no-key fallback using Wikipedia's public search API.
    if (results.length < 3) {
      try {
        const wikiUrl =
          "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
          encodeURIComponent(q) +
          "&srlimit=10&format=json&origin=*";

        const response = await fetch(wikiUrl, {
          headers: { "User-Agent": "czX Search/1.0" }
        });

        if (response.ok) {
          const data = await response.json();

          for (const item of data.query?.search || []) {
            if (results.length >= 10) break;

            const snippet = String(item.snippet || "")
              .replace(/<[^>]+>/g, "")
              .replace(/&quot;/g, '"')
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
      } catch (error) {
        console.error("Wikipedia fallback failed:", error);
      }
    }

    // Remove duplicate URLs.
    const unique = [];
    const seen = new Set();

    for (const item of results) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        unique.push(item);
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      query: q,
      results: unique.slice(0, 10)
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(502).json({
      ok: false,
      error: "The search service could not be reached. Please try again."
    });
  }
};
