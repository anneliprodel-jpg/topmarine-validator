import type { LineInput, SubmissionInput } from "./validation/types";

export interface DemoCase {
  key: "A" | "B" | "C";
  title: string;
  description: string;
  input: SubmissionInput;
}

const base = (): SubmissionInput => ({
  type: "ORDER",
  projectName: "",
  customerName: "Näidis Edasimüüja OÜ (fiktiivne)",
  requestedDeliveryDate: null,
  referenceText: "",
  comments: "Näidisjuhtum - fiktiivsed andmed.",
  lines: [],
  modulesConnected: "NO",
  connectionDescription: "",
  connectionComponents: "",
  connectionQuantitiesUnknown: false,
  anchoringType: "CHAIN",
  anchoringDetails: "",
  shoreConnection: "NO",
  gangwayDetails: "",
  shoreSupportDetails: "",
  shoreDetailsUnknown: false,
  siteNotes: "",
  winterUse: null,
  relevantProperties: [],
});

const line = (o: Partial<LineInput>): LineInput => ({
  variant: "MODULE",
  code: "02 12 04",
  customName: null,
  quantity: 1,
  statedWidthM: null,
  statedLengthM: null,
  statedFloatsPerModule: null,
  ...o,
});

export function relativeDate(now: Date, days: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
}

/** Näidisjuhtumid; kuupäevad on seotud laadimise hetkega. */
export function buildDemoCases(now: Date = new Date()): DemoCase[] {
  return [
    {
      key: "A",
      title: "A: Standardne moodul 02 12 04",
      description:
        "Täielik tellimus: MODULE 02 12 04, kogus 1, kliendi märgitud 2,4 x 4 m ja 4 ujukit, ketiankurdus, ilma kaldaühenduseta ja ilma moodulite ühenduseta. Peaks läbima rakenduses realiseeritud kontrollid (inseneri sobivust ei hinnata).",
      input: {
        ...base(),
        projectName: "Näidis A: Sadamakai ponton",
        requestedDeliveryDate: relativeDate(now, 60),
        anchoringDetails: "Ketiankurdus, kinnitus kai äärde (näidisandmed)",
        lines: [line({ statedWidthM: 2.4, statedLengthM: 4, statedFloatsPerModule: 4 })],
      },
    },
    {
      key: "B",
      title: "B: Mittetäielik tellimus, ühendatud moodulid",
      description:
        "Kaks moodulit, mis kavatsetakse ühendada; puudub tarnekuupäev, ühenduse kirjeldus ja ankurduse üksikasjad. Muuda tüüp päringuks, et näha pehmendatud täielikkuse käsitlust.",
      input: {
        ...base(),
        projectName: "Näidis B: Ühendatud ponton",
        requestedDeliveryDate: null,
        modulesConnected: "YES",
        lines: [line({ quantity: 2 })],
      },
    },
    {
      key: "C",
      title: "C: Vastuolulised kliendi andmed",
      description:
        "Valitud MODULE 02 12 04 (2,4 m, 4 ujukit), kuid klient märkis laiuseks 3,0 m ja 6 ujukit. Mõlemad lahknevused tuleb tuvastada; toodet ei vahetata automaatselt.",
      input: {
        ...base(),
        projectName: "Näidis C: Vastuolulised andmed",
        requestedDeliveryDate: relativeDate(now, 45),
        anchoringDetails: "Ketiankurdus (näidisandmed)",
        lines: [line({ statedWidthM: 3.0, statedFloatsPerModule: 6 })],
      },
    },
  ];
}
