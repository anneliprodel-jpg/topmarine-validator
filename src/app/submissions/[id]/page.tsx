import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAction, recheckAction } from "@/app/actions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ExtractedFacts } from "@/components/ExtractedFacts";
import { ProcessingStatus } from "@/components/ProcessingStatus";
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
  const auto = row.source === "AUTO";
  const processing = row.extractionStatus === "PROCESSING";
  const failed = row.extractionStatus === "FAILED";
  const latest = runs[0] ? await getRun(runs[0].id) : null;
  const stale = runs[0] && row.updatedAt.getTime() > runs[0].createdAt.getTime();
  const title = input.projectName || (auto ? "Dokumentidest loetud tellimus" : "(nimetu)");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        <p className="text-slate-700">
          {input.type === "ORDER" ? "Tellimus" : "Päring"} · {input.customerName || "klient puudub"}
          {input.requestedDeliveryDate && ` · tarne ${input.requestedDeliveryDate}`}
          {row.isDemo && " · näidisjuhtum"}
          {auto && ` · automaatne lugemine (${row.extractionProvider}, ${row.extractionModel})`}
        </p>
      </div>

      {processing && <ProcessingStatus id={id} />}

      {failed && (
        <div role="alert" className="card border-2 border-red-700 bg-red-50 text-red-900">
          <h2 className="text-lg font-bold">Automaatne analüüs ebaõnnestus</h2>
          <p className="my-2">{row.extractionError ?? "Töötlus ei lõppenud."}</p>
          <p>Sellest ei ole tehtud kontrolli. <Link className="underline" href="/">Proovi uuesti</Link> või <Link className="underline" href={`/submissions/${id}/edit`}>sisesta andmed käsitsi</Link>.</p>
          {sub.documents.length > 0 && (
            <ul className="mt-2 text-sm">
              {sub.documents.map((d) => (<li key={d.index}><strong>{d.fileName}</strong> — {d.message ?? d.status}</li>))}
            </ul>
          )}
        </div>
      )}

      {!processing && (
        <div className="no-print flex flex-wrap gap-3">
          <Link className="btn" href={`/submissions/${id}/edit`}>Paranda või täienda andmeid</Link>
          {!failed && (
            <form action={recheckAction.bind(null, id)}>
              <button className="btn btn-primary" type="submit">Kontrolli uuesti</button>
            </form>
          )}
          <ConfirmDelete action={deleteAction.bind(null, id)} />
        </div>
      )}

      {!processing && !failed && (
        <section>
          <h2 className="mb-2 text-lg font-bold text-navy">Kontrolli tulemus</h2>
          {!latest ? (
            <div className="card">
              <NotChecked /> <span className="ml-2">See kirje on salvestatud, aga kontrolli ei ole veel tehtud.</span>
            </div>
          ) : (
            <>
              {stale && (
                <p role="status" className="mb-2 rounded border border-amber-700 bg-amber-50 p-2 text-amber-900">
                  ⟳ Kirjet on muudetud pärast seda kontrolli. Kuvatud tulemus kehtib vana sisendi kohta - käivita kontroll uuesti (uut analüüsi ei tehta, dokumente ei loeta uuesti).
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
      )}

      {!processing && (auto || input.lines.length > 0) && (
        <ExtractedFacts
          input={input}
          evidence={sub.evidence}
          conflicts={sub.conflicts}
          corrections={sub.corrections}
          documents={sub.documents}
          issues={sub.extractionIssues}
          auto={auto}
        />
      )}

      {!processing && (
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
      )}
    </div>
  );
}
