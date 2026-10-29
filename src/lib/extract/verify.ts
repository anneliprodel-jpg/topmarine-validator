// Mudeli väljundi kontroll: iga väide peab osutama tegelikule loetud tekstile. Kontrollimata väited visatakse ära.
import type { Evidence } from "../evidence";
import type { IngestedDoc, TextUnit } from "../ingest/types";
import type { RawCite, RawExtraction, RawLine } from "./schema";

export const norm = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[​­]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const squash = (s: string) => norm(s).replace(/ /g, "");

export interface VStatement<T> {
  value: T;
  original: string;
  ev: Evidence;
}
export interface VField<T> {
  value: T;
  original: string;
  ev: Evidence;
}
export interface VLine {
  docIndex: number;
  ev: Evidence[];
  code: VField<string> | null;
  name: VField<string> | null;
  variant: VField<"MODULE" | "SET" | "ACCESSORY" | "CUSTOM"> | null;
  quantity: VField<number> | null;
  width: VField<number> | null;
  length: VField<number> | null;
  floatsPerModule: VField<number> | null;
  floatsTotal: VField<number> | null;
}

export const SCALAR_KEYS = [
  "documentType",
  "customerName",
  "projectName",
  "requestedDeliveryDate",
  "modulesConnected",
  "connectionDescription",
  "anchoringType",
  "anchoringDetails",
  "shoreConnection",
  "gangwayDetails",
  "shoreSupportDetails",
  "winterUse",
  "waveHeightM",
  "currentSpeedMs",
  "boatLengthM",
] as const;
export type ScalarKey = (typeof SCALAR_KEYS)[number];

export interface Verified {
  scalars: Record<ScalarKey, VStatement<unknown>[]>;
  lines: VLine[];
  other: { text: string; ev: Evidence }[];
  issues: string[];
}

class Index {
  units = new Map<string, TextUnit>();
  files = new Map<number, IngestedDoc>();
  constructor(docs: IngestedDoc[]) {
    for (const d of docs) {
      this.files.set(d.index, d);
      for (const u of d.units) this.units.set(u.id, u);
    }
  }
  /** Leiab lõigu: viidatud ID, või (parandus) ainus lõik, mis katkendit sisaldab. */
  resolve(cite: RawCite): TextUnit | null {
    const ex = squash(cite.excerpt);
    if (!ex) return null;
    const u = this.units.get(cite.unit_id);
    if (u && squash(u.text).includes(ex)) return u;
    const hits = [...this.units.values()].filter((x) => squash(x.text).includes(ex));
    return hits.length === 1 ? hits[0] : null;
  }
  evidence(u: TextUnit, excerpt: string, original: string | null): Evidence {
    return {
      docIndex: u.docIndex,
      fileName: this.files.get(u.docIndex)?.fileName ?? "",
      locator: u.locator,
      excerpt: excerpt.trim().slice(0, 400),
      original: original?.trim() || null,
      ocr: !!u.ocr,
    };
  }
}

const numbersIn = (s: string) => [...s.replace(/ /g, " ").matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));

/** Number-väärtus peab tulenema algsest sõnastusest (otse või mm/cm -> m teisendusega). */
export function numberMatchesOriginal(value: number, original: string): boolean {
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  return numbersIn(original).some((n) => eq(n, value) || eq(n / 1000, value) || eq(n / 100, value));
}

function dateMatchesOriginal(iso: string, original: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [, y, mo, d] = m;
  const nums = (original.match(/\d+/g) ?? []).map((x) => String(Number(x)));
  const monthNames = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets", "jan", "feb", "mar", "jun", "jul", "oct", "dec"];
  const hasMonth = nums.includes(String(Number(mo))) || monthNames.some((n) => norm(original).includes(n));
  return nums.includes(String(Number(y))) && nums.includes(String(Number(d))) && hasMonth;
}

const ENUM_WORDS: Record<string, RegExp> = {
  SET: /\bset\b|komplekt/i,
  MODULE: /moodul|modul|module/i,
  CHAIN: /\bket[ti]|chain/i,
  PILES: /\bvai|pile/i,
  CONCRETE: /betoon|concrete/i,
};

