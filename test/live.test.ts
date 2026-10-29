// PÄRIS semantiline väljavõte (tasuline Claude API). Jookseb ainult siis, kui ANTHROPIC_API_KEY on seadistatud:
//   ANTHROPIC_API_KEY=... npx vitest run test/live.test.ts
// Ilma võtmeta jäetakse test vahele - siis jääb päris väljavõte KONTROLLIMATA.
import { describe, expect, it } from "vitest";
import { catalogFromData } from "@/lib/catalogue/convert";
import { createAnthropicExtractor, getLlmConfig } from "@/lib/extract/provider";
import { analyzeDocuments } from "@/lib/pipeline/analyze";
import { runValidation } from "@/lib/validation/engine";
import { docsFrom, readText } from "./helpers/scripted";

const cfg = getLlmConfig();

describe.skipIf(!cfg)("päris väljavõte (live)", () => {
  const routes: [string, Parameters<typeof docsFrom>[0]][] = [
    ["e-kiri (et)", [{ paste: readText("email-a-et.txt") }]],
    ["e-kiri (en)", [{ paste: readText("email-a-en.txt") }]],
    ["pdf", [{ file: "order-a.pdf" }]],
    ["skaneeritud pdf (OCR)", [{ file: "order-a-scanned.pdf" }]],
    ["xlsx", [{ file: "order-a.xlsx" }]],
    ["xls", [{ file: "order-a.xls" }]],
    ["docx", [{ file: "order-a.docx" }]],
    ["doc", [{ file: "order-a.doc" }]],
    ["e-kiri + manus ei kahekordista", [{ paste: readText("email-g-same.txt") }, { file: "order-a.docx" }]],
  ];
  it.each(routes)("%s -> 2 × 02 12 04, 2,4 x 4 m", async (_n, src) => {
    const docs = await docsFrom(src);
    const res = await analyzeDocuments(docs, createAnthropicExtractor(cfg!));
    const l = res.built.input.lines;
    expect(l).toHaveLength(1);
    expect(l[0].code).toBe("02 12 04");
    expect(l[0].quantity).toBe(2);
    expect(Object.keys(res.built.evidence).length).toBeGreaterThan(0);
    const report = runValidation(res.built.input, catalogFromData(), new Date("2027-01-10"), { evidence: res.built.evidence, conflicts: res.built.conflicts });
    expect(report.results.some((r) => r.ruleId === "R-DOC-02")).toBe(false);
  }, 240_000);

  it("vastuolu: e-kiri 3 tk vs manus 2 tk", async () => {
    const docs = await docsFrom([{ paste: readText("email-g-conflict.txt") }, { file: "order-a.docx" }]);
    const res = await analyzeDocuments(docs, createAnthropicExtractor(cfg!));
    expect(Object.keys(res.built.conflicts).some((k) => k.endsWith("quantity"))).toBe(true);
  }, 240_000);
});
