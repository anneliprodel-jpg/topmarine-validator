// Versioneeritud kataloogi- ja reeglite andmed (allikas tõest). Seed kirjutab need andmebaasi.
// Hindu ei impordita. Ainult vajalikud tootetunnused ja tehnilised andmed koos allikaviidetega.
// Ei impordi ega kasuta aliaseid ("@/") - seda faili loeb ka tsx-seed.

export type EvidenceStatus = "CORROBORATED" | "SINGLE_SOURCE" | "DISPUTED" | "ASSUMPTION";
export type ProductVariantKind = "MODULE" | "SET" | "ACCESSORY";
export type RuleStatus = "ACTIVE" | "DISABLED" | "UNCONFIRMED";

export const RULES_VERSION = "1.0.0";

export const EVIDENCE_LABELS: Record<EvidenceStatus, string> = {
  CORROBORATED: "Kinnitatud mitmest allikast",
  SINGLE_SOURCE: "Üks allikas (viiteinfo)",
  DISPUTED: "Vaidlustatud / vastuolu allikate vahel",
  ASSUMPTION: "MVP töövoo eeldus (mitte kontrollitud ettevõtte reegel)",
};

export interface SourceData {
  key: string;
  filename: string;
  location: string;
  sourceDate: string | null;
  evidenceStatus: EvidenceStatus;
  note: string | null;
}

export const SOURCES: SourceData[] = [
  {
    key: "PDF_P3",
    filename: "Swimming Pontoon with Plastic Floats.pdf",
    location: "lk 3, tehniliste andmete tabel (mudelid, piirangud, ankurdussüsteemid)",
    sourceDate: "01.01.2023 (revisjon)",
    evidenceStatus: "CORROBORATED",
    note: "Üheksa mudeli pikkus, laius, ujukite arv, koormus ja kaal ühtivad 2026. a SP hinnakirja tehnilise tabeliga. Kõrgus ja vabaparras erinevad.",
  },
  {
    key: "PDF_P2",
    filename: "Swimming Pontoon with Plastic Floats.pdf",
    location: "lk 2, komponentide kirjeldused ja ühendusvõimalused",
    sourceDate: "01.01.2023 (revisjon)",
    evidenceStatus: "SINGLE_SOURCE",
    note: "Ühendused (otsa-, külje-, L-, T-ühendus), kettankurdus, vaiankurdus (Ø60 mm, 1 kN), ligipääsusild kuni 4 m, piirded, ujukid 220 l.",
  },
  {
    key: "XLSX_SP",
    filename: "Top Marine Dealer Price list EUR 2026.xlsx",
    location:
      "leht SP: SET-read 3-11, SET näide 13-19, moodulid 21-29, puitkatted 31-39, ujukid/liitmik/külgkate 40-45, tehniline tabel 49-57",
    sourceDate: "2026",
    evidenceStatus: "CORROBORATED",
    note: "Kasutatud ainult kataloogina (kood, nimi, tehnilised andmed). Hindu ei impordita ega kuvata.",
  },
  {
    key: "XLSX_SELECTION",
    filename: "Selection of pontoons.xlsx",
    location: "Sheet1, veerg C (SP 220 ltr), nt C11, C12, C13, C14, C16-C23",
    sourceDate: null,
    evidenceStatus: "DISPUTED",
    note: "Kokkuvõttetabel on detailtabelitega vastuolus (laius, kõrgus, vabaparras, koormus). Ketid, ankrud, vai, laine ja paadi pikkus ühtivad PDF-iga.",
  },
  {
    key: "PDF_ASSEMBLY",
    filename: "Swimming Pontoon Assembly instructions_ENG.pdf",
    location: "sisukord ja lehed 1/7-7/7: ainult komponentide koodid ja nimetused",
    sourceDate: "19.08.2024 (joonise kuupäev)",
    evidenceStatus: "SINGLE_SOURCE",
    note: "Märgitud CONFIDENTIAL / PROPRIETARY: jooniseid ega nende sisu ei salvestata. Joonis ei ole universaalne komplekti koosseis (BOM).",
  },
  {
    key: "MVP_ASSUMPTION",
    filename: "MVP töövoo eeldus",
    location: "Tootejuht / õppetöö projekt",
    sourceDate: null,
    evidenceStatus: "ASSUMPTION",
    note: "Ei ole kontrollitud Top Marine'i poliitika.",
  },
];

