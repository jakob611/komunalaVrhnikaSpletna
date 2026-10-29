# KPV · Komunalno podjetje Vrhnika

Slovenski demonstracijski portal za pregled komunalnih storitev. React in TypeScript z Vite na odjemalcu; skupni Fetch API zaledni del za lokalni Node.js in Cloudflare Workers. To je oblikovni in funkcionalni prototip, ne uradna spletna stran podjetja.

**Objavljena predstavitev:** <https://kpv.jakobtominc.com> · Cloudflare Worker `kpv-portal`, baza D1 `kpv-portal` (EU), zasebni R2 `kpv-portal-photos`. Konfiguracija že vsebuje povezave do ustvarjenih virov. Resend pošilja obvestila o obrazcih skrbniku predstavitve; plačila so izključena.

Portal vsebuje 19 poti: začetno stran, tri področna izhodišča, zemljevid odpadkov, čarovnik, urnik, obvestila, ceste, prijavo napake, storitve, tržnico, kalkulator, DEPO, pokopališče, kontakte, podjetje, Moj dom in zasebnost. Podatki o naslovu v Moj dom ostanejo v brskalniku.

## Pokopališče in uradne ure

`/pokopalisce` vsebuje interaktivni ilustrativni načrt 96 grobov s 120 izmišljenimi osebami. Iskanje podpira šumnike, več oseb v grobu, letnice in oznake; vsi zadetki so označeni na načrtu. Podprti so povečava, premikanje, tipkovnica in povezava do izbranega groba. To ni dejanska evidenca ali posnetek pokopališča. Navodila za prihodnji posnetek in potrjene podatke so v [CEMETERY.md](docs/CEMETERY.md).

Kontakt vsebuje ločene razpredelnice rednih ur informacijske pisarne, zbirnega centra Tojnice in trgovine DEPO. Vir je uradna stran KPV, preverjeno 29. oktobra 2026; praznične izjeme niso modelirane, zato portal ne prikazuje oznake »odprto zdaj«.

## Kontaktni obrazec in zaščita

Kontakt ima sedem področij in odvisne podkategorije, uredljivo zadevo, sporočilo, ime, e-pošto, neobvezen telefon in privolitev. `/api/contact` sporočilo dejansko shrani v zasebno tabelo D1 `contact_submissions`. Ostali obrazci ostanejo v tabeli `submissions`. Javna oddaja ustvari tudi obvestilo skrbniku predstavitve prek Resend; podjetju KPV se ne pošlje.

Vseh pet oddaj varuje Cloudflare Turnstile v načinu Managed z `appearance: interaction-only`. Običajno poteka samodejno, potrditveno polje pa se pokaže, če je potrebno. Zaledje preveri uspeh, točno gostiteljsko ime in dejanje ter preverjanje opravi pred zapisom v D1 ali R2. Žetoni so enkratni in se po poskusu osvežijo. Dodano je tudi skrito polje proti neželenim oddajam. Brez povezane zaščite javno zaledje oddajo zavrne. Lokalni Node strežnik na zanki `127.0.0.1` je jasno označen razvojni preizkus brez zunanjega preverjanja.

Javni ključ in gostitelj sta v `wrangler.jsonc`; `TURNSTILE_SECRET` je shranjen samo kot skrivnost obstoječega Workerja v Cloudflare. `/api/config` vrne samo javne nastavitve. Ob selitvi skrivnost nastavite v nadzorni plošči Worker → Settings → Variables and Secrets in omejite `TURNSTILE_HOSTNAMES` na dejanske javne gostitelje. Produkcijski seznam ne sme vsebovati lokalnih ali testnih imen.

Pregled potrebnih storitev, brezplačnih omejitev in naslednjih korakov: [SERVICES.md](docs/SERVICES.md).

## Telefon, koledar in prijave

Vmesnik je preverjen tudi pri širini 320 px. Navigacija, obrazci in zemljevidi ostanejo znotraj zaslona; polja imajo na telefonu velikost pisave 16 px, da vnos ne sproži samodejne povečave v brskalniku iOS. Prehodi menija, koledarskega lista in prikazovanje razdelkov med drsenjem upoštevajo nastavitev zmanjšanega gibanja.

