export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "YouTube API is not configured. Add YOUTUBE_API_KEY in Vercel Environment Variables."
    });
  }

  const query = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  const maxResults = Math.min(
    Math.max(Number.parseInt(req.query?.maxResults || "12", 10) || 12, 1),
    25
  );

  if (!query) {
    return res.status(400).json({ error: "A search query is required." });
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    regionCode: "US",
    safeSearch: "moderate",
    videoEmbeddable: "true",
    key: apiKey
  });

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "YouTube API request failed."
      });
    }

    const items = (data.items || []).map(item => ({
      id: item.id?.videoId,
      title: item.snippet?.title || "",
      description: item.snippet?.description || "",
      channelTitle: item.snippet?.channelTitle || "",
      publishedAt: item.snippet?.publishedAt || "",
      thumbnail:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        ""
    })).filter(item => item.id);

    return res.status(200).json({
      items,
      nextPageToken: data.nextPageToken || null
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to reach YouTube right now." });
  }
}
