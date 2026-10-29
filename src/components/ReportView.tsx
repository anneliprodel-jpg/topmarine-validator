import type { CheckResult, CheckStatus, ValidationReport } from "@/lib/validation/types";
import { StatusBadge } from "./StatusBadge";

const ACTION: CheckStatus[] = ["REVIEW", "CONFLICT", "MISSING", "WARNING"];
const RANK: Record<string, number> = { REVIEW: 0, CONFLICT: 1, MISSING: 2, WARNING: 3 };

function Finding({ r }: { r: CheckResult }) {
  return (
    <li className="card">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <span className="font-mono text-sm text-slate-600">{r.ruleId}</span>
        <h3 className="font-semibold">
          {r.title}
          {r.lineNumber != null && <span className="font-normal text-slate-600"> · rida {r.lineNumber}</span>}
        </h3>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="font-semibold">Põhjus / kontrollitud</dt>
        <dd>{r.checked}</dd>
        {r.supplied != null && (<><dt className="font-semibold">Klient esitas</dt><dd>{r.supplied}</dd></>)}
        {r.evidence && r.evidence.length > 0 && (
          <>
            <dt className="font-semibold">Kus dokumendis</dt>
            <dd>
              <details>
                <summary className="cursor-pointer underline">
                  {r.evidence[0].fileName || "dokument"}, {r.evidence[0].locator}
                  {r.evidence.length > 1 ? ` (+${r.evidence.length - 1})` : ""}
                </summary>
                <ul className="mt-1 space-y-1">
                  {r.evidence.map((e, i) => (
                    <li key={i}><strong>{e.fileName}</strong>, {e.locator}{e.ocr ? " (OCR)" : ""}: „{e.excerpt}“</li>
                  ))}
                </ul>
              </details>
            </dd>
          </>
        )}
        {r.expected != null && (<><dt className="font-semibold">Kataloog / reegel</dt><dd>{r.expected}</dd></>)}
        <dt className="font-semibold">Tõendusallikas</dt>
        <dd>{r.source}</dd>
        {r.question && (<><dt className="font-semibold">Täpsustav küsimus</dt><dd className="font-medium">{r.question}</dd></>)}
      </dl>
    </li>
  );
}

export function ReportView({ report }: { report: ValidationReport }) {
  const action = report.results.filter((r) => ACTION.includes(r.status)).sort((a, b) => RANK[a.status] - RANK[b.status]);
  const rest = report.results.filter((r) => !ACTION.includes(r.status));
  return (
    <div className="space-y-4">
      <div className="card border-navy">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={report.overallStatus} />
          <strong>{report.overallText}</strong>
        </div>
        <p className="hint mt-2">
          Vastab: {report.counts.PASS} · Vastuolu: {report.counts.CONFLICT ?? 0} · Puuduv info: {report.counts.MISSING} · Vajab inseneri ülevaatust:{" "}
          {report.counts.REVIEW} · Ei kohaldu: {report.counts.NA}
          {report.counts.WARNING ? ` · Hoiatus (vana): ${report.counts.WARNING}` : ""}
        </p>
        {report.expectedFloatsTotal != null && (
          <p className="mt-1 text-sm">
            Arvutuslik ujukite arv kokku (moodulite kogus × ujukeid mooduli kohta): <strong>{report.expectedFloatsTotal}</strong>
          </p>
        )}
        <p className="mt-2 rounded bg-mist p-2 text-sm">{report.scope}</p>
      </div>

      {action.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold text-navy">Vajab sinu tähelepanu ({action.length})</h2>
          <ul className="space-y-3">{action.map((r, i) => (<Finding key={i} r={r} />))}</ul>
        </section>
      )}
      {rest.length > 0 && (
        <details open={action.length === 0}>
          <summary className="cursor-pointer text-lg font-bold text-navy">Vastab või ei kohaldu ({rest.length})</summary>
          <ul className="mt-2 space-y-3">{rest.map((r, i) => (<Finding key={i} r={r} />))}</ul>
        </details>
      )}
    </div>
  );
}
