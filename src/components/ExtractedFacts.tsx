import type { ConflictMap, DocSummary, Evidence, EvidenceMap } from "@/lib/evidence";
import type { Correction } from "@/lib/repo";
import type { SubmissionInput } from "@/lib/validation/types";

const SCALARS: [keyof SubmissionInput, string][] = [
  ["type", "Tüüp"],
  ["customerName", "Klient"],
  ["projectName", "Projekt / viide"],
  ["requestedDeliveryDate", "Soovitud tarne"],
  ["modulesConnected", "Moodulid ühendatud"],
  ["connectionDescription", "Ühenduse kirjeldus"],
  ["anchoringType", "Ankurduse tüüp"],
  ["anchoringDetails", "Ankurduse üksikasjad"],
  ["shoreConnection", "Kaldaühendus"],
  ["gangwayDetails", "Ligipääsusild"],
  ["shoreSupportDetails", "Kaldatugi"],
  ["winterUse", "Talvekasutus"],
  ["waveHeightM", "Laine kõrgus (m)"],
  ["currentSpeedMs", "Hoovuse kiirus (m/s)"],
  ["boatLengthM", "Paadi pikkus (m)"],
  ["siteNotes", "Muud tingimused"],
];
const ENUM: Record<string, string> = {
  ENQUIRY: "Päring", ORDER: "Tellimus", YES: "Jah", NO: "Ei", UNKNOWN: "Teadmata", CHAIN: "Kett", PILES: "Vaiad", CONCRETE: "Betoonankur", OTHER: "Muu",
  MODULE: "Moodul", SET: "Komplekt (SET)", ACCESSORY: "Tarvik", CUSTOM: "Eritoode",
};
const LINE_FIELDS: [string, string][] = [
  ["code", "Kood"], ["variant", "Variant"], ["customName", "Nimetus"], ["quantity", "Kogus"], ["statedWidthM", "Laius (m)"],
  ["statedLengthM", "Pikkus (m)"], ["statedFloatsPerModule", "Ujukeid / moodul"], ["statedFloatsTotal", "Ujukeid kokku"],
];

const fmt = (v: unknown) => (v === true ? "Jah" : v === false ? "Ei" : typeof v === "string" && ENUM[v] ? ENUM[v] : v == null || v === "" ? "" : String(v).replace(".", ","));

function Source({ ev }: { ev?: Evidence[] }) {
  if (!ev?.length) return <span className="hint">—</span>;
  const first = ev[0];
  return (
    <details>
      <summary className="cursor-pointer text-sm underline">{first.fileName || "dokument"}, {first.locator}{ev.length > 1 ? ` (+${ev.length - 1})` : ""}</summary>
      <ul className="mt-1 space-y-1 text-sm">
        {ev.map((e, i) => (
          <li key={i}><strong>{e.fileName}</strong>, {e.locator}{e.ocr ? " (OCR)" : ""}: „{e.excerpt}“{e.original && e.original !== e.excerpt ? ` — algne sõnastus: „${e.original}“` : ""}</li>
        ))}
      </ul>
    </details>
  );
}

export function ExtractedFacts({
  input, evidence, conflicts, corrections, documents, issues, auto,
}: {
  input: SubmissionInput;
  evidence: EvidenceMap;
  conflicts: ConflictMap;
  corrections: Correction[];
  documents: DocSummary[];
  issues: string[];
  auto: boolean;
}) {
  const corr = new Map(corrections.map((c) => [c.field, c]));
  const cell = (key: string, value: unknown) => {
    const v = fmt(value);
    const c = corr.get(key);
    const conf = conflicts[key];
    return (
      <>
        <td className="p-2 align-top">
          {v || <span className="text-slate-600">{conf ? "vastuolu (vt allpool)" : "puudub"}</span>}
          {c && <span className="ml-1 rounded border border-teal-dark px-1 text-xs">parandatud (loetud: {c.extracted})</span>}
        </td>
        <td className="p-2 align-top"><Source ev={evidence[key]} /></td>
      </>
    );
  };
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-navy">{auto ? "Dokumentidest loetud andmed" : "Sisestatud andmed"}</h2>
      {auto && documents.length > 0 && (
        <ul className="space-y-1 text-sm">
          {documents.map((d) => (
            <li key={d.index} className={d.status === "OK" ? "" : "rounded border-2 border-amber-700 bg-amber-50 p-2 text-amber-900"}>
              <strong>{d.fileName}</strong> — {d.status === "OK" ? "loetud" : d.message ?? d.status}{d.status === "OK" && d.message ? ` (${d.message})` : ""}{d.ocrUsed && d.status === "OK" ? " (OCR)" : ""}
            </li>
          ))}
        </ul>
      )}
      {issues.map((m, i) => (<p key={i} className="rounded bg-amber-50 p-2 text-sm text-amber-900">{m}</p>))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead><tr className="bg-navy text-left text-white"><th className="p-2">Väli</th><th className="p-2">Väärtus</th><th className="p-2">Allikas</th></tr></thead>
          <tbody>
            {SCALARS.map(([k, label]) => (
              <tr key={k} className="border-b"><th className="p-2 text-left align-top font-semibold">{label}</th>{cell(k as string, input[k])}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {input.lines.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold">Tootread</h3>
          {input.lines.map((l, i) => (
            <div key={i} className="overflow-x-auto rounded border border-slate-300">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <caption className="bg-mist p-2 text-left font-semibold">Rida {i + 1}</caption>
                <tbody>
                  {LINE_FIELDS.map(([f, label]) => (
                    <tr key={f} className="border-b"><th className="w-40 p-2 text-left align-top font-semibold">{label}</th>{cell(`lines.${i}.${f}`, (l as unknown as Record<string, unknown>)[f])}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {auto && corrections.length > 0 && <p className="hint">Parandusi tehtud: {corrections.length}. Algne loetud väärtus jääb nähtavaks.</p>}
    </section>
  );
}
