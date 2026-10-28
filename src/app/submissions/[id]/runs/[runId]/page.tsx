import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { ReportView } from "@/components/ReportView";
import { getRun } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const run = await getRun(runId);
  if (!run || run.submissionId !== id) notFound();
  const s = run.inputSnapshot;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Kontrolliraport: {s.projectName || run.projectName || "(nimetu)"}</h1>
      <p>
        {run.createdAt.toLocaleString("et-EE", { timeZone: "Europe/Tallinn" })} · reeglite versioon {run.ruleVersion} ·{" "}
        {run.submissionType === "ORDER" ? "tellimus" : "päring"} (demo)
      </p>
      <div className="no-print flex flex-wrap gap-3">
        <PrintButton />
        <a className="btn" href={`/api/runs/${runId}/export`}>Ekspordi JSON</a>
        <Link className="btn" href={`/submissions/${id}`}>Tagasi kirje juurde</Link>
      </div>
      <ReportView report={run.report} />
      <details className="card" open>
        <summary className="cursor-pointer font-semibold">Sisendi hetktõmmis selle käivituse ajal</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="font-semibold">Projekt</dt><dd>{s.projectName}</dd>
          <dt className="font-semibold">Klient</dt><dd>{s.customerName}</dd>
          <dt className="font-semibold">Tarnekuupäev</dt><dd>{s.requestedDeliveryDate ?? "puudub"}</dd>
          <dt className="font-semibold">Moodulid ühendatud</dt><dd>{s.modulesConnected ?? "vastus puudub"}</dd>
          <dt className="font-semibold">Ankurdus</dt><dd>{s.anchoringType ?? "puudub"} {s.anchoringDetails}</dd>
          <dt className="font-semibold">Kaldaühendus</dt><dd>{s.shoreConnection ?? "vastus puudub"}</dd>
          <dt className="font-semibold">Read</dt>
          <dd>
            <ul>
              {s.lines.map((l, i) => (
                <li key={i}>
                  {i + 1}. {l.variant ?? "variant puudub"} {l.code ?? l.customName ?? ""} × {l.quantity ?? "?"}
                  {l.statedWidthM != null && ` · laius ${l.statedWidthM} m`}
                  {l.statedLengthM != null && ` · pikkus ${l.statedLengthM} m`}
                  {l.statedFloatsPerModule != null && ` · ${l.statedFloatsPerModule} ujukit/moodul`}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </details>
    </div>
  );
}