Pri posameznem odvozu gumb **Dodaj v koledar** odpre izbiro: enkraten dogodek ali ponavljanje na 1–8 tednov, z 2–52 termini. Predlagano ponavljanje zajema približno tri mesece. Google Koledar se odpre z izpolnjenim dogodkom; Apple, Outlook in druge aplikacije prejmejo datoteko ICS. Naprava predlaga začetno izbiro, uporabnik pa jo lahko spremeni. Končno shranjevanje je vedno potrjeno v koledarski aplikaciji. Na nekaterih različicah iOS je za ICS potreben uvoz iz priloge; spletna stran ne more zagotoviti tihega vpisa ali enakega odpiranja v vseh brskalnikih. Čas opozorila se nastavi v koledarski aplikaciji. Uvoz ne spremlja poznejših sprememb urnika, zato so vsi dogodki še vedno označeni kot PRIMER.

API za en dogodek: `GET /api/calendar?address=Vrhnika&eventId=ID_ODVOZA&repeat=once`. Za ponavljanje dodajte `repeat=weekly&interval=2&count=7`. ID vzemite iz `/api/collection`; neznani ali potekli ID-ji so zavrnjeni. Koledar brez `eventId` še vedno izvozi vse prikazane datume brez dodatnega ponavljanja.

Prijava infrastrukture ima štiri korake: težava, lokacija, neobvezna fotografija in kontakt. Lokacija težave se ne izpolni z domačim naslovom. Zadostuje besedilni opis; neobvezno točko GPS ali zemljevida uporabnik najprej pregleda in potrdi. Fotografijo in potrjeno točko je mogoče odstraniti. Storitve imajo ločena navodila za pripravo in vidne povezave do tržnice, kalkulatorja ter DEPO.

## Lokalni zagon

Zahteve: Node.js 22 ali novejši in npm.

```powershell
npm install
npm run dev
```

Razvojni ukaz zažene spletni vmesnik in API. Če ju želite zagnati posebej, uporabite `npm run dev:api` za API na `http://127.0.0.1:8787` in `npx vite --host 127.0.0.1` za vmesnik. Vite posreduje `/api` na lokalni API; pri posredovanju mora ohraniti javni `Host` (`changeOrigin: false`).

```powershell
npm run build
node --test server/backend.test.mjs
```

## Kaj že deluje

- Iskanje ločevanja odpadkov, interaktivni zemljevid zbirnih mest in povezave za navigacijo.
- Iskanje prikaznega urnika po kraju/naslovu ter prenos koledarja ICS in povezave za Google Koledar.
- Filtriranje obvestil, cestna dela, prijava napak z GPS-koordinatami in fotografijami.
- Obrazci za obvestila, naročilo storitev in prijavo na tržnico z dejanskim shranjevanjem prikaznih oddaj.
- Informativni kalkulator, predstavitev DEPO ter kontaktne in vsebinske strani.

Lokalni strežnik uporablja SQLite v `.data/cms.sqlite` za vsebine, seje, oddaje in obravnavo nalogov. Fotografije prijav so v `.data/photos/`, javne uredniške slike pa ločeno v `.data/cms-media/`. Mapa `.data` je izključena iz Gita in ponovni zagon ohrani podatke. Adapter `server/storage.mjs` ostaja na voljo za ločene datotečne teste. V objavljeni različici se uporablja D1 in R2.

## Skrbniška konzola

Odprite `/admin` neposredno ali v iskanje po portalu vpišite točno `/admin`. V javni navigaciji ni povezave. Prijava in vsi skrbniški API so zaščiteni na strežniku, ne samo s skrito stranjo. Navodila za urejanje, obravnavo prijav, varnost in selitev so v [ADMIN.md](docs/ADMIN.md).

Konzola ureja besedila in slike v predogledu, kontakte, delovne čase, obvestila, odvozne poti, zbirna mesta, pravila ločevanja, opise storitev, cene, tržnične termine ter načrt in podatke pokopališča. Objave imajo zgodovino različic in zaščito pred prepisom sočasnih sprememb. Nove oddaje se samodejno pokažejo kot delovni nalogi s kontrolnim seznamom, prioriteto, odgovorno osebo, rokom in internimi opombami. E-poštno obvestilo skrbniku vsebuje neposredno povezavo; ogled še vedno zahteva prijavo.

Prijava zdaj zahteva dovoljeni e-poštni naslov, geslo in 8-mestno enkratno kodo prek obstoječega Resend. `ADMIN_OWNER_EMAIL` izrecno določa začetnega lastnika; samo lastnik lahko povabi ali odstrani urednike. Povabljeni nastavijo lastna gesla. Stare seje, ki so bile ustvarjene samo z geslom, ne veljajo več. Konzola beleži urednika objav in sprememb nalogov. Interna opravila je mogoče dodati brez javne oddaje ali pošiljanja e-pošte.

