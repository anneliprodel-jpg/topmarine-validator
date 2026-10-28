// Puhas valideerimismootor: ei sõltu UI-st ega andmebaasist.
import { LIMITS, RULES_VERSION } from "../catalogue/data";
import { fmtM, normalizeCode, sameNumber } from "./codes";
import {
  CatalogProduct,
  CheckResult,
  CheckStatus,
  LineInput,
  SCOPE_STATEMENT,
  SubmissionInput,
  ValidationReport,
} from "./types";

const SRC_MODEL = "Toote PDF lk 3 (rev. 01.01.2023) + hinnakiri 2026 SP leht - kahes allikas ühtivad (kinnitatud)";
const SRC_ASSUMPTION = "MVP töövoo eeldus (mitte kontrollitud Top Marine'i poliitika)";
const SRC_WINTER =
  "Toote PDF lk 3 (rev. 01.01.2023), Allowed ice condition: ponton tuleb talveks lahti monteerida; kokkuvõttetabel C16: jääoludes ei kasutata";
const SRC_LIMITS = "Toote PDF lk 3 (rev. 01.01.2023), lubatud piirid; laine ja paadi pikkus ühtivad kokkuvõttetabeliga";
const ANCHOR_LISTED = "Kataloogis loetletud: kett Ø10/Ø13 mm, betoonankur 200/500 kg, vai Ø60 mm (1 kN)";
const SRC_ANCHOR = "Toote PDF lk 3 (rev. 01.01.2023) ankurdussüsteemid; kokkuvõttetabel C17-C20 ühtib";
const LOOSE_FLOAT_CODES = ["02 73 00", "02 74 00"];

const DISPUTE_TEXT: Record<string, { label: string; detail: string }> = {
  HEIGHT: { label: "kõrgus", detail: "Toote PDF 0,43 m vs hinnakiri 0,39 m" },
  FREEBOARD: { label: "vabaparras", detail: "PDF ja hinnakirja töövihik erinevad, väärtus sõltub mudelist" },
  LOAD: { label: "koormus", detail: "Kokkuvõttetabel 1,0 kN/m² vs mudelipõhised väärtused detailtabelites" },
};

