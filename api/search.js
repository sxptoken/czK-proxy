module.exports = async (req,res) => {
  const url=new URL(req.url||"/","https://czx.local");
  const q=(url.searchParams.get("q")||"").trim();
  if(!q)return res.status(400).json({ok:false,error:"Missing search query."});
  try{
    if(/^youtube(?:\s|$)/i.test(q)){
      const term=q.replace(/^youtube\s*/i,"").trim()||"trending";
      return res.status(200).json({ok:true,query:q,results:[{title:"YouTube search: "+term,url:"https://www.youtube.com/results?search_query="+encodeURIComponent(term),snippet:"Open YouTube search results for "+term+"."}]});
    }
    const target="https://html.duckduckgo.com/html/?q="+encodeURIComponent(q);
    const response=await fetch(target,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36","Accept":"text/html,application/xhtml+xml"}});
    if(!response.ok)throw new Error("Search provider returned HTTP "+response.status);
    const html=await response.text(),results=[];
    const linkRegex=/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const strip=s=>s.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
    let match;
    while((match=linkRegex.exec(html))&&results.length<10){
      let resultUrl=match[1];
      try{if(resultUrl.startsWith("/l/?"))resultUrl=new URL("https://html.duckduckgo.com"+resultUrl).searchParams.get("uddg")||resultUrl;}catch{}
      if(resultUrl.startsWith("//"))resultUrl="https:"+resultUrl;
      if(!/^https?:\/\//i.test(resultUrl))continue;
      const after=html.slice(linkRegex.lastIndex,linkRegex.lastIndex+2500);
      const sm=after.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
      results.push({title:strip(match[2]),url:resultUrl,snippet:sm?strip(sm[1]):""});
    }
    return res.status(200).json({ok:true,query:q,results});
  }catch(error){console.error("czX search error:",error);return res.status(502).json({ok:false,error:"The search service could not be reached. Please try again."});}
};