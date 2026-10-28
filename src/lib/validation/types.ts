export type SubmissionType = "ENQUIRY" | "ORDER";
export type Tri = "YES" | "NO" | "UNKNOWN";
export type LineVariant = "MODULE" | "SET" | "ACCESSORY" | "CUSTOM";
export type AnchoringType = "CHAIN" | "PILES" | "CONCRETE" | "OTHER" | "UNKNOWN";
export type DisputedProperty = "HEIGHT" | "FREEBOARD" | "LOAD";

export interface LineInput {
  variant: LineVariant | null;
  code: string | null;
  customName: string | null;
  quantity: number | null;
  /** Kliendi märgitud väärtused - eraldi kataloogi andmetest. null = puudub (mitte 0). */
  statedWidthM: number | null;
  statedLengthM: number | null;
  statedFloatsPerModule: number | null;
}

export interface SubmissionInput {
  type: SubmissionType;
  projectName: string;
  customerName: string;
  requestedDeliveryDate: string | null; // YYYY-MM-DD
  referenceText: string;
  comments: string;
  lines: LineInput[];
  modulesConnected: Tri | null;
  connectionDescription: string;
  connectionComponents: string;
  connectionQuantitiesUnknown: boolean;
  anchoringType: AnchoringType | null;
  anchoringDetails: string;
  shoreConnection: Tri | null;
  gangwayDetails: string;
  shoreSupportDetails: string;
  shoreDetailsUnknown: boolean;
  siteNotes: string;
  winterUse: boolean | null;
  /** Valikulised asukoha andmed; null = ei täpsustatud (mitte 0). */
  waveHeightM: number | null;
  currentSpeedMs: number | null;
  boatLengthM: number | null;
  relevantProperties: DisputedProperty[];
}

export interface CatalogProduct {
  internalId: string;
  code: string;
  variant: "MODULE" | "SET" | "ACCESSORY";
  kind: "MODEL" | "ACCESSORY";
  name: string;
  widthM: number | null;
  lengthM: number | null;
  floatsPerModule: number | null;
  reviewRequired: boolean;
  sourceLabel: string;
}

export type CheckStatus = "PASS" | "MISSING" | "WARNING" | "REVIEW" | "NA";

export interface CheckResult {
  ruleId: string;
  title: string;
  status: CheckStatus;
  checked: string;
  supplied: string | null;
  expected: string | null;
  source: string;
  question: string | null;
  lineNumber: number | null;
}

export interface ValidationReport {
  rulesVersion: string;
  submissionType: SubmissionType;
  generatedAt: string;
  overallStatus: CheckStatus;
  overallText: string;
  counts: Record<CheckStatus, number>;
  expectedFloatsTotal: number | null;
  results: CheckResult[];
  scope: string;
}

export const STATUS_LABEL: Record<CheckStatus, string> = {
  PASS: "Vastab",
  MISSING: "Puuduv info",
  WARNING: "Hoiatus",
  REVIEW: "Vajab inseneri ülevaatust",
  NA: "Ei kohaldu",
};

export const STATUS_SYMBOL: Record<CheckStatus, string> = {
  PASS: "✔",
  MISSING: "?",
  WARNING: "▲",
  REVIEW: "⚑",
  NA: "–",
};

export const SCOPE_STATEMENT =
  "Positiivne tulemus (Vastab) tähendab ainult seda, et selles rakenduses realiseeritud kontrollid läbiti. See ei ole Top Marine'i inseneri kinnitus ega hinnang konstruktsiooni, ankurduse, kandevõime ega sobivuse kohta. Demo õppetööks.";
