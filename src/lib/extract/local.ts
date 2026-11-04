// Kohalik reeglipõhine väljavõte (ilma välise tehisintellekti- või OCR-teenuseta).
// Loeb ingest-kihi tekstilõike (rida/lõik/tabeli rida) ja toodab sama RawExtraction-kuju, mida verify.ts kontrollib.
// Reegel: võta ainult see, mis lõigus sõnaselgelt kirjas on. Midagi ei arvata ega täideta; ebaselge jääb puudu ja läheb kasutaja ülevaatusele.
import type { IngestedDoc, TextUnit } from "../ingest/types";
import { EXTRACTION_VERSION, type RawCite, type RawExtraction, type RawLine } from "./schema";

export const LOCAL_META = { provider: "local", model: "reeglipõhine", extractionVersion: EXTRACTION_VERSION } as const;

const squash = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT = String.raw`mm|cm|m`;
const toNum = (s: string) => Number(s.replace(",", "."));
const toMetres = (n: number, unit: string | undefined) => (unit === "mm" ? n / 1000 : unit === "cm" ? n / 100 : n);
const UNKNOWN_WORDS = /^(?:ei tea|teadmata|selgitame|selgub|tbd|n\/a|unknown|\?+|-+|puudub)\.?$/i;

/** Arvutustabeli lahtriviited "[B2]:" eemaldatakse, et "Kogus [C5]: 2" ja "[A1]: Kogus | [B1]: 2" loetaks mõlemad "Kogus: 2". */
function clean(raw: string): string {
  return raw
    .replace(/(^|\|\s)\[[A-Z]{1,3}\d+\]:\s*/g, "$1")
    .replace(/\s*\[[A-Z]{1,3}\d+\]:\s*/g, ": ")
    .replace(/:\s*\|\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMERIC_CELL = /^[\d\s.,]+$/;
const HEADER_WORDS = /kogus|quantity|qty|laius|width|pikkus|length|kood|code|nimetus|ujuk/i;

/** PDF/Word tabeli rida ("02 12 04 | SP ponton | moodul | 2") saab pealkirjarea põhjal sildid ("Kogus: 2"), nagu Exceli puhul juba on. */
function relabelTableRows(doc: IngestedDoc): string[] {
  let header: string[] | null = null;
  return doc.units.map((u) => {
    const cells = u.text.split(/\s*\|\s*/);
    if (cells.length < 3) {
      header = null;
      return clean(u.text);
    }
    if (!header && cells.every((x) => !NUMERIC_CELL.test(x)) && HEADER_WORDS.test(u.text)) {
      header = cells;
      return clean(u.text);
    }
    if (header && doc.kind !== "XLSX" && doc.kind !== "XLS" && cells.length === header.length) {
      return cells.map((x, i) => (header![i] ? `${header![i]}: ${x}` : x)).join(" | ");
    }
    return clean(u.text);
  });
}

const CODE_RE = /(?<![\d.,/-])(\d{2})([ \-.]?)(\d{2})\2(\d{2})(?![\d]|[.,]\d)/g;

/** Tootekood tekstis (eesnullid säilivad, sest töötleme stringina). Kuupäevad nagu 15.05.2027 ei sobi, sest neljas rühm jätkub numbritega. */
function findCodes(t: string): { text: string; index: number }[] {
  return [...t.matchAll(CODE_RE)].map((m) => ({ text: m[0], index: m.index! }));
}

interface Ctx {
  doc: IngestedDoc;
  unit: TextUnit;
  raw: string;
  text: string; // puhastatud
}

const cite = (c: Ctx): RawCite => ({ unit_id: c.unit.id, excerpt: c.unit.text });

/** "original" peab olema sõnasõnaline katkend lõigu tekstist, muidu fakti ei võeta. */
function inRaw(c: Ctx, original: string): boolean {
  return !!original.trim() && squash(c.raw).includes(squash(original));
}

function statement<T>(out: { value: T; original: string; cite: RawCite }[], c: Ctx, value: T, original: string) {
  if (inRaw(c, original)) out.push({ value, original: original.trim(), cite: cite(c) });
}

/** Silt: väärtus ("Klient: X" / "Klient | X"), väärtus lõpeb "|" või lõigu lõpus. */
function labelled(text: string, labels: string): string | null {
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${labels})(?![\p{L}\p{N}])[^:|\n]{0,25}?\s*[:|]\s*([^|\n]+)`, "iu");
  const v = text.match(re)?.[1]?.trim().replace(/[;,.]+$/, "").trim();
  return v && !UNKNOWN_WORDS.test(v) ? v : null;
}

function parseDate(s: string): string | null {
  let y: string, m: string, d: string;
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const est = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (iso) [, y, m, d] = iso;
  else if (est) [, d, m, y] = est;
  else return null;
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(m) - 1 || dt.getUTCDate() !== Number(d)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const empty = (): RawExtraction => ({
  document_type: [], customer_name: [], project_name: [], requested_delivery_date: [], lines: [], modules_connected: [], connection_description: [],
  anchoring_type: [], anchoring_details: [], shore_connection: [], gangway_details: [], shore_support_details: [], winter_use: [],
  wave_height_m: [], current_speed_ms: [], boat_length_m: [], other_conditions: [],
});

// ---- tootread ----

type Field<T> = { value: T; original: string } | null;
const CUSTOM_RE = /kohandatud|custom|erilahendus|eritellimus|(?<![\p{L}])eri(?![\p{L}])|special/iu;
const QTY_LABEL = String.raw`kogus|qty|quantity|arv|tk`;
const QTY_RES = [
  new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${QTY_LABEL})\s*(?:\([^)]*\))?\s*[:|=]\s*(\d{1,5})(?![\d.,])`, "iu"),
  new RegExp(String.raw`(?<![\d.,])(\d{1,5})\s*(?:tk|pcs?|psc|pieces|kpl)(?![\p{L}])`, "iu"),
];

