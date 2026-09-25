module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });

  // Use DuckDuckGo's no-JS HTML endpoint directly from the Vercel function.
  // The frontend never contacts DuckDuckGo, so CORS is not involved.
  const target = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q) + "&kl=us-en";

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return res.status(502).json({ok:false,error:"DuckDuckGo returned HTTP " + response.status});
    }

    const html = await response.text();
    const results = [];
    const seen = new Set();

    const clean = value => String(value || "")
      .replace(/<script[\\s\\S]*?<\/script>/gi," ")
      .replace(/<style[\\s\\S]*?<\/style>/gi," ")
      .replace(/<[^>]+>/g," ")
      .replace(/&nbsp;/gi," ")
      .replace(/&amp;/gi,"&")
      .replace(/&quot;/gi,'"')
      .replace(/&#39;|&#x27;/gi,"'")
      .replace(/&lt;/gi,"<")
      .replace(/&gt;/gi,">")
      .replace(/\\s+/g," ")
      .trim();

    const decode = href => {
      try {
        const u = new URL(href, "https://html.duckduckgo.com/");
        const uddg = u.searchParams.get("uddg");
        return uddg ? decodeURIComponent(uddg) : u.href;
      } catch {
        return href;
      }
    };

    // Parse DDG result blocks rather than relying on one exact attribute order.
    const blocks = html.match(/<div[^>]+class=["'][^"']*\\bresult\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/div>\\s*(?=<div|$)/gi) || [];

    for (const block of blocks) {
      if (results.length >= 10) break;

      const linkMatch = block.match(
        /<a[^>]+class=["'][^"']*\\bresult__a\\b[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/i
      );

      if (!linkMatch) continue;

      const href = decode(linkMatch[1]);
      const title = clean(linkMatch[2]);

      if (!title || !/^https?:\\/\\//i.test(href) || /duckduckgo\\.com/i.test(href) || seen.has(href)) {
        continue;
      }

      const snippetMatch = block.match(
        /class=["'][^"']*\\bresult__snippet\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>/i
      );

      seen.add(href);
      results.push({
        title,
        url: href,
        snippet: clean(snippetMatch ? snippetMatch[1] : "")
      });
    }

    // Alternate parser for DDG Lite.
    if (!results.length) {
      const links = [...html.matchAll(
        /<a[^>]+class=["'][^"']*\\bresult-link\\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi
      ));

      for (const match of links) {
        if (results.length >= 10) break;
        const href = decode(match[1]);
        const title = clean(match[2]);

        if (!title || !/^https?:\\/\\//i.test(href) || /duckduckgo\\.com/i.test(href) || seen.has(href)) continue;

        seen.add(href);
        results.push({title,url:href,snippet:""});
      }
    }

    if (!results.length) {
      return res.status(502).json({ok:false,error:"DuckDuckGo returned no searchable results."});
    }

    return res.status(200).json({ok:true,query:q,results});
  } catch (error) {
    console.error("czX DuckDuckGo search error:", error);
    return res.status(502).json({ok:false,error:"DuckDuckGo could not be reached right now."});
  }
};