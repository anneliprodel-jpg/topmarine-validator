// Serveripoolne vormi sisendi valideerimine (toorstringid -> SubmissionInput).
import {
  AnchoringType,
  DisputedProperty,
  LineInput,
  LineVariant,
  SubmissionInput,
  SubmissionType,
  Tri,
} from "./types";

export interface RawLine {
  variant: string;
  code: string;
  customName: string;
  quantity: string;
  statedWidthM: string;
  statedLengthM: string;
  statedFloatsPerModule: string;
}

export interface RawSubmission {
  type: string;
  projectName: string;
  customerName: string;
  requestedDeliveryDate: string;
  referenceText: string;
  comments: string;
  lines: RawLine[];
  modulesConnected: string;
  connectionDescription: string;
  connectionComponents: string;
  connectionQuantitiesUnknown: boolean;
  anchoringType: string;
  anchoringDetails: string;
  shoreConnection: string;
  gangwayDetails: string;
  shoreSupportDetails: string;
  shoreDetailsUnknown: boolean;
  siteNotes: string;
  winterUse: string;
  waveHeightM: string;
  currentSpeedMs: string;
  boatLengthM: string;
  relevantProperties: string[];
}

export type ParseResult =
  | { ok: true; data: SubmissionInput }
  | { ok: false; errors: string[] };

const MAX_TEXT = 5000;
const MAX_LINES = 50;
export const MAX_QUANTITY = 100000;

export function parseQuantity(raw: string): { value: number | null; error?: string } {
  const s = (raw ?? "").trim();
  if (s === "") return { value: null };
  if (!/^\d+$/.test(s)) return { value: null, error: "Kogus peab olema positiivne täisarv (nt 1, 2, 10)." };
  const v = Number(s);
  if (v < 1) return { value: null, error: "Kogus peab olema vähemalt 1." };
  if (v > MAX_QUANTITY) return { value: null, error: `Kogus on liiga suur (maksimaalselt ${MAX_QUANTITY}).` };
  return { value: v };
}

