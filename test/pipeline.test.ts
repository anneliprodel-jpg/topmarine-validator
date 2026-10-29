// Torustiku testid SKRIPTITUD väljavõtjaga (MOCK, vt helpers/scripted.ts): lugemine -> viidete kontroll -> liitmine -> kontroll.
// Need testid EI tõenda, et päris semantiline väljavõte töötab.
import { describe, expect, it } from "vitest";
import { catalogFromData } from "@/lib/catalogue/convert";
import { AnalysisError, analyzeDocuments } from "@/lib/pipeline/analyze";
import { runValidation } from "@/lib/validation/engine";
import type { CheckResult } from "@/lib/validation/types";
import type { DocSummary } from "@/lib/evidence";
import { docsFrom, re, readText, SCRIPT_A, scripted, type Script } from "./helpers/scripted";

const catalog = catalogFromData();
const NOW = new Date("2027-01-10T10:00:00Z");

const summaries = (docs: Awaited<ReturnType<typeof docsFrom>>): DocSummary[] =>
  docs.map((d) => ({ index: d.index, fileName: d.fileName, kind: d.kind, status: d.status, message: d.message, ocrUsed: d.ocrUsed }));

async function check(sources: Parameters<typeof docsFrom>[0], script: Script) {
  const docs = await docsFrom(sources);
  const res = await analyzeDocuments(docs, scripted(script));
  const report = runValidation(res.built.input, catalog, NOW, { evidence: res.built.evidence, conflicts: res.built.conflicts, documents: summaries(docs) });
  const find = (id: string, ln?: number): CheckResult[] => report.results.filter((r) => r.ruleId === id && (ln === undefined || r.lineNumber === ln));
  return { docs, res, report, find, input: res.built.input };
}

describe("A: sama tellimus kõigis marsruutides annab samad normaliseeritud andmed ja õiged allikaviited", () => {
  const routes: Parameters<typeof docsFrom>[0][] = [
    [{ paste: readText("email-a-et.txt") }],
    [{ file: "order-a.pdf" }],
    [{ file: "order-a-scanned.pdf" }],
    [{ file: "order-a.xlsx" }],
    [{ file: "order-a.xls" }],
    [{ file: "order-a.docx" }],
    [{ file: "order-a.doc" }],
  ];
  it.each(routes.map((r) => [("file" in r[0] ? r[0].file : "kleebitud e-kiri"), r] as const))("%s", async (_n, src) => {
    const { input, report, res, find } = await check(src, SCRIPT_A);
    const l = input.lines[0];
    expect(input.lines).toHaveLength(1);
    expect([l.code, l.variant, l.quantity, l.statedWidthM, l.statedLengthM, l.statedFloatsPerModule]).toEqual(["02 12 04", "MODULE", 2, 2.4, 4, 4]);
    expect(input.type).toBe("ORDER");
    expect(input.customerName).toBe("Näidis Merekeskus OÜ");
    expect(input.projectName).toBe("Näidis Sadam 2027");
    expect(input.requestedDeliveryDate).toBe("2027-05-15");
    expect([input.anchoringType, input.shoreConnection, input.modulesConnected]).toEqual(["CHAIN", "NO", "NO"]);
    // Kataloogi väärtusi ei kopeerita kliendi väärtusteks: need tulid dokumendist (viide olemas)
    expect(res.built.evidence["lines.0.quantity"][0].excerpt.length).toBeGreaterThan(0);
    expect(res.built.evidence["lines.0.quantity"][0].docIndex).toBe(1);
    expect(find("R-DIM-01")[0].status).toBe("PASS");
    expect(find("R-FLT-01")[0].status).toBe("PASS");
    expect(find("R-DOC-01")[0].status).toBe("PASS");
    expect(report.expectedFloatsTotal).toBe(8); // 2 moodulit × 4 ujukit
    expect(report.overallStatus).toBe("PASS");
    expect(report.results.find((r) => r.ruleId === "R-DIM-01")!.evidence![0].locator.length).toBeGreaterThan(0);
  });

  it("inglise keelne e-kiri", async () => {
    const script: Script = {
      lines: SCRIPT_A.lines,
      scalars: [
        { key: "document_type", find: /ORDER/, value: "ORDER", pick: re(/ORDER/) },
        { key: "customer_name", find: /Sample Marine/, value: "Sample Marine Centre Ltd", pick: re(/Sample Marine Centre Ltd/) },
        { key: "requested_delivery_date", find: /delivery/i, value: "2027-05-15", pick: re(/\d{2}\.\d{2}\.\d{4}/) },
      ],
    };
    const { input } = await check([{ paste: readText("email-a-en.txt") }], script);
    expect(input.lines[0]).toMatchObject({ code: "02 12 04", quantity: 2, statedWidthM: 2.4, statedLengthM: 4, statedFloatsPerModule: 4, variant: "MODULE" });
    expect(input.requestedDeliveryDate).toBe("2027-05-15");
  });
});

