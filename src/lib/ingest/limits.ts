// Piirid on valitud Renderi Free teenuse (512 MB RAM, 0,1 CPU) jaoks. Kontrollitud ainult kohalikult (vt README).
export const LIMITS = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxPasteChars: 30_000,
  maxPdfPages: 20,
  maxOcrPages: 6,
  maxSheets: 12,
  maxRowsPerSheet: 400,
  maxColsPerRow: 40,
  maxUnitsCharsToModel: 60_000,
  fileTimeoutMs: 150_000,
  ocrScale: 2,
} as const;

export function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  const timer = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(onTimeout()), ms);
  });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}
