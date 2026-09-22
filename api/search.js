module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "BRAVE_SEARCH_API_KEY is not configured in Vercel."
    });
  }

  try {
    const searchUrl =
      "https://api.search.brave.com/res/v1/web/search?" +
      new URLSearchParams({
        q,
        count: "10",
        country: "us",
        search_lang: "en",
        safesearch: "moderate"
      }).toString();

    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Brave Search API error:", response.status, data);
      return res.status(502).json({
        ok: false,
        error: "Brave Search API returned HTTP " + response.status + "."
      });
    }

    const results = (data.web?.results || [])
      .slice(0, 10)
      .map((item) => ({
        title: item.title || "Untitled",
        url: item.url,
        snippet: item.description || ""
      }))
      .filter((item) => item.url);

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      ok: true,
      query: q,
      results
    });
  } catch (error) {
    console.error("czX Brave Search error:", error);

    return res.status(502).json({
      ok: false,
      error: "Brave Search could not be reached."
    });
  }
};
