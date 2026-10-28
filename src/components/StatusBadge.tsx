import { CheckStatus, STATUS_LABEL, STATUS_SYMBOL } from "@/lib/validation/types";

const STYLE: Record<CheckStatus, string> = {
  PASS: "bg-emerald-50 text-emerald-900 border-emerald-700",
  MISSING: "bg-amber-50 text-amber-900 border-amber-700",
  WARNING: "bg-orange-50 text-orange-900 border-orange-700",
  REVIEW: "bg-red-50 text-red-900 border-red-700",
  NA: "bg-slate-100 text-slate-700 border-slate-400",
};

/** Olek on näidatud sümboli ja tekstiga, mitte ainult värviga. */
export function StatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${STYLE[status]}`}>
      <span aria-hidden="true">{STATUS_SYMBOL[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function NotChecked() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
      <span aria-hidden="true">○</span>Pole kontrollitud
    </span>
  );
}
