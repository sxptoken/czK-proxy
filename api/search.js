module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });

  try {
    const target = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const response = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        "Accept":"text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new Error("DuckDuckGo HTTP " + response.status);

    const html = await response.text();
    const results = [];
    const clean = s => s.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&#39;|&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x2F;/g,"/").replace(/\s+/g," ").trim();

    const blockRegex = /<div[^>]+class=["'][^"']*result[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let block;
    while ((block = blockRegex.exec(html)) && results.length < 12) {
      const part = block[1];
      const link = part.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      let resultUrl = link[1];
      try {
        if (resultUrl.startsWith("/l/?")) resultUrl = new URL("https://html.duckduckgo.com" + resultUrl).searchParams.get("uddg") || resultUrl;
      } catch {}
      if (!/^https?:\/\//i.test(resultUrl)) continue;
      const snippetMatch = part.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
      results.push({title:clean(link[2]),url:resultUrl,snippet:snippetMatch ? clean(snippetMatch[1]) : ""});
    }

    // Fallback parser for DuckDuckGo markup variations.
    if (!results.length) {
      const linkRegex = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = linkRegex.exec(html)) && results.length < 12) {
        let resultUrl = m[1];
        try {
          if (resultUrl.startsWith("/l/?")) resultUrl = new URL("https://html.duckduckgo.com" + resultUrl).searchParams.get("uddg") || resultUrl;
        } catch {}
        if (!/^https?:\/\//i.test(resultUrl)) continue;
        const after = html.slice(m.index, m.index + 5000);
        const sm = after.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
        results.push({title:clean(m[2]),url:resultUrl,snippet:sm ? clean(sm[1]) : ""});
      }
    }

    return res.status(200).json({ok:true,query:q,results});
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({ok:false,error:"DuckDuckGo could not be reached from the search backend."});
  }
};