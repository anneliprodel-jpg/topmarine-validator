// Deterministlik liitmine: mitu dokumenti -> üks tellimus. Korduvaid ridu ei summeerita; vastuolud säilitatakse mõlema allikaga.
import type { ConflictAlt, ConflictMap, Evidence, EvidenceMap } from "../evidence";
import { normalizeCode } from "../validation/codes";
import type { LineInput, SubmissionInput } from "../validation/types";
import { norm, type ScalarKey, type VField, type VLine, type VStatement, type Verified } from "./verify";

interface Merged<T> {
  value: T | null;
  ev: Evidence[];
  alts?: ConflictAlt[];
}

type Kind = "enum" | "number" | "date" | "bool" | "text";

function mergeValues<T>(items: { value: T; ev: Evidence }[], kind: Kind): Merged<T> {
  if (!items.length) return { value: null, ev: [] };
  const key = (v: unknown) => (kind === "number" ? String(Math.round(Number(v) * 1e6) / 1e6) : norm(String(v)));
  if (kind === "text") {
    const seen = new Map<string, { value: T; ev: Evidence[] }>();
    for (const it of items) {
      const k = key(it.value);
      const cur = seen.get(k);
      if (cur) cur.ev.push(it.ev);
      else seen.set(k, { value: it.value, ev: [it.ev] });
    }
    const all = [...seen.values()];
    return { value: all.map((x) => String(x.value)).join("; ") as unknown as T, ev: all.flatMap((x) => x.ev) };
  }
  const groups = new Map<string, { value: T; ev: Evidence[] }>();
  for (const it of items) {
    const k = key(it.value);
    const g = groups.get(k);
    if (g) g.ev.push(it.ev);
    else groups.set(k, { value: it.value, ev: [it.ev] });
  }
  const gs = [...groups.values()];
  if (gs.length === 1) return { value: gs[0].value, ev: gs[0].ev };
  return { value: null, ev: gs.flatMap((g) => g.ev), alts: gs.map((g) => ({ value: String(g.value), evidence: g.ev })) };
}

const fromStatements = <T>(list: VStatement<unknown>[], kind: Kind) => mergeValues<T>(list.map((s) => ({ value: s.value as T, ev: s.ev })), kind);
const fromFields = <T>(list: (VField<T> | null)[], kind: Kind) =>
  mergeValues<T>(list.filter((f): f is VField<T> => !!f).map((f) => ({ value: f.value, ev: f.ev })), kind);

interface MLine {
  parts: VLine[];
  ambiguous: boolean;
}

function groupLines(lines: VLine[]): MLine[] {
  const key = (l: VLine, i: number) => {
    const c = l.code ? normalizeCode(l.code.value) : null;
    return c ? `c:${c}` : l.name ? `n:${norm(l.name.value)}` : `u:${i}`;
  };
  const order: string[] = [];
  const groups = new Map<string, VLine[]>();
  lines.forEach((l, i) => {
    const k = key(l, i);
    if (!groups.has(k)) {
      groups.set(k, []);
      order.push(k);
    }
    groups.get(k)!.push(l);
  });
  const out: MLine[] = [];
  for (const k of order) {
    const ls = groups.get(k)!;
    const byDoc = new Map<number, VLine[]>();
    ls.forEach((l) => byDoc.set(l.docIndex, [...(byDoc.get(l.docIndex) ?? []), l]));
    const docs = [...byDoc.keys()];
    if (docs.length < 2) {
      ls.forEach((l) => out.push({ parts: [l], ambiguous: false }));
      continue;
    }
    const counts = docs.map((d) => byDoc.get(d)!.length);
    if (counts.every((c) => c === counts[0])) {
      for (let j = 0; j < counts[0]; j++) out.push({ parts: docs.map((d) => byDoc.get(d)![j]), ambiguous: false });
    } else {
      ls.forEach((l) => out.push({ parts: [l], ambiguous: true }));
    }
  }
  return out;
}

const inputKey = (k: ScalarKey): string => (k === "documentType" ? "type" : k);

export interface BuiltOrder {
  input: SubmissionInput;
  evidence: EvidenceMap;
  conflicts: ConflictMap;
  issues: string[];
  typeAssumed: boolean;
}

