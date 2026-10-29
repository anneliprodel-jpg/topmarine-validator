import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { LIMITS } from "./limits";
import { ocrImages } from "./ocr";
import { IngestError, type IngestedDoc, type TextUnit } from "./types";

const MIN_TEXT_CHARS = 25; // lehel alla selle on kasutatav tekst puudu -> OCR

export async function ingestPdf(index: number, fileName: string, data: Uint8Array): Promise<IngestedDoc> {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(data));
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new IngestError("ENCRYPTED", "PDF on parooliga kaitstud.");
    throw new IngestError("CORRUPT", "PDF on vigane või ei ole loetav.");
  }
  try {
    const total = pdf.numPages;
    const pages = Math.min(total, LIMITS.maxPdfPages);
    const { text } = await extractText(pdf, { mergePages: false });
    const perPage = text as unknown as string[];
    const notes: string[] = [];
    let partial = total > pages;
    if (partial) notes.push(`PDF-is on ${total} lehte; loetud esimesed ${pages}.`);

    const units: TextUnit[] = [];
    const pageText: Record<number, string> = {};
    const ocrNeeded: number[] = [];
    for (let p = 1; p <= pages; p++) {
      const t = perPage[p - 1] ?? "";
      if (t.replace(/\s/g, "").length >= MIN_TEXT_CHARS) pageText[p] = t;
      else ocrNeeded.push(p);
    }

    let ocrUsed = false;
    const ocrResults: Record<number, string> = {};
    if (ocrNeeded.length) {
      const toOcr = ocrNeeded.slice(0, LIMITS.maxOcrPages);
      if (ocrNeeded.length > toOcr.length) {
        partial = true;
        notes.push(`${ocrNeeded.length} lehte vajab OCR-i; loetud ${toOcr.length} (piir ${LIMITS.maxOcrPages}).`);
      }
      const pngs: Uint8Array[] = [];
      for (const p of toOcr) {
        const img = await renderPageAsImage(pdf, p, { canvasImport: () => import("@napi-rs/canvas"), scale: LIMITS.ocrScale });
        pngs.push(new Uint8Array(img));
      }
      const texts = await ocrImages(pngs);
      toOcr.forEach((p, i) => (ocrResults[p] = texts[i] ?? ""));
      ocrUsed = true;
      notes.push("Skaneeritud lehed loeti OCR-iga; tekst võib sisaldada lugemisvigu.");
    }

    const push = (page: number, raw: string, ocr: boolean) => {
      raw.split(/\r?\n/).forEach((line, i) => {
        const t = line.trim();
        if (t) units.push({ id: `D${index}-U${units.length + 1}`, docIndex: index, locator: `lk ${page} rida ${i + 1}${ocr ? " (OCR)" : ""}`, text: t, ocr });
      });
    };
    for (let p = 1; p <= pages; p++) {
      if (pageText[p]) push(p, pageText[p], false);
      else if (ocrResults[p] !== undefined) push(p, ocrResults[p], true);
    }
    const emptyPages = ocrNeeded.filter((p) => ocrResults[p] !== undefined && !ocrResults[p].trim());
    if (emptyPages.length) {
      partial = true;
      notes.push(`Lehtedelt ${emptyPages.join(", ")} ei leitud teksti.`);
    }
    if (units.length === 0) throw new IngestError("UNREADABLE", "PDF-ist ei leitud teksti (ka OCR ei andnud tulemust).");
    return { index, fileName, kind: "PDF", byteSize: data.byteLength, status: partial ? "PARTIAL" : "OK", message: notes.join(" ") || null, ocrUsed, units };
  } finally {
    try {
      await (pdf as unknown as { destroy(): Promise<void> }).destroy();
    } catch {
      /* ignore */
    }
  }
}
