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
    filename: "Swimming Pontoon with Plastic Floats(1).pdf",
    location: "lk 3, mudelitabel",
    sourceDate: "01.01.2023 (revisjon)",
    evidenceStatus: "CORROBORATED",
    note: "Üheksa mudeli mõõdud ja ujukite arv ühtivad 2026. aasta SP hinnakirja tehnilise tabeliga.",
  },
  {
    key: "PDF_P2",
    filename: "Swimming Pontoon with Plastic Floats(1).pdf",
    location: "lk 2, komponentide kirjeldused ja kasutusmärkused",
    sourceDate: "01.01.2023 (revisjon)",
    evidenceStatus: "SINGLE_SOURCE",
    note: "Sisaldab märget, et ponton tuleb talveks lahti monteerida (täpne lehekülg/lõik tuleb enne esitlust üle kontrollida).",
  },
  {
    key: "XLSX_SP",
    filename: "Top Marine Dealer Price list EUR 2026.xlsx",
    location: "leht SP, read 3-11, 13-19, 21-45 ja 49-57",
    sourceDate: "2026",
    evidenceStatus: "CORROBORATED",
    note: "Kasutatud ainult kataloogina. Hindu ei impordita ega kuvata.",
  },
  {
    key: "XLSX_SELECTION",
    filename: "Selection of pontoons(1).xlsx",
    location: "Sheet1, veerg C (SP 220 ltr), lahtrid C11 ja C14",
    sourceDate: null,
    evidenceStatus: "DISPUTED",
    note: "Kokkuvõttetabel on detailsete mudelitabelitega vastuolus (laius ja koormus).",
  },
  {
    key: "PDF_ASSEMBLY",
    filename: "Swimming Pontoon Assembly instructions_ENG(1).pdf",
    location: "komponentide viited",
    sourceDate: null,
    evidenceStatus: "SINGLE_SOURCE",
    note: "Joonis ei ole universaalne komplekti koosseis (BOM).",
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
  sourceKey: string;
  sourceLocation: string;
  evidenceStatus: EvidenceStatus;
  reviewRequired: boolean;
  notes: string | null;
  sortOrder: number;
}

const MODEL_ROWS: Array<[string, number, number, number]> = [
  ["02 10 04", 2.0, 4, 4],
  ["02 12 04", 2.4, 4, 4],
  ["02 14 04", 3.0, 4, 4],
  ["02 20 06", 2.0, 5, 6],
  ["02 22 06", 2.4, 5, 6],
  ["02 24 06", 3.0, 5, 6],
  ["02 30 08", 2.0, 6, 8],
  ["02 32 08", 2.4, 6, 8],
  ["02 34 08", 3.0, 6, 8],
];

const fmtDim = (n: number) => n.toFixed(1).replace(".", ",");

const moduleProducts: ProductData[] = MODEL_ROWS.map(([code, w, l, f], i) => ({
  internalId: `SP-${code.replace(/ /g, "")}-MODULE`,
  code,
  variant: "MODULE",
  kind: "MODEL",
  name: `SP ponton plastujukitega ${fmtDim(w)} x ${l} m (moodul)`,
  widthM: w,
  lengthM: l,
  floatsPerModule: f,
  floatVolumeL: 220,
  sourceKey: "PDF_P3",
  sourceLocation: "PDF lk 3 mudelitabel; hinnakiri SP leht read 3-11 (täpne rida kinnitamata)",
  evidenceStatus: "CORROBORATED",
  reviewRequired: false,
  notes: "Kõrgus, vabaparras ja koormus on allikate vahel vastuolus - vt vastuolud.",
  sortOrder: 10 + i,
}));