Urejevalnik razporeditve omogoča premikanje in skrivanje obstoječih razdelkov, dodajanje besedil, slik, kartic in delujočih gumbov ter nove vsebinske strani pod `/strani/`. Povezave in glavni meni so uredljivi; poljubni HTML, CSS in skripti niso dovoljeni. Obstoječi obrazci in zemljevidi ostajajo programski moduli. Način **Urejanje** prestreže tudi klike ikon in tipkovnico, **Preizkus** pa dovoli navigacijo, pri čemer oddaja obrazcev v predogledu ostaja izključena. Upravljanje odvozov ima območja, preverjanje naslovov, pripravo ponavljanj, praznične izjeme in množične premike; v javni urnik se objavijo dejanski datumi.

Skrivnost `ADMIN_PASSWORD_HASH` je soljen PBKDF2-SHA256 izpeljan ključ (100.000 ponovitev), shranjen v Cloudflare in za lokalni razvoj v prezrti `.dev.vars`. Navadnega gesla ne vnašajte v repozitorij ali javne spremenljivke. Lokalni razvoj iz `.dev.vars` naloži skrivnost; tudi lokalna prijava potrebuje geslo.

## Prikazni podatki

Urniki, zbirne točke, ceniki, razpoložljivost tržnice in operativna obvestila so primeri in niso uradni podatki KPV. Urnik se ustvari za prihodnje datume glede na časovni pas `Europe/Ljubljana`; podprta so prikazna območja Vrhnika, Borovnica in Log - Dragomer. Ne predstavlja natančne povezave med hišno številko in odvozno potjo. Steklo in papir se praviloma oddajata na zbirnih mestih, zato v vzorcu hišnega urnika prikazujemo embalažo, biološke in mešane komunalne odpadke. Pred uporabo podatke uskladite z uradnim urnikom in pravili KPV.

Prijave se shranijo v prikazno zbirko in prek Resend posredujejo skrbniku predstavitve na `tomincjakob@gmail.com`, podjetju KPV pa niso posredovane. Obrazec vrne referenco in dejansko stanje čakalne vrste e-pošte. Samodejnih odgovorov uporabnikom ali rednih obvestil gospodinjstvom še ne pošilja. Tržnica ne obdeluje resničnih plačil in ne potrdi dejanske razpoložljivosti stojnice. Ne vnašajte občutljivih ali resničnih osebnih podatkov v javni demo.

## Resend

Pošiljatelj je `KPV predstavitev <obvestila@kpv.jakobtominc.com>` na preverjeni domeni. Nastavitve Workerja so `EMAIL_ENABLED`, `EMAIL_FROM` in `EMAIL_TO`; `RESEND_API_KEY` mora biti shranjen kot skrivnost Workerja. Ključa ne dodajajte v repozitorij ali v spremenljivko z začetkom `VITE_`. `/api/config` vrne samo javni podatek o vklopljeni e-pošti.

Oddaja in obvestilo se najprej shranita v D1. Trajna čakalna vrsta omogoča ponovno dostavo po začasni napaki, Workerjev Cron pa jo preverja vsakih pet minut. Ponovni poskusi so omejeni na največ 20 ur in uporabljajo enak idempotentni ključ Resend. Uspeh oddaje pomeni shranjen zapis in uvrstitev obvestila v čakalno vrsto, ne zagotovljene dostave v predal. Lokalni Node strežnik e-pošte ne pošilja. Podrobnosti in koraki za selitev so v [SERVICES.md](docs/SERVICES.md).

## Cloudflare Workers

Projekt uporablja Worker z vezavo `ASSETS` za mapo `dist`, D1 za oddaje in zasebni R2 za fotografije. Za že povezani račun zadostujeta `npm run build` in `npx wrangler deploy`. Naslednji koraki so namenjeni vzpostavitvi na **drugem računu**; obstoječih virov ni treba ponovno ustvariti. Ob selitvi zamenjajte `account_id`, ID baze in domeno v `wrangler.jsonc`.

```powershell
npx wrangler login
npx wrangler d1 create kpv-portal
```

V `wrangler.jsonc` dodajte vrnjeni ID baze:

```json
"d1_databases": [{ "binding": "DB", "database_name": "kpv-portal", "database_id": "ID_IZ_REZULTATA" }]
```

Nato ustvarite shemo in po želji zasebni R2 bucket:

```powershell
npx wrangler d1 execute kpv-portal --remote --file ./schema.sql
npx wrangler r2 bucket create kpv-portal-photos
```