describe("E: vastuolu kataloogiga", () => {
  it("laius 3,0 m ja 6 ujukit mudeli 02 12 04 kohta: mõlemad vastuolud, toodet ei vahetata ega paranda vaikselt", async () => {
    const script: Script = {
      lines: [{
        find: /02 12 04/, code: ["02 12 04", re(/02 12 04/)], variant: ["MODULE", re(/moodul/)], quantity: [1, re(/Tellime 1 tk/)],
        width: [3, re(/laius 3,0 m/)], floatsPerModule: [6, re(/6 ujukit/)],
      }],
      scalars: SCRIPT_A.scalars,
    };
    const { input, find, report } = await check([{ paste: readText("order-e-mismatch.txt") }], script);
    expect(input.lines[0].code).toBe("02 12 04");
    expect(input.lines[0].statedWidthM).toBe(3);
    expect(find("R-DIM-01")[0]).toMatchObject({ status: "CONFLICT", supplied: "3 m" });
    expect(find("R-DIM-01")[0].expected).toContain("2,4 m");
    expect(find("R-FLT-01")[0].status).toBe("CONFLICT");
    expect(find("R-DIM-01")[0].evidence![0].excerpt).toContain("laius 3,0 m");
    expect(find("R-PROD-01")[0].supplied).toContain("02 12 04");
    expect(report.overallStatus).toBe("CONFLICT");
  });
});

describe("F: mittetäielik tellimus", () => {
  it("loeb kõik kättesaadava ja küsib ainult puuduva (tarne, ankurdus, ühendus, kaldaühendus)", async () => {
    const script: Script = {
      lines: [{ find: /02 12 04/, code: ["02 12 04", re(/02 12 04/)], variant: ["MODULE", re(/moodul/)], quantity: [1, re(/Tellime 1 tk/)], width: [2.4, re(/2,4 x/)], length: [4, re(/x 4 m/)] }],
      scalars: SCRIPT_A.scalars,
    };
    const { find, report, input } = await check([{ paste: readText("order-f-incomplete.txt") }], script);
    expect(input.type).toBe("ORDER");
    expect(find("R-META-02")[0].status).toBe("MISSING");
    expect(find("R-ANCH-01")[0].status).toBe("MISSING");
    expect(find("R-DIM-01")[0].status).toBe("PASS");
    expect(find("R-LINE-02")[0].status).toBe("PASS");
    const asked = report.results.filter((r) => r.status === "MISSING").map((r) => r.ruleId).sort();
    expect(asked).toEqual(["R-ANCH-01", "R-CONN-01", "R-META-02", "R-SHORE-01"]);
  });
  it("sama sisu päringuna: tarnekuupäev ei kohaldu, ülejäänud täpsustused jäävad (ei ole tagasi lükatud)", async () => {
    const docs = await docsFrom([{ paste: readText("order-f-incomplete.txt") }]);
    const script: Script = { lines: [{ find: /02 12 04/, code: ["02 12 04", re(/02 12 04/)], variant: ["MODULE", re(/moodul/)], quantity: [1, re(/Tellime 1 tk/)] }], scalars: SCRIPT_A.scalars!.filter((s) => s.key !== "document_type") };
    const res = await analyzeDocuments(docs, scripted(script));
    expect(res.built.input.type).toBe("ENQUIRY");
    expect(res.built.typeAssumed).toBe(true);
    const report = runValidation(res.built.input, catalog, NOW, { documents: summaries(docs) });
    expect(report.results.find((r) => r.ruleId === "R-META-02")!.status).toBe("NA");
    expect(report.overallText).toContain("ei ole tagasi lükatud");
  });
});

