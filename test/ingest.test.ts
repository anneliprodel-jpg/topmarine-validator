import { describe, expect, it } from "vitest";
import { detectKind, ingestFile, ingestPaste } from "@/lib/ingest";
import { LIMITS } from "@/lib/ingest/limits";
import { readFix } from "./helpers/scripted";

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const allText = (d: { units: { text: string }[] }) => squash(d.units.map((u) => u.text).join("\n"));

// Päris failid (SÜNTEETILISED, fiktiivne klient); .doc ja .docx on loodud Microsoft Wordiga, .xls on BIFF8 (SheetJS), skaneeritud PDF on pilt ilma tekstikihita.
describe("failide lugemine: sama tellimus erinevates vormingutes", () => {
  const cases: [string, string, boolean][] = [
    ["order-a.pdf", "PDF", false],
    ["order-a-scanned.pdf", "PDF", true],
    ["order-a.xlsx", "XLSX", false],
    ["order-a.xls", "XLS", false],
    ["order-a.docx", "DOCX", false],
    ["order-a.doc", "DOC", false],
  ];
  it.each(cases)("%s -> %s (OCR: %s)", async (file, kind, ocr) => {
    const d = await ingestFile(1, file, readFix(file));
    expect(d.status).toBe("OK");
    expect(d.kind).toBe(kind);
    expect(d.ocrUsed).toBe(ocr);
    const t = allText(d);
    expect(t).toMatch(/02120?4|021204/); // kood (OCR võib tühikud kaotada)
    expect(t).toContain("näidissadam2027");
    expect(t).toContain("15.05.2027");
    expect(t).toContain("ketiankur");
    expect(d.units.every((u) => u.id.startsWith("D1-U") && u.locator.length > 0)).toBe(true);
    if (ocr) expect(d.units.every((u) => u.ocr && u.locator.includes("OCR"))).toBe(true);
  }, 120_000);

  it("asukohaviited: PDF lk/rida, Excel leht+lahtrid, Word lõik/tabel", async () => {
    const pdf = await ingestFile(1, "order-a.pdf", readFix("order-a.pdf"));
    expect(pdf.units.find((u) => /02 12 04/.test(u.text))!.locator).toMatch(/^lk 1 rida \d+$/);
    const x = await ingestFile(1, "order-a.xlsx", readFix("order-a.xlsx"));
    const row = x.units.find((u) => /02 12 04/.test(u.text))!;
    expect(row.locator).toContain('Leht "Tellimus" rida 7 (A7:G7)');
    expect(row.text).toContain("[A7]: 02 12 04");
    expect(row.text).toContain("Kogus [D7]: 2");
    const w = await ingestFile(1, "order-a.docx", readFix("order-a.docx"));
    expect(w.units.find((u) => /02 12 04/.test(u.text))!.locator).toBe("tabel 1 rida 2");
    const doc = await ingestFile(1, "order-a.doc", readFix("order-a.doc"));
    expect(doc.units.find((u) => /02 12 04/.test(u.text))!.locator).toMatch(/^lõik \d+$/);
  });

  it("Excel: tühi esimene leht ei peata lugemist, mitu lehte säilivad, ühendatud päis ei ole veerupäis, 'Märkused' leht on loetud", async () => {
    const x = await ingestFile(1, "order-a.xls", readFix("order-a.xls"));
    expect(x.message).toContain("Tühjad lehed: Kaas");
    expect(x.units.some((u) => u.locator.includes('Leht "Märkused"'))).toBe(true);
    expect(x.units[0].locator).not.toContain("päis"); // ühendatud pealkirjarida
    expect(x.units.some((u) => u.locator.includes("päis") && u.text.includes("Kogus"))).toBe(true);
  });

  it("OCR: skaneeritud PDF-ist leiab koodi ja märgib read OCR-iga loetuks", async () => {
    const d = await ingestFile(1, "order-a-scanned.pdf", readFix("order-a-scanned.pdf"));
    expect(d.message).toContain("OCR");
    expect(d.units.some((u) => /0\s?2\s?1\s?2\s?0\s?4/.test(u.text))).toBe(true);
  }, 120_000);
});

describe("vigased, toetamata ja liiga suured failid", () => {
  it("vigane docx/pdf ja ümber nimetatud fail -> CORRUPT, kunagi tühi eduka tulemusena", async () => {
    for (const f of ["corrupted.docx", "corrupted.pdf", "fake.xlsx"]) {
      const d = await ingestFile(1, f, readFix(f));
      expect(d.status, f).toBe("CORRUPT");
      expect(d.units).toHaveLength(0);
      expect(d.message).toBeTruthy();
    }
  });
  it("toetamata laiend, tühi fail, liiga suur fail", async () => {
    expect((await ingestFile(1, "a.exe", new Uint8Array([1, 2, 3]))).status).toBe("UNSUPPORTED");
    expect((await ingestFile(1, "a.pdf", new Uint8Array())).status).toBe("UNREADABLE");
    expect((await ingestFile(1, "a.pdf", new Uint8Array(LIMITS.maxFileBytes + 1))).status).toBe("TOO_LARGE");
  });
  it("OLE-konteiner .xlsx laiendiga loetakse parooliga kaitstud Office-failiks", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect((await ingestFile(1, "salajane.xlsx", ole)).status).toBe("ENCRYPTED");
    expect(detectKind("a.docx", ole)).toBeNull();
  });
  it("makrotega või käivitatava sisuga faili ei käivitata (ainult tekstiväljavõte)", async () => {
    const d = await ingestFile(1, "makro.xlsm", new Uint8Array([0x50, 0x4b, 3, 4]));
    expect(d.status).toBe("UNSUPPORTED");
  });
});

describe("kleebitud tekst", () => {
  it("rida-viited ja tühja teksti tagasilükkamine", () => {
    const d = ingestPaste(1, "esimene\n\nteine rida");
    expect(d.units.map((u) => u.locator)).toEqual(["rida 1", "rida 3"]);
    expect(ingestPaste(1, "   \n ").status).toBe("UNREADABLE");
  });
  it("liiga pikk tekst lühendatakse ja märgitakse osaliseks", () => {
    const d = ingestPaste(1, "x".repeat(LIMITS.maxPasteChars + 10));
    expect(d.status).toBe("PARTIAL");
  });
});
