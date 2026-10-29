import { describe, expect, it } from "vitest";
import { catalogFromData } from "../catalogue/convert";
import { CONFLICTS, PRODUCTS, RULES } from "../catalogue/data";
import { buildDemoCases } from "../demo";
import { normalizeCode } from "./codes";
import { runValidation } from "./engine";
import type { CheckResult, LineInput, SubmissionInput, ValidationReport } from "./types";

const catalog = catalogFromData();
const NOW = new Date("2026-10-28T10:00:00Z");

const line = (o: Partial<LineInput> = {}): LineInput => ({
  variant: "MODULE",
  code: "02 12 04",
  customName: null,
  quantity: 1,
  statedWidthM: null,
  statedLengthM: null,
  statedFloatsPerModule: null,
  ...o,
});

const sub = (o: Partial<SubmissionInput> = {}): SubmissionInput => ({
  type: "ORDER",
  projectName: "Proj",
  customerName: "Klient",
  requestedDeliveryDate: "2026-12-31",
  referenceText: "",
  comments: "",
  lines: [line()],
  modulesConnected: "NO",
  connectionDescription: "",
  connectionComponents: "",
  connectionQuantitiesUnknown: false,
  anchoringType: "CHAIN",
  anchoringDetails: "Kett",
  shoreConnection: "NO",
  gangwayDetails: "",
  shoreSupportDetails: "",
  shoreDetailsUnknown: false,
  siteNotes: "",
  winterUse: null,
  waveHeightM: null,
  currentSpeedMs: null,
  boatLengthM: null,
  relevantProperties: [],
  ...o,
});

const run = (o: Partial<SubmissionInput> = {}) => runValidation(sub(o), catalog, NOW);
const find = (r: ValidationReport, id: string, ln?: number): CheckResult[] =>
  r.results.filter((x) => x.ruleId === id && (ln === undefined || x.lineNumber === ln));

describe("kataloog: üheksa mudelit", () => {
  const expected: Array<[string, number, number, number]> = [
    ["02 10 04", 2.0, 4, 4],
    ["02 12 04", 2.4, 4, 4],
    ["02 14 04", 3.0, 4, 4],
    ["02 20 06", 2.0, 5, 6],
    ["02 22 06", 2.4, 5, 6],
    ["02 24 06", 3.0, 5, 6],
    ["02 30 08", 2.0, 6, 8],
    ["02 32 08", 2.4, 6, 8],
    ["02 34 08", 3.0, 6, 8],
  ];
  it.each(expected)("%s -> laius %s, pikkus %s, ujukeid %s", (code, w, l, f) => {
    const p = catalog.find((c) => c.code === code && c.variant === "MODULE")!;
    expect(p).toBeDefined();
    expect([p.widthM, p.lengthM, p.floatsPerModule]).toEqual([w, l, f]);
    const r = run({ lines: [line({ code, statedWidthM: w, statedLengthM: l, statedFloatsPerModule: f })] });
    expect(find(r, "R-DIM-01")[0].status).toBe("PASS");
    expect(find(r, "R-DIM-02")[0].status).toBe("PASS");
    expect(find(r, "R-FLT-01")[0].status).toBe("PASS");
  });

  it("koodid on stringid ja eesnullid säilivad; sisemine ID on unikaalne, kood+variant mitte ainult kood", () => {
    expect(PRODUCTS.every((p) => typeof p.code === "string")).toBe(true);
    expect(new Set(PRODUCTS.map((p) => p.internalId)).size).toBe(PRODUCTS.length);
    const sameCode = PRODUCTS.filter((p) => p.code === "02 12 04");
    expect(sameCode.map((p) => p.variant).sort()).toEqual(["MODULE", "SET"]);
    expect(PRODUCTS.filter((p) => p.variant === "MODULE")).toHaveLength(9);
    expect(PRODUCTS.filter((p) => p.variant === "SET")).toHaveLength(9);
    expect(PRODUCTS.filter((p) => p.variant === "SET").every((p) => p.reviewRequired)).toBe(true);
  });

  it("andmed ei sisalda hindu", () => {
    expect(JSON.stringify(PRODUCTS).toLowerCase()).not.toMatch(/price|hind|eur|€/);
  });

  it("koodi variatsioonid normaliseeritakse eesnulle kaotamata", () => {
    for (const v of ["02 12 04", " 02  12 04 ", "021204", "02-12-04", "02.12.04", "02 12 04"]) {
      expect(normalizeCode(v)).toBe("02 12 04");
    }
    expect(normalizeCode("2 12 04")).toBeNull();
    expect(normalizeCode("abc")).toBeNull();
    expect(normalizeCode("")).toBeNull();
  });
});

