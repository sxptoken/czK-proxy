module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return res.status(400).json({ok:false,error:"Missing search query."});

  try {
    const endpoint = "https://lite.duckduckgo.com/lite/";
    const headers = {
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
      "Accept":"text/html,application/xhtml+xml",
      "Referer":"https://lite.duckduckgo.com/lite/",
      "Content-Type":"application/x-www-form-urlencoded"
    };

    // DDG's no-JS Lite service expects a normal browser-style POST.
    const response = await fetch(endpoint, {
      method:"POST",
      headers,
      body:new URLSearchParams({q, kl:"us-en"}).toString(),
      redirect:"follow"
    });

    if (!response.ok) throw new Error("DuckDuckGo HTTP " + response.status);
    const html = await response.text();
    const results = [];
    const seen = new Set();

    const clean = s => s
      .replace(/<[^>]*>/g," ")
      .replace(/&amp;/g,"&")
      .replace(/&quot;/g,'"')
      .replace(/&#39;|&#x27;/g,"'")
      .replace(/&lt;/g,"<")
      .replace(/&gt;/g,">")
      .replace(/\s+/g," ")
      .trim();

    // Lite uses result-link/result-snippet markup and DDG redirect URLs.
    const linkRegex = /<a[^>]+class=["'][^"']*result-link[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = linkRegex.exec(html)) && results.length < 10) {
      let resultUrl = m[1];

      try {
        const u = new URL(resultUrl, endpoint);
        const uddg = u.searchParams.get("uddg");
        if (uddg) resultUrl = decodeURIComponent(uddg);
        else resultUrl = u.href;
      } catch {}

      if (!/^https?:\/\//i.test(resultUrl) || seen.has(resultUrl)) continue;
      seen.add(resultUrl);

      const after = html.slice(linkRegex.lastIndex, linkRegex.lastIndex + 2500);
      const sm = after.match(/class=["'][^"']*result-snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);

      results.push({
        title:clean(m[2]),
        url:resultUrl,
        snippet:sm ? clean(sm[1]) : ""
      });
    }

    return res.status(200).json({ok:true,query:q,results});
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok:false,
      error:"DuckDuckGo search is temporarily unavailable."
    });
  }
};