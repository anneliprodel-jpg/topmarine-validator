import { extractFromFile, ImportError, MAX_BYTES } from "@/lib/import/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loeb üleslaaditud faili teksti. Faili ei salvestata. Tulemus on ainult tekst. */
export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 100_000) {
    return Response.json({ error: "Fail on liiga suur (maksimaalselt 5 MB)." }, { status: 413 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Faili ei valitud." }, { status: 400 });
    const result = await extractFromFile(file.name, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ fileName: file.name, ...result });
  } catch (e) {
    if (e instanceof ImportError) return Response.json({ error: e.message }, { status: 422 });
    console.error("extract failed", e);
    return Response.json({ error: "Faili töötlemine ebaõnnestus." }, { status: 500 });
  }
}