function maskCode(t: string): string {
  let out = t;
  for (const c of findCodes(t)) out = out.slice(0, c.index) + " ".repeat(c.text.length) + out.slice(c.index + c.text.length);
  return out;
}

function parseLineFields(t: string, labelledOnly: boolean) {
  const x = maskCode(t);
  const f: Record<"quantity" | "width" | "length" | "floatsPerModule" | "floatsTotal", Field<number>> = {
    quantity: null, width: null, length: null, floatsPerModule: null, floatsTotal: null,
  };

  const qre = labelledOnly ? QTY_RES.slice(0, 1) : QTY_RES;
  for (const re of qre) {
    const m = x.match(re);
    if (m) {
      f.quantity = { value: Number(m[1]), original: m[1] };
      break;
    }
  }

  // Mõõdud: sildiga, sufiksiga ("2000 mm lai"), siis "2,4 x 4 m"
  const wl = x.match(new RegExp(String.raw`(?<![\p{L}])(?:laius|width)\s*(?:\(\s*(${UNIT})\s*\))?\s*[:=|]?\s*(${NUM})\s*(${UNIT})?(?![\p{L}])`, "iu"));
  const ll = x.match(new RegExp(String.raw`(?<![\p{L}])(?:pikkus|length)\s*(?:\(\s*(${UNIT})\s*\))?\s*[:=|]?\s*(${NUM})\s*(${UNIT})?(?![\p{L}])`, "iu"));
  const dim = (m: RegExpMatchArray | null): Field<number> => {
    if (!m) return null;
    const n = toNum(m[2]);
    const unit = (m[3] ?? m[1])?.toLowerCase();
    if (!unit && n > 30) return null; // ühikuta suur arv: mm või m? ei arva
    return { value: toMetres(n, unit), original: m[0].replace(/^[\p{L}\s]+(\([^)]*\))?\s*[:=|]?\s*/u, "") || m[2] };
  };
  f.width = dim(wl);
  f.length = dim(ll);
  if (!labelledOnly) {
    const sw = x.match(new RegExp(String.raw`(${NUM})\s*(${UNIT})\s*(?:lai|wide)(?![\p{L}])`, "iu"));
    const sl = x.match(new RegExp(String.raw`(${NUM})\s*(${UNIT})\s*(?:pikk|long)(?![\p{L}])`, "iu"));
    if (!f.width && sw) f.width = { value: toMetres(toNum(sw[1]), sw[2].toLowerCase()), original: sw[0].replace(/\s*(?:lai|wide).*$/i, "") };
    if (!f.length && sl) f.length = { value: toMetres(toNum(sl[1]), sl[2].toLowerCase()), original: sl[0].replace(/\s*(?:pikk|long).*$/i, "") };
    const xm = x.match(new RegExp(String.raw`(${NUM})\s*(${UNIT})?\s*[x×*]\s*(${NUM})\s*(${UNIT})(?!\s*[x×*]\s*\d)(?![\p{L}])`, "iu"));
    if (xm && !f.width && !f.length) {
      const unit2 = xm[4].toLowerCase();
      const unit1 = (xm[2] ?? xm[4]).toLowerCase();
      f.width = { value: toMetres(toNum(xm[1]), unit1), original: xm[0] };
      f.length = { value: toMetres(toNum(xm[3]), unit2), original: xm[0] };
    }
  }

  const fpm =
    x.match(/(\d{1,3})\s*(?:ujuk\p{L}*|floats?)\s*(?:mooduli kohta|per module|\/\s*modul\p{L}*|moodulis|each)/iu) ??
    x.match(/(?:ujukeid mooduli kohta|ujukite arv mooduli kohta|floats per module|floats\/module)\s*[:|=]\s*(\d{1,3})(?![\d.,])/iu);
  if (fpm) f.floatsPerModule = { value: Number(fpm[1]), original: fpm[1] };
  const ft =
    x.match(/(\d{1,5})\s*(?:ujuk\p{L}*|floats?)\s*(?:kokku|total|in total)/iu) ??
    x.match(/(?:ujukeid kokku|ujukite arv kokku|floats total|total floats)\s*[:|=]\s*(\d{1,5})(?![\d.,])/iu);
  if (ft) f.floatsTotal = { value: Number(ft[1]), original: ft[1] };
  return f;
}

