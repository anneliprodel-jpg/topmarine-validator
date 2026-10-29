import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Top Marine SP tellimuse kontroll (õppetöö demo)",
  description: "Demo: SP ujuvpontoonide päringute ja tellimuste kontroll. Õppetöö MVP, mitte Top Marine'i toode.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const NAV = [
  ["/", "Lisa tellimus või päring"],
  ["/history", "Varasemad kontrollid"],
  ["/catalogue", "Tooted ja kontrollireeglid"],
  ["/demos", "Näidisjuhtumid"],
  ["/submissions/new?type=ORDER", "Sisesta käsitsi"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">
          Mine sisu juurde
        </a>
        <header className="bg-navy text-white">
          <div className="mx-auto max-w-5xl px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href="/" className="text-lg font-bold text-white no-underline">
                Top Marine · SP tellimuse kontroll
              </Link>
              <span className="rounded border border-teal px-2 text-sm text-teal">DEMO</span>
            </div>
            <details className="mt-2 sm:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center rounded border border-white px-3 font-semibold text-white">
                Menüü
              </summary>
              <nav aria-label="Peamenüü" className="mt-2 flex flex-col gap-1">
                {NAV.map(([href, t]) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center rounded px-2 text-white hover:bg-navy-soft">
                    {t}
                  </Link>
                ))}
              </nav>
            </details>
            <nav aria-label="Peamenüü" className="mt-2 hidden flex-wrap gap-1 sm:flex">
              {NAV.map(([href, t]) => (
                <Link key={href} href={href} className="flex min-h-11 items-center rounded px-3 text-white hover:bg-navy-soft">
                  {t}
                </Link>
              ))}
            </nav>
          </div>
          <div className="bg-teal-dark px-4 py-1 text-center text-sm text-white">
            Õppetöö demo: kasuta ainult fiktiivseid kliente ja andmeid. Ära sisesta päris konfidentsiaalseid tellimusi. Tulemus ei ole inseneri kinnitus.
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-sm text-slate-600">
          Tarkvaratehnoloogiate õppetöö projekt. Hindu ega allikadokumentide originaale ei avaldata.
        </footer>
      </body>
    </html>
  );
}
