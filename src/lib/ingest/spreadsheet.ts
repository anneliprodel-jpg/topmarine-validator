// Excel (.xlsx ja vana .xls) SheetJS-iga. Makrosid ei käivitata. Lahtrite koordinaadid säilivad.
import * as XLSX from "xlsx";
import { LIMITS } from "./limits";
import { IngestError, type DocKind, type IngestedDoc, type TextUnit } from "./types";

const looksNumeric = (s: string) => /^[\s\d.,:+\-/%]+$/.test(s);

export function ingestSpreadsheet(index: number, fileName: string, data: Uint8Array, kind: DocKind): IngestedDoc {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(data, { type: "array", cellDates: true, cellFormula: false, cellHTML: false, cellNF: false, bookVBA: false, sheetRows: LIMITS.maxRowsPerSheet + 1 });
  } catch (e) {
    if (/password|encrypt/i.test(String((e as Error)?.message ?? ""))) throw new IngestError("ENCRYPTED", "Excel-fail on parooliga kaitstud.");
    throw new IngestError("CORRUPT", "Excel-faili ei õnnestunud lugeda (vigane või toetamata vorming).");
  }
  const units: TextUnit[] = [];
  const notes: string[] = [];
  let partial = false;
  const names = wb.SheetNames.slice(0, LIMITS.maxSheets);
  if (wb.SheetNames.length > names.length) {
    partial = true;
    notes.push(`Failis on ${wb.SheetNames.length} lehte; loetud esimesed ${names.length}.`);
  }
  const emptySheets: string[] = [];

  for (const name of names) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) {
      emptySheets.push(name);
      continue;
    }
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const merges = ws["!merges"] ?? [];
    const cellText = (r: number, c: number): string => {
      let cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) {
        // Mitmele reale ühendatud lahtri väärtus kehtib kõigil ridadel; ainult horisontaalselt ühendatud lahtri kordusi ei korrata
        const m = merges.find((mm) => r >= mm.s.r && r <= mm.e.r && c >= mm.s.c && c <= mm.e.c);
        if (m && m.e.r > m.s.r) cell = ws[XLSX.utils.encode_cell(m.s)];
      }
      if (!cell || cell.v === undefined || cell.v === null) return "";
      if (cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
      return String(cell.w ?? cell.v).trim();
    };
    const lastRow = Math.min(range.e.r, range.s.r + LIMITS.maxRowsPerSheet - 1);
    if (range.e.r > lastRow) {
      partial = true;
      notes.push(`Leht "${name}": loetud ${LIMITS.maxRowsPerSheet} rida.`);
    }
    const lastCol = Math.min(range.e.c, range.s.c + LIMITS.maxColsPerRow - 1);
    let header: string[] | null = null;
    let any = false;
    for (let r = range.s.r; r <= lastRow; r++) {
      const cells: { c: number; t: string }[] = [];
      for (let c = range.s.c; c <= lastCol; c++) {
        const t = cellText(r, c);
        if (t) cells.push({ c, t });
      }
      if (!cells.length) {
        header = null; // tühi rida lõpetab tabeli
        continue;
      }
      any = true;
      const addr = (c: number) => XLSX.utils.encode_cell({ r, c });
      const isHeader = !header && new Set(cells.map((x) => x.t)).size >= 3 && cells.every((x) => !looksNumeric(x.t));
      if (isHeader) {
        const h: string[] = [];
        cells.forEach((x) => (h[x.c] = x.t));
        header = h;
      }
      const parts = cells.map((x) => {
        const label = header && !isHeader && header[x.c] ? `${header[x.c]} ` : "";
        return `${label}[${addr(x.c)}]: ${x.t}`;
      });
      const span = `${addr(cells[0].c)}:${addr(cells[cells.length - 1].c)}`;
      units.push({
        id: `D${index}-U${units.length + 1}`,
        docIndex: index,
        locator: `Leht "${name}" rida ${r + 1} (${span})${isHeader ? " päis" : ""}`,
        text: parts.join(" | "),
      });
    }
    if (!any) emptySheets.push(name);
  }
  if (emptySheets.length) notes.push(`Tühjad lehed: ${emptySheets.join(", ")}.`);
  if (units.length === 0) throw new IngestError("UNREADABLE", "Excel-failis ei leitud ühtegi täidetud lahtrit.");
  return { index, fileName, kind, byteSize: data.byteLength, status: partial ? "PARTIAL" : "OK", message: notes.join(" ") || null, ocrUsed: false, units };
}
