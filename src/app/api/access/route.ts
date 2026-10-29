import { ACCESS_COOKIE, accessCookieValue, checkCode, clientIp, rateLimited } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (rateLimited(`access:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return Response.json({ error: "Liiga palju katseid. Proovi mõne minuti pärast." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const value = accessCookieValue();
  if (!value || !checkCode(String(body.code ?? ""))) return Response.json({ error: "Vale ligipääsukood." }, { status: 401 });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${ACCESS_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`,
    },
  });
}
