import fs from "node:fs";
import path from "node:path";

const outputDir = path.resolve("games/moto-x3m");

const files = [
  ["index.html", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/index.html"],
  ["assets/css/app.css", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/assets/css/app.css"],
  ["assets/box2dweb/nape.min.js", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/assets/box2dweb/nape.min.js"],
  ["assets/box2dweb/nape-debug-draw.min.js", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/assets/box2dweb/nape-debug-draw.min.js"],
  ["assets/box2dweb/jquery-3.1.1.min.js", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/assets/box2dweb/jquery-3.1.1.min.js"],
  ["assets/box2dweb/easeljs-0.8.2.combined.js", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/assets/box2dweb/easeljs-0.8.2.combined.js"],
  ["assets/box2dweb/bluebird.min.js", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/assets/box2dweb/bluebird.min.js"],
  ["assets/js/motox3m4.min.js", "https://raw.githubusercontent.com/HTML5GameArchive/gfiles/master/games/motox3m/assets/js/motox3m4.min.js"]
];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

console.log("Installing Moto X3M from a complete local game build...");
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const [relative, url] of files) {
  const destination = path.resolve(outputDir, relative);
  if (!destination.startsWith(outputDir + path.sep)) {
    throw new Error("Unsafe output path.");
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, await download(url));
}

const indexPath = path.join(outputDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

// Make the game completely local. Remove ad/analytics/instrumentation
// scripts and the host site's absolute main.js reference.
html = html.replace(/<script[^>]+src=["']https:\/\/imasdk\.googleapis\.com\/[^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']https:\/\/api\.gamemonetize\.com\/[^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']https:\/\/static\.cloudflareinsights\.com\/[^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']inject\.js["'][^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']\/js\/main\.js["'][^>]*><\/script>/gi, "");
html = html.replace(/<link[^>]+(?:shortcut icon|icon)[^>]*>/gi, "");
html = html.replace(/<script[^>]*>\s*var\s+notIE11[\s\S]*?<\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']https:\/\/[^"']+["'][^>]*><\/script>/gi, "");

fs.writeFileSync(indexPath, html);
console.log(`Moto X3M installed locally: ${outputDir}`);
