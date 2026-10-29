import Link from "next/link";
import { AnalyzeBox } from "@/components/AnalyzeBox";
import { SubmissionList } from "@/components/SubmissionList";
import { listSubmissions } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const recent = await listSubmissions(8);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">SP ujuvpontoonide päringute ja tellimuste kontroll</h1>
      <AnalyzeBox />
      <p className="text-sm">
        Teisesed tööriistad:{" "}
        <Link className="underline" href="/submissions/new?type=ORDER">sisesta käsitsi</Link> ·{" "}
        <Link className="underline" href="/history">varasemad kontrollid</Link> ·{" "}
        <Link className="underline" href="/catalogue">tooted ja kontrollireeglid</Link> ·{" "}
        <Link className="underline" href="/demos">näidisjuhtumid (käsitsi koostatud)</Link>
      </p>
      <section>
        <h2 className="mb-2 text-lg font-bold text-navy">Viimased kirjed</h2>
        <SubmissionList rows={recent} />
      </section>
    </div>
  );
}
