module.exports = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ok:false,error:"Missing search query."});

  const target = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html"
      }
    });
    if (!response.ok) throw new Error("DuckDuckGo returned HTTP " + response.status);
    const html = await response.text();
    const results = [];
    const chunks = html.split(/result__body/i);

    for (const chunk of chunks) {
      if (results.length >= 10) break;
      const link = chunk.match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      let url = link[1].replace(/&amp;/g,"&");
      const title = link[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
      if (url.startsWith("//")) url="https:"+url;
      if (url.startsWith("/l/?")) {
        try {
          const u=new URL("https://html.duckduckgo.com"+url);
          const real=u.searchParams.get("uddg");
          if(real) url=decodeURIComponent(real);
        } catch {}
      }
      const sm = chunk.match(/result__snippet[^>]*>([\s\S]*?)(?:<\/a>|<\/div>)/i);
      const snippet = sm ? sm[1].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim() : "";
      if (title && /^https?:\/\//i.test(url)) results.push({title,url,snippet});
    }

    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({ok:true,results});
  } catch (e) {
    console.error(e);
    return res.status(502).json({ok:false,error:"The search service could not be reached. Please try again."});
  }
};
