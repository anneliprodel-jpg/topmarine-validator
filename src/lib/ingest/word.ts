// Word: .docx (mammoth -> HTML -> lõigud/tabelid) ja vana .doc (word-extractor). Makrosid ei käivitata.
import mammoth from "mammoth";
import { parse, type HTMLElement } from "node-html-parser";
import WordExtractor from "word-extractor";
import { IngestError, type IngestedDoc, type TextUnit } from "./types";

const norm = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

export async function ingestDocx(index: number, fileName: string, data: Uint8Array): Promise<IngestedDoc> {
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer: Buffer.from(data) })).value;
  } catch {
    throw new IngestError("CORRUPT", "Docx-faili ei õnnestunud lugeda (vigane fail).");
  }
  const root = parse(html);
  const units: TextUnit[] = [];
  const add = (locator: string, text: string) => {
    if (text) units.push({ id: `D${index}-U${units.length + 1}`, docIndex: index, locator, text });
  };
  let para = 0;
  let tbl = 0;
  for (const node of root.childNodes) {
    const n = node as HTMLElement;
    const tag = (n.tagName ?? "").toLowerCase();
    if (tag === "table") {
      tbl += 1;
      n.querySelectorAll("tr").forEach((tr, ri) => {
        const cells = tr.querySelectorAll("td,th").map((c) => norm(c.text));
        if (cells.some(Boolean)) add(`tabel ${tbl} rida ${ri + 1}`, cells.join(" | "));
      });
    } else if (tag === "ul" || tag === "ol") {
      n.querySelectorAll("li").forEach((li) => {
        const t = norm(li.text);
        if (t) add(`lõik ${++para}`, t);
      });
    } else if (tag) {
      const t = norm(n.text);
      if (t) add(`lõik ${++para}`, t);
    }
  }
  if (!units.length) throw new IngestError("UNREADABLE", "Dokumendist ei leitud teksti.");
  return {
    index,
    fileName,
    kind: "DOCX",
    byteSize: data.byteLength,
    status: "OK",
    message: "Lõikude ja tabelite numbrid on dokumendisisesed (lehekülgi ei määrata).",
    ocrUsed: false,
    units,
  };
}

export async function ingestDoc(index: number, fileName: string, data: Uint8Array): Promise<IngestedDoc> {
  let body: string;
  try {
    const doc = await new WordExtractor().extract(Buffer.from(data));
    body = doc.getBody();
  } catch (e) {
    if (/password|encrypt/i.test(String((e as Error)?.message))) throw new IngestError("ENCRYPTED", "Doc-fail on parooliga kaitstud.");
    throw new IngestError("CORRUPT", "Doc-faili (Word 97-2003) ei õnnestunud lugeda.");
  }
  const units: TextUnit[] = [];
  let n = 0;
  for (const raw of body.split(/\r?\n|\r|\u000b/)) {
    // Tabelirakud on vanas formaadis eraldatud tabulaatoritega või lahtrimärgiga
    const t = norm(raw.replace(/\u0007/g, " | ").replace(/\t/g, " | ").replace(/(\s*\|\s*)+$/, "").replace(/^(\s*\|\s*)+/, ""));
    if (t) {
      n += 1;
      units.push({ id: `D${index}-U${units.length + 1}`, docIndex: index, locator: `lõik ${n}`, text: t });
    }
  }
  if (!units.length) throw new IngestError("UNREADABLE", "Dokumendist ei leitud teksti.");
  return {
    index,
    fileName,
    kind: "DOC",
    byteSize: data.byteLength,
    status: "OK",
    message: "Vana .doc vormingu lõigud on nummerdatud dokumendisiseselt; tabelid on loetud ridadena.",
    ocrUsed: false,
    units,
  };
}
