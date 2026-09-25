module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return res.status(400).json({ ok: false, error: "Missing search query." });

  const clean = (value = "") => value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();

  const decodeUrl = (value) => {
    try {
      const u = new URL(value, "https://html.duckduckgo.com/");
      const uddg = u.searchParams.get("uddg");
      return uddg ? decodeURIComponent(uddg) : u.href;
    } catch {
      return value;
    }
  };

  const addResult = (results, seen, title, href, snippet = "") => {
    const resultUrl = decodeUrl(href);
    const cleanTitle = clean(title);
    if (!cleanTitle || !/^https?:\/\//i.test(resultUrl) || seen.has(resultUrl)) return;
    if (/duckduckgo\.com/i.test(resultUrl)) return;
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

    const anchors = [...html.matchAll(
      /<a\b[^>]*class\s*=\s*["'][^"']*\bresult__a\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi
    )];

    for (const match of anchors) {
      if (results.length >= 10) break;
      const tag = match[0];
      const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
      const title = (tag.match(/>([\s\S]*?)<\/a>/i) || [])[1];
      const after = html.slice(match.index + tag.length, match.index + tag.length + 5000);
      const snippet = (after.match(
        /<[^>]*class\s*=\s*["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
      ) || [])[1] || "";
      if (href) addResult(results, seen, title, href, snippet);
    }

    if (!results.length) {
      const liteAnchors = [...html.matchAll(
        /<a\b[^>]*class\s*=\s*["'][^"']*\bresult-link\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi
      )];

      for (const match of liteAnchors) {
        if (results.length >= 10) break;
        const tag = match[0];
        const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
        const title = (tag.match(/>([\s\S]*?)<\/a>/i) || [])[1];
        const after = html.slice(match.index + tag.length, match.index + tag.length + 4000);
        const snippet = (after.match(
          /<[^>]*class\s*=\s*["'][^"']*\bresult-snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
        ) || [])[1] || "";
        if (href) addResult(results, seen, title, href, snippet);
      }
    }

    return results;
  };

  const ddgHtml = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q) + "&kl=us-en";
  const ddgLite = "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q) + "&kl=us-en";

  const fetchText = async (target) => {
    const gateways = [
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(target),
      "https://corsproxy.io/?url=" + encodeURIComponent(target),
      "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(target)
    ];

    for (const gateway of gateways) {
      try {
        const response = await fetch(gateway, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"
          },
          redirect: "follow"
        });
        if (!response.ok) continue;
        const html = await response.text();
        if (html && html.length > 500) return html;
      } catch (error) {
        console.error("Search gateway failed:", error);
      }
    }

    throw new Error("No search gateway returned DuckDuckGo HTML");
  };

  try {
    let html;

    try {
      html = await fetchText(ddgHtml);
    } catch {
      html = await fetchText(ddgLite);
    }

    let results = parseResults(html);

    if (!results.length) {
      try {
        results = parseResults(await fetchText(ddgLite));
      } catch {}
    }

    if (!results.length) {
      try {
        const response = await fetch("https://r.jina.ai/" + ddgHtml, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/plain,text/markdown;q=0.9,*/*;q=0.8"
          },
          redirect: "follow"
        });

        if (response.ok) {
          const markdown = await response.text();
          const seen = new Set();
          results = [];

          for (const match of markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
            if (results.length >= 10) break;
            const href = decodeUrl(match[2]);
            const title = clean(match[1]);
            if (title && !/duckduckgo\.com/i.test(href)) {
              addResult(results, seen, title, href, "");
            }
          }
        }
      } catch {}
    }

    if (!results.length) {
      return res.status(502).json({
        ok: false,
        error: "DuckDuckGo returned no results."
      });
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