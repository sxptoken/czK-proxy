module.exports = async (req, res) => {
  const requestUrl = new URL(req.url || "/", "https://czx.local");
  const target = requestUrl.searchParams.get("url");
  if (!target) return res.status(400).send("Missing url.");

  let targetUrl;
  try { targetUrl = new URL(target); }
  catch { return res.status(400).send("Invalid url."); }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return res.status(400).send("Unsupported protocol.");
  }

  try {
    if (targetUrl.hostname === "basketrandomonline.github.io") {
      const page = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>czX · Basket Random</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#08090d;color:#fff;font-family:Arial,sans-serif;overflow:hidden}.top{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:#0d1016;border-bottom:1px solid #202530}.logo{color:#fff;text-decoration:none;font-size:24px;font-weight:900}.back{color:#aeb5c2;text-decoration:none;font-size:14px}.game{width:100%;height:calc(100vh - 58px);border:0;display:block;background:#000}</style></head><body><div class="top"><a class="logo" href="/">czX</a><a class="back" href="/">← Back</a></div><iframe class="game" src="https://basketrandomonline.github.io/" title="Basket Random" allow="fullscreen; autoplay" allowfullscreen></iframe></body></html>`;
      res.status(200);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.send(page);
    }

    const youtubeHost =
      targetUrl.hostname === "www.youtube.com" ||
      targetUrl.hostname === "youtube.com" ||
      targetUrl.hostname === "m.youtube.com" ||
      targetUrl.hostname === "youtu.be";

    if (youtubeHost) {
      let videoId = null;

      if (targetUrl.hostname === "youtu.be") {
        videoId = targetUrl.pathname.split("/").filter(Boolean)[0] || null;
      } else if (targetUrl.pathname === "/watch") {
        videoId = targetUrl.searchParams.get("v");
      } else if (targetUrl.pathname.startsWith("/shorts/")) {
        videoId = targetUrl.pathname.split("/").filter(Boolean)[1] || null;
      } else if (targetUrl.pathname.startsWith("/embed/")) {
        videoId = targetUrl.pathname.split("/").filter(Boolean)[1] || null;
      }

      if (videoId && /^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
        const embedUrl =
          "https://www.youtube.com/embed/" + encodeURIComponent(videoId) +
          "?autoplay=0&playsinline=1&rel=0&origin=https%3A%2F%2Fczk-bay.vercel.app";

        const page = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>czX · YouTube</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#08090d;color:#fff;font-family:Arial,sans-serif}body{padding:18px}.top{max-width:1200px;margin:0 auto 14px;display:flex;justify-content:space-between;align-items:center}.logo{font-size:24px;font-weight:900;color:#fff;text-decoration:none}.back{color:#aeb5c2;text-decoration:none;font-size:14px}.video{max-width:1200px;margin:0 auto;background:#000;aspect-ratio:16/9;border-radius:12px;overflow:hidden}iframe{width:100%;height:100%;border:0;display:block}.note{max-width:1200px;margin:12px auto 0;color:#8f96a3;font-size:13px}</style></head><body><div class="top"><a class="logo" href="/">czX</a><a class="back" href="javascript:history.back()">← Back</a></div><div class="video"><iframe src="${embedUrl}" title="YouTube video" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="note">YouTube video player</div></body></html>`;

        res.status(200);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.send(page);
      }

      const page = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>czX · YouTube</title><style>html,body{margin:0;min-height:100%;background:#08090d;color:#fff;font-family:Arial,sans-serif}body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}.box{max-width:600px;text-align:center}.logo{font-size:30px;font-weight:900;margin-bottom:16px}.muted{color:#9aa1ad;line-height:1.5}.back{display:inline-block;margin-top:20px;padding:10px 16px;border-radius:8px;background:#7c3aed;color:#fff;text-decoration:none}</style></head><body><div class="box"><div class="logo">czX · YouTube</div><div class="muted">This is a YouTube page rather than a specific video. Video results open in the embedded player.</div><a class="back" href="javascript:history.back()">← Back to results</a></div></body></html>`;

      res.status(200);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.send(page);
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

    const proxy = (value) => {
      try {
        const absolute = new URL(value, base);
        if (!["http:", "https:"].includes(absolute.protocol)) return value;
        return "/api/proxy?url=" + encodeURIComponent(absolute.href);
      } catch { return value; }
    };

    html = html.replace(
      /(<(?:a|link|img|script|iframe|source|video|audio|form)\b[^>]*?\b(?:href|src|action)=["'])([^"']+)(["'])/gi,
      (full, start, value, end) => start + proxy(value) + end
    );

    html = html.replace(
      /url\((['"]?)([^'")]+)\1\)/gi,
      (full, quote, value) => {
        if (/^(data:|blob:|#)/i.test(value)) return full;
        return "url(" + quote + proxy(value) + quote + ")";
      }
    );

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