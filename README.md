# Top Marine SP Order Checker (õppetöö demo)

Tarkvaratehnoloogiate õppetöö: veebirakendus, millega Top Marine'i töötaja kontrollib **SP (Swimming Pontoon with Plastic Floats)** pontoonide
päringuid ja tellimusi. Liides on eesti keeles. Töötaja, mitte edasimüüja, kasutab rakendust.

> **Demo.** Kasuta ainult fiktiivseid või anonüümseid kliente ja andmeid. Rakendus on avalik ega sobi päris konfidentsiaalsete tellimuste jaoks.
> Hindu ei impordita ega kuvata; allikadokumentide originaale ei avaldata.

**Positiivne tulemus ("Vastab") tähendab ainult, et rakenduses realiseeritud kontrollid läbiti. See ei ole Top Marine'i inseneri kinnitus ega hinnang
konstruktsiooni, ankurduse, kandevõime ega sobivuse kohta.**

## Töövoog (kasutaja vaates)

1. Avalehel **"Lisa tellimus või päring"**: kleebi kliendi e-kiri ja/või lae üles dokumendid (PDF, Excel, Word), vajuta **"Loe ja kontrolli"**.
2. Rakendus näitab edenemist (lugemine -> andmete väljavõte -> kontroll). Skaneeritud PDF-i OCR võib võtta minuteid.
3. Tulemuses on esikohal need punktid, mis vajavad tähelepanu (ülevaatus, vastuolu, puuduv info), koos täpsustava küsimusega. Iga leitud väärtuse ja
   iga leiu juures saab avada **allika**: dokument, asukoht (lk/rida, leht+lahter, lõik/tabel) ja täpne katkend.
4. Küsitakse alles pärast lugemist ja ainult seda, mis on tegelikult puudu või ebaselge. Väärtust saab parandada ("Paranda või täienda andmeid") ja
   **"Kontrolli uuesti"** ei loe dokumente uuesti ega kutsu mudelit (ei maksa lisaks). Algselt loetud väärtus jääb nähtavaks.
5. Salvestatud kirjed, loetud tõendid ja muutumatud kontrollikäivitused (reeglite versioon, mudel, väljavõtte versioon) on ajaloos. Käsitsi sisestamine
   ("Sisesta käsitsi") on teisene tööriist.

## Sisendid ja nende lugemine

| Sisend | Kuidas loetakse | Viide tulemuses |
|---|---|---|
| Kleebitud tekst | rea kaupa | rida N |
| PDF (tekstiline) | `unpdf` (pdf.js) tekst lehekülje ja rea kaupa | lk N rida M |
| PDF (skaneeritud / lehed ilma tekstikihita) | lehe renderdus (`@napi-rs/canvas`) + OCR `tesseract.js` (eesti + inglise, keeleandmed npm-paketist) lehtede kaupa | lk N rida M (OCR) |
| Excel `.xlsx` ja vana `.xls` | SheetJS; kõik mittetühjad lehed, päiserea tuvastus, lahtri koordinaadid, ühendatud lahtrite (mitmele reale) väärtus | Leht "X" rida N (A7:G7) |
| Word `.docx` | `mammoth` -> lõigud ja tabelite read | lõik N / tabel T rida R |
| Word `.doc` (Word 97-2003) | `word-extractor` (päris parser, mitte ümbernimetamine) | lõik N |

Makrosid ei käivitata (ainult tekst loetakse). Parooliga kaitstud, vigased, ümber nimetatud, liiga suured või toetamata failid märgitakse nähtavalt
(Eesti keeles) ega kao vaikselt; **loetamatu või osaliselt loetud dokument takistab tingimusteta järeldust "kõik dokumendid kontrollitud"** (reegel R-DOC-01).
Tehniliste joonistete tõlgendamine, CAD ja joonise mõõtude väljavõte on tahtlikult väljas.

**Piirid** (`src/lib/ingest/limits.ts`): kuni 5 faili, 10 MB faili kohta, 20 MB kokku; kleebitud tekst 30 000 märki; PDF kuni 20 lehte, neist OCR kuni 6 lehte;
Excel kuni 12 lehte, 400 rida lehe kohta; mudelile saadetakse kuni 60 000 märki; faili lugemise ajalimiit 150 s; korraga töötleb üks analüüs. Need on valitud
Renderi Free (512 MB RAM) jaoks, kuid **Renderis ei ole neid proovitud** (vt "Mis on testitud").