export interface ProductData {
  internalId: string;
  code: string; // string, ei kaota eesnulle
  variant: ProductVariantKind;
  kind: "MODEL" | "ACCESSORY";
  name: string;
  widthM: number | null;
  lengthM: number | null;
  floatsPerModule: number | null;
  floatVolumeL: number | null;
  /** Kõrgus ja vabaparras allikati eraldi (vastuolulised, ei valita ühte). */
  heightPdfM: number | null;
  heightWorkbookM: number | null;
  freeboardPdfM: number | null;
  freeboardWorkbookM: number | null;
  /** Mudelipõhine arvutuslik koormus ja kaal: PDF ja hinnakiri ühtivad. Ainult viiteinfo, sobivust ei kontrollita. */
  loadKnPerM2: number | null;
  loadKg: number | null;
  weightKg: number | null;
  sourceKey: string;
  sourceLocation: string;
  evidenceStatus: EvidenceStatus;
  reviewRequired: boolean;
  notes: string | null;
  sortOrder: number;
}

/** [kood, laius, pikkus, ujukeid, freeboard PDF, freeboard hinnakiri, kN/m², kg, kaal kg] */
const MODEL_ROWS: Array<[string, number, number, number, number, number, number, number, number]> = [
  ["02 10 04", 2.0, 4, 4, 0.36, 0.35, 0.84, 688, 192],
  ["02 12 04", 2.4, 4, 4, 0.35, 0.34, 0.68, 670, 210],
  ["02 14 04", 3.0, 4, 4, 0.34, 0.33, 0.52, 632, 248],
  ["02 20 06", 2.0, 5, 6, 0.37, 0.35, 1.05, 1068, 252],
  ["02 22 06", 2.4, 5, 6, 0.36, 0.35, 0.86, 1046, 274],
  ["02 24 06", 3.0, 5, 6, 0.35, 0.34, 0.65, 1000, 320],
  ["02 30 08", 2.0, 6, 8, 0.37, 0.35, 1.18, 1448, 312],
  ["02 32 08", 2.4, 6, 8, 0.37, 0.35, 0.97, 1422, 338],
  ["02 34 08", 3.0, 6, 8, 0.36, 0.34, 0.75, 1367, 393],
];

const fmtDim = (n: number) => n.toFixed(1).replace(".", ",");

const modelBase = (row: (typeof MODEL_ROWS)[number], i: number) => {
  const [code, w, l, f, fbPdf, fbXls, kn, kg, weight] = row;
  return {
    code,
    kind: "MODEL" as const,
    widthM: w,
    lengthM: l,
    floatsPerModule: f,
    floatVolumeL: 220,
    heightPdfM: 0.43,
    heightWorkbookM: 0.39,
    freeboardPdfM: fbPdf,
    freeboardWorkbookM: fbXls,
    loadKnPerM2: kn,
    loadKg: kg,
    weightKg: weight,
    i,
    w,
    l,
  };
};

const moduleProducts: ProductData[] = MODEL_ROWS.map((row, i) => {
  const { w, l, i: _i, ...b } = modelBase(row, i);
  return {
    ...b,
    internalId: `SP-${b.code.replace(/ /g, "")}-MODULE`,
    variant: "MODULE" as const,
    name: `SP ponton plastujukitega ${fmtDim(w)} x ${l} m (moodul)`,
    sourceKey: "PDF_P3",
    sourceLocation: `PDF lk 3 tehniline tabel; hinnakiri SP leht moodulirida ${21 + i} ja tehniline rida ${49 + i}`,
    evidenceStatus: "CORROBORATED" as const,
    reviewRequired: false,
    notes: "Mõõdud, ujukite arv, koormus ja kaal ühtivad kahes allikas. Kõrgus ja vabaparras on allikate vahel vastuolus.",
    sortOrder: 10 + i,
  };
});