describe("toote lahendamine", () => {
  it("ainult kood ilma variandita nõuab variandi täpsustust", () => {
    const r = run({ lines: [line({ variant: null })] });
    const x = find(r, "R-PROD-02")[0];
    expect(x.status).toBe("MISSING");
    expect(x.question).toMatch(/komplekti|SET/);
    expect(find(r, "R-DIM-01")).toHaveLength(0);
  });

  it("koodi sisestus tühikute variatsioonidega leitakse", () => {
    const r = run({ lines: [line({ code: "021204" })] });
    expect(find(r, "R-PROD-01")[0].status).toBe("PASS");
  });

  it("tundmatu kood -> inseneri ülevaatus", () => {
    const r = run({ lines: [line({ code: "99 99 99" })] });
    expect(find(r, "R-PROD-03")[0].status).toBe("REVIEW");
    expect(r.overallStatus).toBe("REVIEW");
  });

  it("vigane koodi formaat -> ülevaatus; puuduv kood -> puuduv info", () => {
    expect(find(run({ lines: [line({ code: "xyz" })] }), "R-PROD-03")[0].status).toBe("REVIEW");
    expect(find(run({ lines: [line({ code: null })] }), "R-PROD-01")[0].status).toBe("MISSING");
  });

  it("eritoode (CUSTOM) -> ülevaatus ega vali toodet", () => {
    const r = run({ lines: [line({ variant: "CUSTOM", code: null, customName: "Eri ponton 5x7" })] });
    expect(find(r, "R-PROD-03")[0].status).toBe("REVIEW");
    expect(find(r, "R-PROD-01")).toHaveLength(0);
  });

  it("variandi ja koodi vale kombinatsioon (tarvik koodiga, variant MODULE) -> ülevaatus", () => {
    const r = run({ lines: [line({ variant: "MODULE", code: "02 80 00" })] });
    expect(find(r, "R-PROD-03")[0].status).toBe("REVIEW");
  });

  it("tarvik ühese koodiga ei vaja varianti ega mõõte", () => {
    const r = run({ lines: [line({ variant: "ACCESSORY", code: "02 80 00", quantity: 4 })] });
    expect(find(r, "R-PROD-01")[0].status).toBe("PASS");
    expect(find(r, "R-DIM-01")).toHaveLength(0);
  });

  it("vana tüüpi ujukid 02 71 00 ja 02 72 00 vajavad ülevaatust", () => {
    for (const code of ["02 71 00", "02 72 00"]) {
      const r = run({ lines: [line({ variant: "ACCESSORY", code })] });
      expect(find(r, "R-OLD-01")[0].status).toBe("REVIEW");
    }
  });
});

