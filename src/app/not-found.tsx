import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <h1 className="text-xl font-bold">Lehte ei leitud</h1>
      <p className="my-2">Kirjet ei leitud - see võib olla kustutatud.</p>
      <Link className="btn btn-primary" href="/history">
        Varasemad kontrollid
      </Link>
    </div>
  );
}
