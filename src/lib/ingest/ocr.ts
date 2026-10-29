// OCR: tesseract.js (WASM) eesti + inglise keelega; keeleandmed tulevad npm-pakettidest (võrku ei vaja). Üks töö korraga.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function langDir(): string {
  // tesseract.js vajab ühte kausta, kus on mõlema keele <kood>.traineddata.gz; kopeerime keeleandmed ajutisse kausta (ei sisalda kliendiandmeid)
  const dir = path.join(os.tmpdir(), "tm-ocr-lang");
  fs.mkdirSync(dir, { recursive: true });
  for (const [pkg, code] of [["@tesseract.js-data/est", "est"], ["@tesseract.js-data/eng", "eng"]]) {
    const target = path.join(dir, `${code}.traineddata.gz`);
    if (fs.existsSync(target)) continue;
    const root = path.join(process.cwd(), "node_modules", pkg);
    const src = ["4.0.0_best_int", "4.0.0"].map((d) => path.join(root, d, `${code}.traineddata.gz`)).find((f) => fs.existsSync(f));
    if (!src) throw new Error(`OCR keeleandmed puuduvad: ${pkg}`);
    fs.copyFileSync(src, target);
  }
  return dir;
}

let chain: Promise<unknown> = Promise.resolve();

/** Tuvastab teksti PNG-piltidest. Töötaja luuakse töö jaoks ja lõpetatakse (piiratud mälu); tööd on järjekorras. */
export function ocrImages(pngs: Uint8Array[]): Promise<string[]> {
  const job = chain.then(async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("est+eng", 1, { langPath: langDir(), gzip: true, cacheMethod: "none" } as never);
    try {
      const out: string[] = [];
      for (const png of pngs) {
        const r = await worker.recognize(Buffer.from(png));
        out.push(r.data.text);
      }
      return out;
    } finally {
      await worker.terminate();
    }
  });
  chain = job.catch(() => undefined);
  return job;
}
