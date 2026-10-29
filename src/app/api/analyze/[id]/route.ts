import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STALE_MS = 12 * 60 * 1000;

/** Töötluse olek (küsitakse perioodiliselt). Ei sisalda dokumentide teksti. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const s = await prisma.submission.findUnique({
      where: { id },
      select: { id: true, extractionStatus: true, extractionStage: true, extractionError: true, extractionStartedAt: true, documents: { orderBy: { index: "asc" }, select: { index: true, fileName: true, status: true, message: true, ocrUsed: true } } },
    });
    if (!s) return Response.json({ error: "Kirjet ei leitud." }, { status: 404 });
    let { extractionStatus: status, extractionError: error } = s;
    if (status === "PROCESSING" && s.extractionStartedAt && Date.now() - s.extractionStartedAt.getTime() > STALE_MS) {
      status = "FAILED";
      error = "Töötlus katkes (serveri taaskäivitus või ajalimiit). Lisa dokumendid uuesti.";
      await prisma.submission.update({ where: { id }, data: { extractionStatus: status, extractionError: error, extractionFinishedAt: new Date() } });
    }
    return Response.json({ id: s.id, status, stage: s.extractionStage, error, documents: s.documents });
  } catch {
    return Response.json({ error: "Andmebaasi viga. Proovi hiljem uuesti." }, { status: 503 });
  }
}