const setProduct: ProductData = {
  internalId: "SP-021204-SET",
  code: "02 12 04",
  variant: "SET",
  kind: "MODEL",
  name: "SP ponton plastujukitega 2,4 x 4 m (komplekt / SET)",
  widthM: 2.4,
  lengthM: 4,
  floatsPerModule: 4,
  floatVolumeL: 220,
  sourceKey: "XLSX_SP",
  sourceLocation: "hinnakiri SP leht, read 13-19 (SET näide)",
  evidenceStatus: "SINGLE_SOURCE",
  reviewRequired: true,
  notes:
    "Sama kood mis moodulil. Komponentide jaotus (read 13-19) on tõend ainult selle ühe näite kohta; üldist komplekti koosseisu ei järeldata. SET koosseis vajab ülevaatust.",
  sortOrder: 30,
};

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
  sourceKey: opts.sourceKey ?? "XLSX_SP",
  sourceLocation: opts.sourceLocation ?? "hinnakiri SP leht, read 21-45 / 49-57 (täpne rida kinnitamata)",
  evidenceStatus: "SINGLE_SOURCE",
  reviewRequired: opts.reviewRequired ?? false,
  notes: opts.notes ?? "Tarvik. Kohustuslikkust ja kogust ei järeldata dokumendis esinemisest.",
  sortOrder,
});

const accessories: ProductData[] = [
  accessory("02 73 00", "SP ujuk 220 liitrit", 40),
  accessory("02 74 00", "SP ujuk 220 liitrit, EPS-iga", 41),
  accessory("02 80 00", "SP kummiliitmik (rubber joint)", 42),
  accessory("10 10 00", "SP puidust ligipääsusild 1,2 x 4 m (gangway)", 43),
  accessory("10 14 00", "Sirge hing ECO (SP tarvik, ei ole ECO ponton)", 44),
  accessory("10 15 00", "F-hing ECO (SP tarvik, ei ole ECO ponton)", 45),
  accessory("17 50 00", "SP ketikinnitus (paigaldusjuhend)", 46, {
    sourceKey: "PDF_ASSEMBLY",
    sourceLocation: "paigaldusjuhend, komponentide viited",
  }),
  accessory("02 71 00", "Vana tüüpi ujuk (ei ole 02 73 00 asendus)", 47, {
    reviewRequired: true,
    notes: "Vana tüüpi ujukit ei käsitleta ilma ülevaatuseta asendajana.",
  }),
  accessory("02 72 00", "Vana tüüpi ujuk (ei ole 02 74 00 asendus)", 48, {
    reviewRequired: true,
    notes: "Vana tüüpi ujukit ei käsitleta ilma ülevaatuseta asendajana.",
  }),
];

export const PRODUCTS: ProductData[] = [...moduleProducts, setProduct, ...accessories];