V konfiguracijo dodajte `"r2_buckets": [{ "binding": "PHOTOS", "bucket_name": "kpv-portal-photos" }]`. R2 ne potrebuje javnega dostopa. Brez vezave `PHOTOS` je mogoče oddajati prijave brez fotografije; prijava s fotografijo vrne razloženo napako. Brez vezave `DB` vse oddaje vrnejo 503; sistem nikoli ne sporoči lažnega uspeha.

```powershell
npm run build
npx wrangler types
npx wrangler deploy --dry-run
npx wrangler deploy
```

Za lokalno simulacijo Cloudflare po dodanih vezavah najprej uporabite `npx wrangler d1 execute kpv-portal --local --file ./schema.sql`, nato `npx wrangler dev`. Konfiguracija vključuje datum združljivosti 2026-10-28, `nodejs_compat`, opazovanje izvajanja in pot `/api/*` pred statičnimi datotekami. Vse druge poti se vračajo v aplikacijo SPA, zato neposredni obiski podstrani delujejo.

### Poddomena

Custom Domain `kpv.jakobtominc.com` je povezana prek nastavitve `routes` v `wrangler.jsonc`. Ob selitvi mora biti izbrana domena v coni istega Cloudflare računa. Glavna stran `jakobtominc.com` ostane samostojna.

### Preverjanje po objavi

```powershell
npm run test:smoke -- https://kpv.jakobtominc.com
```

Ukaz preveri koledar, urnik, zaščito pred oddajami z drugega izvora in vseh pet obrazcev. Na javni strani preveri, da oddaje brez žetona niso sprejete; CAPTCHA ne obide. Lokalno ustvari jasno označene testne zapise z naslovom `portal-test@example.com`, vključno s fotografijo. Ne pošilja e-pošte in ne bremeni plačil. Samodejna preverjanja v GitHub Actions izvajajo gradnjo in teste API, vključno s kontaktom, preverjanjem dejanja in gostitelja Turnstile, ponovitvijo žetona ter pravili koledarja. Pravo uspešno zaščiteno oddajo preverite v brskalniku.

## API in zasebnost

Javne bralne poti: `GET /api/health`, `/api/notices`, `/api/collection?address=Vrhnika`, `/api/calendar?address=Vrhnika`.

Oddaje JSON: `POST /api/contact`, `/api/subscriptions`, `/api/requests`, `/api/market`. Prijava infrastrukture uporablja `POST /api/reports` in `multipart/form-data`. Fotografije JPG, PNG ali WebP imajo omejitev 5 MB; preverjata se MIME in podpis datoteke. JSON ima omejitev 32 KB. Oddaje zahtevajo privolitev; dovoljena so samo pričakovana polja in vrednosti. Zapis vsebuje le validirane podatke. Navzkrižne oddaje iz drugega spletnega izvora so zavrnjene. Koledar ubeži in prelomi vrednosti po pravilih ICS.

API ne objavlja seznama prijav, osebnih podatkov ali fotografij. Za pregled lokalnih oddaj uporabite zasebne datoteke, v Cloudflare pa nadzorovani dostop do D1 in R2. Podatki javnih obrazcev se za dostavo obvestila obdelajo tudi pri Resend in v prejemnikovem predalu. Pred uradno uporabo dodajte upravljanje uporabnikov in pooblastil za interno obravnavo, preverjanje e-pošte naročnikov in odjavo, omejitve hitrosti in hrambe/brisanja ter dejanski operativni podatkovni vir. Turnstile in Resend sta vključena; prava plačila ostajajo ločen prihodnji korak.

## Reference

- Uradna spletna stran in operativni podatki KPV: <https://www.kpv.si/>
- Cloudflare Worker in statične datoteke: <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>
- Cloudflare D1: <https://developers.cloudflare.com/d1/worker-api/d1-database/>
- Priporočila za Worker: <https://developers.cloudflare.com/workers/best-practices/workers-best-practices/>

Prikaz zemljevida uporablja OpenStreetMap in Leaflet. Pri javni uporabi ohranite navedbo ponudnika in preverite pogoje ponudnika kartografskih ploščic.

Fotografija Ljubljanice na začetni strani je povzeta iz [predstavitve Društva Ljubljanica na MojaObčina.si](https://www.mojaobcina.si/vrhnika/novice/predstavljamo-drustvo-ljubljanica-reka-sedmerih-imen-sop.html) za to predstavitev. Pred uradno uporabo uskladite pravice ali jo zamenjajte z lastno fotografijo. Podatki o ločevanju in kontakti so povzeti po povezanih uradnih virih KPV; povezave so vključene v vsebinske strani in `src/data/waste.ts`.
