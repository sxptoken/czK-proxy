const GAME_ORIGIN = "https://mindsetpro.github.io/Basket-Random/";

export default async function handler(req, res) {
  try {
    const rawPath = Array.isArray(req.query.path) ? req.query.path.join("/") : (req.query.path || "");
    const cleanPath = String(rawPath).replace(/^\/+/, "").replace(/\.\./g, "");
    const target = new URL(cleanPath || "index.html", GAME_ORIGIN);

    if (target.origin !== new URL(GAME_ORIGIN).origin) {
      return res.status(400).send("Invalid game path");
    }

    const response = await fetch(target.toString(), {
      headers: { "User-Agent": "czX Game Proxy" }
    });

    if (!response.ok) {
      return res.status(response.status).send("Game asset unavailable");
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    let body;

    if (contentType.includes("text/html")) {
      body = await response.text();

      body = body
        .replace(
          /window\.location\s*=\s*"https:\/\/mindsetpro\.github\.io\/Basket-Random\/"\s*;?/g,
          ""
        )
        .replace(
          /(["'(])((?:\.\/|\.\.\/|\/)?(?:images|scripts|media|js|json|style\.css|appmanifest\.json|data\.json|box2d\.wasm(?:\.js)?|favicon\.ico)[^"' )]*)/g,
          (match, prefix, path) => {
            const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
            return prefix + "/api/game-proxy?path=" + encodeURIComponent(normalized);
          }
        );
    } else {
      body = Buffer.from(await response.arrayBuffer());
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(body);
  } catch (error) {
    console.error("Basket Random proxy error:", error);
    return res.status(500).send("Unable to load game");
  }
}
