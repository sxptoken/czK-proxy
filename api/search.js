module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return res.status(400).json({ ok: false, error: "Missing search query." });
  }

  const clean = (value = "") => value
    .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\\s+/g, " ")
    .trim();

  const decodeUrl = (value) => {
    try {
      const absolute = new URL(value, "https://html.duckduckgo.com/");
      const uddg = absolute.searchParams.get("uddg");
      return uddg ? decodeURIComponent(uddg) : absolute.href;
    } catch {
      return value;
    }
  };

  const addResult = (results, seen, title, href, snippet = "") => {
    const resultUrl = decodeUrl(href);
    const cleanTitle = clean(title);
    if (!/^https?:\\/\\//i.test(resultUrl) || !cleanTitle || seen.has(resultUrl)) return;

    seen.add(resultUrl);
    results.push({
      title: cleanTitle,
      url: resultUrl,
      snippet: clean(snippet)
    });
  };

  const parseHtmlResults = (html) => {
    const results = [];
    const seen = new Set();

    const htmlLinks = [...html.matchAll(
      /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi
    )];

    for (const m of htmlLinks) {
      if (results.length >= 10) break;
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 5000);
      const snippet = after.match(
        /class=["'][^"']*result__snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>/i
      );
      addResult(results, seen, m[2], m[1], snippet ? snippet[1] : "");
    }

    if (!results.length) {
      const liteLinks = [...html.matchAll(
        /<a[^>]+class=["'][^"']*result-link[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi
      )];

      for (const m of liteLinks) {
        if (results.length >= 10) break;
        const after = html.slice(m.index + m[0].length, m.index + m[0].length + 5000);
        const snippet = after.match(
          /class=["'][^"']*result-snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>/i
        );
        addResult(results, seen, m[2], m[1], snippet ? snippet[1] : "");
      }
    }

    return results;
  };

  const parseJinaMarkdown = (markdown) => {
    const results = [];
    const seen = new Set();

    // Jina Reader can return the DDG HTML page as Markdown. DDG result
    // links are ordinary Markdown links, so keep only real http(s) links.
    const links = [...markdown.matchAll(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g)];

    for (const m of links) {
      if (results.length >= 10) break;

      const title = clean(m[1]);
      const href = decodeUrl(m[2]);

      // Ignore navigation/utility links that are not actual search results.
      if (
        !title ||
        /^(duckduckgo|privacy|terms|settings|feedback|next|previous|more)$/i.test(title) ||
        /duckduckgo\\.com/i.test(href)
      ) {
        continue;
      }

      addResult(results, seen, title, href, "");
    }

    return results;
  };

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };

  try {
    // Primary path: have Jina Reader fetch DuckDuckGo's no-JS HTML page.
    // This avoids Vercel's serverless IP being rejected by DDG directly.
    const ddgUrl = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const jinaUrl = "https://r.jina.ai/" + ddgUrl;

    const jinaResponse = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        "User-Agent": browserHeaders["User-Agent"],
        "Accept": "text/plain,text/markdown;q=0.9,*/*;q=0.8",
        "X-Respond-With": "markdown"
      },
      redirect: "follow"
    });

    if (jinaResponse.ok) {
      const markdown = await jinaResponse.text();
      const results = parseJinaMarkdown(markdown);

      if (results.length) {
        return res.status(200).json({ ok: true, query: q, results });
      }

      console.error("Jina fetched DDG but no results were parsed. Response length:", markdown.length);
    } else {
      console.error("Jina Reader HTTP", jinaResponse.status);
    }

    // Fallback: try DDG directly as well.
    const direct = await fetch(ddgUrl, {
      method: "GET",
      headers: {
        ...browserHeaders,
        "Referer": "https://html.duckduckgo.com/"
      },
      redirect: "follow"
    });

    if (direct.ok) {
      const html = await direct.text();
      const results = parseHtmlResults(html);

      if (results.length) {
        return res.status(200).json({ ok: true, query: q, results });
      }

      console.error("Direct DDG returned no parsed results. Response length:", html.length);
    } else {
      console.error("Direct DDG HTTP", direct.status);
    }

    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo did not return searchable results."
    });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo could not be reached right now."
    });
  }
};