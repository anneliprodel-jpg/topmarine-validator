import type { ValidationReport } from "@/lib/validation/types";
import { StatusBadge } from "./StatusBadge";

export function ReportView({ report }: { report: ValidationReport }) {
  return (
    <div className="space-y-4">
      <div className="card border-navy">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={report.overallStatus} />
          <strong>{report.overallText}</strong>
        </div>
        <p className="hint mt-2">
          Vastab: {report.counts.PASS} · Puuduv info: {report.counts.MISSING} · Hoiatus: {report.counts.WARNING} · Vajab
          inseneri ülevaatust: {report.counts.REVIEW} · Ei kohaldu: {report.counts.NA}
        </p>
        {report.expectedFloatsTotal != null && (
          <p className="mt-1 text-sm">
            Arvutuslik ujukite arv kokku (moodulite kogus × ujukeid mooduli kohta): <strong>{report.expectedFloatsTotal}</strong>
          </p>
        )}
        <p className="mt-2 rounded bg-mist p-2 text-sm">{report.scope}</p>
      </div>

      <ul className="space-y-3">
        {report.results.map((r, i) => (
          <li key={i} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={r.status} />
              <span className="font-mono text-sm text-slate-600">{r.ruleId}</span>
              <h3 className="font-semibold">
                {r.title}
                {r.lineNumber != null && <span className="font-normal text-slate-600"> · rida {r.lineNumber}</span>}
              </h3>
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="font-semibold">Kontrollitud</dt>
              <dd>{r.checked}</dd>
              {r.supplied != null && (<><dt className="font-semibold">Esitatud väärtus</dt><dd>{r.supplied}</dd></>)}
              {r.expected != null && (<><dt className="font-semibold">Oodatav väärtus</dt><dd>{r.expected}</dd></>)}
              <dt className="font-semibold">Tõendusallikas</dt>
              <dd>{r.source}</dd>
              {r.question && (<><dt className="font-semibold">Täpsustav küsimus</dt><dd className="font-medium">{r.question}</dd></>)}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