export function buildOrder(v: Verified): BuiltOrder {
  const evidence: EvidenceMap = {};
  const conflicts: ConflictMap = {};
  const issues = [...v.issues];

  const sc = <T>(k: ScalarKey, kind: Kind): T | null => {
    const m = fromStatements<T>(v.scalars[k], kind);
    const name = inputKey(k);
    if (m.ev.length) evidence[name] = m.ev;
    if (m.alts) conflicts[name] = m.alts;
    return m.value;
  };

  const docType = sc<"ENQUIRY" | "ORDER">("documentType", "enum");
  const typeAssumed = docType == null;
  if (typeAssumed) issues.push("Dokumentides ei ole selgelt öeldud, kas tegemist on päringu või tellimusega; loetud päringuks. Muuda vajadusel.");

  const lines: LineInput[] = [];
  groupLines(v.lines).forEach((g, i) => {
    const f = <T>(pick: (l: VLine) => VField<T> | null, kind: Kind, name: string): T | null => {
      const m = fromFields<T>(g.parts.map(pick), kind);
      const k = `lines.${i}.${name}`;
      if (m.ev.length) evidence[k] = m.ev;
      if (m.alts) conflicts[k] = m.alts;
      return m.value;
    };
    const codeRaw = f<string>((l) => (l.code ? { ...l.code, value: normalizeCode(l.code.value) ?? l.code.value } : null), "enum", "code");
    const name = f<string>((l) => l.name, "text", "customName");
    const variant = f<"MODULE" | "SET" | "ACCESSORY" | "CUSTOM">((l) => l.variant, "enum", "variant");
    evidence[`lines.${i}`] = g.parts.flatMap((p) => p.ev);
    if (g.ambiguous) {
      conflicts[`lines.${i}.merge`] = [
        { value: "Dokumendid kirjeldavad sama toodet erineva arvu ridadena - ei saa kindlalt öelda, millised read on samad", evidence: g.parts.flatMap((p) => p.ev) },
      ];
    }
    lines.push({
      variant: variant ?? (codeRaw ? null : name ? "CUSTOM" : null),
      code: codeRaw,
      customName: name,
      quantity: f<number>((l) => l.quantity, "number", "quantity"),
      statedWidthM: f<number>((l) => l.width, "number", "statedWidthM"),
      statedLengthM: f<number>((l) => l.length, "number", "statedLengthM"),
      statedFloatsPerModule: f<number>((l) => l.floatsPerModule, "number", "statedFloatsPerModule"),
      statedFloatsTotal: f<number>((l) => l.floatsTotal, "number", "statedFloatsTotal"),
    });
  });

  const siteNotes = v.other.map((o) => o.text).join("; ");
  if (v.other.length) evidence.siteNotes = v.other.map((o) => o.ev);

  const input: SubmissionInput = {
    type: docType ?? "ENQUIRY",
    projectName: sc<string>("projectName", "text") ?? "",
    customerName: sc<string>("customerName", "text") ?? "",
    requestedDeliveryDate: sc<string>("requestedDeliveryDate", "date"),
    referenceText: "",
    comments: "",
    lines,
    modulesConnected: sc<"YES" | "NO" | "UNKNOWN">("modulesConnected", "enum"),
    connectionDescription: sc<string>("connectionDescription", "text") ?? "",
    connectionComponents: "",
    connectionQuantitiesUnknown: false,
    anchoringType: sc<"CHAIN" | "PILES" | "CONCRETE" | "OTHER" | "UNKNOWN">("anchoringType", "enum"),
    anchoringDetails: sc<string>("anchoringDetails", "text") ?? "",
    shoreConnection: sc<"YES" | "NO" | "UNKNOWN">("shoreConnection", "enum"),
    gangwayDetails: sc<string>("gangwayDetails", "text") ?? "",
    shoreSupportDetails: sc<string>("shoreSupportDetails", "text") ?? "",
    shoreDetailsUnknown: false,
    siteNotes,
    winterUse: sc<boolean>("winterUse", "bool"),
    waveHeightM: sc<number>("waveHeightM", "number"),
    currentSpeedMs: sc<number>("currentSpeedMs", "number"),
    boatLengthM: sc<number>("boatLengthM", "number"),
    relevantProperties: [],
  };
  return { input, evidence, conflicts, issues, typeAssumed };
}