describe("kogus ja puuduvad sisendid", () => {
  it("puuduv kogus -> puuduv info, ja ujukite kogusumma jääb arvutamata", () => {
    const r = run({ lines: [line({ quantity: null })] });
    expect(find(r, "R-LINE-02")[0].status).toBe("MISSING");
    expect(r.expectedFloatsTotal).toBeNull();
  });

  it("mitte-täisarv ja 0 kogus ei läbi kontrolli (kaitse ka mootoris)", () => {
    expect(find(run({ lines: [line({ quantity: 0 })] }), "R-LINE-02")[0].status).toBe("MISSING");
    expect(find(run({ lines: [line({ quantity: 1.5 })] }), "R-LINE-02")[0].status).toBe("MISSING");
    expect(find(run({ lines: [line({ quantity: -2 })] }), "R-LINE-02")[0].status).toBe("MISSING");
  });

  it("puuduvad valikulised mõõdud tähendavad 'ei kontrollitud', mitte vastavust", () => {
    const r = run();
    expect(find(r, "R-DIM-01")[0].status).toBe("NA");
    expect(find(r, "R-DIM-02")[0].status).toBe("NA");
    expect(find(r, "R-FLT-01")[0].status).toBe("NA");
    expect(find(r, "R-DIM-01")[0].supplied).toBeNull();
  });

  it("tühi tellimus: kõik nõutud elemendid tekitavad puuduva info", () => {
    const r = run({ projectName: "", customerName: "", requestedDeliveryDate: null, lines: [], anchoringType: null, modulesConnected: null, shoreConnection: null });
    expect(find(r, "R-META-01")[0].status).toBe("MISSING");
    expect(find(r, "R-META-02")[0].status).toBe("MISSING");
    expect(find(r, "R-LINE-01")[0].status).toBe("MISSING");
    expect(find(r, "R-ANCH-01")[0].status).toBe("MISSING");
    expect(find(r, "R-CONN-01")[0].status).toBe("MISSING");
    expect(find(r, "R-SHORE-01")[0].status).toBe("MISSING");
    expect(r.overallStatus).toBe("MISSING");
  });

  it("tarnekuupäev minevikus -> hoiatus", () => {
    expect(find(run({ requestedDeliveryDate: "2020-01-01" }), "R-META-02")[0].status).toBe("CONFLICT");
  });
});

describe("laius / pikkus / ujukid", () => {
  it("laiuse ja pikkuse lahknevus tuvastatakse ega vaheta toodet", () => {
    const r = run({ lines: [line({ statedWidthM: 3.0, statedLengthM: 5 })] });
    const w = find(r, "R-DIM-01")[0];
    const l = find(r, "R-DIM-02")[0];
    expect(w.status).toBe("CONFLICT");
    expect(w.expected).toContain("2,4 m");
    expect(w.supplied).toBe("3 m");
    expect(l.status).toBe("CONFLICT");
    expect(find(r, "R-PROD-01")[0].supplied).toContain("02 12 04");
  });

  it("ujukite arv mooduli kohta: lahknevus ja vastavus", () => {
    expect(find(run({ lines: [line({ statedFloatsPerModule: 6 })] }), "R-FLT-01")[0].status).toBe("CONFLICT");
    expect(find(run({ lines: [line({ statedFloatsPerModule: 4 })] }), "R-FLT-01")[0].status).toBe("PASS");
  });

  it("mooduli kohta vs kokku: 2 × 02 12 04 (4) + 1 × 02 20 06 (6) = 14", () => {
    const r = run({ lines: [line({ quantity: 2 }), line({ code: "02 20 06", quantity: 1 })] });
    expect(r.expectedFloatsTotal).toBe(14);
    const t = find(r, "R-FLT-02")[0];
    expect(t.expected).toContain("14 ujukit kokku");
    expect(find(r, "R-FLT-01").map((x) => x.expected)).toEqual([
      "4 ujukit ühe mooduli kohta",
      "6 ujukit ühe mooduli kohta",
    ]);
  });
});

describe("sisaldatud vs eraldi ujukid", () => {
  it("täielik moodul ei nõua eraldi ujukeid", () => {
    const r = run();
    expect(find(r, "R-FLT-03")[0].status).toBe("NA");
    expect(r.overallStatus).toBe("PASS");
  });

  it("eraldi ujukirida (02 73 00) on varuosarida, hoiatus ega mõjuta mooduli ujukite kogusummat", () => {
    const r = run({ lines: [line({ quantity: 1 }), line({ variant: "ACCESSORY", code: "02 73 00", quantity: 2 })] });
    expect(find(r, "R-FLT-03")[0].status).toBe("MISSING");
    expect(r.expectedFloatsTotal).toBe(4);
  });
});

describe("SET", () => {
  it("SET nõuab koosseisu ülevaatust ega väida komponentide olemasolu", () => {
    const r = run({ lines: [line({ variant: "SET" })] });
    expect(find(r, "R-SET-01")[0].status).toBe("REVIEW");
    expect(r.overallStatus).toBe("REVIEW");
    expect(r.results.some((x) => /kõik komponendid/i.test(x.checked))).toBe(false);
  });

  it("SET on olemas kõigile üheksale koodile, kuid igaüks vajab koosseisu ülevaatust", () => {
    for (const code of ["02 10 04", "02 34 08"]) {
      const r = run({ lines: [line({ variant: "SET", code })] });
      expect(find(r, "R-PROD-01")[0].status).toBe("PASS");
      expect(find(r, "R-SET-01")[0].status).toBe("REVIEW");
    }
  });

  it("SET ei lähe mooduli ujukite kogusummasse", () => {
    expect(run({ lines: [line({ variant: "SET" })] }).expectedFloatsTotal).toBeNull();
  });
});

