module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return res.status(400).json({ok:false,error:"Missing search query."});

  const target = "https://api.duckduckgo.com/?q=" + encodeURIComponent(q) + "&format=json&no_html=1&no_redirect=1";

  try {
    const response = await fetch(target, {
      headers: {"User-Agent":"czX Search/1.0"},
      redirect: "follow"
    });

    if (!response.ok) throw new Error("DuckDuckGo HTTP " + response.status);

    const data = await response.json();
    const results = [];
    const seen = new Set();

    const add = (title, href, snippet) => {
      if (!href || !/^https?:\/\//i.test(href) || seen.has(href)) return;
      if (/duckduckgo\.com/i.test(href)) return;
      const cleanTitle = String(title || "").trim();
      if (!cleanTitle) return;
      seen.add(href);
      results.push({title:cleanTitle,url:href,snippet:String(snippet || "").trim()});
    };

    if (data.AbstractURL && data.AbstractText) {
      add(data.Heading || q, data.AbstractURL, data.AbstractText);
    }

    const walk = topics => {
      if (!Array.isArray(topics) || results.length >= 10) return;
      for (const item of topics) {
        if (results.length >= 10) break;
        if (item.FirstURL) {
          add(item.Text, item.FirstURL, item.Text);
        }
        if (item.Topics) walk(item.Topics);
      }
    };

    walk(data.RelatedTopics);

    return res.status(200).json({
      ok:true,
      query:q,
      results,
      note: results.length
        ? "DuckDuckGo results"
        : "DuckDuckGo returned no web results for this query."
    });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({ok:false,error:"DuckDuckGo search is temporarily unavailable."});
  }
};