## Semantiline väljavõte (LLM) ja kaitse

- Pakkuja: **Anthropic Claude API** (`@anthropic-ai/sdk`), struktureeritud väljund (JSON-skeem + zod), mudel seadistatav (`LLM_MODEL`, vaikimisi `claude-opus-5-5`).
- Mudel saab loetud tekstilõigud ID-dega ja peab iga väite juurde andma lõigu ID ja sõnasõnalise katkendi. Server kontrollib: katkend peab olema tegelikult loetud
  tekstis, algne sõnastus katkendis, number ühtima sõnastusega (nt "2400 mm" -> 2,4), kuupäev ühtima, variant/ankurduse tüüp toetatud sõnastusega. Kontrollimata väited
  **visatakse ära**.
- Kliendi tekst on mudelile andmestik, mitte juhis. Mudelit ei kasutata kataloogi sobitamiseks ega kontrolliks: need on deterministlikud (`src/lib/validation/`).
- Mitme dokumendi liitmine on deterministlik (`src/lib/extract/build.ts`): sama toode e-kirjas ja manuses on **üks** rida (kogust ei kahekordistata); erinev kogus/mõõt
  tekitab "Vastuolu" mõlema allikaga ja jääb lahendamata, kuni kasutaja valib.
- Seadistamata korral näitab rakendus **"Automaatne analüüs pole seadistatud"** (ei näita võltstulemusi).
- **Kulu ja privaatsus:** tekst ja failid saadetakse analüüsiks Anthropicule; API kasutus on tasuline (Claude.ai tellimus API võtit ei anna).
  Originaalfaile ei salvestata (Renderi ketas on ajutine): salvestatakse loetud tekst, leitud andmed, tõendid ja tulemused PostgreSQL-i; originaale hiljem alla laadida ei saa.
- **Ligipääsukaitse:** tootmises on analüüs **keelatud**, kuni serveris on `ANALYSIS_ACCESS_CODE`; kasutaja sisestab koodi (HttpOnly küpsis). Lisaks: 10 analüüsi/tunnis IP kohta
  (mälupõhine, nullub taaskäivitusel) ja päevapiir `ANALYSIS_DAILY_LIMIT` (vaikimisi 30, loendatakse andmebaasist).

## Render-i seadistus

Midagi ei ole minu poolt Renderis loodud ega kontrollitud - sammud teed ise.

1. **PostgreSQL:** Render -> New -> PostgreSQL, **Frankfurt**, Free (*tasuta andmebaas aegub 30 päeva pärast*).
2. **Web Service:** GitHubi repo `anneliprodel-jpg/topmarine-validator`, **branch `main`**, Frankfurt, **Free** (*uinub passiivsusel*).
   Build Command `npm install && npm run build`, Start Command `npm start`.
3. **Keskkonnamuutujad** (Environment; väärtusi ära kleebi vestlusesse):

| Nimi | Kohustuslik | Mida |
|---|---|---|
| `DATABASE_URL` | jah | andmebaasi **Internal Database URL** (kopeeri otse) |
| `ANTHROPIC_API_KEY` | analüüsiks jah | Anthropic Console'i API võti (**kasutus on tasuline**) |
| `ANALYSIS_ACCESS_CODE` | analüüsiks jah (tootmises) | enda mõeldud pikk juhuslik ligipääsukood |
| `LLM_MODEL` | ei | vaikimisi `claude-opus-5-5`; odavam nt `claude-sonnet-5-5` |
| `LLM_EFFORT` | ei | `low` / `medium` (vaikimisi) / `high` |
| `ANALYSIS_DAILY_LIMIT` | ei | vaikimisi 30 |