function variantOf(t: string): Field<"MODULE" | "SET"> {
  const x = t.replace(/mooduli kohta|per module|\/\s*modul\p{L}*/giu, " ");
  const set = x.match(/(?<![\p{L}])(?:set|komplekt\p{L}*)(?![\p{L}])/iu);
  const mod = x.match(/(?<![\p{L}])(?:moodul\p{L}*|modules?)(?![\p{L}])/iu);
  if (set && mod) return null; // "komplekt koosneb moodulitest": variant jääb küsimiseks
  if (set) return { value: "SET", original: set[0] };
  if (mod) return { value: "MODULE", original: mod[0] };
  return null;
}

function mkLine(c: Ctx, extra: Ctx[], code: string | null, name: string | null, custom: boolean): RawLine | null {
  const all = [c, ...extra];
  const fields = parseLineFields(c.text, false);
  for (const e of extra) {
    const more = parseLineFields(e.text, true);
    for (const k of Object.keys(fields) as (keyof typeof fields)[]) if (!fields[k] && more[k]) fields[k] = more[k];
  }
  const v = variantOf(c.text);
  const wrap = <T,>(f: Field<T> | null) => (f && all.some((x) => inRaw(x, f.original)) ? f : null);
  let variant = v ? { value: v.value as "MODULE" | "SET" | "ACCESSORY" | "CUSTOM", original: v.original } : null;
  if (!variant && custom) {
    const w = c.text.match(CUSTOM_RE);
    if (w) variant = { value: "CUSTOM", original: w[0] };
  }
  const codeNorm = code ? code.replace(/[^\d]/g, "").replace(/^(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3") : null;
  return {
    cites: all.map(cite),
    product_code: codeNorm && code ? { value: codeNorm, original: code } : null,
    product_name: name ? { value: name, original: name } : null,
    variant: wrap(variant),
    quantity: wrap(fields.quantity),
    width_m: wrap(fields.width),
    length_m: wrap(fields.length),
    floats_per_module: wrap(fields.floatsPerModule),
    floats_total: wrap(fields.floatsTotal),
  };
}

// ---- ühe lõigu lugemine ----

const ORDER_RE = /(?<![\p{L}])(?:tellime|tellin|tellida|tellimus\p{L}*|(?:we|i)\s+(?:would like to\s+|want to\s+|hereby\s+)?order|purchase order|order\s+(?:no|number|confirmation))(?![\p{L}])/iu;
const ENQUIRY_RE = /(?<![\p{L}])(?:hinnapakkumi\p{L}*|pakkumi\p{L}*|päring\p{L}*|hinnapäring|enquir\p{L}*|inquir\p{L}*|quot(?:e|ation)|rfq|palun pakkuda|palume pakkuda)(?![\p{L}])/iu;

function onUnit(c: Ctx, out: RawExtraction, typeHits: { order: Ctx[]; enquiry: Ctx[] }) {
  const t = c.text;

  const o = t.match(ORDER_RE);
  if (o) typeHits.order.push(c);
  if (ENQUIRY_RE.test(t)) typeHits.enquiry.push(c);

  const customer = labelled(t, "klient|tellija|customer|client|ettevõte|company");
  if (customer) statement(out.customer_name, c, customer, customer);
  const project = labelled(t, "projekt|project|objekt|object");
  if (project) statement(out.project_name, c, project, project);

  const deliv = labelled(t, "soovitud tarne|tarneaeg|tarnetähtaeg|tarnekuupäev|tarne|requested delivery|delivery date|delivery|deliver by|soovitud tarnekuupäev");
  if (deliv) {
    const dm = deliv.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{4}/);
    const iso = dm ? parseDate(dm[0]) : null;
    if (dm && iso) statement(out.requested_delivery_date, c, iso, dm[0]);
  }

  // Ühendus ja kai
  const no = t.match(/paigaldatakse eraldi|paigaldame eraldi|installed (?:separately|individually)|ei ühendata|ei ole omavahel ühendatud|not (?:to be )?connected to each other/iu);
  const yes = t.match(
    /(?<![\p{L}])moodulid(?: on| tuleb| tuleks)?(?: omavahel)? ühend\p{L}*|ühend\p{L}* omavahel|(?:modules?|pontoons?) (?:are |to be |will be )?connected(?: together| to each other)?|connected together|joined together/iu,
  );
  if (no && !yes) statement(out.modules_connected, c, "NO" as const, no[0]);
  else if (yes && !no) statement(out.modules_connected, c, "YES" as const, yes[0]);
  const conn = labelled(t, "ühenduse? (?:viis|kirjeldus|tüüp)|ühendamine|connection (?:method|type|description)");
  if (conn) statement(out.connection_description, c, conn, conn);

  const anch = labelled(t, "ankurdus|ankurdamine|anchoring|anchorage|anchor");
  if (anch) {
    statement(out.anchoring_details, c, anch, anch);
    const kinds: [string, RegExp][] = [
      ["CHAIN", /(?<![\p{L}])(?:ket[ti]\p{L}*|chains?)/iu],
      ["PILES", /(?<![\p{L}])(?:vai\p{L}*|piles?)/iu],
      ["CONCRETE", /(?<![\p{L}])(?:betoon\p{L}*|concrete\p{L}*)/iu],
    ];
    const hit = kinds.map(([k, r]) => [k, anch.match(r)] as const).filter(([, m]) => m);
    if (hit.length === 1) statement(out.anchoring_type, c, hit[0][0] as "CHAIN", hit[0][1]![0]);
  }

  const shoreNo = t.match(/kalda\p{L}*[uü]hendust ei ole|kaldaühendus puudub|ilma kaldaühenduseta|no shore connection|without (?:a )?shore connection|kaldaühendus\s*[:|]\s*(?:ei|puudub|no)(?![\p{L}])/iu);
  const shoreYes = t.match(/kaldaühendus\s*[:|]\s*(?:jah|yes|on)(?![\p{L}])|kaldaühendus on|kaldaühendusega|with (?:a )?shore connection|shore connection\s*[:|]\s*(?:yes|required)/iu);
  if (shoreNo && !shoreYes) statement(out.shore_connection, c, "NO" as const, shoreNo[0]);
  else if (shoreYes && !shoreNo) statement(out.shore_connection, c, "YES" as const, shoreYes[0]);

  const isProductish = findCodes(t).length > 0;
  if (!isProductish) {
    const gw = labelled(t, "ligipääsusild|gangway");
    if (gw) statement(out.gangway_details, c, gw, gw);
    else if (/ligipääsusild|gangway/iu.test(t)) statement(out.gangway_details, c, c.raw, c.raw);
    const ss = labelled(t, "kaldatugi|shore support|kaldaosa tugi");
    if (ss) statement(out.shore_support_details, c, ss, ss);
    else if (/kaldatugi|shore support/iu.test(t)) statement(out.shore_support_details, c, c.raw, c.raw);
  }

  // Talvekasutus
  const winter = t.match(/[^.,;|]*(?:talv|winter)[^.,;|]*/iu);
  if (winter) {
    const seg = winter[0].trim();
    const neg = /(?<![\p{L}])(?:ei|puudub|no|not|without|ilma|ära)(?![\p{L}])/iu.test(seg);
    const pos = /(?<![\p{L}])(?:jah|yes|vajalik|required|kasutatakse|kasutame|kasutus|jääb|used|use|remain\p{L}*|jää\p{L}*)(?![\p{L}])/iu.test(seg);
    if (neg && !pos) statement(out.winter_use, c, false, seg);
    else if (pos && !neg) statement(out.winter_use, c, true, seg);
  }

  // Mõõdetavad tingimused
  const wave = t.match(new RegExp(String.raw`(?<![\p{L}])(?:laine(?:de)?(?: kõrgus)?|wave(?: height)?)[^\d\n]{0,30}?(${NUM})\s*(${UNIT})?(?![\p{L}])`, "iu"));
  if (wave) {
    const unit = wave[2]?.toLowerCase() ?? (/\(\s*(mm|cm|m)\s*\)/i.exec(wave[0])?.[1].toLowerCase());
    const n = toNum(wave[1]);
    if (unit || n <= 10) statement(out.wave_height_m, c, toMetres(n, unit), wave[2] ? `${wave[1]} ${wave[2]}` : wave[1]);
  }
  const cur = t.match(new RegExp(String.raw`(?<![\p{L}])(?:hoovus|hoovuse kiirus|current(?: speed)?)[^\d\n]{0,30}?(${NUM})\s*(m\/s|m\/sek|cm\/s)`, "iu"));
  if (cur) {
    const n = toNum(cur[1]);
    statement(out.current_speed_ms, c, cur[2].toLowerCase().startsWith("cm") ? n / 100 : n, `${cur[1]} ${cur[2]}`);
  }
  const boat = t.match(new RegExp(String.raw`(?<![\p{L}])(?:paadi? pikkus|paatide? pikkus|laeva pikkus|boat length|vessel length|(?:paadid|paate|boats)\s+(?:kuni|up to))[^\d\n]{0,20}?(${NUM})\s*(${UNIT})(?![\p{L}])`, "iu"));
  if (boat) statement(out.boat_length_m, c, toMetres(toNum(boat[1]), boat[2].toLowerCase()), `${boat[1]} ${boat[2]}`);

  const note = labelled(t, "märkus(?:ed)?|kommentaar|lisainfo|note|notes|comment|erinõue\\p{L}*|requirements?|tingimus\\p{L}*|veesügavus|vee sügavus|water depth|depth|sügavus");
  if (note && inRaw(c, note)) out.other_conditions.push({ text: note, cite: cite(c) });
  else if (!note && /veesügavus|vee sügavus|water depth|sügavus/iu.test(t) && !isProductish) out.other_conditions.push({ text: t, cite: cite(c) });
}

/** Loeb dokumentide tekstilõigud ja koostab väljavõtte. Ei kasuta võrku ega väliseid teenuseid. */
export function extractLocally(docs: IngestedDoc[]): { raw: RawExtraction; notes: string[] } {
  const out = empty();
  const notes: string[] = [];
  for (const doc of docs) {
    const typeHits = { order: [] as Ctx[], enquiry: [] as Ctx[] };
    const texts = relabelTableRows(doc);
    const ctxs: Ctx[] = doc.units.map((unit, i) => ({ doc, unit, raw: unit.text, text: texts[i] }));
    ctxs.forEach((c, i) => {
      onUnit(c, out, typeHits);

      const codes = findCodes(c.text);
      const customLine = codes.length === 0 && CUSTOM_RE.test(c.text) && QTY_RES.some((r) => r.test(maskCode(c.text)));
      if (codes.length === 1 || customLine) {
        // Kui koodiga rida ei sisalda mõnda välja, vaata kuni kahte järgmist koodita lõiku, kus on sildiga väli (nt "Kogus: 2")
        const extra: Ctx[] = [];
        if (codes.length === 1) {
          for (let k = i + 1; k < Math.min(ctxs.length, i + 3); k++) {
            const nx = ctxs[k];
            if (findCodes(nx.text).length) break;
            if (/(?:kogus|qty|quantity|laius|width|pikkus|length|ujuk)\s*(?:\([^)]*\))?\s*[:|=]/iu.test(nx.text)) extra.push(nx);
          }
        }
        let name: string | null = null;
        if (customLine) {
          const n = c.text.replace(/^\s*\d+[).]\s*/, "").split(/,/)[0].trim();
          if (n && inRaw(c, n)) name = n;
        }
        const line = mkLine(c, extra, codes[0]?.text ?? null, name, customLine);
        if (line) out.lines.push(line);
      } else if (codes.length > 1) {
        notes.push(`${doc.fileName}, ${c.unit.locator}: ühes lõigus on mitu tootekoodi (${codes.map((x) => x.text).join(", ")}); tootridu ei loodud, lisa read käsitsi.`);
      }
    });

    // Dokumenditüüp ainult siis, kui signaal on üheselt ühepoolne
    const pick = typeHits.order.length && !typeHits.enquiry.length ? ("ORDER" as const) : typeHits.enquiry.length && !typeHits.order.length ? ("ENQUIRY" as const) : null;
    if (pick) {
      const c = (pick === "ORDER" ? typeHits.order : typeHits.enquiry)[0];
      const m = c.text.match(pick === "ORDER" ? ORDER_RE : ENQUIRY_RE)!;
      statement(out.document_type, c, pick, m[0]);
    }
  }
  return { raw: out, notes };
}
