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
    .replace(/&nbsp;/gi, " ")
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
      const absolute = new URL(value, "https://duckduckgo.com/");
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

    // Do not expose DuckDuckGo's own navigation links as search results.
    if (/^(https?:\\/\\/)?([a-z0-9-]+\\.)*duckduckgo\\.com(\\/|$)/i.test(resultUrl)) return;

    seen.add(resultUrl);
    results.push({
      title: cleanTitle,
      url: resultUrl,
      snippet: clean(snippet)
    });
  };

  const parseResults = (html) => {
    const results = [];
    const seen = new Set();

    // Match the result title anchor regardless of HTML attribute order.
    const anchors = [...html.matchAll(
      /<a\\b[^>]*class\\s*=\\s*["'][^"']*\\bresult__a\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>/gi
    )];

    for (const match of anchors) {
      if (results.length >= 10) break;

      const tag = match[0];
      const hrefMatch = tag.match(/\\bhref\\s*=\\s*["']([^"']+)["']/i);
      if (!hrefMatch) continue;

      const after = html.slice(match.index + tag.length, match.index + tag.length + 3500);
      const snippetMatch = after.match(
        /<a\\b[^>]*class\\s*=\\s*["'][^"']*\\bresult__snippet\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>/i
      );

      addResult(results, seen, match[1], hrefMatch[1], snippetMatch ? snippetMatch[1] : "");
    }

    // Lite endpoint fallback.
    if (!results.length) {
      const lite = [...html.matchAll(
        /<a\\b[^>]*class\\s*=\\s*["'][^"']*\\bresult-link\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>/gi
      )];

      for (const match of lite) {
        if (results.length >= 10) break;
        const hrefMatch = match[0].match(/\\bhref\\s*=\\s*["']([^"']+)["']/i);
        if (!hrefMatch) continue;

        const after = html.slice(match.index + match[0].length, match.index + match[0].length + 3500);
        const snippetMatch = after.match(
          /<[^>]*class\\s*=\\s*["'][^"']*\\bresult-snippet\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>/i
        );

        addResult(results, seen, match[1], hrefMatch[1], snippetMatch ? snippetMatch[1] : "");
      }
    }

    return results;
  };

  const fetchViaAllOrigins = async () => {
    const ddgUrl = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q) + "&kl=us-en";
    const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(ddgUrl);

    const response = await fetch(proxyUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml"
      },
      redirect: "follow"
    });

    if (!response.ok) throw new Error("AllOrigins HTTP " + response.status);

    const html = await response.text();
    const results = parseResults(html);

    if (!results.length) {
      throw new Error("AllOrigins returned no parsed DuckDuckGo results (" + html.length + " bytes)");
    }

    return results;
  };

  const fetchViaJina = async () => {
    const ddgUrl = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q) + "&kl=us-en";
    const response = await fetch("https://r.jina.ai/" + ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/plain,text/markdown;q=0.9,*/*;q=0.8"
      },
      redirect: "follow"
    });

    if (!response.ok) throw new Error("Jina HTTP " + response.status);

    const text = await response.text();
    const results = [];
    const seen = new Set();

    // Jina may turn the DDG result page into Markdown.
    const links = [...text.matchAll(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g)];

    for (const m of links) {
      if (results.length >= 10) break;
      const title = clean(m[1]);
      const href = decodeUrl(m[2]);

      if (!title || /duckduckgo\\.com/i.test(href)) continue;
      addResult(results, seen, title, href, "");
    }

    if (!results.length) throw new Error("Jina returned no parsed results");
    return results;
  };

  try {
    let results;

    // Primary: AllOrigins fetches DuckDuckGo's non-JS results from a
    // separate network, avoiding Vercel datacenter requests being rejected.
    try {
      results = await fetchViaAllOrigins();
    } catch (allOriginsError) {
      console.error("AllOrigins DDG search failed:", allOriginsError);
      results = await fetchViaJina();
    }

    return res.status(200).json({
      ok: true,
      query: q,
      results
    });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo could not be reached right now."
    });
  }
};