export function runValidation(
  input: SubmissionInput,
  catalog: CatalogProduct[],
  now: Date = new Date(),
): ValidationReport {
  const isOrder = input.type === "ORDER";
  const results: CheckResult[] = [];

  const add = (
    ruleId: string,
    title: string,
    status: CheckStatus,
    checked: string,
    o: Partial<Pick<CheckResult, "supplied" | "expected" | "source" | "question" | "lineNumber">> = {},
  ) =>
    results.push({
      ruleId,
      title,
      status,
      checked,
      supplied: o.supplied ?? null,
      expected: o.expected ?? null,
      source: o.source ?? SRC_ASSUMPTION,
      question: o.question ?? null,
      lineNumber: o.lineNumber ?? null,
    });

  /** Puuduv info: tellimusel puuduv info, päringul pehmem hoiatus (täpsustus). */
  const incomplete: CheckStatus = isOrder ? "MISSING" : "WARNING";
  const has = (s: string | null | undefined) => !!s && s.trim().length > 0;

  // --- Üldandmed ---
  const metaOk = has(input.projectName) && has(input.customerName);
  add("R-META-01", "Projekt ja klient", metaOk ? "PASS" : "MISSING", "Projekti nimi ja kliendi nimi on täidetud", {
    supplied: `Projekt: ${input.projectName.trim() || "puudub"}; klient: ${input.customerName.trim() || "puudub"}`,
    question: metaOk ? null : "Palun lisa projekti nimi ja kliendi/edasimüüja nimi.",
  });

  if (isOrder) {
    const date = input.requestedDeliveryDate;
    if (!date) {
      add("R-META-02", "Soovitud tarneaeg", "MISSING", "Tellimusel on soovitud tarnekuupäev", {
        question: "Mis on kliendi soovitud tarnekuupäev?",
      });
    } else if (new Date(`${date}T23:59:59Z`).getTime() < now.getTime()) {
      add("R-META-02", "Soovitud tarneaeg", "WARNING", "Tarnekuupäev ei ole minevikus", {
        supplied: date,
        question: "Soovitud tarnekuupäev on minevikus. Kas kuupäev on õige?",
      });
    } else {
      add("R-META-02", "Soovitud tarneaeg", "PASS", "Tellimusel on soovitud tarnekuupäev", { supplied: date });
    }
  } else {
    add("R-META-02", "Soovitud tarneaeg", "NA", "Päringul tarnekuupäeva ei nõuta", {
      supplied: input.requestedDeliveryDate,
    });
  }

  if (input.lines.length === 0) {
    add("R-LINE-01", "Tootrida olemas", incomplete, "Vähemalt üks tootrida", {
      question: "Milliseid tooteid klient soovib (variant, kood, kogus)?",
    });
  } else {
    add("R-LINE-01", "Tootrida olemas", "PASS", "Vähemalt üks tootrida", { supplied: `${input.lines.length} rida` });
  }

  if (has(input.referenceText)) {
    add(
      "R-REF-01",
      "Algne tellimustekst",
      "NA",
      "Algne tekst on ainult viide; seda ei ole automaatselt tõlgendatud. Kontrollid põhinevad ainult struktureeritud väljadel.",
    );
  }

  // --- Read ---
  let totalExpectedFloats = 0;
  let totalComputable = true;
  let moduleLineCount = 0;
  let moduleQtySum = 0;
  let looseFloatLines = 0;

  input.lines.forEach((line, idx) => {
    const n = idx + 1;
    const opt = { lineNumber: n };
    const q = line.quantity;
    const qtyOk = q != null && Number.isInteger(q) && q > 0;
    add(
      "R-LINE-02",
      "Kogus",
      qtyOk ? "PASS" : "MISSING",
      "Kogus on positiivne täisarv",
      {
        ...opt,
        supplied: q == null ? "puudub" : String(q),
        question: qtyOk ? null : "Palun sisesta kogus positiivse täisarvuna.",
      },
    );

    const resolved = resolveProduct(line, catalog, add, n);
    if (!resolved) {
      totalComputable = false;
      return;
    }
    const p = resolved;

    if (p.reviewRequired && p.kind === "ACCESSORY") {
      add("R-OLD-01", "Vana tüüpi ujukid", "REVIEW", "Vana tüüpi ujukit ei käsitleta ilma ülevaatuseta asendajana", {
        ...opt,
        supplied: `${p.code} ${p.name}`,
        source: "Hinnakiri 2026 SP leht (üks allikas)",
        question: "Kas vana tüüpi ujuk on tõesti soovitud ja kas sobivus on inseneriga üle vaadatud?",
      });
    }

    if (p.kind === "ACCESSORY") {
      if (LOOSE_FLOAT_CODES.includes(p.code)) looseFloatLines += 1;
      return;
    }

    if (p.variant === "SET") {
      add("R-SET-01", "SET koosseis", "REVIEW", "SET komponentide koosseis (BOM) ei ole kinnitatud", {
        ...opt,
        supplied: `SET ${p.code}`,
        expected: "Kinnitatud komplekti koosseis puudub; hinnakirja SET näide kehtib ainult selle ühe näite kohta",
        source: "Hinnakiri 2026 SP leht, read 13-19 (üks näide)",
        question: "Palun kinnita komplekti koosseis (millised komponendid ja kogused kuuluvad komplekti).",
      });
    } else {
      moduleLineCount += 1;
      if (qtyOk) moduleQtySum += q as number;
      if (qtyOk && p.floatsPerModule != null) totalExpectedFloats += (q as number) * p.floatsPerModule;
      else totalComputable = false;
    }

    // Mõõtude võrdlus: puuduv kliendiväärtus = ei kontrollitud
    compareDim(add, "R-DIM-01", "Laius", line.statedWidthM, p.widthM, p, n, line, catalog, "width");
    compareDim(add, "R-DIM-02", "Pikkus", line.statedLengthM, p.lengthM, p, n, line, catalog, "length");

    if (line.statedFloatsPerModule == null) {
      add("R-FLT-01", "Ujukeid mooduli kohta", "NA", "Kliendi märgitud ujukite arv mooduli kohta puudub - ei kontrollitud (mitte vastavus)", {
        ...opt,
        expected: `${p.floatsPerModule} ujukit ühe mooduli kohta`,
        source: SRC_MODEL,
      });
    } else if (line.statedFloatsPerModule === p.floatsPerModule) {
      add("R-FLT-01", "Ujukeid mooduli kohta", "PASS", "Ujukite arv ühe mooduli kohta ühtib mudeliga", {
        ...opt,
        supplied: `${line.statedFloatsPerModule} ujukit ühe mooduli kohta`,
        expected: `${p.floatsPerModule} ujukit ühe mooduli kohta`,
        source: SRC_MODEL,
      });
    } else {
      add("R-FLT-01", "Ujukeid mooduli kohta", "WARNING", "Ujukite arv ühe mooduli kohta EI ühti mudeliga", {
        ...opt,
        supplied: `${line.statedFloatsPerModule} ujukit ühe mooduli kohta`,
        expected: `${p.floatsPerModule} ujukit ühe mooduli kohta (mudel ${p.code})`,
        source: SRC_MODEL,
        question: `Klient märkis ${line.statedFloatsPerModule} ujukit mooduli kohta, mudelil ${p.code} on ${p.floatsPerModule}. Kas klient mõtles teist mudelit või on väärtus ekslik? Toodet ei vahetata automaatselt.`,
      });
    }
  });

  // --- Ujukite koondarvutus ---
  if (moduleLineCount > 0) {
    add(
      "R-FLT-02",
      "Ujukeid kokku (arvutus)",
      "NA",
      "Teavitav arvutus: kokku oodatav ujukite arv = Σ (mooduli kogus × mudeli ujukite arv). Mooduli kohta ja kokku on eraldi väärtused.",
      {
        expected: totalComputable ? `${totalExpectedFloats} ujukit kokku (moodulite kogus ${moduleQtySum})` : "Ei arvutatud: mõni rida on mittetäielik või lahendamata",
        source: SRC_MODEL,
      },
    );
    if (looseFloatLines > 0) {
      add("R-FLT-03", "Eraldi ujukid", "WARNING", "Eraldi ujukirida koos täielike moodulitega", {
        supplied: `${looseFloatLines} eraldi ujukirida`,
        expected: "Täielik moodul sisaldab juba ujukid; eraldi ujukid on varuosad",
        source: "Toote PDF lk 2 komponendid (üks allikas)",
        question: "Kas eraldi ujukid on tahtlik varuosade tellimus? Moodulitele lisaujukeid ei nõuta.",
      });
    } else {
      add("R-FLT-03", "Eraldi ujukid", "NA", "Täielik moodul sisaldab ujukid - eraldi ujukeid ei nõuta", {
        source: "Toote PDF lk 2 komponendid (üks allikas)",
      });
    }
  }

  // --- Moodulite ühendus ---
  const conn = input.modulesConnected;
  if (conn === "YES") {
    if (!has(input.connectionDescription)) {
      add("R-CONN-01", "Moodulite ühendus", "MISSING", "Ühendatud moodulite paigutuse/ühenduse kirjeldus", {
        supplied: "puudub",
        question: "Kuidas moodulid on omavahel ühendatud (paigutus, ühendustüüp, komponendid)?",
      });
    } else {
      add("R-CONN-01", "Moodulite ühendus", "PASS", "Ühenduse kirjeldus on esitatud (sisu ei hinnata)", {
        supplied: input.connectionDescription.trim(),
      });
    }
    const compUnknown = !has(input.connectionComponents) || input.connectionQuantitiesUnknown;
    add(
      "R-CONN-02",
      "Ühenduskomponentide kogus",
      compUnknown ? "WARNING" : "NA",
      "Ühenduskomponentide kogust ei arvutata (universaalset valemit ei ole kinnitatud)",
      {
        supplied: has(input.connectionComponents) ? input.connectionComponents.trim() : "komponendid puuduvad",
        question: compUnknown ? "Millised ühenduskomponendid ja mis kogustes on vaja? Insener peab koguse kinnitama." : null,
      },
    );
    if (moduleQtySum > 0 && moduleQtySum < 2) {
      add("R-CONN-01", "Moodulite ühendus", "WARNING", "Ühendus on märgitud, kuid mooduleid on kokku alla kahe", {
        supplied: `Moodulite arv kokku: ${moduleQtySum}`,
        question: "Mis moodulid omavahel ühendatakse? Praegu on tellitud ainult üks moodul.",
      });
    }
  } else if (conn === "NO") {
    add(
      "R-CONN-01",
      "Moodulite ühendus",
      "PASS",
      moduleQtySum > 1 ? "Moodulid ei ole ühendatud - käsitletakse eraldi paigaldustena" : "Moodulid ei ole ühendatud",
      { supplied: "Ei" },
    );
  } else if (conn === "UNKNOWN") {
    add("R-CONN-01", "Moodulite ühendus", "MISSING", "Kas moodulid on ühendatud", {
      supplied: "Teadmata",
      question: "Kas moodulid ühendatakse omavahel või paigaldatakse eraldi?",
    });
  } else {
    add("R-CONN-01", "Moodulite ühendus", incomplete, "Kas moodulid on ühendatud", {
      supplied: "vastus puudub",
      question: "Kas moodulid ühendatakse omavahel (jah/ei/teadmata)?",
    });
  }

  // --- Ankurdus ---
  const at = input.anchoringType;
  if (at === "OTHER") {
    add("R-ANCH-01", "Ankurdus", "REVIEW", "Kataloogis loetlemata (mittestandardne) ankurdus vajab inseneri ülevaatust", {
      supplied: `Muu: ${input.anchoringDetails.trim() || "üksikasjad puuduvad"}`,
      expected: ANCHOR_LISTED,
      source: SRC_ANCHOR,
      question: "Palun esita ankurduse üksikasjad; insener hindab lahenduse.",
    });
  } else if (at === "CHAIN" || at === "PILES" || at === "CONCRETE") {
    const label = at === "CHAIN" ? "Kett" : at === "PILES" ? "Vaiad" : "Betoonankur";
    add(
      "R-ANCH-01",
      "Ankurdus",
      has(input.anchoringDetails) ? "PASS" : incomplete,
      `${label}: kataloogis loetletud lahendus, üksikasjad on esitatud (sobivust ega mõõtmeid ei hinnata)`,
      {
        supplied: has(input.anchoringDetails) ? input.anchoringDetails.trim() : "üksikasjad puuduvad",
        expected: ANCHOR_LISTED,
        source: SRC_ANCHOR,
        question: has(input.anchoringDetails)
          ? null
          : `Millised on ankurduse üksikasjad (${at === "CHAIN" ? "keti Ø, ankrutüüp, kinnituskoht" : at === "PILES" ? "vaiade Ø, arv, koormus" : "ankru mass, arv, kinnituskoht"})?`,
      },
    );
  } else {
    add("R-ANCH-01", "Ankurdus", incomplete, "Ankurduse info", {
      supplied: at === "UNKNOWN" ? "Teadmata" : "puudub",
      question: "Kuidas ponton ankurdatakse (kett, vaiad, muu)? Palun lisa üksikasjad.",
    });
  }

  // --- Asukoha piirid (kataloogi lubatud piirid, PDF lk 3) ---
  siteLimit(add, "R-SITE-01", "Laine kõrgus", input.waveHeightM, LIMITS.maxWaveHeightM, "m", "laine kõrgus");
  siteLimit(add, "R-SITE-02", "Hoovuse kiirus", input.currentSpeedMs, LIMITS.maxCurrentSpeedMs, "m/s", "hoovuse kiirus");
  siteLimit(add, "R-SITE-03", "Paadi pikkus", input.boatLengthM, LIMITS.maxBoatLengthM, "m", "paadi pikkus");

  // --- Kaldaühendus ---
  const sc = input.shoreConnection;
  if (sc === "YES") {
    const gw = has(input.gangwayDetails);
    const sp = has(input.shoreSupportDetails);
    if (gw && sp) {
      add("R-SHORE-01", "Kaldaühendus", "PASS", "Ligipääsusilla ja kaldatoe andmed on esitatud (sobivust ei hinnata)", {
        supplied: `Sild: ${input.gangwayDetails.trim()}; kaldatugi: ${input.shoreSupportDetails.trim()}`,
      });
    } else {
      add("R-SHORE-01", "Kaldaühendus", incomplete, "Ligipääsusilla ja kaldatoe andmed", {
        supplied: `Sild: ${gw ? input.gangwayDetails.trim() : input.shoreDetailsUnknown ? "märgitud teadmata" : "puudub"}; kaldatugi: ${sp ? input.shoreSupportDetails.trim() : input.shoreDetailsUnknown ? "märgitud teadmata" : "puudub"}`,
        question: "Palun täpsusta ligipääsusild ja kaldatugi (või kinnita, et need on veel teadmata). Hinge tüüpi/kogust ei määrata automaatselt.",
      });
    }
  } else if (sc === "NO") {
    add("R-SHORE-01", "Kaldaühendus", "PASS", "Kaldaühendust ei soovita", { supplied: "Ei" });
  } else if (sc === "UNKNOWN") {
    add("R-SHORE-01", "Kaldaühendus", incomplete, "Kas kaldaühendus on soovitud", {
      supplied: "Teadmata",
      question: "Kas ponton vajab ühendust kaldaga (ligipääsusild)?",
    });
  } else {
    add("R-SHORE-01", "Kaldaühendus", incomplete, "Kas kaldaühendus on soovitud", {
      supplied: "vastus puudub",
      question: "Kas ponton vajab ühendust kaldaga (jah/ei/teadmata)?",
    });
  }

  // --- Talvine kasutus ---
  if (input.winterUse === true) {
    add("R-WINTER-01", "Talvine kasutus", "REVIEW", "Talvekasutus on selgelt soovitud", {
      supplied: "Jah",
      expected: "Talvise sobivust ei ole kinnitatud",
      source: SRC_WINTER,
      question: "Toote PDF märgib, et ponton tuleb talveks lahti monteerida. Kuidas klient talvekasutust plaanib? Insener vaatab üle.",
    });
  } else {
    add("R-WINTER-01", "Talvine kasutus", "NA", "Talvekasutust ei ole soovitud", {
      source: SRC_WINTER,
      supplied: input.winterUse === false ? "Ei" : "ei täpsustatud",
    });
  }

  // --- Vaidlustatud omadused ---
  if (input.relevantProperties.length === 0) {
    add("R-DISP-01", "Vaidlustatud omadused", "NA", "Päring ei sõltu kõrgusest, vabapardast ega koormusest (vastuolud on nähtavad kataloogis)", {
      source: "Kataloog / allikate vastuolud",
    });
  } else {
    for (const prop of input.relevantProperties) {
      const d = DISPUTE_TEXT[prop];
      add("R-DISP-01", "Vaidlustatud omadused", "REVIEW", `Päring sõltub omadusest "${d.label}", mille allikad on vastuolus`, {
        supplied: d.label,
        expected: d.detail,
        source: "Allikate vastuolu (vt Tooted ja kontrollireeglid)",
        question: `Allikad on omaduse "${d.label}" osas vastuolus. Tootejuht/insener peab kinnitama kehtiva väärtuse enne vastamist.`,
      });
    }
  }

  const counts: Record<CheckStatus, number> = { PASS: 0, MISSING: 0, WARNING: 0, REVIEW: 0, NA: 0 };
  for (const res of results) counts[res.status] += 1;

  let overallStatus: CheckStatus = "PASS";
  let overallText = "Rakenduses realiseeritud kontrollid läbiti (inseneri sobivust ei hinnatud).";
  if (counts.REVIEW > 0) {
    overallStatus = "REVIEW";
    overallText = "Vajab inseneri ülevaatust.";
  } else if (counts.MISSING > 0) {
    overallStatus = "MISSING";
    overallText = isOrder ? "Tellimus ei ole kontrolliks valmis: puudub info." : "Päring vajab täpsustusi (ei ole tagasi lükatud).";
  } else if (counts.WARNING > 0) {
    overallStatus = "WARNING";
    overallText = isOrder ? "Hoiatused - vaata üle." : "Päring vajab täpsustusi (ei ole tagasi lükatud).";
  }

  return {
    rulesVersion: RULES_VERSION,
    submissionType: input.type,
    generatedAt: now.toISOString(),
    overallStatus,
    overallText,
    counts,
    expectedFloatsTotal: moduleLineCount > 0 && totalComputable ? totalExpectedFloats : null,
    results,
    scope: SCOPE_STATEMENT,
  };
}

