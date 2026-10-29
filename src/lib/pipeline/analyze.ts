// Dokumentide analüüs: lugemine -> semantiline väljavõte -> kontrollitud viited -> liitmine. Ei sõltu andmebaasist (testitav).
import { buildOrder, type BuiltOrder } from "../extract/build";
import { buildPrompt } from "../extract/prompt";
import type { Extractor, ExtractorMeta } from "../extract/provider";
import { verifyExtraction } from "../extract/verify";
import type { IngestedDoc } from "../ingest/types";

export class AnalysisError extends Error {}

export interface AnalysisResult {
  built: BuiltOrder;
  meta: ExtractorMeta;
  /** Dokumendid, mille tekst lühendati enne mudelile saatmist (loetakse osaliseks). */
  truncatedDocs: number[];
}

export async function analyzeDocuments(docs: IngestedDoc[], extractor: Extractor): Promise<AnalysisResult> {
  const readable = docs.filter((d) => d.units.length > 0);
  if (readable.length === 0) throw new AnalysisError("Ühtegi dokumenti ei õnnestunud lugeda, seega kontrolli ei saa teha.");
  const prompt = buildPrompt(readable);
  const raw = await extractor.extract(prompt.text);
  const verified = verifyExtraction(raw, readable, prompt.included);
  const built = buildOrder(verified);
  return { built, meta: extractor.meta, truncatedDocs: prompt.truncatedDocs };
}
