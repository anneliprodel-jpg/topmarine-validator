import { SubmissionForm } from "@/components/SubmissionForm";
import { loadCatalog } from "@/lib/repo";
import { emptyRawSubmission } from "@/lib/validation/input";

export const dynamic = "force-dynamic";

export default async function NewSubmission({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const t = type === "ORDER" ? "ORDER" : "ENQUIRY";
  const catalog = await loadCatalog();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">{t === "ORDER" ? "Uus tellimus" : "Uus päring"}</h1>
      <SubmissionForm id={null} initial={emptyRawSubmission(t)} products={catalog} />
    </div>
  );
}