function siteLimit(
  add: AddFn,
  ruleId: string,
  title: string,
  value: number | null,
  max: number,
  unit: string,
  what: string,
) {
  const lim = `${String(max).replace(".", ",")} ${unit}`;
  if (value == null) {
    add(ruleId, title, "NA", `Kliendi märgitud ${what} puudub - ei kontrollitud (mitte vastavus)`, { expected: `kataloogi piir kuni ${lim}`, source: SRC_LIMITS });
  } else if (value > max) {
    add(ruleId, title, "REVIEW", `Kliendi märgitud ${what} ületab kataloogi lubatud piiri`, {
      supplied: `${String(value).replace(".", ",")} ${unit}`,
      expected: `kuni ${lim}`,
      source: SRC_LIMITS,
      question: `Märgitud ${what} on suurem kui kataloogi piir ${lim}. Insener peab hindama, kas ja mis tingimustel toode sobib.`,
    });
  } else {
    add(ruleId, title, "PASS", `Kliendi märgitud ${what} ei ületa kataloogi piiri (ei ole inseneri kinnitus)`, {
      supplied: `${String(value).replace(".", ",")} ${unit}`,
      expected: `kuni ${lim}`,
      source: SRC_LIMITS,
    });
  }
}

type AddFn = (
  ruleId: string,
  title: string,
  status: CheckStatus,
  checked: string,
  o?: Partial<Pick<CheckResult, "supplied" | "expected" | "source" | "question" | "lineNumber">>,
) => void;

