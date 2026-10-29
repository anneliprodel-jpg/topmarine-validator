import { LIMITS } from "@/lib/ingest/limits";
import { configStatus, isAuthorized } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = configStatus();
  return Response.json({
    configured: s.configured,
    accessRequired: s.accessRequired,
    accessConfigured: s.accessConfigured,
    authorized: isAuthorized(req),
    limits: { maxFiles: LIMITS.maxFiles, maxFileMb: LIMITS.maxFileBytes / 1024 / 1024, maxTotalMb: LIMITS.maxTotalBytes / 1024 / 1024 },
  });
}
