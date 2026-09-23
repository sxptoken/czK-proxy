import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const url = "https://github.com/MajesticWafer/tiny-fishing/archive/refs/heads/main.zip";
const outDir = path.resolve("games/tiny-fishing");

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tiny Fishing download failed: ${response.status}`);

  const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
  const temp = path.resolve(".tiny-fishing-temp");
  fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync(temp, { recursive: true });
  zip.extractAllTo(temp, true);

  const roots = fs.readdirSync(temp).filter(name => fs.statSync(path.join(temp, name)).isDirectory());
  const source = roots.length === 1 ? path.join(temp, roots[0]) : temp;

  fs.cpSync(source, outDir, { recursive: true });
  fs.rmSync(temp, { recursive: true, force: true });

  if (!fs.existsSync(path.join(outDir, "index.html"))) {
    throw new Error("Tiny Fishing build is missing index.html");
  }

  console.log("Tiny Fishing ready.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