// Hinnakirja read 3-11 on SET-id kõigi üheksa koodi jaoks (sama kood mis moodulil).
const setProducts: ProductData[] = MODEL_ROWS.map((row, i) => {
  const { w, l, i: _i, ...b } = modelBase(row, i);
  return {
    ...b,
    internalId: `SP-${b.code.replace(/ /g, "")}-SET`,
    variant: "SET" as const,
    name: `SP ponton plastujukitega ${fmtDim(w)} x ${l} m (komplekt / SET)`,
    sourceKey: "XLSX_SP",
    sourceLocation: `hinnakiri SP leht SET-rida ${3 + i}${i === 1 ? " (komponentide näide read 13-19)" : ""}`,
    evidenceStatus: "SINGLE_SOURCE" as const,
    reviewRequired: true,
    notes:
      i === 1
        ? "Näide (read 13-19): puitkate 02 12 00 x1, ujukid 02 73 00 x4, kummiliitmikud 02 80 00 x2, ligipääsusild 10 10 00 x1, sirge hing 10 14 00 x2, F-hing 10 15 00 x2. Tõend ainult selle ühe näite kohta - üldist komplekti koosseisu ei järeldata. SET koosseis vajab ülevaatust."
        : "SET koosseis ei ole kinnitatud (ainult koodil 02 12 04 on komponentide näide). SET koosseis vajab ülevaatust.",
    sortOrder: 30 + i,
  };
});

const accessory = (
  code: string,
  name: string,
  sortOrder: number,
  opts: Partial<Pick<ProductData, "reviewRequired" | "notes" | "sourceKey" | "sourceLocation">> = {},
): ProductData => ({
  internalId: `SP-${code.replace(/ /g, "")}-ACCESSORY`,
  code,
  variant: "ACCESSORY",
  kind: "ACCESSORY",
  name,
  widthM: null,
  lengthM: null,
  floatsPerModule: null,
  floatVolumeL: null,
  heightPdfM: null,
  heightWorkbookM: null,
  freeboardPdfM: null,
  freeboardWorkbookM: null,
  loadKnPerM2: null,
  loadKg: null,
  weightKg: null,
  sourceKey: opts.sourceKey ?? "XLSX_SP",
  sourceLocation: opts.sourceLocation ?? "hinnakiri SP leht, read 31-45",
  evidenceStatus: "SINGLE_SOURCE",
  reviewRequired: opts.reviewRequired ?? false,
  notes: opts.notes ?? "Tarvik. Kohustuslikkust ja kogust ei järeldata dokumendis esinemisest.",
  sortOrder,
});

const ASSEMBLY = (page: string) => ({
  sourceKey: "PDF_ASSEMBLY",
  sourceLocation: `paigaldusjuhend ${page}, ainult komponendi kood ja nimetus`,
});

