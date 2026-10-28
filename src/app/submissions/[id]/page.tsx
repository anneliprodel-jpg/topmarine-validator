import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAction, recheckAction } from "@/app/actions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ReportView } from "@/components/ReportView";
import { NotChecked, StatusBadge } from "@/components/StatusBadge";
import { getRun, getSubmission } from "@/lib/repo";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("et-EE", { timeZone: "Europe/Tallinn" });

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await getSubmission(id);
  if (!sub) notFound();
  const { input, row, runs } = sub;
  const latest = runs[0] ? await getRun(runs[0].id) : null;
  const stale = runs[0] && row.updatedAt.getTime() > runs[0].createdAt.getTime();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{input.projectName || "(nimetu)"}</h1>
        <p className="text-slate-700">
          {input.type === "ORDER" ? "Tellimus" : "Päring"} · {input.customerName || "klient puudub"}
          {input.requestedDeliveryDate && ` · tarne ${input.requestedDeliveryDate}`}
          {row.isDemo && " · näidisjuhtum"}
        </p>
      </div>
      <div className="no-print flex flex-wrap gap-3">
        <Link className="btn" href={`/submissions/${id}/edit`}>Muuda</Link>
        <form action={recheckAction.bind(null, id)}>
          <button className="btn btn-primary" type="submit">Kontrolli uuesti</button>
        </form>
        <ConfirmDelete action={deleteAction.bind(null, id)} />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold text-navy">Viimane kontrolli tulemus</h2>
        {!latest ? (
          <div className="card">
            <NotChecked /> <span className="ml-2">See kirje on salvestatud, aga kontrolli ei ole veel tehtud.</span>
          </div>
        ) : (
          <>
            {stale && (
              <p role="status" className="mb-2 rounded border border-amber-700 bg-amber-50 p-2 text-amber-900">
                ⟳ Kirjet on muudetud pärast seda kontrolli. Kuvatud tulemus kehtib vana sisendi kohta - käivita kontroll uuesti.
              </p>
            )}
            <p className="mb-2 text-sm">Käivitatud {fmt(latest.createdAt)} · reeglite versioon {latest.ruleVersion}</p>
            <ReportView report={latest.report} />
            <p className="no-print mt-2">
              <Link className="underline" href={`/submissions/${id}/runs/${latest.id}`}>Ava raport (prindi / ekspordi)</Link>
            </p>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-navy">Kontrollide ajalugu (muutumatud käivitused)</h2>
        {runs.length === 0 ? (
          <p>Käivitusi ei ole.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2">
                <span>
                  {fmt(r.createdAt)} · {r.submissionType === "ORDER" ? "tellimus" : "päring"} · reeglid {r.ruleVersion}
                </span>
                <span className="flex items-center gap-3">
                  <StatusBadge status={r.overallStatus} />
                  <Link className="underline" href={`/submissions/${id}/runs/${r.id}`}>Ava</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
