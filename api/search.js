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

  const parseResults = (html) => {
    const results = [];
    const seen = new Set();

    const add = (title, href, snippet = "") => {
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

    // DuckDuckGo HTML results.
    const htmlLinks = [...html.matchAll(
      /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi
    )];

    for (const m of htmlLinks) {
      if (results.length >= 10) break;
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 5000);
      const snippet = after.match(
        /class=["'][^"']*result__snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>/i
      );
      add(m[2], m[1], snippet ? snippet[1] : "");
    }

    // DuckDuckGo Lite results.
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
        add(m[2], m[1], snippet ? snippet[1] : "");
      }
    }

    return results;
  };

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1"
  };

  const cookieHeader = (response) => {
    const values = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
    return values
      .map(v => v.split(";")[0])
      .filter(Boolean)
      .join("; ");
  };

  const hiddenFields = (html) => {
    const fields = {};
    const inputs = [...html.matchAll(
      /<input\\b[^>]*type=["']hidden["'][^>]*>/gi
    )];

    for (const input of inputs) {
      const name = input[0].match(/\\bname=["']([^"']+)["']/i);
      if (!name) continue;
      const value = input[0].match(/\\bvalue=["']([^"']*)["']/i);
      fields[name[1]] = value ? value[1] : "";
    }

    return fields;
  };

  try {
    const endpoint = "https://html.duckduckgo.com/html/";

    // First load the search form so DDG can provide its current hidden
    // parameters/cookies. This is important because DDG changes its
    // no-JS form and bot checks from time to time.
    const intro = await fetch(endpoint, {
      method: "GET",
      headers: {
        ...browserHeaders,
        "Referer": "https://html.duckduckgo.com/"
      },
      redirect: "follow"
    });

    if (!intro.ok) {
      throw new Error("DuckDuckGo form HTTP " + intro.status);
    }

    const introHtml = await intro.text();
    const fields = hiddenFields(introHtml);

    fields.q = q;
    fields.kl = fields.kl || "us-en";
    fields.b = "";

    const cookies = cookieHeader(intro);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...browserHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://html.duckduckgo.com/html/",
        "Origin": "https://html.duckduckgo.com",
        ...(cookies ? { Cookie: cookies } : {})
      },
      body: new URLSearchParams(fields).toString(),
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("DuckDuckGo search HTTP " + response.status);
    }

    const html = await response.text();
    const results = parseResults(html);

    if (results.length) {
      return res.status(200).json({ ok: true, query: q, results });
    }

    console.error("DuckDuckGo returned no parsed results. Response length:", html.length);

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