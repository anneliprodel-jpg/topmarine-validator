"use client";

import { useState, useTransition } from "react";
import { saveAction } from "@/app/actions";
import { emptyRawLine, type RawLine, type RawSubmission } from "@/lib/validation/input";

export interface ProductHint {
  code: string;
  variant: string;
  name: string;
  widthM: number | null;
  lengthM: number | null;
  floatsPerModule: number | null;
}

const fmt = (n: number | null) => (n == null ? "-" : String(n).replace(".", ","));

export function SubmissionForm({
  id,
  initial,
  products,
}: {
  id: string | null;
  initial: RawSubmission;
  products: ProductHint[];
}) {
  const [s, setS] = useState<RawSubmission>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const set = <K extends keyof RawSubmission>(k: K, v: RawSubmission[K]) => setS((p) => ({ ...p, [k]: v }));
  const setLine = (i: number, patch: Partial<RawLine>) =>
    setS((p) => ({ ...p, lines: p.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const submit = (intent: "save" | "check") =>
    start(async () => {
      setErrors([]);
      const res = await saveAction(id, intent, s);
      if (res?.errors?.length) {
        setErrors(res.errors);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  const hintFor = (l: RawLine) => {
    const code = l.code.replace(/[\s\-._]/g, "");
    const norm = /^\d{6}$/.test(code) ? `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4)}` : l.code.trim();
    return products.find((p) => p.code === norm && (!l.variant || p.variant === l.variant));
  };

  const toggleProp = (p: string) =>
    set("relevantProperties", s.relevantProperties.includes(p) ? s.relevantProperties.filter((x) => x !== p) : [...s.relevantProperties, p]);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("check");
      }}
      noValidate
    >
      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border-2 border-red-700 bg-red-50 p-3 text-red-900">
          <strong>Salvestamine ei õnnestunud:</strong>
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (<li key={i}>{e}</li>))}
          </ul>
        </div>
      )}

      <fieldset className="card space-y-4">
        <legend className="px-1 text-lg font-bold text-navy">Üldandmed</legend>
        <div>
          <span className="label" id="type-label">Tüüp</span>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-labelledby="type-label">
            {[["ENQUIRY", "Päring"], ["ORDER", "Tellimus"]].map(([v, t]) => (
              <label key={v} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-400 px-3">
                <input type="radio" name="type" value={v} checked={s.type === v} onChange={() => set("type", v)} className="h-5 w-5" />
                {t}
              </label>
            ))}
          </div>
          <p className="hint mt-1">Tellimuse kontroll on rangem (nt on vaja tarnekuupäeva). Päringul puuduv info loob täpsustusi.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="projectName">Projekti nimi</label>
            <input id="projectName" className="field" value={s.projectName} onChange={(e) => set("projectName", e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="customerName">Klient / edasimüüja (demo: fiktiivne)</label>
            <input id="customerName" className="field" value={s.customerName} onChange={(e) => set("customerName", e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="date">Soovitud tarnekuupäev</label>
            <input id="date" type="date" className="field" value={s.requestedDeliveryDate} onChange={(e) => set("requestedDeliveryDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ref">Algne tellimus-/päringutekst (valikuline, ainult viide)</label>
          <textarea id="ref" className="field" rows={3} value={s.referenceText} onChange={(e) => set("referenceText", e.target.value)} />
          <p className="hint">Seda teksti ei tõlgendata automaatselt. Kontrollid põhinevad ainult allpool sisestatud struktureeritud väljadel.</p>
        </div>
        <div>
          <label className="label" htmlFor="comments">Kommentaarid</label>
          <textarea id="comments" className="field" rows={2} value={s.comments} onChange={(e) => set("comments", e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 text-lg font-bold text-navy">Tootread</legend>
        <p className="hint">
          Kataloogi andmed ja kliendi märgitud väärtused on eraldi. Toote valik ei täida kliendi väärtusi automaatselt. Tundmatu toote korral vali
          „Muu / tundmatu toode“ - see suunatakse inseneri ülevaatusele.
        </p>
        <datalist id="codes">
          {[...new Set(products.map((p) => p.code))].map((c) => (<option key={c} value={c} />))}
        </datalist>
        {s.lines.map((l, i) => {
          const hint = hintFor(l);
          return (
            <div key={i} className="rounded-lg border border-slate-300 bg-mist/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <strong>Rida {i + 1}</strong>
                <button type="button" className="btn btn-danger" onClick={() => set("lines", s.lines.length > 1 ? s.lines.filter((_, j) => j !== i) : [emptyRawLine()])}>
                  Eemalda rida
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label" htmlFor={`v${i}`}>Variant</label>
                  <select id={`v${i}`} className="field" value={l.variant} onChange={(e) => setLine(i, { variant: e.target.value })}>
                    <option value="">- vali -</option>
                    <option value="MODULE">Moodul (MODULE)</option>
                    <option value="SET">Komplekt (SET)</option>
                    <option value="ACCESSORY">Tarvik</option>
                    <option value="CUSTOM">Muu / tundmatu toode</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`c${i}`}>Tootekood</label>
                  <input id={`c${i}`} list="codes" className="field" value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} placeholder="nt 02 12 04" />
                </div>
                <div>
                  <label className="label" htmlFor={`q${i}`}>Kogus</label>
                  <input id={`q${i}`} inputMode="numeric" className="field" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="täisarv" />
                </div>
                {l.variant === "CUSTOM" && (
                  <div>
                    <label className="label" htmlFor={`n${i}`}>Kirjeldus</label>
                    <input id={`n${i}`} className="field" value={l.customName} onChange={(e) => setLine(i, { customName: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor={`w${i}`}>Kliendi märgitud laius (m)</label>
                  <input id={`w${i}`} inputMode="decimal" className="field" value={l.statedWidthM} onChange={(e) => setLine(i, { statedWidthM: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor={`l${i}`}>Kliendi märgitud pikkus (m)</label>
                  <input id={`l${i}`} inputMode="decimal" className="field" value={l.statedLengthM} onChange={(e) => setLine(i, { statedLengthM: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor={`f${i}`}>Kliendi märgitud ujukeid mooduli kohta</label>
                  <input id={`f${i}`} inputMode="numeric" className="field" value={l.statedFloatsPerModule} onChange={(e) => setLine(i, { statedFloatsPerModule: e.target.value })} />
                </div>
              </div>
              {hint && (
                <p className="hint mt-2">
                  Kataloog ({hint.variant}): {hint.name}
                  {hint.widthM != null && ` - laius ${fmt(hint.widthM)} m, pikkus ${fmt(hint.lengthM)} m, ${hint.floatsPerModule} ujukit mooduli kohta`}
                </p>
              )}
            </div>
          );
        })}
        <button type="button" className="btn" onClick={() => set("lines", [...s.lines, emptyRawLine()])}>+ Lisa tootrida</button>
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-lg font-bold text-navy">Moodulite ühendus</legend>
        <TriSelect id="mc" label="Kas moodulid on omavahel ühendatud?" value={s.modulesConnected} onChange={(v) => set("modulesConnected", v)} />
        <p className="hint">Mitu moodulit võivad olla ka eraldi paigaldused. Kataloog nimetab otsa-, külje-, L- ja T-ühendust.</p>
        {s.modulesConnected === "YES" && (
          <>
            <Area id="cd" label="Paigutuse / ühenduse kirjeldus" value={s.connectionDescription} onChange={(v) => set("connectionDescription", v)} />
            <Area id="cc" label="Asjakohased komponendid" value={s.connectionComponents} onChange={(v) => set("connectionComponents", v)} />
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={s.connectionQuantitiesUnknown} onChange={(e) => set("connectionQuantitiesUnknown", e.target.checked)} />
              Komponentide kogused on teadmata
            </label>
          </>
        )}
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-lg font-bold text-navy">Ankurdus</legend>
        <div>
          <label className="label" htmlFor="at">Ankurduse tüüp</label>
          <select id="at" className="field" value={s.anchoringType} onChange={(e) => set("anchoringType", e.target.value)}>
            <option value="">- vali -</option>
            <option value="CHAIN">Kett (Ø10 / Ø13 mm)</option>
            <option value="PILES">Vaiad (Ø60 mm, 1 kN)</option>
            <option value="CONCRETE">Betoonankur (200 / 500 kg)</option>
            <option value="OTHER">Muu (vajab inseneri ülevaatust)</option>
            <option value="UNKNOWN">Teadmata</option>
          </select>
        </div>
        <Area id="ad" label="Ankurduse üksikasjad" value={s.anchoringDetails} onChange={(v) => set("anchoringDetails", v)} />
        <p className="hint">Kataloog loetleb ketid, betoonankrud ja vaiad. Rakendus ei arvuta ega kinnita ankurduse sobivust.</p>
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-lg font-bold text-navy">Kaldaühendus</legend>
        <TriSelect id="sc" label="Kas on vaja ühendust kaldaga?" value={s.shoreConnection} onChange={(v) => set("shoreConnection", v)} />
        {s.shoreConnection === "YES" && (
          <>
            <Area id="gw" label="Ligipääsusild (gangway) andmed" value={s.gangwayDetails} onChange={(v) => set("gangwayDetails", v)} />
            <Area id="ss" label="Kaldatoe andmed" value={s.shoreSupportDetails} onChange={(v) => set("shoreSupportDetails", v)} />
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={s.shoreDetailsUnknown} onChange={(e) => set("shoreDetailsUnknown", e.target.checked)} />
              Sild / kaldatugi on veel teadmata
            </label>
          </>
        )}
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-lg font-bold text-navy">Muu</legend>
        <Area id="sn" label="Asukoha märkused (valikuline)" value={s.siteNotes} onChange={(v) => set("siteNotes", v)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="wv">Laine kõrgus (m, valikuline)</label>
            <input id="wv" inputMode="decimal" className="field" value={s.waveHeightM} onChange={(e) => set("waveHeightM", e.target.value)} />
            <p className="hint">Kataloogi piir 0,2 m</p>
          </div>
          <div>
            <label className="label" htmlFor="cv">Hoovuse kiirus (m/s, valikuline)</label>
            <input id="cv" inputMode="decimal" className="field" value={s.currentSpeedMs} onChange={(e) => set("currentSpeedMs", e.target.value)} />
            <p className="hint">Kataloogi piir 1 m/s</p>
          </div>
          <div>
            <label className="label" htmlFor="bl">Suurima paadi pikkus (m, valikuline)</label>
            <input id="bl" inputMode="decimal" className="field" value={s.boatLengthM} onChange={(e) => set("boatLengthM", e.target.value)} />
            <p className="hint">Kataloogi piir 6,1 m (20 jalga)</p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="wu">Talvine kasutus</label>
          <select id="wu" className="field" value={s.winterUse} onChange={(e) => set("winterUse", e.target.value)}>
            <option value="">Ei täpsustatud</option>
            <option value="NO">Ei soovita</option>
            <option value="YES">Jah, talvekasutus on soovitud</option>
          </select>
        </div>
        <div>
          <span className="label">Päring sõltub omadustest, mille allikad on vastuolus</span>
          <div className="flex flex-wrap gap-3">
            {[["HEIGHT", "Kõrgus"], ["FREEBOARD", "Vabaparras"], ["LOAD", "Koormus / kandevõime"]].map(([v, t]) => (
              <label key={v} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-400 px-3">
                <input type="checkbox" className="h-5 w-5" checked={s.relevantProperties.includes(v)} onChange={() => toggleProp(v)} />
                {t}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn" disabled={pending} onClick={() => submit("save")}>
          {pending ? "Salvestan..." : "Salvesta mustandina"}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Töötlen..." : "Salvesta ja kontrolli"}
        </button>
      </div>
    </form>
  );
}

function TriSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">- vali -</option>
        <option value="YES">Jah</option>
        <option value="NO">Ei</option>
        <option value="UNKNOWN">Teadmata</option>
      </select>
    </div>
  );
}

function Area({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <textarea id={id} className="field" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
