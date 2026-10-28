import { notFound } from "next/navigation";
import { SubmissionForm } from "@/components/SubmissionForm";
import { getSubmission, loadCatalog } from "@/lib/repo";
import { toRaw } from "@/lib/validation/input";

export const dynamic = "force-dynamic";

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sub, catalog] = await Promise.all([getSubmission(id), loadCatalog()]);
  if (!sub) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Muuda: {sub.input.projectName || "(nimetu)"}</h1>
      <p className="hint">Muutmine ei kirjuta varasemaid kontrolliraporteid ümber; uus kontroll loob uue raporti.</p>
      <SubmissionForm id={id} initial={toRaw(sub.input)} products={catalog} />
    </div>
  );
}