/** Valikuline positiivne arv; tühi -> null (mitte 0). Aktsepteerib koma kümnendmärgina. */
export function parseOptionalPositive(raw: string, integer = false): { value: number | null; error?: string } {
  const s = (raw ?? "").trim().replace(",", ".");
  if (s === "") return { value: null };
  if (!/^\d+(\.\d+)?$/.test(s)) return { value: null, error: "Palun sisesta positiivne arv." };
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) return { value: null, error: "Väärtus peab olema suurem kui 0." };
  if (v > 1000) return { value: null, error: "Väärtus on ebamõistlikult suur." };
  if (integer && !Number.isInteger(v)) return { value: null, error: "Väärtus peab olema täisarv." };
  return { value: v };
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function oneOf<T extends string>(v: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export function parseSubmission(raw: RawSubmission): ParseResult {
  const errors: string[] = [];
  const text = (v: string | undefined, label: string) => {
    const s = (v ?? "").trim();
    if (s.length > MAX_TEXT) errors.push(`${label}: tekst on liiga pikk (maksimaalselt ${MAX_TEXT} märki).`);
    return s;
  };

  const type = oneOf<SubmissionType>(raw.type, ["ENQUIRY", "ORDER"]);
  if (!type) errors.push("Vali tüüp: Päring või Tellimus.");

  const date = (raw.requestedDeliveryDate ?? "").trim();
  if (date !== "" && !isValidDate(date)) errors.push("Soovitud tarnekuupäev on vigane (kasuta kuupäeva valijat).");

  const modulesConnected = raw.modulesConnected ? oneOf<Tri>(raw.modulesConnected, ["YES", "NO", "UNKNOWN"]) : null;
  if (raw.modulesConnected && !modulesConnected) errors.push("Moodulite ühenduse vastus on vigane.");
  const shoreConnection = raw.shoreConnection ? oneOf<Tri>(raw.shoreConnection, ["YES", "NO", "UNKNOWN"]) : null;
  if (raw.shoreConnection && !shoreConnection) errors.push("Kaldaühenduse vastus on vigane.");
  const anchoringType = raw.anchoringType
    ? oneOf<AnchoringType>(raw.anchoringType, ["CHAIN", "PILES", "CONCRETE", "OTHER", "UNKNOWN"])
    : null;
  if (raw.anchoringType && !anchoringType) errors.push("Ankurduse tüüp on vigane.");

  const props: DisputedProperty[] = [];
  for (const p of raw.relevantProperties ?? []) {
    const v = oneOf<DisputedProperty>(p, ["HEIGHT", "FREEBOARD", "LOAD"]);
    if (!v) errors.push("Vigane omadus vaidlustatud omaduste valikus.");
    else if (!props.includes(v)) props.push(v);
  }

  const rawLines = raw.lines ?? [];
  if (rawLines.length > MAX_LINES) errors.push(`Tootridu võib olla kuni ${MAX_LINES}.`);
  const lines: LineInput[] = [];
  rawLines.slice(0, MAX_LINES).forEach((l, i) => {
    const n = i + 1;
    const blank = [l.variant, l.code, l.customName, l.quantity, l.statedWidthM, l.statedLengthM, l.statedFloatsPerModule].every(
      (x) => (x ?? "").trim() === "",
    );
    if (blank) return;
    const variant = l.variant ? oneOf<LineVariant>(l.variant, ["MODULE", "SET", "ACCESSORY", "CUSTOM"]) : null;
    if (l.variant && !variant) errors.push(`Rida ${n}: vigane variant.`);
    const q = parseQuantity(l.quantity);
    if (q.error) errors.push(`Rida ${n}: ${q.error}`);
    const w = parseOptionalPositive(l.statedWidthM);
    if (w.error) errors.push(`Rida ${n}, laius: ${w.error}`);
    const len = parseOptionalPositive(l.statedLengthM);
    if (len.error) errors.push(`Rida ${n}, pikkus: ${len.error}`);
    const f = parseOptionalPositive(l.statedFloatsPerModule, true);
    if (f.error) errors.push(`Rida ${n}, ujukeid mooduli kohta: ${f.error}`);
    const code = text(l.code, `Rida ${n}, kood`);
    const customName = text(l.customName, `Rida ${n}, kirjeldus`);
    lines.push({
      variant,
      code: code || null,
      customName: customName || null,
      quantity: q.value,
      statedWidthM: w.value,
      statedLengthM: len.value,
      statedFloatsPerModule: f.value,
    });
  });

  const wave = parseOptionalPositive(raw.waveHeightM ?? "");
  if (wave.error) errors.push(`Laine kõrgus: ${wave.error}`);
  const current = parseOptionalPositive(raw.currentSpeedMs ?? "");
  if (current.error) errors.push(`Hoovuse kiirus: ${current.error}`);
  const boat = parseOptionalPositive(raw.boatLengthM ?? "");
  if (boat.error) errors.push(`Paadi pikkus: ${boat.error}`);

  const projectName = text(raw.projectName, "Projekti nimi");
  const customerName = text(raw.customerName, "Kliendi nimi");
  if (projectName.length > 200) errors.push("Projekti nimi on liiga pikk (maksimaalselt 200 märki).");
  if (customerName.length > 200) errors.push("Kliendi nimi on liiga pikk (maksimaalselt 200 märki).");

  if (!projectName && !customerName && lines.length === 0) {
    errors.push("Tühja päringut ei saa salvestada: lisa vähemalt projekti nimi, klient või üks tootrida.");
  }

  const data: SubmissionInput = {
    type: type ?? "ENQUIRY",
    projectName,
    customerName,
    requestedDeliveryDate: date === "" ? null : date,
    referenceText: text(raw.referenceText, "Algne tellimustekst"),
    comments: text(raw.comments, "Kommentaarid"),
    lines,
    modulesConnected,
    connectionDescription: text(raw.connectionDescription, "Ühenduse kirjeldus"),
    connectionComponents: text(raw.connectionComponents, "Ühenduskomponendid"),
    connectionQuantitiesUnknown: !!raw.connectionQuantitiesUnknown,
    anchoringType,
    anchoringDetails: text(raw.anchoringDetails, "Ankurduse üksikasjad"),
    shoreConnection,
    gangwayDetails: text(raw.gangwayDetails, "Ligipääsusild"),
    shoreSupportDetails: text(raw.shoreSupportDetails, "Kaldatugi"),
    shoreDetailsUnknown: !!raw.shoreDetailsUnknown,
    siteNotes: text(raw.siteNotes, "Asukoha märkused"),
    winterUse: raw.winterUse === "YES" ? true : raw.winterUse === "NO" ? false : null,
    waveHeightM: wave.value,
    currentSpeedMs: current.value,
    boatLengthM: boat.value,
    relevantProperties: props,
  };

  return errors.length > 0 ? { ok: false, errors } : { ok: true, data };
}

export function emptyRawLine(): RawLine {
  return { variant: "", code: "", customName: "", quantity: "", statedWidthM: "", statedLengthM: "", statedFloatsPerModule: "" };
}

export function emptyRawSubmission(type: SubmissionType = "ENQUIRY"): RawSubmission {
  return {
    type,
    projectName: "",
    customerName: "",
    requestedDeliveryDate: "",
    referenceText: "",
    comments: "",
    lines: [emptyRawLine()],
    modulesConnected: "",
    connectionDescription: "",
    connectionComponents: "",
    connectionQuantitiesUnknown: false,
    anchoringType: "",
    anchoringDetails: "",
    shoreConnection: "",
    gangwayDetails: "",
    shoreSupportDetails: "",
    shoreDetailsUnknown: false,
    siteNotes: "",
    winterUse: "",
    waveHeightM: "",
    currentSpeedMs: "",
    boatLengthM: "",
    relevantProperties: [],
  };
}

/** SubmissionInput -> vormi toorväärtused (redigeerimiseks). */
export function toRaw(i: SubmissionInput): RawSubmission {
  const n = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
  return {
    type: i.type,
    projectName: i.projectName,
    customerName: i.customerName,
    requestedDeliveryDate: i.requestedDeliveryDate ?? "",
    referenceText: i.referenceText,
    comments: i.comments,
    lines: i.lines.length
      ? i.lines.map((l) => ({
          variant: l.variant ?? "",
          code: l.code ?? "",
          customName: l.customName ?? "",
          quantity: n(l.quantity),
          statedWidthM: n(l.statedWidthM),
          statedLengthM: n(l.statedLengthM),
          statedFloatsPerModule: n(l.statedFloatsPerModule),
        }))
      : [emptyRawLine()],
    modulesConnected: i.modulesConnected ?? "",
    connectionDescription: i.connectionDescription,
    connectionComponents: i.connectionComponents,
    connectionQuantitiesUnknown: i.connectionQuantitiesUnknown,
    anchoringType: i.anchoringType ?? "",
    anchoringDetails: i.anchoringDetails,
    shoreConnection: i.shoreConnection ?? "",
    gangwayDetails: i.gangwayDetails,
    shoreSupportDetails: i.shoreSupportDetails,
    shoreDetailsUnknown: i.shoreDetailsUnknown,
    siteNotes: i.siteNotes,
    winterUse: i.winterUse === true ? "YES" : i.winterUse === false ? "NO" : "",
    waveHeightM: n(i.waveHeightM),
    currentSpeedMs: n(i.currentSpeedMs),
    boatLengthM: n(i.boatLengthM),
    relevantProperties: [...i.relevantProperties],
  };
}
