module.exports = async (req, res) => {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });

  try {
    const url = "https://api.webstractor.com/v1/search?q=" +
      encodeURIComponent(q) + "&limit=10&language=en-US&country=US&format=json";

    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) throw new Error("Search provider HTTP " + response.status);

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    const results = items.slice(0, 10).map(item => ({
      title: typeof item.title === "string" ? item.title : "",
      url: typeof item.url === "string" ? item.url : "",
      snippet: typeof item.snippet === "string" ? item.snippet : ""
    })).filter(item => item.title && /^https?:\/\//i.test(item.url));

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok:true, query:q, results });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(502).json({
      ok:false,
      error:"The search provider could not be reached. Please try again shortly."
    });
  }
};