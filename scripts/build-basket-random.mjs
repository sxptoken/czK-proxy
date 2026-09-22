import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const ZIP_URL = "https://github.com/mindsetpro/Basket-Random/archive/refs/heads/JJK.zip";
const outputDir = path.resolve("games/basket-random");
const tempZip = path.resolve(".basket-random.zip");

console.log("Downloading Basket Random JJK build...");
const response = await fetch(ZIP_URL);

if (!response.ok) {
  throw new Error(`Basket Random download failed: HTTP ${response.status}`);
}

fs.writeFileSync(tempZip, Buffer.from(await response.arrayBuffer()));

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const zip = new AdmZip(tempZip);
const entries = zip.getEntries();

for (const entry of entries) {
  const raw = entry.entryName.replaceAll("\\", "/");
  const parts = raw.split("/");

  if (parts.length < 2) continue;

  parts.shift();
  const relative = parts.join("/");
  if (!relative) continue;

  const destination = path.resolve(outputDir, relative);

  if (!destination.startsWith(outputDir + path.sep)) {
    throw new Error("Unsafe path in Basket Random archive.");
  }

  if (entry.isDirectory) {
    fs.mkdirSync(destination, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, entry.getData());
  }
}

fs.rmSync(tempZip, { force: true });

if (!fs.existsSync(path.join(outputDir, "index.html"))) {
  throw new Error("Basket Random index.html was not found after extraction.");
}

console.log(`Basket Random installed locally: ${outputDir}`);
