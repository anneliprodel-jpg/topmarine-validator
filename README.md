# Top Marine SP Order Checker (õppetöö demo)

Tarkvaratehnoloogiate õppetöö MVP: veebirakendus, millega Top Marine'i töötaja kontrollib **SP (Swimming Pontoon with Plastic Floats)**
pontoonide päringuid ja tellimusi. Liides on eesti keeles. Töötaja, mitte edasimüüja, kasutab rakendust.

> **Demo.** Kasuta ainult fiktiivseid kliente ja andmeid. Rakendus on anonüümne ega sobi päris konfidentsiaalsete tellimuste jaoks.
> Autentimine ja tootmiskasutus on MVP-st väljas. Hindu ei impordita ega kuvata; allikadokumentide originaale ei avaldata.

**Positiivne tulemus ("Vastab") tähendab ainult, et rakenduses realiseeritud kontrollid läbiti. See ei ole Top Marine'i inseneri kinnitus
ega hinnang konstruktsiooni, ankurduse, kandevõime ega sobivuse kohta.**

## Õppetöö kõrvalekalded ja piirangud (selgesõnaliselt)

- **Paigaldus: Render, mitte Railway.** Railway ligipääs ei ole kättesaadav, seetõttu kasutatakse Renderit (veebiteenus + Render PostgreSQL).
  See on õppetöö nõuete kõrvalekalle; **õppejõud ei ole seda kinnitanud** (kinnitus tuleb eraldi küsida).
- **See ei ole üldine vestlusrobot.** Tegemist on valdkonnapõhise tellimuste kontrollirakendusega, mitte õppetöö näite üldise chatbotiga.
  Rakendus **ei väida**, et rahuldab chatbot-spetsiifilisi hindamiskriteeriume.
- Ei sisalda OCR-i, CAD-analüüsi, joonise üleslaadimist, tehisintellekti väljavõtet, tasulisi AI API-sid, hinnapakkumisi ega automaatset
  insenerikinnitust. Valikuline algne tellimustekst on ainult viide - seda **ei tõlgendata automaatselt**.
- Scope: ainult SP ja otseselt asjakohased tarvikud (ECO-märgisega hinged on SP tarvikud, mitte ECO pontoonid).

## Tehnoloogia

Next.js 15 (App Router), TypeScript, Tailwind CSS 4, Prisma 6 ORM, PostgreSQL. Valideerimismootor (`src/lib/validation/`) on UI-st ja
püsivusest (`src/lib/repo.ts`) eraldi ning testitav ilma andmebaasita. Kataloog ja reeglid on versioneeritud failis
`src/lib/catalogue/data.ts` ja jõuavad andmebaasi idempotentse seediga.

## Render-i seadistus (sammud kasutajale)

Midagi pole veel loodud ega paigaldatud - allolevad sammud tuleb ise teha.

1. **PostgreSQL:** Render dashboard -> New -> PostgreSQL. Region **Frankfurt (EU Central)**, sama mis veebiteenusel. Vali tasuta plaan
   (*tasuta andmebaas aegub 30 päeva pärast*, vt allpool). Tasuta ressursse ei looda automaatselt.
2. **Web Service:** New -> Web Service -> ühenda GitHubi repo `anneliprodel-jpg/topmarine-validator`, **branch `main`**, region **Frankfurt**,
   plaan **Free** (*tasuta veebiteenus uinub passiivsusel; esimene päring pärast und võib olla aeglane*).
   - Runtime: Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. **DATABASE_URL:** andmebaasi lehelt kopeeri **Internal Database URL** otse veebiteenuse Environment -> `DATABASE_URL` väärtuseks.
   **Ära kleebi andmebaasi andmeid vestlusesse ega GitHubi.** Rakendus loeb URL-i ainult keskkonnamuutujast (vt `.env.example`).
4. Deploy. Esimesel käivitusel rakendatakse migratsioonid ja seed automaatselt.

### Käsud

| Skript | Mida teeb |
|---|---|
| `npm run build` | `prisma generate && next build` (andmebaasiühendust ei vajata) |
| `npm start` | `prisma migrate deploy` -> `tsx prisma/seed.ts` -> `next start -H 0.0.0.0 -p $PORT` |
| `npm test` | Vitest ühikutestid (puhas mootor + sisendi valideerimine) |
| `npm run typecheck` | TypeScript kontroll |

Tasuta Renderi plaan ei võimalda pre-deploy käsku, shelli, SSH-d ega ühekordseid töid, seetõttu käivad migratsioonid ja seed `npm start`-is.
Seed kasutab `upsert`-e looduslike võtmete järgi: korduv käivitus ei dubleeri ega lähtesta päringuid, ridu ega kontrolliraporteid; ta kirjutab
ainult kataloogi-, allika-, reegli- ja vastuolutabeleid. `tsx` ja `prisma` on tootmises vajalike sõltuvustena `dependencies` all.
Migratsioonid on genereeritud käsuga `prisma migrate diff --from-empty --to-schema-datamodel` (kohalikku andmebaasi pole vaja).
**Migratsiooni rakendumist Renderi andmebaasi vastu ei ole veel kontrollitud.**

### Tasuta plaani piirangud

- Render tasuta PostgreSQL **aegub 30 päeva pärast** - enne seda ekspordi vajalik või tee uus andmebaas.
- Tasuta veebiteenus **uinub** passiivsuse korral; esimene päring ärkab aeglaselt.

## Andmemudel

