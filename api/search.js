module.exports = async (req, res) => {
  const url = new URL(req.url || "/", "https://czx.local");
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return res.status(400).json({ ok:false, error:"Missing search query." });

  const clean = (value = "") => value
    .replace(/<script[\\s\\S]*?<\\/script>/gi," ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi," ")
    .replace(/<[^>]*>/g," ")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&#x27;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))
    .replace(/\\s+/g," ")
    .trim();

  const decodeUrl = value => {
    try {
      const u = new URL(value,"https://html.duckduckgo.com/");
      const uddg = u.searchParams.get("uddg");
      return uddg ? decodeURIComponent(uddg) : u.href;
    } catch { return value; }
  };

  const add = (out, seen, title, href, snippet="") => {
    const u = decodeUrl(href);
    const t = clean(title);
    if (!t || !/^https?:\\/\\//i.test(u) || seen.has(u)) return;
    if (/duckduckgo\\.com/i.test(u)) return;
    seen.add(u);
    out.push({title:t,url:u,snippet:clean(snippet)});
  };

  const parse = html => {
    const out=[], seen=new Set();

    // Normal DDG HTML.
    const a=[...html.matchAll(/<a\\b[^>]*class\\s*=\\s*["'][^"']*result__a[^"']*["'][^>]*>[\\s\\S]*?<\\/a>/gi)];
    for (const m of a) {
      if(out.length>=10) break;
      const tag=m[0];
      const href=(tag.match(/\\bhref\\s*=\\s*["']([^"']+)["']/i)||[])[1];
      const title=(tag.match(/>([\\s\\S]*?)<\\/a>/i)||[])[1];
      const after=html.slice(m.index+tag.length,m.index+tag.length+5000);
      const sn=(after.match(/<[^>]*class\\s*=\\s*["'][^"']*result__snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>/i)||[])[1]||"";
      if(href) add(out,seen,title,href,sn);
    }

    // DDG Lite.
    if(!out.length){
      const a2=[...html.matchAll(/<a\\b[^>]*class\\s*=\\s*["'][^"']*result-link[^"']*["'][^>]*>[\\s\\S]*?<\\/a>/gi)];
      for(const m of a2){
        if(out.length>=10) break;
        const tag=m[0];
        const href=(tag.match(/\\bhref\\s*=\\s*["']([^"']+)["']/i)||[])[1];
        const title=(tag.match(/>([\\s\\S]*?)<\\/a>/i)||[])[1];
        const after=html.slice(m.index+tag.length,m.index+tag.length+4000);
        const sn=(after.match(/class\\s*=\\s*["'][^"']*result-snippet[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>/i)||[])[1]||"";
        if(href) add(out,seen,title,href,sn);
      }
    }

    return out;
  };

  const ddgHtml = "https://html.duckduckgo.com/html/?q="+encodeURIComponent(q)+"&kl=us-en";
  const ddgLite = "https://lite.duckduckgo.com/lite/?q="+encodeURIComponent(q)+"&kl=us-en";

  const fetchText = async target => {
    const gateways = [
      "https://api.allorigins.win/raw?url="+encodeURIComponent(target),
      "https://corsproxy.io/?url="+encodeURIComponent(target),
      "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(target)
    ];

    for(const gateway of gateways){
      try{
        const r=await fetch(gateway,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html,*/*;q=0.8"},redirect:"follow"});
        if(!r.ok) continue;
        const text=await r.text();
        if(text && text.length>500) return text;
      }catch(e){
        console.error("Search gateway failed:",gateway,e);
      }
    }
    throw new Error("No search gateway returned DuckDuckGo HTML");
  };

  try {
    let html;
    try {
      html=await fetchText(ddgHtml);
    } catch {
      html=await fetchText(ddgLite);
    }

    let results=parse(html);

    // If the first endpoint returned Lite/HTML without the expected classes,
    // try the other DDG no-JS endpoint through the same gateways.
    if(!results.length){
      try { results=parse(await fetchText(ddgLite)); } catch {}
    }

    // Last resort: Jina Reader fetching the actual DDG page.
    if(!results.length){
      const r=await fetch("https://r.jina.ai/"+ddgHtml,{
        headers:{"User-Agent":"Mozilla/5.0","Accept":"text/plain,text/markdown;q=0.9,*/*;q=0.8"},
        redirect:"follow"
      });
      if(r.ok){
        const md=await r.text();
        const seen=new Set();
        results=[];
        for(const m of md.matchAll(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g)){
          if(results.length>=10) break;
          const href=decodeUrl(m[2]), title=clean(m[1]);
          if(title && !/duckduckgo\\.com/i.test(href)) add(results,seen,title,href,"");
        }
      }
    }

    if(!results.length){
      console.error("No DDG results parsed for:",q);
      return res.status(502).json({ok:false,error:"DuckDuckGo returned no results."});
    }

    return res.status(200).json({ok:true,query:q,results});
  } catch(error) {
    console.error("czX search error:",error);
    return res.status(502).json({ok:false,error:"DuckDuckGo could not be reached right now."});
  }
};