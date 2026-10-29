// Analüüsi lõpp-punktide kaitse: serveripoolne ligipääsukood + piirangud. Peidetud nupp ei ole kaitse.
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { getLlmConfig } from "./extract/provider";

export const ACCESS_COOKIE = "tm_access";

const accessCode = () => process.env.ANALYSIS_ACCESS_CODE?.trim() || null;
const token = (code: string) => createHmac("sha256", code).update("tm-access-v1").digest("hex");

export function accessRequired(): boolean {
  return process.env.NODE_ENV === "production" || !!accessCode();
}

export function checkCode(given: string): boolean {
  const code = accessCode();
  if (!code) return false;
  const a = Buffer.from(createHmac("sha256", "cmp").update(given).digest());
  const b = Buffer.from(createHmac("sha256", "cmp").update(code).digest());
  return timingSafeEqual(a, b);
}

export function accessCookieValue(): string | null {
  const code = accessCode();
  return code ? token(code) : null;
}

export function readCookie(req: Request, name: string): string | null {
  const m = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

export function isAuthorized(req: Request): boolean {
  if (!accessRequired()) return true;
  const expected = accessCookieValue();
  const got = readCookie(req, ACCESS_COOKIE);
  if (!expected || !got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

// Mälupõhine piirang (ühe serveriprotsessi piires; uuel käivitusel nullub)
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

export const DAILY_LIMIT = () => Number(process.env.ANALYSIS_DAILY_LIMIT ?? 30) || 30;
export async function dailyLimitReached(): Promise<boolean> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const n = await prisma.submission.count({ where: { source: "AUTO", createdAt: { gte: since } } });
  return n >= DAILY_LIMIT();
}

export interface AnalysisConfigStatus {
  configured: boolean;
  accessRequired: boolean;
  accessConfigured: boolean;
}
export function configStatus(): AnalysisConfigStatus {
  return { configured: !!getLlmConfig(), accessRequired: accessRequired(), accessConfigured: !!accessCode() };
}
