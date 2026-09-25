module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });

  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return res.status(500).json({
      ok:false,
      error:"Search is not configured yet. Add BRAVE_SEARCH_API_KEY to Vercel Environment Variables."
    });
  }

  try {
    const endpoint = "https://api.search.brave.com/res/v1/web/search?q=" +
      encodeURIComponent(q) +
      "&country=US&search_lang=en&count=10&safesearch=moderate";

    const response = await fetch(endpoint, {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": key
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Brave Search error:", response.status, data);
      return res.status(502).json({
        ok:false,
        error:"Search provider returned an error."
      });
    }

    const results = Array.isArray(data?.web?.results)
      ? data.web.results.slice(0, 10).map(item => ({
          title: item.title || item.url,
          url: item.url,
          snippet: item.description || ""
        })).filter(item => /^https?:\/\//i.test(item.url || ""))
      : [];

    return res.status(200).json({
      ok:true,
      query:q,
      results
    });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok:false,
      error:"Search provider could not be reached."
    });
  }
};