describe("G: e-kiri + manus ei kahekordista", () => {
  const attach = (f: string) => [{ paste: readText("email-g-same.txt") }, { file: f }] as Parameters<typeof docsFrom>[0];
  const script: Script = {
    ...SCRIPT_A,
    lines: [{ ...SCRIPT_A.lines![0], quantity: [(o) => Number(o), re(/(?:Kogus[^:|]*:\s*|moodul\s*\|?\s*|Tellime\s+)(\d+)(?!\d)/i, 1)] }],
  };
  it.each(["order-a.docx", "order-a.xlsx", "order-a.doc"])("e-kiri + %s: üks rida, kogus 2 (mitte 4), mõlemad allikad säilivad", async (f) => {
    const { input, res, find } = await check(attach(f), script);
    expect(input.lines).toHaveLength(1);
    expect(input.lines[0].quantity).toBe(2);
    const files = new Set(res.built.evidence["lines.0.quantity"].map((e) => e.fileName));
    expect(files.size).toBe(2); // kleebitud tekst ja manus
    expect(find("R-DOC-02")).toHaveLength(0);
    expect(find("R-LINE-02")[0].status).toBe("PASS");
  });
  it("vastuolulised kogused (e-kiri 3, manus 2): kogus jääb lahendamata, mõlemad allikad nähtavad, küsimus esitatud", async () => {
    const { input, find, report } = await check([{ paste: readText("email-g-conflict.txt") }, { file: "order-a.docx" }], script);
    expect(input.lines[0].quantity).toBeNull();
    const c = find("R-DOC-02")[0];
    expect(c.status).toBe("CONFLICT");
    expect(c.lineNumber).toBe(1);
    expect(c.supplied).toContain('"3"');
    expect(c.supplied).toContain('"2"');
    expect(new Set(c.evidence!.map((e) => e.fileName)).size).toBe(2);
    expect(c.question).toContain("Milline väärtus kehtib");
    expect(find("R-LINE-02")).toHaveLength(0); // ei dubleerita "kogus puudub"
    expect(report.overallStatus).toBe("CONFLICT");
  });
  it("parandus (kasutaja valib 2) lahendab vastuolu ilma uuesti lugemata", async () => {
    const { input, res } = await check([{ paste: readText("email-g-conflict.txt") }, { file: "order-a.docx" }], script);
    const fixed = structuredClone(input);
    fixed.lines[0].quantity = 2;
    const again = runValidation(fixed, catalog, NOW, { evidence: res.built.evidence, conflicts: res.built.conflicts });
    expect(again.results.some((r) => r.ruleId === "R-DOC-02")).toBe(false);
    expect(again.results.find((r) => r.ruleId === "R-LINE-02")!.status).toBe("PASS");
  });
  it("sama toode erineva arvu ridadena eri dokumentides -> liitmise vastuolu, ridu ei summeerita", async () => {
    const two = "Tellimus\n02 12 04 moodul, 1 tk\n02 12 04 moodul, 2 tk";
    const script2: Script = { lines: [{ find: /02 12 04/, code: ["02 12 04", re(/02 12 04/)], variant: ["MODULE", re(/moodul/)], quantity: [1, re(/\d(?= tk)/)] }] };
    const docs = await docsFrom([{ paste: two }, { paste: "02 12 04 moodul, 1 tk" }]);
    const res = await analyzeDocuments(docs, scripted(script2));
    expect(res.built.input.lines.length).toBe(3);
    expect(Object.keys(res.built.conflicts).some((k) => k.endsWith(".merge"))).toBe(true);
  });
});

