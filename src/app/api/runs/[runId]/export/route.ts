import { getRun } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  try {
    const run = await getRun(runId);
    if (!run) return Response.json({ error: "Käivitust ei leitud." }, { status: 404 });
    const body = {
      exportedFrom: "Top Marine SP tellimuse kontroll (õppetöö demo)",
      runId: run.id,
      createdAt: run.createdAt.toISOString(),
      ruleVersion: run.ruleVersion,
      submissionType: run.submissionType,
      overallStatus: run.overallStatus,
      inputSnapshot: run.inputSnapshot,
      report: run.report,
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="kontroll-${run.id}.json"`,
      },
    });
  } catch (e) {
    console.error("export failed", e);
    return Response.json({ error: "Andmebaasi viga. Proovi hiljem uuesti." }, { status: 503 });
  }
}