4. Käivitamisel rakendatakse migratsioonid (`prisma migrate deploy`) ja seed; korduv käivitus ei dubleeri ega lähtesta andmeid. Migratsioonid on **additiivsed**
   (`20261028000000_init`, `20261029000000_add_technical_and_site_fields`, `20261030000000_document_analysis`); varasemad kirjed ja raportid säilivad.
   **Migratsioonide rakendumist Renderi andmebaasi vastu ei ole veel kontrollitud.**

Ressursirisk: Free-teenuse 512 MB RAM võib OCR-i (WASM) jaoks olla kitsas. Kui OCR kukub mälu tõttu, vähenda `maxOcrPages` (`limits.ts`) või kasuta suuremat instantsi;
OCR on järjekorras (üks korraga) ja töötaja lõpetatakse iga töö järel.

## Testid ja skriptid

`npm test` (Vitest), `npm run typecheck`, `npm run build`. Sünt-fixture'id (fiktiivne klient) on kaustas `test/fixtures/`: `scripts/make-fixtures.ts` (PDF, skaneeritud PDF, xlsx, xls, vigased failid)
ja `scripts/make-word-fixtures.ps1` (päris `.docx` ja `.doc` Microsoft Wordiga). `scripts/verify-catalogue.ts <hinnakiri.xlsx>` võrdleb kataloogi hinnakirja SP lehega.
Päris mudeli test `test/live.test.ts` jookseb ainult siis, kui `ANTHROPIC_API_KEY` on seatud (`npx vitest run test/live.test.ts`).

## Mis on testitud ja mis mitte

**Tehtud (kohalikult):**
- Kõik lugemisviisid **päris failidega**: tekstiline PDF, skaneeritud PDF **päris OCR-iga**, `.xlsx`, **päris `.xls` (BIFF8)**, `.docx` ja **päris `.doc`** (Wordiga loodud), kleebitud tekst;
  asukohaviited, mitu lehte/tühi esimene leht/ühendatud päis, vigased/ümber nimetatud/tühjad/liiga suured/toetamata failid, "parooliga" OLE-fail.
- Viidete kontroll (väljamõeldud tsitaat, vale number/kuupäev/variant), liitmine (e-kiri + manus ei kahekordista; vastuolulised kogused; liitmisvastuolu), mootor (vastuolu kataloogiga,
  puuduv info, tundmatu toode, SET, mm/koma), parandus ja uuesti kontroll, dokumentide oleku mõju, ligipääsu ja seadistuse loogika.
- Päris Next.js tootmisserver (`next start`) **ilma andmebaasita**: `/api/analyze/config` ja `POST /api/analyze` tagastab seadistamata korral "Automaatne analüüs pole seadistatud" (503).
- Kataloog võrreldud hinnakirja SP lehega (`verify-catalogue.ts`): 9 mudelit, MODULE ja SET read, tehnilised väärtused ühtivad.
- Torustiku testid kasutavad **skriptitud mock-väljavõtjat** (`test/helpers/scripted.ts`, selgelt märgitud). **Mock ei tõesta, et päris semantiline väljavõte töötab.**

**EI ole tehtud / kontrollimata:**
- **Päris LLM-väljavõte** (puudub API võti): skeem, prompt ja Anthropic-kutse (`messages.parse` + `zodOutputFormat`) on kirjutatud ametliku SDK dokumentatsiooni järgi, kuid ei ole ühegi päris
  vastuse vastu proovitud. Mudeli väljund ei pruugi alati läbida viidete kontrolli; sel juhul jäävad väärtused tühjaks (ja küsitakse), mitte ei teki valesid.
- **Brauseritest** (kleebi/lae -> loe -> eeltäidetud tulemus -> parandus -> uuesti kontroll -> salvesta/ava): ei ole tehtud (vaja andmebaasi, API võtit ja Renderi paigaldust).
- Migratsioonide rakendumine Renderi PostgreSQL-is; andmete säilimine uue paigalduse järel; Renderi Free mälu/aja piirid OCR-iga; mobiilivaade; teisest seadmest avamine.
- Ei ole testitud: väga suured failid (>piir), ega paralleelsed kasutajad.
- Kasutajaliidese uued komponendid (`AnalyzeBox`, `ProcessingStatus`, `ExtractedFacts`) on ainult tüübi- ja build-kontrollitud.

## Allikad ja tõendusstaatus

