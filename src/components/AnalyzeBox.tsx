"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Config {
  configured: boolean;
  accessRequired: boolean;
  accessConfigured: boolean;
  authorized: boolean;
  limits: { maxFiles: number; maxFileMb: number; maxTotalMb: number };
}

const ACCEPT = ".pdf,.xlsx,.xls,.docx,.doc";

export function AnalyzeBox() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const loadCfg = () =>
    fetch("/api/analyze/config")
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => setError("Seadistuse laadimine ebaõnnestus. Värskenda lehte."));
  useEffect(() => {
    loadCfg();
  }, []);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 20));
  };

  const unlock = async () => {
    setError(null);
    const res = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Vale ligipääsukood.");
    setCode("");
    loadCfg();
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("text", text);
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        loadCfg();
        throw new Error("Sisesta ligipääsukood.");
      }
      if (!res.ok) throw new Error(body.error ?? "Analüüsi alustamine ebaõnnestus.");
      router.push(`/submissions/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analüüsi alustamine ebaõnnestus.");
      setBusy(false);
    }
  };

  const total = files.reduce((n, f) => n + f.size, 0);
  const tooMany = cfg && files.length > cfg.limits.maxFiles;
  const tooBig = cfg && total > cfg.limits.maxTotalMb * 1024 * 1024;
  const canSubmit = !busy && (text.trim() || files.length > 0) && !tooMany && !tooBig && cfg?.configured && (cfg.authorized || !cfg.accessRequired);

  return (
    <section className="card space-y-4 border-2 border-navy" aria-labelledby="analyze-h">
      <h2 id="analyze-h" className="text-xl font-bold text-navy">Lisa tellimus või päring</h2>
      <p>Kleebi kliendi e-kiri või lae üles tellimus. Rakendus loeb andmed ise välja ja kontrollib need SP toodete andmete ja reeglite vastu. Küsib alles pärast seda, kui midagi on tõesti puudu või ebaselge.</p>

      {cfg && !cfg.configured && (
        <div role="alert" className="rounded border-2 border-amber-700 bg-amber-50 p-3 text-amber-900">
          <strong>Automaatne analüüs pole seadistatud.</strong> Serveris puudub analüüsiteenuse seadistus (vt README: <code>ANTHROPIC_API_KEY</code>). Kuni selleni saab
          andmeid sisestada <Link className="underline" href="/submissions/new">käsitsi</Link>, kuid see ei asenda automaatset lugemist.
        </div>
      )}
      {cfg?.configured && cfg.accessRequired && !cfg.accessConfigured && (
        <div role="alert" className="rounded border-2 border-amber-700 bg-amber-50 p-3 text-amber-900">
          Analüüs on kaitstud: serveris pole veel seadistatud ligipääsukood (<code>ANALYSIS_ACCESS_CODE</code>).
        </div>
      )}
      {cfg?.configured && cfg.accessRequired && cfg.accessConfigured && !cfg.authorized && (
        <div className="space-y-2 rounded border border-slate-400 p-3">
          <label className="label" htmlFor="code">Ligipääsukood</label>
          <div className="flex flex-wrap gap-2">
            <input id="code" type="password" className="field max-w-xs" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            <button type="button" className="btn btn-primary" onClick={unlock}>Ava</button>
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="paste">Kleebi e-kirja või tellimuse tekst</label>
        <textarea id="paste" className="field" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tere! Palun tellida 2 tk SP ponton 02 12 04 ..." />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed p-4 text-center ${drag ? "border-teal bg-mist" : "border-slate-400"}`}
      >
        <p className="mb-2">Lohista failid siia või vali arvutist</p>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" id="files" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <label htmlFor="files" className="btn cursor-pointer">Vali failid</label>
        <p className="hint mt-2">PDF (ka skaneeritud), Excel (.xlsx, .xls), Word (.docx, .doc). Kuni {cfg?.limits.maxFiles ?? 5} faili, {cfg?.limits.maxFileMb ?? 10} MB faili kohta, {cfg?.limits.maxTotalMb ?? 20} MB kokku.</p>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded border border-slate-300 px-2 py-1">
              <span className="break-all">{f.name} <span className="hint">({(f.size / 1024).toFixed(0)} KB)</span></span>
              <button type="button" className="btn btn-danger" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Eemalda ${f.name}`}>Eemalda</button>
            </li>
          ))}
        </ul>
      )}
      {tooMany && <p role="alert" className="text-red-900">Faile on liiga palju (kuni {cfg?.limits.maxFiles}).</p>}
      {tooBig && <p role="alert" className="text-red-900">Failid on kokku liiga suured (kuni {cfg?.limits.maxTotalMb} MB).</p>}
      {error && <p role="alert" className="rounded border-2 border-red-700 bg-red-50 p-2 text-red-900">{error}</p>}

      <p className="hint">
        Tekst ja failid saadetakse analüüsiks välisele tehisintellekti teenusele (Anthropic). Originaalfaile ei salvestata; salvestatakse loetud tekst, leitud andmed ja
        tulemused. Kasuta demos ainult fiktiivseid või anonüümseid tellimusi.
      </p>
      <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={!canSubmit} onClick={submit}>
        {busy ? "Saadan..." : "Loe ja kontrolli"}
      </button>
    </section>
  );
}
