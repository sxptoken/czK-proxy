module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return res.status(400).json({ok:false,error:"Missing search query."});

  try {
    const endpoint = "https://puri.li/api/search?q=" + encodeURIComponent(q) + "&page=1";
    const response = await fetch(endpoint, {
      headers: {"Accept":"application/json"},
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("Search provider HTTP " + response.status);
    }

    const data = await response.json();
    const raw = Array.isArray(data?.results) ? data.results : [];

    const results = raw.slice(0,10).map(item => ({
      title: item.title || item.name || item.url,
      url: item.url || item.link,
      snippet: item.snippet || item.description || item.text || ""
    })).filter(item => item.title && /^https?:\/\//i.test(item.url || ""));

    return res.status(200).json({ok:true,query:q,results});
  } catch (error) {
    console.error("czX search error:", error);
    return res.status(502).json({
      ok:false,
      error:"Search is temporarily unavailable. Please try again."
    });
  }
};