function resolveProduct(line: LineInput, catalog: CatalogProduct[], add: AddFn, n: number): CatalogProduct | null {
  const opt = { lineNumber: n };
  const label = line.code ?? line.customName ?? "";

  if (line.variant === "CUSTOM") {
    add("R-PROD-03", "Tundmatu / eritoode", "REVIEW", "Kohandatud või tundmatu toode vajab inseneri ülevaatust", {
      ...opt,
      supplied: line.customName?.trim() || line.code || "kirjeldus puudub",
      question: "Palun kirjelda toode täpselt (mõõdud, otstarve). Insener hindab sobivuse.",
    });
    return null;
  }

  if (!line.code || !line.code.trim()) {
    add("R-PROD-01", "Toode kataloogis", "MISSING", "Tootekood on märgitud", {
      ...opt,
      supplied: "puudub",
      question: "Palun lisa tootekood või märgi toode eritooteks.",
    });
    return null;
  }

  const code = normalizeCode(line.code);
  const matches = code ? catalog.filter((p) => p.code === code) : [];
  if (!code || matches.length === 0) {
    add("R-PROD-03", "Tundmatu / eritoode", "REVIEW", "Koodi ei leitud SP kataloogist", {
      ...opt,
      supplied: label,
      expected: "Kood peab olema SP kataloogis (kuuekohaline, nt 02 12 04)",
      question: "Kood ei ole SP kataloogis. Palun kontrolli kood või märgi toode eritooteks.",
    });
    return null;
  }

  if (!line.variant) {
    const needsVariant = matches.some((m) => m.kind === "MODEL");
    if (needsVariant) {
      add("R-PROD-02", "Variandi ühesus", "MISSING", "Variant (MODUL või SET) on valitud", {
        ...opt,
        supplied: `Kood ${code}, variant puudub`,
        expected: "Hinnakiri kasutab sama koodi mooduli ja komplekti (SET) jaoks",
        source: "Hinnakiri 2026 SP leht (sama kood mitmel variandil)",
        question: `Kood ${code} ei ütle, kas soovitakse moodulit või komplekti (SET). Palun vali variant.`,
      });
      return null;
    }
  }

  const found = matches.find((m) => (line.variant ? m.variant === line.variant : true));
  if (!found) {
    if (line.variant === "SET") {
      add("R-SET-01", "SET koosseis", "REVIEW", "SET kirjet sellele koodile kataloogis ei ole", {
        ...opt,
        supplied: `SET ${code}`,
        expected: "Kinnitatud komplekti koosseis puudub",
        source: "Hinnakiri 2026 SP leht (SET näide ainult 02 12 04)",
        question: "SET koosseis ei ole kinnitatud. Palun täpsusta komplekti sisu.",
      });
    } else {
      add("R-PROD-03", "Tundmatu / eritoode", "REVIEW", "Koodi ja variandi kombinatsiooni ei ole kataloogis", {
        ...opt,
        supplied: `${code} (${line.variant})`,
        question: "Valitud variant ei vasta koodile kataloogis. Palun kontrolli variant.",
      });
    }
    return null;
  }

  add("R-PROD-01", "Toode kataloogis", "PASS", "Kood ja variant leiti kataloogist", {
    ...opt,
    supplied: `${code} ${found.variant}`,
    expected: found.name,
    source: found.sourceLabel,
  });
  return found;
}

