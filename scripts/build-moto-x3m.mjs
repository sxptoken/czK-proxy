import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const ZIP_URL = "https://github.com/silvereengames/moto-x3m/archive/refs/heads/main.zip";
const outputDir = path.resolve("games/moto-x3m");
const tempZip = path.resolve(".moto-x3m.zip");

console.log("Downloading Moto X3M...");
const response = await fetch(ZIP_URL);
if (!response.ok) throw new Error(`Moto X3M download failed: HTTP ${response.status}`);

fs.writeFileSync(tempZip, Buffer.from(await response.arrayBuffer()));
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const zip = new AdmZip(tempZip);
for (const entry of zip.getEntries()) {
  const raw = entry.entryName.replaceAll("\\", "/");
  const parts = raw.split("/");
  if (parts.length < 2) continue;
  parts.shift();
  const relative = parts.join("/");
  if (!relative) continue;

  const destination = path.resolve(outputDir, relative);
  if (!destination.startsWith(outputDir + path.sep)) throw new Error("Unsafe path in archive.");

  if (entry.isDirectory) fs.mkdirSync(destination, { recursive: true });
  else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, entry.getData());
  }
}
fs.rmSync(tempZip, { force: true });

const indexPath = path.join(outputDir, "index.html");
if (!fs.existsSync(indexPath)) throw new Error("Moto X3M index.html was not found.");

let html = fs.readFileSync(indexPath, "utf8");

// Remove third-party ad/analytics/instrumentation scripts so the local game
// does not depend on those services.
html = html.replace(/<script[^>]+src=["']https:\/\/imasdk\.googleapis\.com\/[^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']https:\/\/api\.gamemonetize\.com\/[^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']https:\/\/static\.cloudflareinsights\.com\/[^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']inject\.js["'][^>]*><\/script>/gi, "");
html = html.replace(/<script[^>]*>\s*var\s+notIE11[\s\S]*?<\/script>/gi, "");
html = html.replace(/<script[^>]+src=["']https:\/\/[^"']+["'][^>]*><\/script>/gi, "");
html = html.replace(/<base[^>]*>/gi, "");

fs.writeFileSync(indexPath, html);
console.log(`Moto X3M installed locally: ${outputDir}`);
