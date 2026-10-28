// Püsivuskiht (Prisma). Valideerimismootor sellest ei sõltu.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
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
  }));

/** Salvestab (loob või uuendab) tehingus; varasemaid ValidationRun kirjeid ei muudeta. */
export async function saveSubmission(input: SubmissionInput, id: string | null, isDemo = false): Promise<string> {
  return prisma.$transaction(async (tx) => {
    if (id) {
      await tx.submissionLine.deleteMany({ where: { submissionId: id } });
      const row = await tx.submission.update({
        where: { id },
        data: { ...scalarData(input), lines: { create: lineRows(input) } },
      });
      return row.id;
    }
    const row = await tx.submission.create({
      data: { ...scalarData(input), isDemo, lines: { create: lineRows(input) } },
    });
    return row.id;
  });
}

/** Käivitab kontrolli ja salvestab muutumatu käivituse (sisendi hetktõmmis + tulemused). */
export async function runCheck(submissionId: string): Promise<string> {
  const row = await prisma.submission.findUnique({ where: { id: submissionId }, include: { lines: true } });
  if (!row) throw new Error("Päringut ei leitud.");
  const input = rowToInput(row);
  const catalog = await loadCatalog();
  const report = runValidation(input, catalog, new Date());
  const run = await prisma.validationRun.create({
    data: {
      submissionId,
      ruleVersion: report.rulesVersion,
      submissionType: report.submissionType,
      overallStatus: report.overallStatus,
      inputSnapshot: input as unknown as Prisma.InputJsonValue,
      report: report as unknown as Prisma.InputJsonValue,
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
    };
  });
}

export async function getSubmission(id: string) {
  const row = await prisma.submission.findUnique({
    where: { id },
    include: { lines: true, runs: { orderBy: { createdAt: "desc" } } },
  });
  if (!row) return null;
  return {
    row,
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
