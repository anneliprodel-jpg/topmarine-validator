import Link from "next/link";
import type { listSubmissions } from "@/lib/repo";
import { NotChecked, StatusBadge } from "./StatusBadge";

export function SubmissionList({ rows }: { rows: Awaited<ReturnType<typeof listSubmissions>> }) {
  if (rows.length === 0) return <p className="card">Kirjeid veel ei ole. Alusta uue päringu või näidisjuhtumiga.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link href={`/submissions/${r.id}`} className="font-semibold text-navy underline">
              {r.projectName || "(nimetu)"}
            </Link>
            <div className="text-sm text-slate-600">
              {r.type === "ORDER" ? "Tellimus" : "Päring"} · {r.customerName || "klient puudub"} · {r.lineCount} rida ·{" "}
              {r.updatedAt.toLocaleString("et-EE", { timeZone: "Europe/Tallinn" })}
              {r.isDemo && " · näidis"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {r.lastStatus ? <StatusBadge status={r.lastStatus} /> : <NotChecked />}
            {r.stale && <span className="text-sm text-amber-900">⟳ muudetud pärast kontrolli</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
