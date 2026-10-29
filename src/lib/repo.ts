// Püsivuskiht (Prisma). Valideerimismootor sellest ei sõltu.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { ConflictMap, DocSummary, EvidenceMap } from "./evidence";
import { runValidation } from "./validation/engine";
import type {
  AnchoringType,
  CatalogProduct,
  DisputedProperty,
  LineVariant,
  SubmissionInput,
  SubmissionType,
  Tri,
  ValidationReport,
  CheckStatus,
} from "./validation/types";

export async function loadCatalog(): Promise<CatalogProduct[]> {
  const rows = await prisma.productVariant.findMany({ include: { source: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((p) => ({
    internalId: p.internalId,
    code: p.code,
    variant: p.variant as CatalogProduct["variant"],
    kind: p.kind as CatalogProduct["kind"],
    name: p.name,
    widthM: p.widthM,
    lengthM: p.lengthM,
    floatsPerModule: p.floatsPerModule,
    reviewRequired: p.reviewRequired,
    sourceLabel: `${p.source.filename}, ${p.source.location}`,
  }));
}

type SubmissionWithLines = Prisma.SubmissionGetPayload<{ include: { lines: true } }>;

export function rowToInput(row: SubmissionWithLines): SubmissionInput {
  return {
    type: row.type as SubmissionType,
    projectName: row.projectName,
    customerName: row.customerName,
    requestedDeliveryDate: row.requestedDeliveryDate ? row.requestedDeliveryDate.toISOString().slice(0, 10) : null,
    referenceText: row.referenceText,
    comments: row.comments,
    lines: [...row.lines]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        variant: l.variant as LineVariant | null,
        code: l.code,
        customName: l.customName,
        quantity: l.quantity,
        statedWidthM: l.statedWidthM,
        statedLengthM: l.statedLengthM,
        statedFloatsPerModule: l.statedFloatsPerModule,
        statedFloatsTotal: l.statedFloatsTotal,
      })),
    modulesConnected: row.modulesConnected as Tri | null,
    connectionDescription: row.connectionDescription,
    connectionComponents: row.connectionComponents,
    connectionQuantitiesUnknown: row.connectionQuantitiesUnknown,
    anchoringType: row.anchoringType as AnchoringType | null,
    anchoringDetails: row.anchoringDetails,
    shoreConnection: row.shoreConnection as Tri | null,
    gangwayDetails: row.gangwayDetails,
    shoreSupportDetails: row.shoreSupportDetails,
    shoreDetailsUnknown: row.shoreDetailsUnknown,
    siteNotes: row.siteNotes,
    winterUse: row.winterUse,
    waveHeightM: row.siteWaveHeightM,
    currentSpeedMs: row.siteCurrentSpeedMs,
    boatLengthM: row.boatLengthM,
    relevantProperties: row.relevantProperties as DisputedProperty[],
  };
}

function scalarData(i: SubmissionInput) {
  return {
    type: i.type,
    projectName: i.projectName,
    customerName: i.customerName,
    requestedDeliveryDate: i.requestedDeliveryDate ? new Date(`${i.requestedDeliveryDate}T00:00:00Z`) : null,
    referenceText: i.referenceText,
    comments: i.comments,
    modulesConnected: i.modulesConnected,
    connectionDescription: i.connectionDescription,
    connectionComponents: i.connectionComponents,
    connectionQuantitiesUnknown: i.connectionQuantitiesUnknown,
    anchoringType: i.anchoringType,
    anchoringDetails: i.anchoringDetails,
    shoreConnection: i.shoreConnection,
    gangwayDetails: i.gangwayDetails,
    shoreSupportDetails: i.shoreSupportDetails,
    shoreDetailsUnknown: i.shoreDetailsUnknown,
    siteNotes: i.siteNotes,
    winterUse: i.winterUse,
    siteWaveHeightM: i.waveHeightM,
    siteCurrentSpeedMs: i.currentSpeedMs,
    boatLengthM: i.boatLengthM,
    relevantProperties: i.relevantProperties,
  };
}

const lineRows = (i: SubmissionInput) =>
  i.lines.map((l, position) => ({
    position,
    variant: l.variant,
    code: l.code,
    customName: l.customName,
    quantity: l.quantity,
    statedWidthM: l.statedWidthM,
    statedLengthM: l.statedLengthM,
    statedFloatsPerModule: l.statedFloatsPerModule,
        statedFloatsTotal: l.statedFloatsTotal,
  }));

