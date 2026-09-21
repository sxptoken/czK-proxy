export default async function handler(req, res) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!q) {
    return res.status(400).send("Missing search query.");
  }

  const url =
    "https://html.duckduckgo.com/html/?q=" +
    encodeURIComponent(q);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; czX/1.0)"
      }
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .send("DuckDuckGo returned an error.");
    }

    const html = await response.text();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(html);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Search proxy error.");
  }
}
