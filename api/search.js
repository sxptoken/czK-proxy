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
      const absolute = new URL(value, "https://duckduckgo.com/");
      const uddg = absolute.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);

      // DDG sometimes puts the destination in a /l/?uddg=... redirect.
      if (absolute.pathname === "/l/" && absolute.searchParams.has("uddg")) {
        return decodeURIComponent(absolute.searchParams.get("uddg"));
      }

      return absolute.href;
    } catch {
      return value;
    }
  };

  const addResult = (results, seen, title, href, snippet) => {
    const resultUrl = decodeUrl(href);
    if (!/^https?:\\/\\//i.test(resultUrl)) return;
    if (seen.has(resultUrl)) return;

    const cleanTitle = clean(title);
    if (!cleanTitle) return;

    seen.add(resultUrl);
    results.push({
      title: cleanTitle,
      url: resultUrl,
      snippet: clean(snippet || "")
    });
  };

  const parseHtmlResults = (html) => {
    const results = [];
    const seen = new Set();

    // Current DuckDuckGo HTML result markup.
    const resultBlocks = html.match(/<div[^>]+class=["'][^"']*results_links[^"']*["'][^>]*>[\\s\\S]*?<\\/div>\\s*(?=<div[^>]+class=|$)/gi) || [];

    for (const block of resultBlocks) {
      if (results.length >= 10) break;

      const link = block.match(
        /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/i
      );
      if (!link) continue;

      const snippet = block.match(
        /<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>/i
      );

      addResult(results, seen, link[2], link[1], snippet ? snippet[1] : "");
    }

    // Fallback if DDG changes the surrounding result container.
    if (!results.length) {
      const links = [...html.matchAll(
        /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi
      )];

      for (const match of links) {
        if (results.length >= 10) break;

        const after = html.slice(match.index + match[0].length, match.index + match[0].length + 3000);
        const snippet = after.match(
          /<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>/i
        );

        addResult(results, seen, match[2], match[1], snippet ? snippet[1] : "");
      }
    }

    return results;
  };

  const parseLiteResults = (html) => {
    const results = [];
    const seen = new Set();

    const links = [...html.matchAll(
      /<a[^>]+class=["'][^"']*result-link[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi
    )];

    for (const match of links) {
      if (results.length >= 10) break;

      const after = html.slice(match.index + match[0].length, match.index + match[0].length + 3500);
      const snippet = after.match(
        /<(?:td|div|a)[^>]+class=["'][^"']*result-snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:td|div|a)>/i
      );

      addResult(results, seen, match[2], match[1], snippet ? snippet[1] : "");
    }

    return results;
  };

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://html.duckduckgo.com/",
    "Origin": "https://html.duckduckgo.com",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1"
  };

  try {
    // DDG's HTML endpoint is the no-JS search service. It returns normal
    // result pages without sending the user away from czX.
    const response = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        q,
        b: "",
        kl: "us-en"
      }).toString(),
      redirect: "follow"
    });

    if (response.ok) {
      const html = await response.text();
      const results = parseHtmlResults(html);

      if (results.length) {
        return res.status(200).json({ ok: true, query: q, results });
      }

      // Some DDG responses still use the Lite markup.
      const liteResults = parseLiteResults(html);
      if (liteResults.length) {
        return res.status(200).json({ ok: true, query: q, results: liteResults });
      }
    }

    // Fallback to Lite with a normal GET request. This also handles
    // occasional changes to DDG's HTML endpoint.
    const lite = await fetch(
      "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q),
      {
        method: "GET",
        headers: {
          ...headers,
          "Referer": "https://lite.duckduckgo.com/"
        },
        redirect: "follow"
      }
    );

    if (lite.ok) {
      const html = await lite.text();
      const results = parseLiteResults(html);

      if (results.length) {
        return res.status(200).json({ ok: true, query: q, results });
      }
    }

    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo returned no searchable results."
    });
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok: false,
      error: "DuckDuckGo search is temporarily unavailable."
    });
  }
};