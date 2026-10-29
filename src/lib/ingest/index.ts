import { LIMITS, withTimeout } from "./limits";
import { ingestPdf } from "./pdf";
import { ingestSpreadsheet } from "./spreadsheet";
import { IngestError, type DocKind, type IngestedDoc } from "./types";
import { ingestDoc, ingestDocx } from "./word";
export { ingestPaste } from "./paste";

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);
const ZIP = [0x50, 0x4b];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PDF = [0x25, 0x50, 0x44, 0x46];

export function detectKind(fileName: string, data: Uint8Array): DocKind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" && startsWith(data, PDF)) return "PDF";
  if (ext === "xlsx" && startsWith(data, ZIP)) return "XLSX";
  if (ext === "docx" && startsWith(data, ZIP)) return "DOCX";
  if (ext === "xls" && startsWith(data, OLE)) return "XLS";
  if (ext === "doc" && startsWith(data, OLE)) return "DOC";
  return null;
}

function failed(index: number, fileName: string, size: number, status: IngestedDoc["status"], message: string): IngestedDoc {
  return { index, fileName, kind: null, byteSize: size, status, message, ocrUsed: false, units: [] };
}

/** Loeb ühe faili. Ei viska: probleemid kajastuvad dokumendi olekus ja eestikeelses teates. */
export async function ingestFile(index: number, fileName: string, data: Uint8Array): Promise<IngestedDoc> {
  const size = data.byteLength;
  if (size === 0) return failed(index, fileName, size, "UNREADABLE", "Fail on tühi.");
  if (size > LIMITS.maxFileBytes) return failed(index, fileName, size, "TOO_LARGE", `Fail on liiga suur (piir ${LIMITS.maxFileBytes / 1024 / 1024} MB).`);
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (!["pdf", "xlsx", "xls", "docx", "doc"].includes(ext)) {
    return failed(index, fileName, size, "UNSUPPORTED", "Toetatud failitüübid: PDF, Excel (.xlsx, .xls) ja Word (.docx, .doc).");
  }
  const kind = detectKind(fileName, data);
  if (!kind) {
    // OLE-konteiner .xlsx/.docx laiendiga on parooliga kaitstud Office-fail
    if ((ext === "xlsx" || ext === "docx") && startsWith(data, OLE)) return failed(index, fileName, size, "ENCRYPTED", "Fail on parooliga kaitstud.");
    return failed(index, fileName, size, "CORRUPT", "Faili sisu ei vasta laiendile (fail võib olla vigane või ümber nimetatud).");
  }
  try {
    const work =
      kind === "PDF"
        ? ingestPdf(index, fileName, data)
        : kind === "DOCX"
          ? ingestDocx(index, fileName, data)
          : kind === "DOC"
            ? ingestDoc(index, fileName, data)
            : Promise.resolve().then(() => ingestSpreadsheet(index, fileName, data, kind));
    return await withTimeout(work, LIMITS.fileTimeoutMs, () => new IngestError("UNREADABLE", "Faili lugemine ületas ajalimiidi."));
  } catch (e) {
    if (e instanceof IngestError) return failed(index, fileName, size, e.status, e.message);
    console.error("ingest failed", kind, e instanceof Error ? e.message : "viga");
    return failed(index, fileName, size, "UNREADABLE", "Faili lugemine ebaõnnestus ootamatu vea tõttu.");
  }
}
