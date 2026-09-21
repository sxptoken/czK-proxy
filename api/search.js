export default async function handler(req, res) {
  const q = String(req.query?.q || "").trim();

  if (!q) {
    return res.status(400).send("Missing search query.");
  }

  const target =
    "https://html.duckduckgo.com/html/?q=" +
    encodeURIComponent(q);

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    const html = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(html);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Unable to reach DuckDuckGo.");
  }
}