`SourceReference`, `ProductVariant` (sisemine unikaalne ID + `variant` MODULE/SET/ACCESSORY; kood üksi ei ole unikaalne), `SourceConflict`,
`ValidationRule`, `Submission`, `SubmissionLine`, `ValidationRun`. Käivitus (`ValidationRun`) salvestab sisendi hetktõmmise (JSON),
tulemused ja reeglite versiooni ning on muutumatu; hilisem muutmine ei kirjuta varasemat raportit ümber. Päringu kustutamine kustutab
kaskaadina read ja käivitused. `localStorage` ei ole andmete allikas.

## Allikad ja tõendusstaatus

Iga mudeli ja reegli juures on allika fail, leht/lehekülg/lahtrivahemik, kuupäev (kui teada) ja tõendusstaatus: *kinnitatud mitmest allikast*,
*üks allikas*, *vaidlustatud*, *MVP töövoo eeldus*. Üheksa mudeli mõõdud ja ujukite arv ühtivad toote PDF-i lk 3 ja 2026. a SP hinnakirja
vahel; need sobivad demoks, kuid **ei ole Top Marine'i ametlik insenerikinnitus**. Täpseid hinnakirja ridu ei ole siin kinnitatud
(`source-documents/` ei olnud selle töö ajal kättesaadav - allikaid ei ole faili tasemel üle kontrollitud ja andmed põhinevad ülesande
tekstis esitatud ülekirjutusel).

### Lahendamata allikate vastuolud (nähtavad rakenduses)

- Kõrgus: PDF 0,43 m vs hinnakiri 0,39 m.
- Vabaparras (freeboard): varieerub mudeliti ja PDF erineb töövihikust.
- Kokkuvõttetabel `Selection of pontoons`, C11, loetleb ainult laiuse 2,0 m, aga detailtabelid sisaldavad 2,0 / 2,4 / 3,0 m. MVP kasutab
  detailseid, kahes allikas ühtivaid mõõte.
- Kokkuvõttetabel C14: 1,0 kN/m², detailtabelid: mudelipõhised väärtused.

Kõrgust, vabaparrast ja koormussobivust **ei kontrollita automaatselt**; kui päring neist sõltub, on tulemuseks *Vajab inseneri ülevaatust*.

## Kontrollireeglid (lühidalt)

Tulemused: *Vastab*, *Puuduv info*, *Hoiatus*, *Vajab inseneri ülevaatust*, *Ei kohaldu*. Iga tulemus näitab reegli ID, kontrollitu, esitatud ja
oodatud väärtuse, allika ning täpsustava küsimuse. Täielik nimekiri (sh keelatud/kinnitamata reeglid) on rakenduses lehel "Tooted ja
kontrollireeglid". Peamised punktid: kogus peab olema positiivne täisarv; puuduv valikuline väärtus on `null`, mitte 0, ja tähendab "ei
kontrollitud"; mooduli kohta ja kokku ujukite arv on eraldi märgitud; täielik moodul sisaldab ujukid; SET koosseis, tundmatu toode, vana
tüüpi ujukid, mittestandardne ankurdus ja selgesõnaline talvekasutus nõuavad ülevaatust; moodulite ühenduskomponentide kogust **ei arvutata**
(vana valemit 2 x (n-1) ei kasutata).

### MVP töövoo eeldused (mitte kontrollitud ettevõtte poliitika)

Projekt ja klient on vajalikud lõpetatud kontrolliks; tellimusel on vaja tarnekuupäeva ja vähemalt ühte tootrida; päringul puuduv info annab
täpsustusi ega põhjusta automaatset tagasilükkamist; ketiankurdus koos üksikasjadega loetakse "standardseks" ainult täielikkuse mõttes.

## Mida pole veel tehtud / käsitsi kontrollida

Kohalikud ühikutestid ja `npm run build` on tehtud. **Ei ole tehtud:** Renderi andmebaasi loomine, paigaldus, migratsiooni rakendumine,
seedi käivitus Renderis, ega ükski brauseri-, mobiili- või Renderi test. Kontrollnimekiri pärast paigaldust:

- [ ] Loomine, salvestamine, uuesti laadimine, avamine, muutmine, uuesti kontroll, kustutamine (kinnitusega)
- [ ] JSON-eksport ja prindi/PDF vaade
- [ ] Kontrollide ajalugu ja muutumatud raportid pärast muutmist
- [ ] Sama kirje teisest seadmest
- [ ] Vigane kogus (0, -1, 1,5, tekst), tühi päring, andmebaasi veateade
- [ ] Töölaua ja mobiili paigutus
- [ ] Andmed säilivad uue paigalduse (redeploy) järel; korduv käivitus ei dubleeri seedi andmeid
- [ ] Näidisjuhtumid A, B (ka päringuks muutes), C

## Hilisem GitHub Pull Requests harjutus

Väike footer-muudatus on **tahtlikult teostamata**. Kui soovid harjutust, palu see eraldi: muudatus tehakse harul `feature/footer`, build
jooksutatakse, kuid **ei commit'ita ega push'ita** - õpilane teeb commit'i, publitseerimise, PR-i, rea-kommentaari ja merge'i ise VS Code'is.

## Failid

`src/lib/validation/` (mootor, sisendi parser, testid) · `src/lib/catalogue/data.ts` · `src/lib/repo.ts` · `prisma/` (skeem, migratsioon, seed) ·
`src/app/` (lehed, serveri tegevused) · `CLAUDE.md` (projekti reeglid).
