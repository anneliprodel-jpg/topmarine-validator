// Loob SÜNTEETILISED testfailid (fiktiivne klient). Käivita: npx tsx scripts/make-fixtures.ts
// .docx ja .doc tehakse eraldi Wordiga: scripts/make-word-fixtures.ps1 (kasutab paigaldatud Microsoft Wordi).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";

const OUT = path.join(process.cwd(), "test", "fixtures");
mkdirSync(OUT, { recursive: true });

export const ORDER_A_LINES = [
  "TELLIMUS nr N-2027-001 (naidis, fiktiivne)",
  "Klient: Näidis Merekeskus OÜ (fiktiivne)",
  "Projekt: Näidis Sadam 2027",
  "Soovitud tarne: 15.05.2027",
  "Toote kood | Nimetus | Variant | Kogus | Laius (m) | Pikkus (m) | Ujukeid mooduli kohta",
  "02 12 04 | SP ponton 2,4 x 4 m | moodul | 2 | 2,4 | 4 | 4",
  "Ankurdus: ketiankur 13 mm, 2 tk",
  "Kaldaühendust ei ole. Moodulid paigaldatakse eraldi.",
];

async function textPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  ORDER_A_LINES.forEach((l, i) => page.drawText(l, { x: 40, y: 780 - i * 24, size: 11, font }));
  writeFileSync(path.join(OUT, "order-a.pdf"), await pdf.save());
}

async function scannedPdf() {
  // Tekst joonistatakse pildiks ja pannakse PDF-i ilma tekstikihita (skaneeritud dokumendi simulatsioon)
  const w = 1240;
  const h = 1754;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.font = "34px Arial";
  ORDER_A_LINES.forEach((l, i) => ctx.fillText(l.replace("Ø", "").replace(/ \| /g, "   "), 80, 140 + i * 70));
  const png = canvas.toBuffer("image/png");
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(png);
  const page = pdf.addPage([595, 842]);
  page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  writeFileSync(path.join(OUT, "order-a-scanned.pdf"), await pdf.save());
}

function workbooks() {
  const head = ["Toote kood", "Nimetus", "Variant", "Kogus", "Laius (m)", "Pikkus (m)", "Ujukeid mooduli kohta"];
  const rows: (string | number)[][] = [
    ["TELLIMUS nr N-2027-001 (naidis, fiktiivne)"],
    ["Klient:", "Näidis Merekeskus OÜ (fiktiivne)"],
    ["Projekt:", "Näidis Sadam 2027"],
    ["Soovitud tarne:", "15.05.2027"],
    [],
    head,
    ["02 12 04", "SP ponton 2,4 x 4 m", "moodul", 2, "2,4", "4", 4],
    [],
    ["Ankurdus: ketiankur 13 mm, 2 tk"],
    ["Kaldaühendust ei ole. Moodulid paigaldatakse eraldi."],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), "Kaas"); // tühi esimene leht
  XLSX.utils.book_append_sheet(wb, ws, "Tellimus");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Märkus", "Hind ei kuulu selle tellimuse juurde"]]), "Märkused");
  writeFileSync(path.join(OUT, "order-a.xlsx"), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  writeFileSync(path.join(OUT, "order-a.xls"), XLSX.write(wb, { type: "buffer", bookType: "biff8" }));
}

function brokenFiles() {
  writeFileSync(path.join(OUT, "corrupted.docx"), Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("see ei ole kehtiv docx")]));
  writeFileSync(path.join(OUT, "corrupted.pdf"), Buffer.from("%PDF-1.4\nrikutud sisu"));
  writeFileSync(path.join(OUT, "fake.xlsx"), "tavaline tekst, mitte Excel");
}

(async () => {
  await textPdf();
  await scannedPdf();
  workbooks();
  brokenFiles();
  console.log("Fixture'id loodud:", OUT);
})();