export function verifyExtraction(raw: RawExtraction, docs: IngestedDoc[], allowedUnits?: Set<string>): Verified {
  const idx = new Index(docs);
  const issues: string[] = [];
  const bad = (what: string) => issues.push(`Viide ei kinnitu, väärtus jäeti ära: ${what}`);

  const cite = (c: RawCite) => {
    const u = idx.resolve(c);
    if (!u || (allowedUnits && !allowedUnits.has(u.id))) return null;
    return u;
  };

  const stmt = <T>(
    list: { value: T; original: string; cite: RawCite }[],
    key: string,
    check?: (value: T, original: string) => boolean,
  ): VStatement<T>[] => {
    const out: VStatement<T>[] = [];
    for (const s of list ?? []) {
      const u = cite(s.cite);
      if (!u) {
        bad(`${key} "${String(s.value).slice(0, 40)}"`);
        continue;
      }
      if (s.original && !squash(u.text).includes(squash(s.original)) && !squash(s.cite.excerpt).includes(squash(s.original))) {
        bad(`${key}: algne sõnastus puudub tsitaadis`);
        continue;
      }
      if (check && !check(s.value, s.original)) {
        bad(`${key} "${String(s.value).slice(0, 40)}" ei vasta sõnastusele "${s.original.slice(0, 40)}"`);
        continue;
      }
      out.push({ value: s.value, original: s.original, ev: idx.evidence(u, s.cite.excerpt, s.original) });
    }
    return out;
  };

  const num = (v: number, o: string) => numberMatchesOriginal(v, o);
  const word = (re: RegExp) => (_v: unknown, o: string) => re.test(o);
  const scalars = {
    documentType: stmt(raw.document_type, "tüüp"),
    customerName: stmt(raw.customer_name, "klient"),
    projectName: stmt(raw.project_name, "projekt"),
    requestedDeliveryDate: stmt(raw.requested_delivery_date, "tarnekuupäev", (v, o) => dateMatchesOriginal(v, o)),
    modulesConnected: stmt(raw.modules_connected, "moodulite ühendus"),
    connectionDescription: stmt(raw.connection_description, "ühenduse kirjeldus"),
    anchoringType: stmt(raw.anchoring_type, "ankurdus", (v, o) => (ENUM_WORDS[v] ? ENUM_WORDS[v].test(o) : true)),
    anchoringDetails: stmt(raw.anchoring_details, "ankurduse üksikasjad"),
    shoreConnection: stmt(raw.shore_connection, "kaldaühendus"),
    gangwayDetails: stmt(raw.gangway_details, "ligipääsusild"),
    shoreSupportDetails: stmt(raw.shore_support_details, "kaldatugi"),
    winterUse: stmt(raw.winter_use, "talvekasutus", word(/talv|winter/i)),
    waveHeightM: stmt(raw.wave_height_m, "laine kõrgus", num),
    currentSpeedMs: stmt(raw.current_speed_ms, "hoovuse kiirus", num),
    boatLengthM: stmt(raw.boat_length_m, "paadi pikkus", num),
  } as unknown as Verified["scalars"];

  const lines: VLine[] = [];
  (raw.lines ?? []).forEach((l: RawLine, i: number) => {
    const units = (l.cites ?? []).map((c) => ({ c, u: cite(c) })).filter((x): x is { c: RawCite; u: TextUnit } => !!x.u);
    if (!units.length) {
      bad(`tootrida ${i + 1} (${l.product_code?.value ?? l.product_name?.value ?? "?"})`);
      return;
    }
    const docIndex = units[0].u.docIndex;
    const evs = units.map((x) => idx.evidence(x.u, x.c.excerpt, null));
    const pick = <T>(f: { value: T; original: string } | null, label: string, check?: (v: T, o: string) => boolean): VField<T> | null => {
      if (!f) return null;
      const hit = units.find((x) => squash(x.u.text).includes(squash(f.original)) || squash(x.c.excerpt).includes(squash(f.original)));
      if (!hit || !f.original.trim()) {
        bad(`rida ${i + 1} ${label}: sõnastus puudub viidatud tekstis`);
        return null;
      }
      if (check && !check(f.value, f.original)) {
        bad(`rida ${i + 1} ${label} "${String(f.value)}" ei vasta sõnastusele "${f.original.slice(0, 40)}"`);
        return null;
      }
      return { value: f.value, original: f.original, ev: idx.evidence(hit.u, hit.c.excerpt, f.original) };
    };
    lines.push({
      docIndex,
      ev: evs,
      code: pick(l.product_code, "kood"),
      name: pick(l.product_name, "nimetus"),
      variant: pick(l.variant, "variant", (v, o) => (ENUM_WORDS[v] ? ENUM_WORDS[v].test(o) : true)),
      quantity: pick(l.quantity, "kogus", num),
      width: pick(l.width_m, "laius", num),
      length: pick(l.length_m, "pikkus", num),
      floatsPerModule: pick(l.floats_per_module, "ujukeid mooduli kohta", num),
      floatsTotal: pick(l.floats_total, "ujukeid kokku", num),
    });
  });

  const other: Verified["other"] = [];
  for (const o of raw.other_conditions ?? []) {
    const u = cite(o.cite);
    if (!u) bad(`tingimus "${o.text.slice(0, 40)}"`);
    else other.push({ text: o.text, ev: idx.evidence(u, o.cite.excerpt, null) });
  }
  return { scalars, lines, other, issues };
}
