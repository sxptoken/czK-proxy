module.exports = async (req, res) => {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });

  try {
    const url = "https://api.duckduckgo.com/?q=" + encodeURIComponent(q) +
      "&format=json&no_html=1&no_redirect=1&skip_disambig=0";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "czX Search/1.0",
        "Accept": "application/json"
      }
    });

    if (!response.ok) throw new Error("DuckDuckGo API HTTP " + response.status);

    const data = await response.json();
    const results = [];

    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading || q,
        url: data.AbstractURL,
        snippet: data.AbstractText
      });
    }

    const addTopics = topics => {
      if (!Array.isArray(topics)) return;
      for (const item of topics) {
        if (item.Topics) addTopics(item.Topics);
        else if (item.Text && item.FirstURL && results.length < 10) {
          results.push({
            title: item.Text.split(" - ")[0] || item.Text,
            url: item.FirstURL,
            snippet: item.Text
          });
        }
      }
    };

    addTopics(data.RelatedTopics);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok:true,
      query:q,
      results
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(502).json({
      ok:false,
      error:"DuckDuckGo's API could not be reached."
    });
  }
};