export interface ConflictData {
  key: string;
  property: "HEIGHT" | "FREEBOARD" | "LOAD" | "SUMMARY_WIDTH";
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
    description: "Toote PDF: 0,43 m; 2026. aasta hinnakirja tehniline tabel: 0,39 m. Allikat ei valitud faili nime ega uudsuse põhjal.",
    sourceA: "Swimming Pontoon with Plastic Floats(1).pdf: 0,43 m",
    sourceB: "Top Marine Dealer Price list EUR 2026.xlsx: 0,39 m",
    status: "DISPUTED",
    sortOrder: 1,
  },
  {
    key: "CONFLICT_FREEBOARD",
    property: "FREEBOARD",
    title: "Vabaparras (freeboard)",
    description: "Vabaparras varieerub mudeliti ning PDF ja töövihik erinevad. Automaatset kontrolli ei tehta.",
    sourceA: "PDF lk 3 mudelitabel",
    sourceB: "Hinnakiri SP leht, tehniline tabel",
    status: "DISPUTED",
    sortOrder: 2,
  },
  {
    key: "CONFLICT_LOAD",
    property: "LOAD",
    title: "Koormus (kN/m²)",
    description:
      "Kokkuvõttetabel (Selection of pontoons, C14) ütleb 1,0 kN/m², detailsed mudelitabelid annavad mudelipõhised väärtused. Koormussobivust ei kontrollita automaatselt.",
    sourceA: "Selection of pontoons(1).xlsx, Sheet1 C14: 1,0 kN/m²",
    sourceB: "Detailsed mudelitabelid (PDF lk 3 ja hinnakiri): mudelipõhised väärtused",
    status: "DISPUTED",
    sortOrder: 3,
  },
  {
    key: "CONFLICT_SUMMARY_WIDTH",
    property: "SUMMARY_WIDTH",
    title: "Laius kokkuvõttetabelis",
    description:
      "Kokkuvõttetabeli C11 loetleb ainult laiuse 2,0 m, kuid mõlemad detailsed mudelitabelid sisaldavad 2,0, 2,4 ja 3,0 m. MVP kasutab kataloogi valikuks detailseid, kahes allikas ühtivaid mudelimõõte.",
    sourceA: "Selection of pontoons(1).xlsx, Sheet1 C11: ainult 2,0 m",
    sourceB: "PDF lk 3 ja hinnakiri: 2,0 / 2,4 / 3,0 m",
    status: "DOCUMENTED",
    sortOrder: 4,
  },
];

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
  r("R-CONN-01", "Moodulite ühendus", "Kui moodulid on ühendatud, on vaja ühenduse kirjeldust. Teadmata vastus tekitab täpsustuse.", 15, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-CONN-02", "Ühenduskomponentide kogus", "Kogust ei arvutata; üldiselt kehtivat valemit ei ole allikatest kinnitatud.", 16, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-ANCH-01", "Ankurdus", "Tellimusel on vaja ankurduse infot; mittestandardne (vaiad/muu) -> inseneri ülevaatus. Sobivust ei hinnata.", 17, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-SHORE-01", "Kaldaühendus", "Kui kaldaühendus on soovitud, on vaja ligipääsusilla ja kaldatoe andmeid.", 18, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  r("R-WINTER-01", "Talvine kasutus", "Selge talvekasutuse soovi korral inseneri ülevaatus; toote PDF: ponton tuleb talveks lahti monteerida.", 19, { evidenceStatus: "SINGLE_SOURCE", sourceKey: "PDF_P2" }),
  r("R-DISP-01", "Vaidlustatud omadused", "Kõrgus, vabaparras ja koormus on allikate vahel vastuolus; sõltuvuse korral inseneri ülevaatus.", 20, { evidenceStatus: "DISPUTED", sourceKey: "XLSX_SELECTION" }),
  r("R-REF-01", "Algne tellimustekst", "Algne tekst on ainult viide; seda ei tõlgendata automaatselt.", 21, { isAssumption: true, sourceKey: "MVP_ASSUMPTION" }),
  // Keelatud / kinnitamata reeglid (ei ole rakendatud)
  r("X-CONN-QTY", "Ühenduskomponentide valem 2 x (moodulid - 1)", "Vana valem; universaalselt kehtivat kogust ei ole allikatest kinnitatud.", 90, { status: "DISABLED", evidenceStatus: "ASSUMPTION", sourceKey: "MVP_ASSUMPTION" }),
  r("X-HINGE-AUTO", "Hinge tüübi/koguse automaatne määramine", "Hinge tüüpi ega kogust ei määrata iga paigutuse jaoks automaatselt.", 91, { status: "DISABLED", evidenceStatus: "ASSUMPTION", sourceKey: "MVP_ASSUMPTION" }),
  r("X-ANCH-SIZE", "Ankru/keti suuruse heakskiit", "Ankurdust ei kiideta heaks ainult nimetatud keti või ankru suuruse põhjal.", 92, { status: "DISABLED", evidenceStatus: "ASSUMPTION", sourceKey: "MVP_ASSUMPTION" }),
  r("X-DISP-AUTO", "Kõrguse / vabaparda / koormuse automaatkontroll", "Allikad on vastuolus; kuni tootejuht andmed lahendab, ei kontrollita.", 93, { status: "UNCONFIRMED", evidenceStatus: "DISPUTED", sourceKey: "XLSX_SELECTION" }),
  r("X-SET-BOM", "SET komponentide täielikkus", "Komplekti koosseisu ei ole kinnitatud, seetõttu ei väideta komponentide olemasolu.", 94, { status: "UNCONFIRMED", evidenceStatus: "SINGLE_SOURCE", sourceKey: "XLSX_SP" }),
  r("X-WINTER-OK", "Talvise sobivuse kinnitus", "Talvist sobivust ei kinnitata.", 95, { status: "DISABLED", evidenceStatus: "SINGLE_SOURCE", sourceKey: "PDF_P2" }),
];