describe("ühendus, ankurdus, kaldaühendus, talv", () => {
  it("ühendatud moodulid ilma kirjelduseta -> täpsustus", () => {
    const r = run({ modulesConnected: "YES", lines: [line({ quantity: 2 })] });
    expect(find(r, "R-CONN-01")[0].status).toBe("MISSING");
    expect(find(r, "R-CONN-01")[0].question).toBeTruthy();
  });

  it("ühendatud moodulid kirjeldusega -> PASS, kuid kogust ei arvutata (puudub valem 2×(n-1))", () => {
    const r = run({ modulesConnected: "YES", connectionDescription: "Kõrvuti", lines: [line({ quantity: 3 })] });
    expect(find(r, "R-CONN-01")[0].status).toBe("PASS");
    const q = find(r, "R-CONN-02")[0];
    expect(q.status).toBe("MISSING");
    expect(q.expected).toBeNull(); // ühtegi ühenduskomponentide kogust ei järeldata
  });

  it("ühendus 'teadmata' -> täpsustus; 'ei' -> eraldi paigaldused", () => {
    expect(find(run({ modulesConnected: "UNKNOWN" }), "R-CONN-01")[0].status).toBe("MISSING");
    const r = run({ modulesConnected: "NO", lines: [line({ quantity: 3 })] });
    expect(find(r, "R-CONN-01")[0].checked).toMatch(/eraldi paigaldus/);
  });

  it("ankurdus: puudub -> täpsustus, vaiad/muu -> ülevaatus, kett ilma üksikasjadeta -> täpsustus", () => {
    expect(find(run({ anchoringType: null }), "R-ANCH-01")[0].status).toBe("MISSING");
    expect(find(run({ anchoringType: "PILES", anchoringDetails: "Ø60 mm, 1 kN" }), "R-ANCH-01")[0].status).toBe("PASS");
    expect(find(run({ anchoringType: "CONCRETE", anchoringDetails: "200 kg" }), "R-ANCH-01")[0].status).toBe("PASS");
    expect(find(run({ anchoringType: "CONCRETE", anchoringDetails: "" }), "R-ANCH-01")[0].status).toBe("MISSING");
    expect(find(run({ anchoringType: "OTHER", anchoringDetails: "kallasankur" }), "R-ANCH-01")[0].status).toBe("REVIEW");
    expect(find(run({ anchoringType: "CHAIN", anchoringDetails: "" }), "R-ANCH-01")[0].status).toBe("MISSING");
    expect(find(run({ anchoringType: "UNKNOWN" }), "R-ANCH-01")[0].status).toBe("MISSING");
  });

  it("kaldaühendus: andmed puuduvad -> täpsustus, ei määra hingesid", () => {
    const r = run({ shoreConnection: "YES" });
    const x = find(r, "R-SHORE-01")[0];
    expect(x.status).toBe("MISSING");
    expect(find(run({ shoreConnection: "YES", shoreDetailsUnknown: true }), "R-SHORE-01")[0].status).toBe("MISSING");
    expect(find(run({ shoreConnection: "YES", gangwayDetails: "1,2 x 4 m", shoreSupportDetails: "Betoonvundament" }), "R-SHORE-01")[0].status).toBe("PASS");
    expect(JSON.stringify(r)).not.toMatch(/10 14 00|10 15 00/);
  });

  it("talvekasutus selgelt soovitud -> ülevaatus viitega PDF-ile", () => {
    const x = find(run({ winterUse: true }), "R-WINTER-01")[0];
    expect(x.status).toBe("REVIEW");
    expect(x.source).toMatch(/PDF/);
    expect(x.source).toMatch(/lahti monteerida/);
    expect(find(run({ winterUse: false }), "R-WINTER-01")[0].status).toBe("NA");
  });
});

