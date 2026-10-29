import { createAnthropicExtractor, getLlmConfig, NOT_CONFIGURED_MESSAGE } from "@/lib/extract/provider";
import { LIMITS } from "@/lib/ingest/limits";
import { startAnalysis } from "@/lib/pipeline/run";
import { clientIp, configStatus, dailyLimitReached, isAuthorized, rateLimited } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const err = (message: string, status: number, extra: Record<string, unknown> = {}) => Response.json({ error: message, ...extra }, { status });

/** Võtab vastu kleebitud teksti ja/või failid, alustab analüüsi taustal ja tagastab kirje ID. */
export async function POST(req: Request) {
  const cfg = getLlmConfig();
  if (!cfg) return err(NOT_CONFIGURED_MESSAGE, 503, { code: "NOT_CONFIGURED" });
  const status = configStatus();
  if (status.accessRequired && !status.accessConfigured) {
    return err("Analüüs on keelatud, kuni serveris pole seadistatud ligipääsukood (ANALYSIS_ACCESS_CODE).", 503, { code: "ACCESS_NOT_CONFIGURED" });
  }
  if (!isAuthorized(req)) return err("Sisesta ligipääsukood.", 401, { code: "ACCESS_REQUIRED" });
  if (rateLimited(`analyze:${clientIp(req)}`, 10, 60 * 60 * 1000)) return err("Liiga palju analüüse selle tunni jooksul. Proovi hiljem uuesti.", 429);
  try {
    if (await dailyLimitReached()) return err("Päevane analüüside piir on täis. Proovi homme uuesti.", 429);
  } catch {
    return err("Andmebaasiga ühendus ebaõnnestus. Proovi mõne hetke pärast uuesti.", 503);
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > LIMITS.maxTotalBytes + 500_000) return err(`Failid on kokku liiga suured (piir ${LIMITS.maxTotalBytes / 1024 / 1024} MB).`, 413);

  let pasteText = "";
  const files: { name: string; bytes: Uint8Array }[] = [];
  try {
    const form = await req.formData();
    pasteText = String(form.get("text") ?? "");
    for (const f of form.getAll("files")) {
      if (f instanceof File && f.size > 0) files.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    }
  } catch {
    return err("Päringut ei õnnestunud lugeda.", 400);
  }
  if (!pasteText.trim() && files.length === 0) return err("Kleebi tekst või lisa vähemalt üks fail.", 400);
  if (files.length > LIMITS.maxFiles) return err(`Faile võib korraga olla kuni ${LIMITS.maxFiles}.`, 400);
  const total = files.reduce((n, f) => n + f.bytes.byteLength, 0);
  if (total > LIMITS.maxTotalBytes) return err(`Failid on kokku liiga suured (piir ${LIMITS.maxTotalBytes / 1024 / 1024} MB).`, 413);

  try {
    const id = await startAnalysis({ pasteText, files }, createAnthropicExtractor(cfg));
    return Response.json({ id }, { status: 202 });
  } catch (e) {
    console.error("start analysis failed", (e as Error)?.name);
    return err("Analüüsi alustamine ebaõnnestus (andmebaasi viga). Proovi mõne hetke pärast uuesti.", 503);
  }
}