/** Salvestab (loob või uuendab) tehingus; varasemaid ValidationRun kirjeid ei muudeta. */
export async function saveSubmission(input: SubmissionInput, id: string | null, isDemo = false): Promise<string> {
  return prisma.$transaction(async (tx) => {
    if (id) {
      const prev = await tx.submission.findUnique({ where: { id }, select: { source: true, extraction: true } });
      const baseline = (prev?.extraction as { baseline?: SubmissionInput } | null)?.baseline;
      const corrections = prev?.source === "AUTO" && baseline ? diffAgainstBaseline(baseline, input) : undefined;
      await tx.submissionLine.deleteMany({ where: { submissionId: id } });
      const row = await tx.submission.update({
        where: { id },
        data: {
          ...scalarData(input),
          ...(corrections ? { corrections: corrections as unknown as Prisma.InputJsonValue } : {}),
          lines: { create: lineRows(input) },
        },
      });
      return row.id;
    }
    const row = await tx.submission.create({
      data: { ...scalarData(input), isDemo, lines: { create: lineRows(input) } },
    });
    return row.id;
  });
}

/** Käivitab kontrolli ja salvestab muutumatu käivituse (sisendi hetktõmmis, tulemused, allikaviited, dokumentide olek). Ei kutsu väljavõtteteenust. */
export async function runCheck(submissionId: string): Promise<string> {
  const row = await prisma.submission.findUnique({ where: { id: submissionId }, include: { lines: true, documents: { orderBy: { index: "asc" } } } });
  if (!row) throw new Error("Päringut ei leitud.");
  const input = rowToInput(row);
  const catalog = await loadCatalog();
  const documents: DocSummary[] = row.documents.map((d) => ({
    index: d.index,
    fileName: d.fileName,
    kind: d.kind,
    status: d.status,
    message: d.message,
    ocrUsed: d.ocrUsed,
  }));
  const evidence = (row.evidence ?? {}) as unknown as EvidenceMap;
  const conflicts = (row.conflicts ?? {}) as unknown as ConflictMap;
  const report = runValidation(input, catalog, new Date(), { evidence, conflicts, documents });
  const extractor = row.source === "AUTO" ? { provider: row.extractionProvider, model: row.extractionModel, extractionVersion: row.extractionVersion } : null;
  const run = await prisma.validationRun.create({
    data: {
      submissionId,
      ruleVersion: report.rulesVersion,
      submissionType: report.submissionType,
      overallStatus: report.overallStatus,
      inputSnapshot: input as unknown as Prisma.InputJsonValue,
      report: report as unknown as Prisma.InputJsonValue,
      evidence: evidence as unknown as Prisma.InputJsonValue,
      conflicts: conflicts as unknown as Prisma.InputJsonValue,
      documents: documents as unknown as Prisma.InputJsonValue,
      ...(extractor ? { extractor: extractor as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  return run.id;
}

export async function listSubmissions(take?: number) {
  const rows = await prisma.submission.findMany({
    orderBy: { updatedAt: "desc" },
    take,
    include: { runs: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { lines: true, runs: true } } },
  });
  return rows.map((r) => {
    const last = r.runs[0];
    return {
      id: r.id,
      type: r.type as SubmissionType,
      projectName: r.projectName,
      customerName: r.customerName,
      isDemo: r.isDemo,
      updatedAt: r.updatedAt,
      lineCount: r._count.lines,
      runCount: r._count.runs,
      lastStatus: (last?.overallStatus as CheckStatus | undefined) ?? null,
      lastRunAt: last?.createdAt ?? null,
      stale: !!last && r.updatedAt.getTime() > last.createdAt.getTime(),
      extractionStatus: r.extractionStatus,
      source: r.source,
    };
  });
}

export async function getSubmission(id: string) {
  const row = await prisma.submission.findUnique({
    where: { id },
    include: { lines: true, runs: { orderBy: { createdAt: "desc" } }, documents: { orderBy: { index: "asc" } } },
  });
  if (!row) return null;
  return {
    row: await failStaleProcessing(row),
    documents: row.documents.map((d) => ({ index: d.index, fileName: d.fileName, kind: d.kind, status: d.status, message: d.message, ocrUsed: d.ocrUsed })) as DocSummary[],
    evidence: (row.evidence ?? {}) as unknown as EvidenceMap,
    conflicts: (row.conflicts ?? {}) as unknown as ConflictMap,
    corrections: (row.corrections ?? []) as unknown as Correction[],
    extractionIssues: ((row.extraction as { issues?: string[] } | null)?.issues ?? []) as string[],
    input: rowToInput(row),
    runs: row.runs.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      ruleVersion: r.ruleVersion,
      overallStatus: r.overallStatus as CheckStatus,
      submissionType: r.submissionType as SubmissionType,
    })),
  };
}

export async function getRun(runId: string) {
  const run = await prisma.validationRun.findUnique({ where: { id: runId }, include: { submission: true } });
  if (!run) return null;
  return {
    id: run.id,
    submissionId: run.submissionId,
    createdAt: run.createdAt,
    ruleVersion: run.ruleVersion,
    submissionType: run.submissionType as SubmissionType,
    overallStatus: run.overallStatus as CheckStatus,
    inputSnapshot: run.inputSnapshot as unknown as SubmissionInput,
    evidence: (run.evidence ?? {}) as unknown as EvidenceMap,
    documents: (run.documents ?? []) as unknown as DocSummary[],
    extractor: (run.extractor ?? null) as { provider?: string; model?: string; extractionVersion?: string } | null,
    report: run.report as unknown as ValidationReport,
    projectName: run.submission.projectName,
  };
}

export async function deleteSubmission(id: string): Promise<void> {
  await prisma.submission.delete({ where: { id } }); // ridade ja käivituste kaskaaduv kustutus
}

export async function getCatalogueView() {
  const [products, sources, conflicts, rules] = await Promise.all([
    prisma.productVariant.findMany({ include: { source: true }, orderBy: { sortOrder: "asc" } }),
    prisma.sourceReference.findMany({ orderBy: { key: "asc" } }),
    prisma.sourceConflict.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.validationRule.findMany({ include: { source: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { products, sources, conflicts, rules };
}

export interface Correction {
  field: string;
  extracted: string;
  corrected: string;
}

const show = (v: unknown) => (v == null || v === "" ? "(tühi)" : String(v));

/** Kasutaja parandused võrreldes automaatselt loetud väärtustega (väärtused jäävad jälgitavaks). */
export function diffAgainstBaseline(baseline: SubmissionInput, now: SubmissionInput): Correction[] {
  const out: Correction[] = [];
  const scalars = [
    "type", "projectName", "customerName", "requestedDeliveryDate", "modulesConnected", "connectionDescription", "anchoringType",
    "anchoringDetails", "shoreConnection", "gangwayDetails", "shoreSupportDetails", "winterUse", "waveHeightM", "currentSpeedMs", "boatLengthM", "siteNotes",
  ] as const;
  for (const k of scalars) if (show(baseline[k]) !== show(now[k])) out.push({ field: k, extracted: show(baseline[k]), corrected: show(now[k]) });
  const fields = ["variant", "code", "customName", "quantity", "statedWidthM", "statedLengthM", "statedFloatsPerModule", "statedFloatsTotal"] as const;
  const n = Math.max(baseline.lines.length, now.lines.length);
  for (let i = 0; i < n; i++) {
    const a = baseline.lines[i];
    const b = now.lines[i];
    if (!a || !b) {
      out.push({ field: `lines.${i}`, extracted: a ? "rida oli olemas" : "(puudus)", corrected: b ? "rida lisatud/olemas" : "rida eemaldatud" });
      continue;
    }
    for (const f of fields) if (show(a[f]) !== show(b[f])) out.push({ field: `lines.${i}.${f}`, extracted: show(a[f]), corrected: show(b[f]) });
  }
  return out;
}

const STALE_MS = 12 * 60 * 1000;

/** Töötlus, mis on liiga kaua käimas (nt serveri taaskäivitus), märgitakse ebaõnnestunuks, et see ei näiduks lõputult pooleli. */
async function failStaleProcessing<T extends { id: string; extractionStatus: string; extractionStartedAt: Date | null }>(row: T): Promise<T> {
  if (row.extractionStatus === "PROCESSING" && row.extractionStartedAt && Date.now() - row.extractionStartedAt.getTime() > STALE_MS) {
    await prisma.submission.update({
      where: { id: row.id },
      data: { extractionStatus: "FAILED", extractionError: "Töötlus katkes (serveri taaskäivitus või ajalimiit). Lisa dokumendid uuesti.", extractionFinishedAt: new Date() },
    });
    return { ...row, extractionStatus: "FAILED" };
  }
  return row;
}
