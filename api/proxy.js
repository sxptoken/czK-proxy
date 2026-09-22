module.exports = async (req, res) => {
  const requestUrl = new URL(req.url || "/", "https://czx.local");
  const target = requestUrl.searchParams.get("url");

  if (!target) {
    return res.status(400).send("Missing url.");
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return res.status(400).send("Invalid url.");
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return res.status(400).send("Unsupported protocol.");
  }

  try {
    const response = await fetch(targetUrl.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      const buffer = await response.arrayBuffer();
      res.status(response.status);
      res.setHeader("Content-Type", contentType || "application/octet-stream");
      return res.send(Buffer.from(buffer));
    }

    let html = await response.text();
    const base = targetUrl.href;

    // Keep normal links, forms, images, stylesheets and scripts pointed through czX.
    const proxy = (value) => {
      try {
        const absolute = new URL(value, base);
        if (!["http:", "https:"].includes(absolute.protocol)) return value;
        return "/api/proxy?url=" + encodeURIComponent(absolute.href);
      } catch {
        return value;
      }
    };

    html = html.replace(
      /(<(?:a|link|img|script|iframe|source|video|audio|form)\b[^>]*?\b(?:href|src|action)=["'])([^"']+)(["'])/gi,
      (full, start, value, end) => start + proxy(value) + end
    );

    // Rewrite CSS url(...) references.
    html = html.replace(
      /url\((['"]?)([^'")]+)\1\)/gi,
      (full, quote, value) => {
        if (/^(data:|blob:|#)/i.test(value)) return full;
        return "url(" + quote + proxy(value) + quote + ")";
      }
    );

    // Prevent the proxied page from escaping czX through a base tag.
    html = html.replace(/<base\b[^>]*>/gi, "");
    html = html.replace(/<head([^>]*)>/i, '<head$1><base href="' + base.replace(/"/g, "&quot;") + '">');

    res.status(response.status);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(html);
  } catch (error) {
    console.error("czX proxy error:", error);
    return res.status(502).send("The requested website could not be loaded through czX.");
  }
};
