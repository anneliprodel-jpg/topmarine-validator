// Dokumentide analüüs: lugemine -> kohalik väljavõte -> kontrollitud viited -> liitmine. Ei sõltu andmebaasist ega välistest teenustest (testitav).
import { buildOrder, type BuiltOrder } from "../extract/build";
import { extractLocally, LOCAL_META } from "../extract/local";
import { verifyExtraction } from "../extract/verify";
import type { IngestedDoc } from "../ingest/types";

export class AnalysisError extends Error {}

export interface AnalysisResult {
  built: BuiltOrder;
  meta: typeof LOCAL_META;
}

export async function analyzeDocuments(docs: IngestedDoc[]): Promise<AnalysisResult> {
  const readable = docs.filter((d) => d.units.length > 0);
  if (readable.length === 0) throw new AnalysisError("Ühtegi dokumenti ei õnnestunud lugeda, seega kontrolli ei saa teha. Sisesta andmed käsitsi.");
  const { raw, notes } = extractLocally(readable);
  const verified = verifyExtraction(raw, readable);
  verified.issues.push(...notes);
  const built = buildOrder(verified);
  return { built, meta: LOCAL_META };
}
