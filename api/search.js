module.exports = async (req, res) => {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  try {
    // Keyless public search index. No Vercel environment variable is required.
    const url = "https://puri.li/api/search?q=" + encodeURIComponent(q) + "&page=1";
    const response = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "czX-Search/1.0" }
    });

    if (!response.ok) {
      throw new Error("Search provider HTTP " + response.status);
    }

    const data = await response.json();
    const raw = Array.isArray(data) ? data : (
      Array.isArray(data.results) ? data.results :
      Array.isArray(data.items) ? data.items :
      Array.isArray(data.data) ? data.data : []
    );

    const results = raw.slice(0, 10).map(item => ({
      title: typeof item.title === "string" ? item.title :
        typeof item.name === "string" ? item.name : "",
      url: typeof item.url === "string" ? item.url :
        typeof item.link === "string" ? item.link : "",
      snippet: typeof item.snippet === "string" ? item.snippet :
        typeof item.description === "string" ? item.description :
        typeof item.text === "string" ? item.text : ""
    })).filter(item =>
      item.title &&
      /^https?:\/\//i.test(item.url)
    );

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, query: q, results });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(502).json({
      ok: false,
      error: "The search provider could not be reached. Please try again shortly."
    });
  }
};