const accessories: ProductData[] = [
  accessory("02 73 00", "SP ujuk 220 liitrit (uus tüüp)", 60, { sourceLocation: "hinnakiri SP leht, rida 42" }),
  accessory("02 74 00", "SP ujuk 220 liitrit, EPS-iga", 61, { sourceLocation: "hinnakiri SP leht, rida 43" }),
  accessory("02 80 00", "SP kummiliitmik (rubber joint)", 62, { sourceLocation: "hinnakiri SP leht, rida 44; paigaldusjuhend 6/7" }),
  accessory("10 10 00", "SP puidust ligipääsusild 1,2 x 4 m (gangway)", 63, { sourceLocation: "hinnakiri SP leht, SET näite rida 17" }),
  accessory("10 14 00", "Sirge hing ECO (SP tarvik, ei ole ECO ponton)", 64, {
    sourceLocation: "hinnakiri SP leht, SET näite rida 18; paigaldusjuhend 3/7",
  }),
  accessory("10 15 00", "F-hing ECO (SP tarvik, ei ole ECO ponton)", 65, {
    sourceLocation: "hinnakiri SP leht, SET näite rida 19; paigaldusjuhend 4/7",
  }),
  accessory("17 50 00", "SP ketikinnitus (chain fixing)", 66, ASSEMBLY("7/7")),
  accessory("10 30 00", "Piire 800 x 4 m, 3 hoidikut (Railing)", 67, ASSEMBLY("2/7")),
  accessory("10 60 00", "Maapiilarid ligipääsusillale 60 x 1500, 4 tk (Ground piles for timber ramp)", 68, ASSEMBLY("5/7")),
  accessory("02 90 00", "Külje puitkate 250 mm, 1 m (Side timber deck)", 69, { sourceLocation: "hinnakiri SP leht, rida 45" }),
  accessory("02 71 00", "Vana tüüpi ujuk (ei ole 02 73 00 asendus)", 70, {
    sourceLocation: "hinnakiri SP leht, rida 40 (OLD TYPE)",
    reviewRequired: true,
    notes: "Vana tüüpi ujukit ei käsitleta ilma ülevaatuseta asendajana.",
  }),
  accessory("02 72 00", "Vana tüüpi ujuk EPS-iga (ei ole 02 74 00 asendus)", 71, {
    sourceLocation: "hinnakiri SP leht, rida 41 (OLD TYPE with EPS)",
    reviewRequired: true,
    notes: "Vana tüüpi ujukit ei käsitleta ilma ülevaatuseta asendajana.",
  }),
  // Puitkatted ilma ujukiteta (hinnakiri SP leht, read 31-39). Ainult varuosa/tarvik; mõõte ei võrrelda.
  ...(
    [
      ["02 10 00", "2,0 x 4 m", 31],
      ["02 12 00", "2,4 x 4 m", 32],
      ["02 14 00", "3,0 x 4 m", 33],
      ["02 20 00", "2,0 x 5 m", 34],
      ["02 22 00", "2,4 x 5 m", 35],
      ["02 24 00", "3,0 x 5 m", 36],
      ["02 30 00", "2,0 x 6 m", 37],
      ["02 32 00", "2,4 x 6 m", 38],
      ["02 34 00", "3,0 x 6 m", 39],
    ] as const
  ).map(([code, size, row], i) =>
    accessory(code, `SP puitkate ${size} (ainult kate, ilma ujukiteta)`, 80 + i, {
      sourceLocation: `hinnakiri SP leht, rida ${row}`,
      notes: "Eraldi puitkate on varuosa/tarvik; ei ole täielik moodul. Mõõte ei võrrelda automaatselt.",
    }),
  ),
];

export const PRODUCTS: ProductData[] = [...moduleProducts, ...setProducts, ...accessories];

export interface ConflictData {
  key: string;
  property: "HEIGHT" | "FREEBOARD" | "LOAD" | "SUMMARY_WIDTH" | "INTENDED_USE";
  title: string;
  description: string;
  sourceA: string;
  sourceB: string;
  status: "DISPUTED" | "DOCUMENTED";
  sortOrder: number;
}

