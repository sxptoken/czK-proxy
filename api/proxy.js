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
    // YouTube watch pages are handled with the official embed player.
    if (targetUrl.hostname === "www.youtube.com" && targetUrl.pathname === "/watch") {
      const videoId = targetUrl.searchParams.get("v");

      if (videoId && /^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
        const embedUrl = "https://www.youtube.com/embed/" + videoId + "?autoplay=0&rel=0";
        const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>czX YouTube</title>
<style>
html,body{margin:0;background:#08090d;color:#fff;font-family:Arial,sans-serif;height:100%}
body{display:flex;align-items:center;justify-content:center}
.player{width:min(1200px,94vw)}
.video{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:14px;overflow:hidden}
iframe{width:100%;height:100%;border:0}
.top{display:flex;justify-content:space-between;align-items:center;padding:14px 0}
.logo{font-size:24px;font-weight:900;color:#fff;text-decoration:none}
.back{color:#aeb5c2;text-decoration:none;font-size:14px}
</style>
</head>
<body>
<div class="player">
  <div class="top"><a class="logo" href="/">czX</a><a class="back" href="javascript:history.back()">← Back</a></div>
  <div class="video"><iframe src="${embedUrl}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
</div>
</body>
</html>`;

        res.status(200);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.send(page);
      }
    }

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
