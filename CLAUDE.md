# CLAUDE.md - Top Marine SP Order Checker (õppetöö demo)

## Projekt
Eestikeelne Next.js (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL rakendus SP (plastujukitega ujuvponton) päringute/tellimuste
kontrolliks. Töötaja kasutab, mitte edasimüüja. Deterministlik reeglipõhine mootor; ei ole vestlusrobot ega joonise analüsaator.

## Reeglid
- Scope ainult SP ja otseselt asjakohased tarvikud. Ei ECO/BP/betoonpontoone. ECO-hinged on SP tarvikud.
- Ei OCR-i, CAD-i, joonise üleslaadimist, AI väljavõtet, tasulisi AI API-sid, hindu/pakkumisi ega automaatset insenerikinnitust.
- Algne tellimustekst on ainult viide; ära vihja automaatsele tõlgendamisele.
- Valideerimismootor (`src/lib/validation/`) on puhas ja eraldi UI-st/Prisma-st. Reegli muudatus -> uuenda `src/lib/catalogue/data.ts`
  (RULES, RULES_VERSION), testid ja seed; ära kirjuta salvestatud ValidationRun kirjeid ümber.
- Tootekoodid on stringid (eesnullid!). Kood üksi ei ole unikaalne - kasuta `internalId` + `variant` (MODULE/SET/ACCESSORY).
- Puuduv valikuline arv = `null`, mitte 0. Ära kunagi leiuta väärtusi ega muuda ebakindlust PASS-iks.
- Vaidlustatud kõrgus/vabaparras/koormus -> inseneri ülevaatus. Allikate vastuolud peavad jääma nähtavaks. Ära vali allikat faili nime/uudsuse järgi.
- Ei kasuta valemit 2 x (moodulid - 1) ega määra automaatselt hinge tüüpi/kogust. SET koosseis vajab ülevaatust.
- Hindu ega originaaldokumente (`source-documents/`, tööjoonised, hinnakirja töövihik) ei commit'i ega avalikusta. `.env` ei kuulu Giti. Parooleid ei küsita vestluses.
- Liides eesti keeles; seis ei tohi toetuda ainult värvile.

## Paigaldus (Render, mitte Railway - õppetöö kõrvalekalle, õppejõu kinnitust ei ole)
- Render Free web service + Render PostgreSQL (Frankfurt, sama regioon). Deploy GitHubi `main` harust.
- Build: `npm install && npm run build` (= `prisma generate && next build`, ilma andmebaasiühenduseta).
- Start: `npm start` (= `prisma migrate deploy` -> `tsx prisma/seed.ts` -> `next start -H 0.0.0.0 -p $PORT`). Ei kasuta pre-deploy käsku, shelli, SSH-d.
- `DATABASE_URL` ainult keskkonnamuutujast (`.env.example`). Seed on idempotentne.
- Ära väida, et andmebaas, paigaldus, brauseri- või Renderi test on tehtud, kui seda tegelikult ei ole tehtud.
- Kohalikku andmebaasi ega veebiserverit ei seadistata; lubatud on kohalik build ja puhtad ühikutestid (`npm test`). Brauseritestid Renderi vastu.

## Töövoog
- Enne igat push'i: `npm test` ja `npm run build`. Tavalistes ülesannetes commit + push `main`-i, kui võimalik; muidu anna täpsed käsitsi sammud.
- Renderi deploy tuleb `main`-ist; teise haru push ei paiguta rakendust.
- **Footer/PR harjutus:** footer-muudatust ei tehta enne, kui õpilane seda küsib. Siis: tee muudatus harul `feature/footer`, jooksuta build,
  **ÄRA commit'i ega push'i** (see tühistab vaikimisi auto-commit reegli). Õpilane teeb commit'i, publish'i, PR-i, rea-kommentaari ja merge'i VS Code'is.
