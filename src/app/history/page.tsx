import { SubmissionList } from "@/components/SubmissionList";
import { listSubmissions } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function History() {
  const rows = await listSubmissions();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Varasemad kontrollid</h1>
      <SubmissionList rows={rows} />
    </div>
  );
}
