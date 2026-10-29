import { LIMITS } from "./limits";
import type { IngestedDoc, TextUnit } from "./types";

export function ingestPaste(index: number, text: string): IngestedDoc {
  const truncated = text.length > LIMITS.maxPasteChars;
  const body = truncated ? text.slice(0, LIMITS.maxPasteChars) : text;
  const units: TextUnit[] = [];
  body.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (t) units.push({ id: `D${index}-U${units.length + 1}`, docIndex: index, locator: `rida ${i + 1}`, text: t });
  });
  return {
    index,
    fileName: "Kleebitud tekst",
    kind: "PASTE",
    byteSize: Buffer.byteLength(text),
    status: truncated ? "PARTIAL" : units.length ? "OK" : "UNREADABLE",
    message: truncated ? `Tekst lühendati ${LIMITS.maxPasteChars} märgini.` : units.length ? null : "Kleebitud tekst on tühi.",
    ocrUsed: false,
    units,
  };
}
