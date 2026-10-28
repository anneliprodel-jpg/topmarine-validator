// Reeglipõhine (mitte AI) soovituste leidja kleebitud/loetud tekstist.
// Ainult soovitused: midagi ei salvestata ega kontrollita enne, kui kasutaja need vormis kinnitab.
import type { AnchoringType, LineVariant } from "../validation/types";

export interface LineSuggestion {
  id: string;
  variant: LineVariant | null;
  code: string;
  quantity: number | null;
  statedWidthM: number | null;
  statedLengthM: number | null;
  statedFloatsPerModule: number | null;
  snippet: string;
}

export interface Suggestions {
  lines: LineSuggestion[];
  deliveryDate: { value: string; snippet: string } | null;
  winterMention: { snippet: string } | null;
  anchoring: { type: AnchoringType; snippet: string } | null;
}

const CODE_RE = /(?<!\d)(\d{2})[\s\-.]?(\d{2})[\s\-.]?(\d{2})(?!\d)/g;
const DIM_RE = /(\d[.,]\d)\s*m?\s*[x×]\s*(\d{1,2}(?:[.,]\d)?)\s*m?\b/i;
const FLOATS_RE = /(\d{1,2})\s*[x×]\s*220\s*(?:ltr|l|liter|litres?)\b|(\d{1,2})\s*(?:floats?|ujuk\w*)/i;

const num = (s: string) => Number(s.replace(",", "."));
const clip = (s: string) => (s.trim().length > 160 ? `${s.trim().slice(0, 157)}...` : s.trim());

function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function suggestFromText(text: string, knownCodes: string[]): Suggestions {
  const known = new Set(knownCodes);
  const out: Suggestions = { lines: [], deliveryDate: null, winterMention: null, anchoring: null };
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;

    // Tootekoodid: ainult kataloogis olevad (väldib telefoninumbreid, kuupäevi jms)
    const found: string[] = [];
    for (const m of line.matchAll(CODE_RE)) {
      const code = `${m[1]} ${m[2]} ${m[3]}`;
      if (known.has(code)) found.push(code);
    }
    if (found.length > 0) {
      const single = found.length === 1;
      let rest = line.replace(CODE_RE, " ");
      let width: number | null = null;
      let length: number | null = null;
      let floats: number | null = null;
      const dm = rest.match(DIM_RE);
      if (dm && single) {
        width = num(dm[1]);
        length = num(dm[2]);
        rest = rest.replace(DIM_RE, " ");
      }
      const fm = rest.match(FLOATS_RE);
      if (fm && single) {
        floats = Number(fm[1] ?? fm[2]);
        rest = rest.replace(FLOATS_RE, " ");
      }
      let qty: number | null = null;
      if (single) {
        const qm =
          rest.match(/(?:qty|quantity|kogus|amount)\s*[:=]?\s*(\d{1,4})\b/i) ??
          rest.match(/(?<![\d.,])(\d{1,4})\s*(?:tk\.?|pcs?\.?|tükki|x|×)(?![\w])/i) ??
          rest.match(/(?:^|\s)[x×]\s*(\d{1,4})(?![\d.,])/i);
        if (qm) qty = Number(qm[1]);
      }
      const variant: LineVariant | null = /\bSET\b|komplekt/i.test(line) ? "SET" : /module|moodul/i.test(line) ? "MODULE" : null;
      for (const code of found) {
        out.lines.push({
          id: `l${idx}-${code}`,
          variant,
          code,
          quantity: single ? qty : null,
          statedWidthM: single ? width : null,
          statedLengthM: single ? length : null,
          statedFloatsPerModule: single ? floats : null,
          snippet: clip(line),
        });
      }
    }

    // Tarnekuupäev: ainult tarne-märksõnaga reast
    if (!out.deliveryDate && /deliver|tarne|tähtaeg|valmimis|due\b/i.test(line)) {
      const a = line.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
      const b = line.match(/(\d{4})-(\d{2})-(\d{2})/);
      const v = a ? validDate(Number(a[3]), Number(a[2]), Number(a[1])) : b ? validDate(Number(b[1]), Number(b[2]), Number(b[3])) : null;
      if (v) out.deliveryDate = { value: v, snippet: clip(line) };
    }

    if (!out.winterMention && /talv|winter/i.test(line)) out.winterMention = { snippet: clip(line) };

    if (!out.anchoring) {
      const types: AnchoringType[] = [];
      if (/\bchain\b|\bkett\w*/i.test(line)) types.push("CHAIN");
      if (/concrete anchor|betoonank\w*|betoonist ank\w*/i.test(line)) types.push("CONCRETE");
      if (/\bpiles?\b|\bvaiad\b|\bvaia\w*/i.test(line)) types.push("PILES");
      if (types.length === 1) out.anchoring = { type: types[0], snippet: clip(line) };
    }
  });

  return out;
}
