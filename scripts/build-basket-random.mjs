import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const ZIP_URL = "https://github.com/mindsetpro/Basket-Random/archive/refs/heads/JJK.zip";
const outputDir = path.resolve("games/basket-random");
const tempZip = path.resolve(".basket-random.zip");

console.log("Downloading Basket Random JJK build...");
const response = await fetch(ZIP_URL);
if (!response.ok) throw new Error(`Basket Random download failed: HTTP ${response.status}`);

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
if (!fs.existsSync(indexPath)) throw new Error("Basket Random index.html was not found.");

let html = fs.readFileSync(indexPath, "utf8");

// The supplied JJK build redirects back to the original GitHub Pages host.
// Remove that redirect so it can actually run from /games/basket-random/.
html = html.replace(/<script>\s*window\.location\s*=\s*"https:\/\/mindsetpro\.github\.io\/Basket-Random\/"[^]*?<\/script>\s*/i, "");
html = html.replace(/<base[^>]*>/gi, "");
fs.writeFileSync(indexPath, html);

console.log(`Basket Random installed and patched locally: ${outputDir}`);
