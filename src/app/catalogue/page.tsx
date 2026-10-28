import { EVIDENCE_LABELS, type EvidenceStatus } from "@/lib/catalogue/data";
import { getCatalogueView } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ev = (s: string) => EVIDENCE_LABELS[s as EvidenceStatus] ?? s;
const m = (n: number | null) => (n == null ? "-" : String(n).replace(".", ","));
const STATUS: Record<string, string> = {
  ACTIVE: "✔ Aktiivne",
  DISABLED: "✖ Keelatud (ei rakendata)",
  UNCONFIRMED: "? Kinnitamata (ei rakendata)",
};

export default async function Catalogue() {
  const { products, sources, conflicts, rules } = await getCatalogueView();
  const models = products.filter((p) => p.kind === "MODEL");
  const acc = products.filter((p) => p.kind === "ACCESSORY");
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-navy">Tooted ja kontrollireeglid</h1>
      <p className="card">
        Ainult SP (plastujukitega ujuvponton) ja otseselt asjakohased tarvikud. ECO-märgisega hinged on SP tarvikud, mitte ECO pontoonid. Hindu ei
        kuvata. Reegleid selles versioonis ei muudeta; muudatused tehakse versioneeritud andmefailide ja seed-uuenduse kaudu.
      </p>

      <section>
        <h2 className="mb-2 text-xl font-bold text-navy">Mudelid (üheksa mudelit, 220 l ujukid)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="bg-navy text-left text-white">
                <th className="p-2">Kood</th><th className="p-2">Variant</th><th className="p-2">Laius (m)</th><th className="p-2">Pikkus (m)</th>
                <th className="p-2">Ujukeid / moodul</th><th className="p-2">Tõendus</th><th className="p-2">Allikas</th>
              </tr>
            </thead>
            <tbody>
              {models.map((p) => (
                <tr key={p.id} className="border-b align-top">
                  <td className="p-2 font-mono">{p.code}</td>
                  <td className="p-2">{p.variant}{p.reviewRequired && " (koosseis vajab ülevaatust)"}</td>
                  <td className="p-2">{m(p.widthM)}</td><td className="p-2">{m(p.lengthM)}</td><td className="p-2">{p.floatsPerModule}</td>
                  <td className="p-2">{ev(p.evidenceStatus)}</td>
                  <td className="p-2">{p.source.filename}, {p.sourceLocation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">
          SET ja MODULE kasutavad hinnakirjas sama koodi; süsteemis eristab neid sisemine ID ja variandiväli. SET näide põhineb ainult koodil
          02 12 04 (read 13-19) ega üldista kõigile komplektidele.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-bold text-navy">Tarvikud (viiteinfo)</h2>
        <ul className="space-y-1 text-sm">
          {acc.map((p) => (
            <li key={p.id} className="card">
              <span className="font-mono">{p.code}</span> · {p.name} · {ev(p.evidenceStatus)}{p.reviewRequired && " · vajab ülevaatust"}
              <div className="hint">{p.source.filename}, {p.sourceLocation}. {p.notes}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-bold text-navy">Allikate vastuolud</h2>
        <ul className="space-y-2">
          {conflicts.map((c) => (
            <li key={c.id} className="card border-orange-700">
              <strong>{c.status === "DISPUTED" ? "▲ Vaidlustatud: " : "ℹ Dokumenteeritud: "}{c.title}</strong>
              <p className="text-sm">{c.description}</p>
              <p className="hint">A: {c.sourceA} · B: {c.sourceB}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-bold text-navy">Kontrollireeglid (versioon {rules[0]?.version})</h2>
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className={`card ${r.status !== "ACTIVE" ? "bg-slate-50" : ""}`}>
              <div className="flex flex-wrap gap-2">
                <span className="font-mono">{r.ruleId}</span>
                <strong>{r.title}</strong>
                <span>{STATUS[r.status]}</span>
                {r.isAssumption && <span className="text-amber-900">⚠ MVP eeldus, mitte kontrollitud ettevõtte reegel</span>}
              </div>
              <p className="text-sm">{r.description}</p>
              <p className="hint">{ev(r.evidenceStatus)}{r.source && ` · ${r.source.filename}, ${r.source.location}`}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-bold text-navy">Allikad</h2>
        <ul className="space-y-1 text-sm">
          {sources.map((s) => (
            <li key={s.id} className="card">
              <strong>{s.filename}</strong> · {s.location} · {s.sourceDate ?? "kuupäev teadmata"} · {ev(s.evidenceStatus)}
              <div className="hint">{s.note}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