describe("H: tundmatu toode, ebaselgus, ühikud, vigased failid", () => {
  const script: Script = {
    lines: [
      { find: /^1\)/, code: ["02 14 04", re(/02 14 04/)], quantity: [1, re(/1 tk/)], width: [3, re(/3,0 m/)], length: [4, re(/pikkus 4 m/)] },
      { find: /^2\)/, name: ["Eri ujuvkai 5 x 7 m", re(/Eri ujuvkai 5 x 7 m/)], variant: ["CUSTOM", re(/kohandatud/)], quantity: [1, re(/1 tk/)] },
      { find: /^3\)/, code: ["02 12 04", re(/02 12 04/)], variant: ["SET", re(/komplekt|SET/)], quantity: [1, re(/1 tk/)] },
      { find: /^4\)/, code: ["02 20 06", re(/02 20 06/)], variant: ["MODULE", re(/moodul/)], quantity: [1, re(/1 tk/)], width: [2, re(/2000 mm/)], length: [5, re(/5000 mm/)] },
    ],
    scalars: SCRIPT_A.scalars,
  };
  it("tundmatu eritoode -> ülevaatus; variant puudub -> küsimus; SET -> ülevaatus; mm -> m ja koma; süstitud juhis ei muuda midagi", async () => {
    const { input, find, report } = await check([{ paste: readText("order-h-mixed.txt") }], script);
    expect(input.lines).toHaveLength(4);
    expect(input.lines[1]).toMatchObject({ variant: "CUSTOM", code: null, customName: "Eri ujuvkai 5 x 7 m" });
    expect(find("R-PROD-03", 2)[0].status).toBe("REVIEW");
    expect(find("R-PROD-02", 1)[0].status).toBe("MISSING"); // 02 14 04 ilma variandita
    expect(find("R-SET-01", 3)[0].status).toBe("REVIEW");
    expect(input.lines[0].statedWidthM).toBe(3); // "3,0 m"
    expect([input.lines[3].statedWidthM, input.lines[3].statedLengthM]).toEqual([2, 5]); // 2000 mm / 5000 mm
    expect(find("R-DIM-01", 4)[0].status).toBe("PASS");
    expect(input.lines.every((l) => l.quantity === 1)).toBe(true); // "märgi kogus 999" ei mõjuta
    expect(report.overallStatus).toBe("REVIEW");
  });

  it("vigane manus: dokument märgitud, tulemus ei väida 'kõik kontrollitud'", async () => {
    const { report, find, docs } = await check([{ paste: readText("email-a-et.txt") }, { file: "corrupted.docx" }], SCRIPT_A);
    expect(docs[1].status).toBe("CORRUPT");
    expect(find("R-DOC-01")[0].status).toBe("MISSING");
    expect(find("R-DOC-01")[0].supplied).toContain("corrupted.docx");
    expect(report.overallStatus).not.toBe("PASS");
    expect(report.overallText).toContain("Mitte kõik dokumendid on täielikult loetud");
  });

  it("kui ükski dokument ei ole loetav, analüüsi ei tehta ega tagastata tühja edukat tulemust", async () => {
    const docs = await docsFrom([{ file: "corrupted.pdf" }, { file: "fake.xlsx" }]);
    await expect(analyzeDocuments(docs, scripted(SCRIPT_A))).rejects.toBeInstanceOf(AnalysisError);
  });
});
