// Serveripoolne tekstiväljavõte faili baitidest. Faili ei salvestata ega logita; töötlus on mälus.
import mammoth from "mammoth";
import PostalMime from "postal-mime";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT = 50_000;

export class ImportError extends Error {}

export interface Extracted {
  text: string;
  kind: "docx" | "pdf" | "eml" | "txt";
  notes: string[];
}

const startsWith = (buf: Uint8Array, bytes: number[]) => bytes.every((b, i) => buf[i] === b);

export async function extractFromFile(fileName: string, data: Uint8Array): Promise<Extracted> {
  if (data.byteLength === 0) throw new ImportError("Fail on tühi.");
  if (data.byteLength > MAX_BYTES) throw new ImportError("Fail on liiga suur (maksimaalselt 5 MB).");
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const notes: string[] = [];
  let text = "";
  let kind: Extracted["kind"];

  if (ext === "docx") {
    if (!startsWith(data, [0x50, 0x4b])) throw new ImportError("See ei ole kehtiv .docx fail.");
    kind = "docx";
    try {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(data) })).value;
    } catch {
      throw new ImportError("Docx-faili lugemine ebaõnnestus.");
    }
  } else if (ext === "pdf") {
    if (!startsWith(data, [0x25, 0x50, 0x44, 0x46])) throw new ImportError("See ei ole kehtiv PDF fail.");
    kind = "pdf";
    try {
      const pdf = await getDocumentProxy(new Uint8Array(data));
      text = (await extractPdfText(pdf, { mergePages: true })).text;
    } catch {
      throw new ImportError("PDF-i lugemine ebaõnnestus (fail võib olla parooliga kaitstud või vigane).");
    }
    if (text.replace(/\s/g, "").length < 20) {
      throw new ImportError("PDF-ist ei leitud teksti. Tõenäoliselt on see skaneeritud pilt - OCR-i rakendus ei toeta.");
    }
  } else if (ext === "eml") {
    kind = "eml";
    try {
      const mail = await PostalMime.parse(Buffer.from(data));
      const body = mail.text ?? (mail.html ? mail.html.replace(/<[^>]+>/g, " ") : "");
      text = [mail.subject ? `Teema: ${mail.subject}` : "", body].filter(Boolean).join("\n\n");
      if (mail.attachments?.length) {
        notes.push(`Kirjal on ${mail.attachments.length} manust (${mail.attachments.map((a) => a.filename ?? "nimetu").join(", ")}); neid ei loetud - lae need eraldi üles.`);
      }
    } catch {
      throw new ImportError("E-kirja (.eml) lugemine ebaõnnestus.");
    }
  } else if (ext === "txt") {
    kind = "txt";
    text = new TextDecoder("utf-8").decode(data);
  } else {
    throw new ImportError("Toetatud failitüübid: .docx, .pdf, .eml (e-kiri) ja .txt.");
  }

  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (!text) throw new ImportError("Failist ei leitud teksti.");
  if (text.length > MAX_TEXT) {
    text = text.slice(0, MAX_TEXT);
    notes.push(`Tekst lühendati ${MAX_TEXT} märgini.`);
  }
  return { text, kind, notes };
}
