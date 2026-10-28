"use client";

import { useState } from "react";
import { suggestFromText, type Suggestions } from "@/lib/import/suggest";
import { emptyRawLine, type RawSubmission } from "@/lib/validation/input";

const MAX_REF = 5000;
const fmt = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
const isBlankLine = (l: RawSubmission["lines"][number]) => Object.values(l).every((v) => (v ?? "") === "");

export function FileImport({
  knownCodes,
  onApply,
}: {
  knownCodes: string[];
  onApply: (fn: (s: RawSubmission) => RawSubmission, message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [sugg, setSugg] = useState<Suggestions | null>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [useText, setUseText] = useState(true);

  const analyse = (t: string) => {
    const r = suggestFromText(t, knownCodes);
    setSugg(r);
    const p: Record<string, boolean> = {};
    r.lines.forEach((l) => (p[l.id] = true));
    p.date = !!r.deliveryDate;
    p.winter = false; // talvekasutus märgitakse ainult kasutaja selgel valikul
    p.anchoring = !!r.anchoring;
    setPick(p);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSugg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Faili lugemine ebaõnnestus.");
      setFileName(body.fileName);
      setNotes(body.notes ?? []);
      setText(body.text);
      analyse(body.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Faili lugemine ebaõnnestus.");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!sugg) return;
    const chosen = sugg.lines.filter((l) => pick[l.id]);
    let msg = `Lisatud ${chosen.length} tootrida`;
    onApply((s) => {
      const next: RawSubmission = { ...s };
      const base = s.lines.filter((l) => !isBlankLine(l));
      next.lines = [
        ...base,
        ...chosen.map((l) => ({
          ...emptyRawLine(),
          variant: l.variant ?? "",
          code: l.code,
          quantity: l.quantity == null ? "" : String(l.quantity),
          statedWidthM: fmt(l.statedWidthM),
          statedLengthM: fmt(l.statedLengthM),
          statedFloatsPerModule: l.statedFloatsPerModule == null ? "" : String(l.statedFloatsPerModule),
        })),
      ];
      if (next.lines.length === 0) next.lines = [emptyRawLine()];
      if (pick.date && sugg.deliveryDate && !s.requestedDeliveryDate) next.requestedDeliveryDate = sugg.deliveryDate.value;
      if (pick.winter && s.winterUse === "") next.winterUse = "YES";
      if (pick.anchoring && sugg.anchoring && !s.anchoringType) {
        next.anchoringType = sugg.anchoring.type;
        if (!s.anchoringDetails) next.anchoringDetails = sugg.anchoring.snippet;
      }
      if (useText) {
        const joined = s.referenceText ? `${s.referenceText}\n\n--- ${fileName} ---\n${text}` : text;
        next.referenceText = joined.slice(0, MAX_REF);
      }
      return next;
    }, msg + ". Kontrolli iga väärtus vormis enne salvestamist.");
  };

  return (
    <section className="card space-y-3 border-teal" aria-labelledby="import-h">
      <h2 id="import-h" className="text-lg font-bold text-navy">Loe päring failist (valikuline)</h2>
      <p className="hint">
        Lae üles .docx, .pdf, .eml (e-kiri) või .txt. Rakendus loeb faili teksti ja pakub <strong>reeglipõhiseid soovitusi</strong> (ei kasuta
        tehisintellekti ega OCR-i). Midagi ei lisata vormi enne, kui sa soovitused kinnitad. Faili ei salvestata. Kasuta ainult fiktiivseid andmeid.
      </p>
      <div>
        <label className="label" htmlFor="file">Fail (kuni 5 MB)</label>
        <input
          id="file"
          type="file"
          accept=".docx,.pdf,.eml,.txt"
          className="field"
          disabled={busy}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {busy && <p role="status" className="mt-1">Loen faili...</p>}
      </div>
      {error && <p role="alert" className="rounded border-2 border-red-700 bg-red-50 p-2 text-red-900">{error}</p>}

      {sugg && (
        <div className="space-y-3">
          <p className="font-semibold">Fail: {fileName}</p>
          {notes.map((n, i) => (<p key={i} className="rounded bg-amber-50 p-2 text-sm text-amber-900">{n}</p>))}
          {sugg.lines.length === 0 && !sugg.deliveryDate && !sugg.anchoring && !sugg.winterMention ? (
            <p className="rounded bg-amber-50 p-2 text-amber-900">
              Tekstist ei leitud ühtegi tuvastatavat SP tootekoodi ega muud infot. Sisesta andmed käsitsi (algtekst on allpool vaadatav ja
              lisatav viiteväljale).
            </p>
          ) : (
            <ul className="space-y-2">
              {sugg.lines.map((l) => (
                <li key={l.id} className="rounded border border-slate-300 p-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-5 w-5" checked={!!pick[l.id]} onChange={(e) => setPick({ ...pick, [l.id]: e.target.checked })} />
                    <span>
                      <strong>Tootrida:</strong> kood {l.code}, variant {l.variant ?? "puudub (vali ise)"}, kogus {l.quantity ?? "teadmata"}
                      {l.statedWidthM != null && `, laius ${fmt(l.statedWidthM)} m`}
                      {l.statedLengthM != null && `, pikkus ${fmt(l.statedLengthM)} m`}
                      {l.statedFloatsPerModule != null && `, ${l.statedFloatsPerModule} ujukit/moodul`}
                      <span className="hint block">Tekstis: „{l.snippet}“</span>
                    </span>
                  </label>
                </li>
              ))}
              {sugg.deliveryDate && (
                <li className="rounded border border-slate-300 p-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-5 w-5" checked={!!pick.date} onChange={(e) => setPick({ ...pick, date: e.target.checked })} />
                    <span><strong>Tarnekuupäev:</strong> {sugg.deliveryDate.value} (täidetakse ainult kui väli on tühi)
                      <span className="hint block">Tekstis: „{sugg.deliveryDate.snippet}“</span></span>
                  </label>
                </li>
              )}
              {sugg.anchoring && (
                <li className="rounded border border-slate-300 p-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-5 w-5" checked={!!pick.anchoring} onChange={(e) => setPick({ ...pick, anchoring: e.target.checked })} />
                    <span><strong>Ankurdus:</strong> {sugg.anchoring.type === "CHAIN" ? "kett" : sugg.anchoring.type === "PILES" ? "vaiad" : "betoonankur"} (täidetakse ainult kui väli on tühi)
                      <span className="hint block">Tekstis: „{sugg.anchoring.snippet}“</span></span>
                  </label>
                </li>
              )}
              {sugg.winterMention && (
                <li className="rounded border border-slate-300 p-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-5 w-5" checked={!!pick.winter} onChange={(e) => setPick({ ...pick, winter: e.target.checked })} />
                    <span><strong>Talvekasutus:</strong> tekstis mainitakse talve - märgi „Jah, talvekasutus on soovitud“? (lugege tekst läbi, see võib olla ka eitus)
                      <span className="hint block">Tekstis: „{sugg.winterMention.snippet}“</span></span>
                  </label>
                </li>
              )}
            </ul>
          )}
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={useText} onChange={(e) => setUseText(e.target.checked)} />
            Lisa algne tekst viiteväljale (ainult viide, kuni {MAX_REF} märki)
          </label>
          <details>
            <summary className="cursor-pointer font-semibold">Failist loetud tekst</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-mist p-2 text-sm">{text}</pre>
          </details>
          <button type="button" className="btn btn-accent" onClick={apply}>Lisa valitud vormi</button>
        </div>
      )}
    </section>
  );
}
