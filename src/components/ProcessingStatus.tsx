"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Doc {
  index: number;
  fileName: string;
  status: string;
  message: string | null;
  ocrUsed: boolean;
}
interface State {
  status: string;
  stage: string | null;
  error: string | null;
  documents: Doc[];
}

const STEPS = [
  ["reading", "1. Dokumentide lugemine"],
  ["extracting", "2. Andmete väljavõte"],
  ["checking", "3. Kontroll"],
] as const;
const DOC_STATUS: Record<string, string> = {
  PENDING: "Ootel",
  OK: "Loetud",
  PARTIAL: "Loetud osaliselt",
  UNREADABLE: "Ei õnnestunud lugeda",
  UNSUPPORTED: "Toetamata failitüüp",
  ENCRYPTED: "Parooliga kaitstud",
  TOO_LARGE: "Liiga suur",
  CORRUPT: "Vigane fail",
};

/** Küsib olekut, kuni töötlus on lõppenud; seejärel värskendab lehe. Töötlus ei ole kunagi "kohene õnnestumine". */
export function ProcessingStatus({ id }: { id: string }) {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/analyze/${id}`, { cache: "no-store" });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "Oleku küsimine ebaõnnestus.");
        if (stop) return;
        setS(b);
        setErr(null);
        if (b.status !== "PROCESSING") return router.refresh();
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : "Oleku küsimine ebaõnnestus.");
      }
      if (!stop) setTimeout(tick, 2000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [id, router]);

  const stage = s?.stage ?? "queued";
  const current = STEPS.findIndex(([k]) => k === stage);
  return (
    <section className="card space-y-3 border-2 border-teal" aria-live="polite">
      <h2 className="text-lg font-bold text-navy">Töötlen dokumente...</h2>
      <p className="hint">Skaneeritud PDF-i lugemine (OCR) ja analüüs võivad võtta mitu minutit. Jäta leht avatuks; töötlus jätkub serveris.</p>
      {stage === "queued" && <p>Ootel järjekorras...</p>}
      <ol className="space-y-1">
        {STEPS.map(([k, label], i) => (
          <li key={k} className={i === current ? "font-bold" : i < current ? "text-emerald-900" : "text-slate-600"}>
            {i < current ? "✔ " : i === current ? "⏳ " : "○ "}
            {label}
          </li>
        ))}
      </ol>
      {s && s.documents.length > 0 && (
        <ul className="space-y-1 text-sm">
          {s.documents.map((d) => (
            <li key={d.index}>
              <strong>{d.fileName}</strong> — {DOC_STATUS[d.status] ?? d.status}
              {d.ocrUsed && " (OCR)"}
              {d.message && <span className="hint block">{d.message}</span>}
            </li>
          ))}
        </ul>
      )}
      {err && <p role="alert" className="text-red-900">{err} Proovin uuesti...</p>}
      <p className="text-sm"><Link className="underline" href="/history">Varasemad kontrollid</Link></p>
    </section>
  );
}
