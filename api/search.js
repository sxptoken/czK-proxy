module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });

  try {
    // Fetch DuckDuckGo through a text reader because DuckDuckGo can reject
    // direct requests from serverless/Vercel IPs.
    const target = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const reader = "https://r.jina.ai/" + target;
    const response = await fetch(reader, {
      headers: {
        "User-Agent":"czX/1.0",
        "Accept":"text/plain"
      }
    });

    if (!response.ok) throw new Error("Search reader HTTP " + response.status);

    const text = await response.text();
    const results = [];
    const seen = new Set();

    // Jina normally returns Markdown links for the DuckDuckGo result page.
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(text)) && results.length < 10) {
      const title = match[1].replace(/\\([_*\[\]()])/g,"$1").trim();
      const resultUrl = match[2].replace(/&amp;/g,"&");
      if (!title || !/^https?:\/\//i.test(resultUrl) || seen.has(resultUrl)) continue;
      if (/duckduckgo\.com/i.test(resultUrl)) continue;
      seen.add(resultUrl);

      const after = text.slice(linkRegex.lastIndex, linkRegex.lastIndex + 700);
      const snippet = after.split("\n")[0].replace(/^[-*]\s*/,"").trim();

      results.push({ title, url: resultUrl, snippet });
    }

    return res.status(200).json({ ok:true, query:q, results });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok:false,
      error:"DuckDuckGo search could not be reached right now."
    });
  }
};