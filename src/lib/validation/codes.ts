/** Normaliseerib tootekoodi kujule "02 12 04". Eesnullid säilivad (töötleb stringina). */
export function normalizeCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = raw.replace(/[\s\-._/ ]+/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}`;
}

export function fmtM(n: number): string {
  return `${String(n).replace(".", ",")} m`;
}

export function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0005;
}
