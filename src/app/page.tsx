import Link from "next/link";
import { SubmissionList } from "@/components/SubmissionList";
import { listSubmissions } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const recent = await listSubmissions(8);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">SP ujuvpontoonide päringute ja tellimuste kontroll</h1>
      <p>
        Töövahend Top Marine&apos;i töötajale: sisesta struktureeritud päring või tellimus, kontrolli täielikkust ja kataloogi vastavust ning
        salvesta tulemused. Rakendus ei hinda konstruktsiooni sobivust ega asenda inseneri.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link className="btn btn-primary" href="/submissions/new?type=ENQUIRY">Uus päring</Link>
        <Link className="btn btn-primary" href="/submissions/new?type=ORDER">Uus tellimus</Link>
        <Link className="btn" href="/history">Varasemad kontrollid</Link>
        <Link className="btn" href="/catalogue">Tooted ja kontrollireeglid</Link>
        <Link className="btn btn-accent" href="/demos">Näidisjuhtumid</Link>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold text-navy">Viimased kirjed</h2>
        <SubmissionList rows={recent} />
      </section>
    </div>
  );
}