export const CONFLICTS: ConflictData[] = [
  {
    key: "CONFLICT_HEIGHT",
    property: "HEIGHT",
    title: "Kõrgus",
    description:
      "Toote PDF (lk 3): 0,43 m kõigil mudelitel. Hinnakirja tehniline tabel (read 49-57): 0,39 m. Kokkuvõttetabel (C12) toetab samuti 0,39 m, st kaks allikat 0,39 vs üks 0,43 - ometi ei valitud allikat arvu ega uudsuse põhjal; väärtus on lahendamata ja ülevaatuseta ei kontrollita.",
    sourceA: "Swimming Pontoon with Plastic Floats.pdf lk 3: 0,43 m",
    sourceB: "Top Marine Dealer Price list EUR 2026.xlsx (SP, E49-E57) ja Selection of pontoons.xlsx (C12): 0,39 m",
    status: "DISPUTED",
    sortOrder: 1,
  },
  {
    key: "CONFLICT_FREEBOARD",
    property: "FREEBOARD",
    title: "Vabaparras (freeboard)",
    description:
      "Vabaparras varieerub mudeliti ja PDF erineb hinnakirjast 0,01-0,02 m võrra igal mudelil (nt 02 12 04: PDF 0,35 m vs hinnakiri 0,34 m; 02 20 06: 0,37 vs 0,35). Kokkuvõttetabel (C13) annab kõigile 0,3 m. Automaatset kontrolli ei tehta; mudelipõhised väärtused on kataloogis nähtavad.",
    sourceA: "PDF lk 3 mudelitabel: 0,34-0,37 m",
    sourceB: "Hinnakiri SP leht G49-G57: 0,33-0,35 m; Selection of pontoons.xlsx C13: 0,3 m",
    status: "DISPUTED",
    sortOrder: 2,
  },
  {
    key: "CONFLICT_LOAD",
    property: "LOAD",
    title: "Koormus (kN/m²)",
    description:
      "Mudelipõhised arvutuslikud koormused (0,52-1,18 kN/m² ja 632-1448 kg) ühtivad PDF-i ja hinnakirja vahel. Kokkuvõttetabel (C14) ütleb aga kõigile 1,0 kN/m², mis ületab mitme mudeli detailväärtuse (nt 02 14 04: 0,52). Koormussobivust ei kontrollita automaatselt - tootejuht peab lahendama, millist väärtust kasutada.",
    sourceA: "Selection of pontoons.xlsx, Sheet1 C14: 1,0 kN/m²",
    sourceB: "PDF lk 3 ja hinnakiri H49-I57: mudelipõhised väärtused (ühtivad omavahel)",
    status: "DISPUTED",
    sortOrder: 3,
  },
  {
    key: "CONFLICT_SUMMARY_WIDTH",
    property: "SUMMARY_WIDTH",
    title: "Laius kokkuvõttetabelis",
    description:
      "Kokkuvõttetabeli C11 loetleb ainult laiuse 2,0 m, kuid mõlemad detailsed mudelitabelid sisaldavad 2,0, 2,4 ja 3,0 m. MVP kasutab kataloogi valikuks detailseid, kahes allikas ühtivaid mudelimõõte.",
    sourceA: "Selection of pontoons.xlsx, Sheet1 C11: ainult 2,0 m",
    sourceB: "PDF lk 3 ja hinnakiri: 2,0 / 2,4 / 3,0 m",
    status: "DOCUMENTED",
    sortOrder: 4,
  },
  {
    key: "CONFLICT_INTENDED_USE",
    property: "INTENDED_USE",
    title: "Kasutusotstarve",
    description:
      "PDF: ujumisalad ja rannad (swimming areas, beaches). Kokkuvõttetabel C9: ujumine ja randumissillad (landing stages). Rakendus ei hinda otstarbe sobivust; mainimisel jäetakse küsimus inseneri otsustada.",
    sourceA: "PDF lk 3: swimming areas, beaches",
    sourceB: "Selection of pontoons.xlsx C9: Swimming, landing stages",
    status: "DOCUMENTED",
    sortOrder: 5,
  },
];

/** Kataloogi lubatud piirid (PDF lk 3; laine ja paadi pikkus ühtivad kokkuvõttetabeliga). */
export const LIMITS = {
  maxWaveHeightM: 0.2,
  maxCurrentSpeedMs: 1,
  maxBoatLengthM: 6.1,
} as const;

export interface RuleData {
  ruleId: string;
  version: string;
  title: string;
  description: string;
  status: RuleStatus;
  evidenceStatus: EvidenceStatus;
  isAssumption: boolean;
  sourceKey: string | null;
  sortOrder: number;
}

