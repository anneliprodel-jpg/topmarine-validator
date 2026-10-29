// Võrdleb kataloogi (src/lib/catalogue/data.ts) hinnakirja SP lehe tehnilise tabeliga (read 49-57), SET-ridade (3-11) ja moodulite (21-29) koodidega.
// Kasutus: npx tsx scripts/verify-catalogue.ts "<tee hinnakirja .xlsx failini>"   (faili ei kopeerita repo sisse)
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { PRODUCTS } from "../src/lib/catalogue/data";

const file = process.argv[2];
if (!file) throw new Error("Anna hinnakirja faili tee argumendina.");
const ws = XLSX.read(readFileSync(file), { type: "buffer" }).Sheets["SP"];
const v = (a: string) => ws[a]?.v;
const problems: string[] = [];
for (let i = 0; i < 9; i++) {
  const tech = 49 + i;
  const code = String(v(`A${tech}`));
  const mod = PRODUCTS.find((p) => p.code === code && p.variant === "MODULE");
  const set = PRODUCTS.find((p) => p.code === code && p.variant === "SET");
  if (!mod || !set) { problems.push(`${code}: kataloogis puudub MODULE/SET`); continue; }
  const checks: [string, unknown, unknown][] = [
    ["pikkus", v(`C${tech}`), mod.lengthM], ["laius", v(`D${tech}`), mod.widthM], ["kõrgus (hinnakiri)", v(`E${tech}`), mod.heightWorkbookM],
    ["ujukid", Number(String(v(`F${tech}`)).match(/^(\d+)/)?.[1]), mod.floatsPerModule], ["vabaparras (hinnakiri)", v(`G${tech}`), mod.freeboardWorkbookM],
    ["kN/m2", v(`H${tech}`), mod.loadKnPerM2], ["kg", v(`I${tech}`), mod.loadKg], ["kaal", v(`J${tech}`), mod.weightKg],
    ["moodulirea kood (rida " + (21 + i) + ")", v(`A${21 + i}`), code], ["SET-rea kood (rida " + (3 + i) + ")", v(`A${3 + i}`), code],
  ];
  for (const [what, got, want] of checks) if (got !== want) problems.push(`${code} ${what}: hinnakiri=${got} kataloog=${want}`);
}
console.log(problems.length ? `VIGU (${problems.length}):\n${problems.join("\n")}` : "OK: 9 mudelit, MODULE ja SET read ning tehnilised väärtused ühtivad hinnakirjaga.");
process.exit(problems.length ? 1 : 0);
