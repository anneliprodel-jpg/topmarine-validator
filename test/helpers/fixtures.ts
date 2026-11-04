// Testide abifunktsioonid: fikstuurfailide lugemine ingest-kihi kaudu.
import { ingestFile, ingestPaste } from "@/lib/ingest";
import type { IngestedDoc } from "@/lib/ingest/types";
import { readFileSync } from "node:fs";
import path from "node:path";

const FIX = path.join(process.cwd(), "test", "fixtures");
export const readFix = (name: string) => new Uint8Array(readFileSync(path.join(FIX, name)));
export const readText = (name: string) => readFileSync(path.join(FIX, "text", name), "utf8");

export async function docsFrom(sources: ({ paste: string } | { file: string })[]): Promise<IngestedDoc[]> {
  const docs: IngestedDoc[] = [];
  let i = 0;
  for (const s of sources) {
    i += 1;
    docs.push("paste" in s ? ingestPaste(i, s.paste) : await ingestFile(i, s.file, readFix(s.file)));
  }
  return docs;
}
