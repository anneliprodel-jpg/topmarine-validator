export type DocKind = "PASTE" | "PDF" | "XLSX" | "XLS" | "DOCX" | "DOC";
export type DocStatus = "OK" | "PARTIAL" | "UNREADABLE" | "UNSUPPORTED" | "ENCRYPTED" | "TOO_LARGE" | "CORRUPT";

/** Üks viidatav tekstilõik (rida, lõik, tabeli rida, arvutustabeli rida). */
export interface TextUnit {
  id: string; // D{doc}-U{n}
  docIndex: number;
  locator: string; // inimloetav asukoht, nt "lk 2 rida 5" või "Leht Tellimus rida 7 (A7:D7)"
  text: string;
  ocr?: boolean;
}

export interface IngestedDoc {
  index: number;
  fileName: string;
  kind: DocKind | null;
  byteSize: number;
  status: DocStatus;
  message: string | null;
  ocrUsed: boolean;
  units: TextUnit[];
}

export const STATUS_TEXT: Record<DocStatus, string> = {
  OK: "Loetud",
  PARTIAL: "Loetud osaliselt",
  UNREADABLE: "Ei õnnestunud lugeda",
  UNSUPPORTED: "Toetamata failitüüp",
  ENCRYPTED: "Parooliga kaitstud",
  TOO_LARGE: "Liiga suur",
  CORRUPT: "Vigane fail",
};

/** Dokument, mis ei ole täielikult loetud, välistab tingimusteta järelduse "kõik dokumendid kontrollitud". */
export const isFullyRead = (d: Pick<IngestedDoc, "status">) => d.status === "OK";

export class IngestError extends Error {
  constructor(
    public status: DocStatus,
    message: string,
  ) {
    super(message);
  }
}
