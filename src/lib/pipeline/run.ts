// Analüüsi töövoog koos püsivusega. Algfaile ei salvestata: baidid elavad ainult töötluse ajal mälus.
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { EXTRACTION_VERSION } from "../extract/schema";
import type { Extractor } from "../extract/provider";
import { ExtractorError } from "../extract/provider";
import { ingestFile, ingestPaste } from "../ingest";
import { LIMITS } from "../ingest/limits";
import type { IngestedDoc } from "../ingest/types";
import { runCheck, saveSubmission } from "../repo";
import { AnalysisError, analyzeDocuments } from "./analyze";

export interface AnalysisInputs {
  pasteText: string;
  files: { name: string; bytes: Uint8Array }[];
}

let tail: Promise<unknown> = Promise.resolve();
/** Üks analüüs korraga (OCR ja mudel on mälu- ja kulumahukad Free-teenusel). */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = tail.then(fn, fn);
  tail = p.catch(() => undefined);
  return p;
}

const setStage = (id: string, stage: string) => prisma.submission.update({ where: { id }, data: { extractionStage: stage } });

/** Loob kirje ja käivitab töötluse taustal; tagastab kohe ID (olek on andmebaasis). */
export async function startAnalysis(inputs: AnalysisInputs, extractor: Extractor): Promise<string> {
  const names: { name: string; size: number }[] = [];
  if (inputs.pasteText.trim()) names.push({ name: "Kleebitud tekst", size: Buffer.byteLength(inputs.pasteText) });
  inputs.files.forEach((f) => names.push({ name: f.name, size: f.bytes.byteLength }));

  const sub = await prisma.submission.create({
    data: {
      type: "ENQUIRY",
      source: "AUTO",
      extractionStatus: "PROCESSING",
      extractionStage: "queued",
      extractionProvider: extractor.meta.provider,
      extractionModel: extractor.meta.model,
      extractionVersion: extractor.meta.extractionVersion,
      extractionStartedAt: new Date(),
      documents: { create: names.map((n, i) => ({ index: i + 1, fileName: n.name, byteSize: n.size, status: "PENDING" })) },
    },
  });
  void enqueue(() => processSubmission(sub.id, inputs, extractor)).catch(async (e) => {
    console.error("analysis crashed", (e as Error)?.name);
    await markFailed(sub.id, "Töötlus ebaõnnestus ootamatu vea tõttu.");
  });
  return sub.id;
}

async function markFailed(id: string, message: string) {
  await prisma.submission
    .update({ where: { id }, data: { extractionStatus: "FAILED", extractionStage: "done", extractionError: message, extractionFinishedAt: new Date() } })
    .catch(() => undefined);
}

async function processSubmission(id: string, inputs: AnalysisInputs, extractor: Extractor) {
  // 1. Lugemine
  await setStage(id, "reading");
  const docs: IngestedDoc[] = [];
  let index = 0;
  const persistDoc = async (d: IngestedDoc) => {
    docs.push(d);
    await prisma.sourceDocument.updateMany({
      where: { submissionId: id, index: d.index },
      data: {
        kind: d.kind,
        byteSize: d.byteSize,
        status: d.status,
        message: d.message,
        ocrUsed: d.ocrUsed,
        units: d.units as unknown as Prisma.InputJsonValue,
      },
    });
  };
  if (inputs.pasteText.trim()) await persistDoc(ingestPaste(++index, inputs.pasteText));
  for (const f of inputs.files) await persistDoc(await ingestFile(++index, f.name, f.bytes));

  // 2. Väljavõte
  await setStage(id, "extracting");
  let result;
  try {
    result = await analyzeDocuments(docs, extractor);
  } catch (e) {
    if (e instanceof AnalysisError || e instanceof ExtractorError) return markFailed(id, e.message);
    console.error("extraction failed", (e as Error)?.name);
    return markFailed(id, "Automaatne analüüs ebaõnnestus ootamatu vea tõttu.");
  }
  for (const di of result.truncatedDocs) {
    await prisma.sourceDocument.updateMany({
      where: { submissionId: id, index: di },
      data: {
        status: "PARTIAL",
        message: `Dokumendi tekst lühendati enne analüüsi (piir ${LIMITS.maxUnitsCharsToModel} märki kokku).`,
      },
    });
  }

  // 3. Kontroll
  await setStage(id, "checking");
  const { input, evidence, conflicts, issues, typeAssumed } = result.built;
  await saveSubmission(input, id);
  await prisma.submission.update({
    where: { id },
    data: {
      extraction: { version: EXTRACTION_VERSION, issues, typeAssumed, baseline: input } as unknown as Prisma.InputJsonValue,
      evidence: evidence as unknown as Prisma.InputJsonValue,
      conflicts: conflicts as unknown as Prisma.InputJsonValue,
    },
  });
  await runCheck(id);
  const partial = docs.some((d) => d.status !== "OK") || result.truncatedDocs.length > 0;
  await prisma.submission.update({
    where: { id },
    data: { extractionStatus: partial ? "PARTIAL" : "DONE", extractionStage: "done", extractionFinishedAt: new Date() },
  });
}
