/**
 * Descarrega o código fonte de https://github.com/RafaelOliveiraCf/NFSE_dist
 * para third_party/NFSE_dist (zip da branch main).
 * Requer: Node 18+.
 * Extração: tenta `unzip` (Linux/Docker); se falhar, usa `tar -xf` (Windows / bsdtar com suporte a zip).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const thirdParty = path.join(root, "third_party");
const zipPath = path.join(thirdParty, "nfse-dist-main.zip");
const extractName = "NFSE_dist-main";
const targetName = "NFSE_dist";
const url = "https://github.com/RafaelOliveiraCf/NFSE_dist/archive/refs/heads/main.zip";

function extractZipToThirdParty() {
  try {
    console.info("A extrair com unzip …");
    execFileSync("unzip", ["-o", "-q", zipPath, "-d", thirdParty], { stdio: "inherit" });
    return;
  } catch {
    console.info("unzip indisponível ou falhou; a tentar tar -xf (ex.: Windows)…");
  }
  execFileSync("tar", ["-xf", zipPath, "-C", thirdParty], { stdio: "inherit" });
}

async function main() {
  mkdirSync(thirdParty, { recursive: true });
  console.info("A descarregar", url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download falhou: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(zipPath, buf);

  const extracted = path.join(thirdParty, extractName);
  const target = path.join(thirdParty, targetName);
  if (existsSync(extracted)) {
    rmSync(extracted, { recursive: true, force: true });
  }
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }

  extractZipToThirdParty();
  renameSync(extracted, target);
  rmSync(zipPath, { force: true });
  console.info("Pronto:", target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