function compareDim(
  add: AddFn,
  ruleId: string,
  title: string,
  stated: number | null,
  expected: number | null,
  p: CatalogProduct,
  n: number,
  line: LineInput,
  catalog: CatalogProduct[],
  dim: "width" | "length",
) {
  const opt = { lineNumber: n, source: SRC_MODEL };
  if (expected == null) return;
  if (stated == null) {
    add(ruleId, title, "NA", `Kliendi märgitud ${title.toLowerCase()} puudub - ei kontrollitud (mitte vastavus)`, {
      ...opt,
      expected: fmtM(expected),
    });
    return;
  }
  if (sameNumber(stated, expected)) {
    add(ruleId, title, "PASS", `Kliendi märgitud ${title.toLowerCase()} ühtib mudeliga`, {
      ...opt,
      supplied: fmtM(stated),
      expected: fmtM(expected),
    });
    return;
  }
  const other = catalog
    .filter(
      (c) =>
        c.variant === "MODULE" &&
        c.internalId !== p.internalId &&
        (line.statedWidthM == null || (c.widthM != null && sameNumber(c.widthM, line.statedWidthM))) &&
        (line.statedLengthM == null || (c.lengthM != null && sameNumber(c.lengthM, line.statedLengthM))),
    )
    .map((c) => c.code);
  add(ruleId, title, "WARNING", `Kliendi märgitud ${title.toLowerCase()} EI ühti mudeliga`, {
    ...opt,
    supplied: fmtM(stated),
    expected: `${fmtM(expected)} (mudel ${p.code})`,
    question: `Klient märkis ${dim === "width" ? "laiuseks" : "pikkuseks"} ${fmtM(stated)}, mudelil ${p.code} on ${fmtM(expected)}. Kas klient soovis teist mudelit${
      other.length ? ` (nt ${other.join(", ")})` : ""
    } või on väärtus ekslik? Toodet ei vahetata automaatselt.`,
  });
}