const r = (
  ruleId: string,
  title: string,
  description: string,
  sortOrder: number,
  o: Partial<Pick<RuleData, "status" | "evidenceStatus" | "isAssumption" | "sourceKey">> = {},
): RuleData => ({
  ruleId,
  version: RULES_VERSION,
  title,
  description,
  status: o.status ?? "ACTIVE",
  evidenceStatus: o.evidenceStatus ?? "ASSUMPTION",
  isAssumption: o.isAssumption ?? false,
  sourceKey: o.sourceKey ?? null,
  sortOrder,
});

export const RULES: RuleData[] = [
  r("R-META-01", "Projekt ja klient", "Lõpetatud kontrolliks on vaja projekti nimi ja (demo) kliendi/edasimüüja nimi.", 1, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-META-02", "Soovitud tarneaeg", "Tellimusel on vaja soovitud tarnekuupäeva. Päringul ei nõuta.", 2, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-LINE-01", "Tootrida olemas", "Tellimusel on vaja vähemalt ühte tootrida. Päringul puudumine tekitab täpsustuse.", 3, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-LINE-02", "Kogus", "Kogus peab olema positiivne täisarv.", 4, { evidenceStatus: "ASSUMPTION", sourceKey: "MVP_ASSUMPTION" }),
  r("R-PROD-01", "Toode kataloogis", "Kood ja variant leitakse kataloogist (kood normaliseeritakse, eesnullid säilivad).", 5, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-PROD-02", "Variandi ühesus", "Sama kood esineb hinnakirjas mooduli ja komplekti (SET) variandina. Ainult kood ei piisa.", 6, { evidenceStatus: "CORROBORATED", sourceKey: "XLSX_SP" }),
  r("R-PROD-03", "Tundmatu / eritoode", "Tundmatu või kohandatud toode suunatakse inseneri ülevaatusele.", 7, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-DIM-01", "Laius", "Kliendi märgitud laius võrreldakse valitud mudeli laiusega. Puuduv väärtus = ei kontrollitud.", 8, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-DIM-02", "Pikkus", "Kliendi märgitud pikkus võrreldakse valitud mudeli pikkusega. Puuduv väärtus = ei kontrollitud.", 9, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-FLT-01", "Ujukeid mooduli kohta", "Kliendi märgitud ujukite arv ühe mooduli kohta võrreldakse mudeli väärtusega.", 10, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-FLT-02", "Ujukeid kokku (arvutus)", "Kokku oodatav = Σ (mooduli kogus × mudeli ujukite arv). Teavitav arvutus, ei ole kinnitus.", 11, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-FLT-03", "Eraldi ujukid", "Täielik moodul sisaldab ujukeid; lisaujukid on eraldi varuosarida ega ole moodulile kohustuslikud.", 12, { evidenceStatus: "SINGLE_SOURCE", sourceKey: "PDF_P2" }),
  r("R-SET-01", "SET koosseis", "SET koosseis (BOM) ei ole kinnitatud - nõuab ülevaatust.", 13, { evidenceStatus: "SINGLE_SOURCE", sourceKey: "XLSX_SP" }),
  r("R-OLD-01", "Vana tüüpi ujukid", "Vanad ujukid 02 71 00 / 02 72 00 ei ole vahetatavad ilma ülevaatuseta.", 14, { evidenceStatus: "SINGLE_SOURCE", sourceKey: "XLSX_SP" }),
  r("R-CONN-01", "Moodulite ühendus", "Kui moodulid on ühendatud, on vaja ühenduse kirjeldust (PDF nimetab otsa-, külje-, L- ja T-ühendust). Teadmata vastus tekitab täpsustuse.", 15, { isAssumption: true, sourceKey: "PDF_P2" }),
  r("R-CONN-02", "Ühenduskomponentide kogus", "Kogust ei arvutata; üldiselt kehtivat valemit ei ole allikatest kinnitatud.", 16, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-ANCH-01", "Ankurdus", "Tellimusel on vaja ankurduse infot. Kataloogis loetletud lahendused (kett Ø10/Ø13 mm, betoonankur 200/500 kg, vai Ø60 mm 1 kN) nõuavad üksikasju; 'Muu' -> inseneri ülevaatus. Sobivust ega mõõtmeid ei hinnata.", 17, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-SITE-01", "Laine kõrgus", "Kliendi märgitud laine kõrgus ei tohi ületada kataloogi piiri 0,2 m; ületamine -> ülevaatus. Puudumine = ei kontrollitud.", 22, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-SITE-02", "Hoovuse kiirus", "Kliendi märgitud hoovuse kiirus ei tohi ületada kataloogi piiri 1 m/s (PDF); ületamine -> ülevaatus.", 23, { evidenceStatus: "SINGLE_SOURCE", sourceKey: "PDF_P3" }),
  r("R-SITE-03", "Paadi pikkus", "Kliendi märgitud paadi pikkus ei tohi ületada 6,1 m (20 jalga); ületamine -> ülevaatus.", 24, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-SHORE-01", "Kaldaühendus", "Kui kaldaühendus on soovitud, on vaja ligipääsusilla ja kaldatoe andmeid.", 18, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-WINTER-01", "Talvine kasutus", "Selge talvekasutuse soovi korral inseneri ülevaatus; toote PDF lk 3 (Allowed ice condition): ponton tuleb talveks lahti monteerida; kokkuvõttetabel C16: jääoludes ei kasutata.", 19, { evidenceStatus: "CORROBORATED", sourceKey: "PDF_P3" }),
  r("R-DISP-01", "Vaidlustatud omadused", "Kõrgus, vabaparras ja koormus on allikate vahel vastuolus; sõltuvuse korral inseneri ülevaatus.", 20, { evidenceStatus: "DISPUTED", sourceKey: "XLSX_SELECTION" }),
  r("R-REF-01", "Algne tellimustekst", "Algne tekst on ainult viide; seda ei tõlgendata automaatselt.", 21, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  // Keelatud / kinnitamata reeglid (ei ole rakendatud)
  r("X-CONN-QTY", "Ühenduskomponentide valem 2 x (moodulid - 1)", "Vana valem; universaalselt kehtivat kogust ei ole allikatest kinnitatud.", 90, { status: "DISABLED", evidenceStatus: "ASSUMPTION", sourceKey: "MVP_ASSUMPTION" }),
  r("X-HINGE-AUTO", "Hinge tüübi/koguse automaatne määramine", "Hinge tüüpi ega kogust ei määrata iga paigutuse jaoks automaatselt.", 91, { status: "DISABLED", evidenceStatus: "ASSUMPTION", sourceKey: "MVP_ASSUMPTION" }),
  r("X-ANCH-SIZE", "Ankru/keti suuruse heakskiit", "Ankurdust ei kiideta heaks ainult nimetatud keti või ankru suuruse põhjal.", 92, { status: "DISABLED", evidenceStatus: "ASSUMPTION", sourceKey: "MVP_ASSUMPTION" }),
  r("X-DISP-AUTO", "Kõrguse / vabaparda / koormuse automaatkontroll", "Allikad on vastuolus; kuni tootejuht andmed lahendab, ei kontrollita.", 93, { status: "UNCONFIRMED", evidenceStatus: "DISPUTED", sourceKey: "XLSX_SELECTION" }),
  r("X-SET-BOM", "SET komponentide täielikkus", "Komplekti koosseisu ei ole kinnitatud, seetõttu ei väideta komponentide olemasolu.", 94, { status: "UNCONFIRMED", evidenceStatus: "SINGLE_SOURCE", sourceKey: "XLSX_SP" }),
  r("X-WINTER-OK", "Talvise sobivuse kinnitus", "Talvist sobivust ei kinnitata.", 95, { status: "DISABLED", evidenceStatus: "SINGLE_SOURCE", sourceKey: "PDF_P3" }),
];