describe("kataloogi piirid ja allikate sisu", () => {
  it("laine / hoovus / paadi pikkus: ületamine -> ülevaatus, piiril -> vastab, puudub -> ei kontrollitud", () => {
    const over = run({ waveHeightM: 0.3, currentSpeedMs: 1.5, boatLengthM: 7 });
    for (const id of ["R-SITE-01", "R-SITE-02", "R-SITE-03"]) expect(find(over, id)[0].status).toBe("REVIEW");
    const edge = run({ waveHeightM: 0.2, currentSpeedMs: 1, boatLengthM: 6.1 });
    for (const id of ["R-SITE-01", "R-SITE-02", "R-SITE-03"]) expect(find(edge, id)[0].status).toBe("PASS");
    const none = run();
    for (const id of ["R-SITE-01", "R-SITE-02", "R-SITE-03"]) expect(find(none, id)[0].status).toBe("NA");
  });

  it("mudelite koormus, kaal ja vastuolulised kõrgus/vabaparras on kataloogis nähtavad", () => {
    const m = PRODUCTS.find((p) => p.internalId === "SP-021204-MODULE")!;
    expect([m.heightPdfM, m.heightWorkbookM, m.freeboardPdfM, m.freeboardWorkbookM]).toEqual([0.43, 0.39, 0.35, 0.34]);
    expect([m.loadKnPerM2, m.loadKg, m.weightKg]).toEqual([0.68, 670, 210]);
    expect(PRODUCTS.filter((p) => p.variant === "MODULE").every((p) => p.freeboardPdfM !== p.freeboardWorkbookM)).toBe(true);
  });

  it("uued tarvikud paigaldusjuhendist ja hinnakirjast ei ole mudelid (mõõte ei võrrelda)", () => {
    for (const code of ["10 30 00", "10 60 00", "02 90 00", "02 12 00"]) {
      const r = run({ lines: [line({ variant: "ACCESSORY", code, statedWidthM: 9 })] });
      expect(find(r, "R-PROD-01")[0].status).toBe("PASS");
      expect(find(r, "R-DIM-01")).toHaveLength(0);
    }
  });
});

describe("allikate vastuolud", () => {
  it("vaidlustatud omadusest sõltuv päring -> ülevaatus", () => {
    const r = run({ relevantProperties: ["HEIGHT", "LOAD"] });
    expect(find(r, "R-DISP-01").map((x) => x.status)).toEqual(["REVIEW", "REVIEW"]);
    expect(r.overallStatus).toBe("REVIEW");
  });

  it("vastuolud jäävad kataloogis nähtavaks isegi kui päring neist ei sõltu", () => {
    expect(find(run(), "R-DISP-01")[0].status).toBe("NA");
    expect(CONFLICTS.map((c) => c.property).sort()).toEqual(["FREEBOARD", "HEIGHT", "INTENDED_USE", "LOAD", "SUMMARY_WIDTH"]);
    expect(CONFLICTS.find((c) => c.property === "HEIGHT")!.description).toMatch(/0,43/);
    expect(CONFLICTS.find((c) => c.property === "HEIGHT")!.description).toMatch(/0,39/);
  });

  it("kõik mootori reegli-ID-d on andmetes aktiivsete reeglitena; keelatud reegleid ei rakendata", () => {
    const cases = [
      sub({ modulesConnected: "YES", lines: [line({ quantity: 2, statedWidthM: 3, statedFloatsPerModule: 6 }), line({ variant: "ACCESSORY", code: "02 73 00" }), line({ variant: "SET" }), line({ code: "99 99 99" }), line({ variant: null }), line({ variant: "ACCESSORY", code: "02 71 00" })], winterUse: true, relevantProperties: ["LOAD"], referenceText: "x", requestedDeliveryDate: null }),
    ];
    const active = new Set(RULES.filter((r) => r.status === "ACTIVE").map((r) => r.ruleId));
    for (const c of cases) {
      for (const res of runValidation(c, catalog, NOW).results) expect(active.has(res.ruleId), res.ruleId).toBe(true);
    }
    expect(RULES.filter((r) => r.status !== "ACTIVE").length).toBeGreaterThan(0);
  });
});

