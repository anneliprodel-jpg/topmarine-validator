/** Väite allikaviide: dokument, asukoht ja täpne katkend (väärtus on alati jälgitav tekstini). */
export interface Evidence {
  docIndex: number;
  fileName: string;
  locator: string;
  excerpt: string;
  original: string | null;
  ocr: boolean;
}

/** Välja võti -> allikaviited. Võtmed: projectName, requestedDeliveryDate, lines.0.quantity jne. */
export type EvidenceMap = Record<string, Evidence[]>;

export interface ConflictAlt {
  value: string;
  evidence: Evidence[];
}
/** Välja võti -> dokumentide vahelised vastuolulised väärtused (lahendamata). */
export type ConflictMap = Record<string, ConflictAlt[]>;

export interface DocSummary {
  index: number;
  fileName: string;
  kind: string | null;
  status: string;
  message: string | null;
  ocrUsed: boolean;
}
