module.exports = async (req, res) => {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });
  if (q.length > 499) return res.status(400).json({ ok:false, error:"Search query is too long." });

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/json,*/*",
    "Accept-Language": "en-US,en;q=0.9"
  };

  try {
    // DuckDuckGo's current web search flow generates a query-specific
    // validation URL before requesting the JSON result endpoint.
    const bootstrapUrl = "https://duckduckgo.com/?q=" + encodeURIComponent(q) + "&ia=web";
    const bootstrap = await fetch(bootstrapUrl, {
      headers: { ...headers, "Referer": "https://duckduckgo.com/" }
    });

    if (!bootstrap.ok) throw new Error("DuckDuckGo bootstrap HTTP " + bootstrap.status);
    const page = await bootstrap.text();

    const preloadMatch = page.match(/<link[^>]+id=["']deep_preload_link["'][^>]+href=["']([^"']+)["']/i);
    if (!preloadMatch) throw new Error("DuckDuckGo did not provide a search endpoint.");

    let endpoint = preloadMatch[1]
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');

    if (endpoint.startsWith("//")) endpoint = "https:" + endpoint;
    else if (endpoint.startsWith("/")) endpoint = "https://duckduckgo.com" + endpoint;

    const separator = endpoint.includes("?") ? "&" : "?";
    const resultResponse = await fetch(
      endpoint + separator + "o=json",
      {
        headers: {
          ...headers,
          "Accept": "application/json,*/*",
          "Referer": bootstrapUrl,
          "Sec-Fetch-Dest": "script",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "same-site"
        }
      }
    );

    if (!resultResponse.ok) throw new Error("DuckDuckGo results HTTP " + resultResponse.status);

    const data = await resultResponse.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];
    const results = rawResults.slice(0, 10).map(item => ({
      title: typeof item.t === "string" ? item.t.replace(/<[^>]+>/g, "") : "",
      url: typeof item.u === "string" ? item.u : "",
      snippet: typeof item.a === "string" ? item.a.replace(/<[^>]+>/g, "") : ""
    })).filter(item => item.title && /^https?:\/\//i.test(item.url));

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({ ok:true, query:q, results });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(502).json({
      ok:false,
      error:"DuckDuckGo blocked the server search request. Please try again shortly."
    });
  }
};