describe("päring vs tellimus", () => {
  const incompleteBase = {
    requestedDeliveryDate: null,
    anchoringType: null,
    shoreConnection: null,
    modulesConnected: "UNKNOWN" as const,
    lines: [] as LineInput[],
  };

  it("tarnekuupäev: tellimusel puudub -> MISSING, päringul ei kohaldu", () => {
    expect(find(run({ ...incompleteBase }), "R-META-02")[0].status).toBe("MISSING");
    expect(find(run({ ...incompleteBase, type: "ENQUIRY" }), "R-META-02")[0].status).toBe("NA");
  });

  it("päring pehmendab täielikkust, kuid ei lükka tagasi", () => {
    const order = run({ ...incompleteBase });
    const enq = run({ ...incompleteBase, type: "ENQUIRY" });
    expect(find(order, "R-ANCH-01")[0].status).toBe("MISSING");
    expect(find(enq, "R-ANCH-01")[0].status).toBe("MISSING");
    expect(find(order, "R-LINE-01")[0].status).toBe("MISSING");
    expect(find(enq, "R-LINE-01")[0].status).toBe("MISSING");
    expect(enq.overallText).toMatch(/ei ole tagasi lükatud/);
    expect(find(enq, "R-ANCH-01")[0].question).toBeTruthy();
  });
});

describe("näidisjuhtumid", () => {
  const [A, B, C] = buildDemoCases(NOW);

  it("A läbib realiseeritud kontrollid ja kinnitab ulatuse", () => {
    const r = runValidation(A.input, catalog, NOW);
    expect(r.overallStatus).toBe("PASS");
    expect(r.counts.MISSING + r.counts.WARNING + r.counts.REVIEW).toBe(0);
    expect(r.scope).toMatch(/ei ole Top Marine'i inseneri kinnitus/);
  });

  it("B annab konkreetsed täpsustused ning päringuks muutmine pehmendab käsitlust", () => {
    const r = runValidation(B.input, catalog, NOW);
    const ids = r.results.filter((x) => x.status === "MISSING").map((x) => x.ruleId);
    expect(ids).toEqual(expect.arrayContaining(["R-META-02", "R-CONN-01", "R-ANCH-01"]));
    const enq = runValidation({ ...B.input, type: "ENQUIRY" }, catalog, NOW);
    expect(find(enq, "R-META-02")[0].status).toBe("NA");
    expect(find(enq, "R-ANCH-01")[0].status).toBe("MISSING");
    expect(find(enq, "R-CONN-01")[0].status).toBe("MISSING"); // täpsustus säilib
    expect(enq.overallStatus).not.toBe("REVIEW");
  });

  it("C tuvastab laiuse ja ujukite lahknevuse ning jätab toote 02 12 04", () => {
    const r = runValidation(C.input, catalog, NOW);
    expect(find(r, "R-DIM-01")[0].status).toBe("CONFLICT");
    expect(find(r, "R-FLT-01")[0].status).toBe("CONFLICT");
    expect(find(r, "R-PROD-01")[0].supplied).toBe("02 12 04 MODULE");
  });

  it("demo kuupäevad on suhtelised laadimise ajaga", () => {
    const later = buildDemoCases(new Date("2027-03-01T00:00:00Z"));
    expect(A.input.requestedDeliveryDate).toBe("2026-12-27");
    expect(later[0].input.requestedDeliveryDate).toBe("2027-04-30");
  });
});

describe("muutumatud raportid", () => {
  it("raport ei jaga viiteid sisendiga: hilisem muutmine ei kirjuta varasemat raportit ümber", () => {
    const input = sub({ lines: [line({ statedWidthM: 3.0 })] });
    const snapshot = structuredClone(input);
    const report = runValidation(input, catalog, NOW);
    const frozen = JSON.stringify(report);
    input.lines[0].statedWidthM = 2.4;
    input.projectName = "Muudetud";
    expect(JSON.stringify(report)).toBe(frozen);
    expect(snapshot.lines[0].statedWidthM).toBe(3.0);
    const rerun = runValidation(input, catalog, new Date("2026-10-29T10:00:00Z"));
    expect(find(rerun, "R-DIM-01")[0].status).toBe("PASS");
    expect(find(report, "R-DIM-01")[0].status).toBe("CONFLICT");
    expect(report.rulesVersion).toBeTruthy();
    expect(report.generatedAt).toBe(NOW.toISOString());
  });
});
