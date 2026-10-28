# KPV · Komunalno podjetje Vrhnika

Slovenski demonstracijski portal za pregled komunalnih storitev. React in TypeScript z Vite na odjemalcu; skupni Fetch API zaledni del za lokalni Node.js in Cloudflare Workers. To je oblikovni in funkcionalni prototip, ne uradna spletna stran podjetja.

**Objavljena predstavitev:** <https://kpv.jakobtominc.com> · Cloudflare Worker `kpv-portal`, baza D1 `kpv-portal` (EU), zasebni R2 `kpv-portal-photos`. Konfiguracija že vsebuje povezave do ustvarjenih virov. E-pošta in plačila sta izključena.

Portal vsebuje 18 poti: začetno stran, tri področna izhodišča, zemljevid odpadkov, čarovnik, urnik, obvestila, ceste, prijavo napake, storitve, tržnico, kalkulator, DEPO, kontakte, podjetje, Moj dom in zasebnost. Podatki o naslovu v Moj dom ostanejo v brskalniku.

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

Lokalno se oddaje hranijo v `.data/records.json`, fotografije pa zasebno v `.data/photos/`. Mapa `.data` mora biti izključena iz Gita. Shramba uporablja zaporedno obdelavo in atomsko zamenjavo datoteke za varen lokalni enoprocesni razvoj. Ponovni zagon ohrani podatke. Za več procesov uporabite D1.

## Prikazni podatki

Urniki, zbirne točke, ceniki, razpoložljivost tržnice in operativna obvestila so primeri in niso uradni podatki KPV. Urnik se ustvari za prihodnje datume glede na časovni pas `Europe/Ljubljana`; podprta so prikazna območja Vrhnika, Borovnica in Log - Dragomer. Ne predstavlja natančne povezave med hišno številko in odvozno potjo. Steklo in papir se praviloma oddajata na zbirnih mestih, zato v vzorcu hišnega urnika prikazujemo embalažo, biološke in mešane komunalne odpadke. Pred uporabo podatke uskladite z uradnim urnikom in pravili KPV.

E-pošta se **ne pošilja**. Prijave se shranijo v prikazno zbirko, podjetju pa niso posredovane. Tržnica ne obdeluje resničnih plačil in ne potrdi dejanske razpoložljivosti stojnice. Obrazec vrne referenco oddaje in jasno opozorilo. Ne vnašajte občutljivih ali resničnih osebnih podatkov v javni demo.

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

Ukaz preveri koledar, urnik, zaščito pred oddajami z drugega izvora in vse štiri obrazce, vključno s fotografijo. Ustvari jasno označene testne zapise z naslovom `portal-test@example.com`; ne pošilja e-pošte in ne bremeni plačil. Samodejna preverjanja v GitHub Actions izvajajo gradnjo in enajst testov API ob spremembah kode, vključno s ponavljanjem in zavračanjem neveljavnih pravil koledarja.

## API in zasebnost

Javne bralne poti: `GET /api/health`, `/api/notices`, `/api/collection?address=Vrhnika`, `/api/calendar?address=Vrhnika`.

Oddaje JSON: `POST /api/subscriptions`, `/api/requests`, `/api/market`. Prijava infrastrukture uporablja `POST /api/reports` in `multipart/form-data`. Fotografije JPG, PNG ali WebP imajo omejitev 5 MB; preverjata se MIME in podpis datoteke. JSON ima omejitev 32 KB. Oddaje zahtevajo privolitev; dovoljena so samo pričakovana polja in vrednosti. Zapis vsebuje le validirane podatke. Navzkrižne oddaje iz drugega spletnega izvora so zavrnjene. Koledar ubeži in prelomi vrednosti po pravilih ICS.

API ne objavlja seznama prijav, osebnih podatkov ali fotografij. Za pregled lokalnih oddaj uporabite zasebne datoteke, v Cloudflare pa nadzorovani dostop do D1 in R2. Pred dejansko javno uporabo dodajte upravljanje uporabnikov in pooblastil za interno obravnavo, preverjanje e-pošte, zaščito pred zlorabami (npr. Turnstile in omejitve hitrosti), pravila hrambe/brisanja in dejanski operativni podatkovni vir. Integracija e-pošte in plačil je namenoma prihodnji korak.

## Reference

- Uradna spletna stran in operativni podatki KPV: <https://www.kpv.si/>
- Cloudflare Worker in statične datoteke: <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>
- Cloudflare D1: <https://developers.cloudflare.com/d1/worker-api/d1-database/>
- Priporočila za Worker: <https://developers.cloudflare.com/workers/best-practices/workers-best-practices/>

Prikaz zemljevida uporablja OpenStreetMap in Leaflet. Pri javni uporabi ohranite navedbo ponudnika in preverite pogoje ponudnika kartografskih ploščic.

Fotografija Ljubljanice na začetni strani je povzeta iz [predstavitve Društva Ljubljanica na MojaObčina.si](https://www.mojaobcina.si/vrhnika/novice/predstavljamo-drustvo-ljubljanica-reka-sedmerih-imen-sop.html) za to predstavitev. Pred uradno uporabo uskladite pravice ali jo zamenjajte z lastno fotografijo. Podatki o ločevanju in kontakti so povzeti po povezanih uradnih virih KPV; povezave so vključene v vsebinske strani in `src/data/waste.ts`.
