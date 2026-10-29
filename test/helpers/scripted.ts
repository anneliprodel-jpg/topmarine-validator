// MOCK: skriptitud "väljavõtja" ainult testideks. See EI ole semantiline väljavõte ega tõesta, et päris mudel töötab.
// Ta kontrollib torustikku: mudelile saadetud viited -> kontroll -> liitmine -> mootor. Päris mudeli test: test/live.test.ts.
import type { Extractor } from "@/lib/extract/provider";
import { EXTRACTION_VERSION, type RawExtraction, type RawLine } from "@/lib/extract/schema";
import type { IngestedDoc } from "@/lib/ingest/types";
import { ingestFile, ingestPaste } from "@/lib/ingest";
import { readFileSync } from "node:fs";
import path from "node:path";

export type Pick = (text: string) => string | null;
export const re = (r: RegExp, group = 0): Pick => (t) => {
  const m = t.match(r);
  return m ? m[group] ?? m[0] : null;
};

type F<T> = [T | ((original: string) => T), Pick];
export interface LineSpec {
  find: RegExp;
  code?: F<string>;
  name?: F<string>;
  variant?: F<"MODULE" | "SET" | "ACCESSORY" | "CUSTOM">;
  quantity?: F<number>;
  width?: F<number>;
  length?: F<number>;
  floatsPerModule?: F<number>;
  floatsTotal?: F<number>;
}
export interface ScalarSpec<T = unknown> {
  key: Exclude<keyof RawExtraction, "lines" | "other_conditions">;
  find: RegExp;
  value: T;
  pick: Pick;
}
export interface Script {
  lines?: LineSpec[];
  scalars?: ScalarSpec[];
}

const empty = (): RawExtraction => ({
  document_type: [], customer_name: [], project_name: [], requested_delivery_date: [], lines: [], modules_connected: [], connection_description: [],
  anchoring_type: [], anchoring_details: [], shore_connection: [], gangway_details: [], shore_support_details: [], winter_use: [],
  wave_height_m: [], current_speed_ms: [], boat_length_m: [], other_conditions: [],
});

/** Parsib mudelile saadetud sisendi (rida: [D1-U6] (asukoht) tekst) ja koostab skripti järgi väljundi. */
export function scripted(script: Script): Extractor {
  return {
    meta: { provider: "mock", model: "scripted-test", extractionVersion: EXTRACTION_VERSION },
    async extract(userContent) {
      const out = empty();
      const units = [...userContent.matchAll(/^\[(D\d+-U\d+)\] \((.*?)\) (.*)$/gm)].map((m) => ({ id: m[1], text: m[3] }));
      for (const u of units) {
        for (const ls of script.lines ?? []) {
          if (!ls.find.test(u.text)) continue;
          const fld = <T,>(f?: F<T>) => {
            if (!f) return null;
            const original = f[1](u.text);
            return original ? { value: typeof f[0] === "function" ? (f[0] as (o: string) => T)(original) : f[0], original } : null;
          };
          const line: RawLine = {
            cites: [{ unit_id: u.id, excerpt: u.text }],
            product_code: fld(ls.code), product_name: fld(ls.name), variant: fld(ls.variant), quantity: fld(ls.quantity),
            width_m: fld(ls.width), length_m: fld(ls.length), floats_per_module: fld(ls.floatsPerModule), floats_total: fld(ls.floatsTotal),
          };
          out.lines.push(line);
        }
        for (const ss of script.scalars ?? []) {
          if (!ss.find.test(u.text)) continue;
          const original = ss.pick(u.text);
          if (!original) continue;
          (out[ss.key] as unknown[]).push({ value: ss.value, original, cite: { unit_id: u.id, excerpt: u.text } });
        }
      }
      return out;
    },
  };
}

const FIX = path.join(process.cwd(), "test", "fixtures");
export const readFix = (name: string) => new Uint8Array(readFileSync(path.join(FIX, name)));
export const readText = (name: string) => readFileSync(path.join(FIX, "text", name), "utf8");

export async function docsFrom(sources: ({ paste: string } | { file: string })[]): Promise<IngestedDoc[]> {
  const docs: IngestedDoc[] = [];
  let i = 0;
  for (const s of sources) {
    i += 1;
    docs.push("paste" in s ? ingestPaste(i, s.paste) : await ingestFile(i, s.file, readFix(s.file)));
  }
  return docs;
}

/** Tellimus A (kood 02 12 04, 2 tk, 2,4 x 4 m, 4 ujukit, kett, tarne 15.05.2027) kõigi failivormingute jaoks. */
export const SCRIPT_A: Script = {
  lines: [
    {
      find: /02\s?12\s?04|021204/,
      code: ["02 12 04", re(/0?2\s?1\s?2\s?0\s?4/)],
      variant: ["MODULE", re(/moodul|module/i)],
      quantity: [(o) => Number(o), re(/(?:Kogus[^:|]*:\s*|moodul\s*\|?\s*|order\s+|Tellime\s+)(\d+)(?!\d)/i, 1)],
      width: [2.4, re(/(\d[.,]\d)\s*x\s*\d\s*m/i, 1)],
      length: [4, re(/\d[.,]\d\s*x\s*(\d)\s*m/i, 1)],
      floatsPerModule: [4, (t) => t.match(/\d\s+(?:ujukit|floats)/)?.[0] ?? t.match(/(?:\|\s*|:\s*|\s)(\d)\s*$/)?.[1] ?? null],
    },
  ],
  scalars: [
    { key: "document_type", find: /tellimus|tellida|order/i, value: "ORDER", pick: re(/tellimus|tellida|order/i) },
    { key: "customer_name", find: /Näidis Merekeskus O/, value: "Näidis Merekeskus OÜ", pick: re(/Näidis Merekeskus O.?/) },
    { key: "project_name", find: /Näidis Sadam 2027/, value: "Näidis Sadam 2027", pick: re(/Näidis Sadam 2027/) },
    { key: "requested_delivery_date", find: /tarne/i, value: "2027-05-15", pick: re(/\d{2}\.\d{2}\.\d{4}/) },
    { key: "anchoring_type", find: /ketiankur/i, value: "CHAIN", pick: re(/ketiankur/i) },
    { key: "anchoring_details", find: /ketiankur/i, value: "ketiankur 13 mm, 2 tk", pick: re(/ketiankur 13 mm, 2 tk/i) },
    { key: "shore_connection", find: /Kalda.?hendust ei ole/, value: "NO", pick: re(/ei ole/) },
    { key: "modules_connected", find: /paigaldatakse eraldi/, value: "NO", pick: re(/paigaldatakse eraldi/) },
  ],
};