Iga mudeli ja reegli juures on allika fail, leht/lehekülg/lahtrivahemik, kuupäev (kui teada) ja tõendusstaatus. Viitedokumendid olid kohalikul teel
(väljaspool repot; ühtegi originaali ei commit'ita): tootePDF (3 lk, rev. 01.01.2023), paigaldusjuhend (9 lk, CONFIDENTIAL - kasutatakse ainult komponentide koode),
`Selection of pontoons.xlsx` ja hinnakirja SP leht (SET read 3-11, moodulid 21-29, puitkatted 31-39, ujukid/liitmik/külgkate 40-45, tehniline tabel 49-57). Hindu ei impordita.

Lahendamata allikate vastuolud (nähtavad lehel "Tooted ja kontrollireeglid"; need mõjutavad tellimust ainult siis, kui see neist sõltub):
- Kõrgus: PDF 0,43 m vs hinnakiri ja kokkuvõttetabel 0,39 m.
- Vabaparras: PDF 0,34-0,37 m vs hinnakiri 0,33-0,35 m vs kokkuvõttetabel 0,3 m.
- Kokkuvõttetabel C11 loetleb ainult laiuse 2,0 m; detailtabelid 2,0 / 2,4 / 3,0 m (kasutusel detailtabelid).
- Kokkuvõttetabel C14: 1,0 kN/m² vs mudelipõhised 0,52-1,18 kN/m².
- Kasutusotstarve: PDF "swimming areas, beaches" vs kokkuvõttetabel "swimming, landing stages".

Kontrollireeglid (täielik nimekiri, sh keelatud/kinnitamata, lehel "Tooted ja kontrollireeglid"): mudeli/koodi vaste, laius/pikkus/ujukid (kliendi väärtus vs kataloog; mooduli kohta ja kokku eraldi),
MODULE/SET, ühendus, ankurdus (kataloogis loetletud: kett, betoonankur, vai; "Muu" -> ülevaatus), kaldaühendus, asukoha piirid (laine 0,2 m, hoovus 1 m/s, paat 6,1 m), talvekasutus (PDF: lahti monteerida),
dokumentide olek ja dokumentidevahelised vastuolud. Ühenduskomponentide kogust **ei arvutata**; hinget ei määrata automaatselt.

## Näidistekst kiireks proovimiseks

Kleebi avalehel "Lisa tellimus või päring" (fiktiivne):

```
Tere! Meie merekeskus (näide, fiktiivne) soovib TELLIDA järgmise.
Klient: Näidis Merekeskus OÜ
Projekt: Näidis Sadam 2027
Tellime 2 tk SP ujuvpontooni 02 12 04 moodul, kumbki 2,4 x 4 m, 4 ujukit mooduli kohta.
Soovitud tarne: 15.05.2027.
Ankurdus: ketiankur 13 mm, 2 tk.
Kaldaühendust ei ole. Moodulid paigaldatakse eraldi.
```

Oodatav: 1 tootrida (02 12 04, MODULE, 2 tk, 2,4 x 4 m, 4 ujukit mooduli kohta), tellimus, tarne 2027-05-15, kett; vastuolu kataloogiga ei ole. Muuda tekstis laius 3,0 m ja ujukid 6 -> tekivad vastuolud.

## Hilisem GitHub Pull Requests harjutus

Footer-muudatus on **tahtlikult teostamata**. Kui soovid harjutust, palu see eraldi: muudatus tehakse harul `feature/footer`, build jooksutatakse, kuid **ei commit'ita ega push'ita** -
õpilane teeb commit'i, publitseerimise, PR-i, rea-kommentaari ja merge'i ise VS Code'is.

## Õppetöö kõrvalekalded

- **Paigaldus: Render, mitte Railway** (Railway ligipääs puudub); õppejõud ei ole seda kinnitanud.
- **See ei ole üldine vestlusrobot**: valdkonnapõhine tellimuste kontrollirakendus; rakendus ei väida, et rahuldab chatbot-spetsiifilisi hindamiskriteeriume.
- Esialgne spetsifikatsioon keelas OCR-i ja automaatse väljavõtte; see parandati (vt `CLAUDE.md`).
