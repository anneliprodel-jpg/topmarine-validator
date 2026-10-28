import { loadDemoAction } from "@/app/actions";
import { buildDemoCases } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function Demos() {
  const cases = buildDemoCases(new Date());
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Näidisjuhtumid</h1>
      <p>
        Laadimine loob alati uue redigeeritava koopia; varasemat tööd ei kirjutata üle. Kõik andmed on fiktiivsed, kuupäevad on seotud
        laadimise hetkega.
      </p>
      {cases.map((c) => (
        <section key={c.key} className="card">
          <h2 className="text-lg font-bold">{c.title}</h2>
          <p className="my-2">{c.description}</p>
          <form action={loadDemoAction.bind(null, c.key)}>
            <button className="btn btn-accent" type="submit">
              Lae redigeeritava koopiana
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
