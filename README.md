# KPV · Komunala Vrhnika

Portal: <https://kpv.jakobtominc.com> · uredništvo: `/admin`.

React/TypeScript/Vite in skupni Fetch API za Node.js ter Cloudflare Workers. D1 hrani vsebine, zasebne oddaje, naloge in seje; R2 fotografije; Resend prijavne kode, povabila in obvestila skrbniku.

## Lokalni zagon

Node.js 22+: `npm install`, nato `npm run dev`. Vmesnik je na `http://127.0.0.1:5173`, API na `http://127.0.0.1:8787`. Skrivnosti so v prezrti `.dev.vars`. Lokalni strežnik ne pošilja zunanje e-pošte; prijavna pošta je zasebno v `.data/admin-auth-mail.json`. `KPV_DATA_DIR` omogoča ločeno podatkovno mapo za preverjanje.

## Uredništvo

Prijava zahteva dovoljeno e-pošto, osebno geslo in enkratno kodo. Lastnik upravlja dostop in **E-poštna obvestila**, kjer lahko spremeni začetnega prejemnika `tomincjakob@gmail.com` brez nove objave aplikacije.

- **Delovni nalogi:** javna sporočila in interna opravila, odgovorna oseba, rok, prioriteta, opombe ter neobvezni kontrolni seznam; začetek, zaključek in ponovno odprtje.
- **Urejevalnik spletne strani:** skupni osnutek besedil, slik, povezav, razdelkov, menija in logotipa KPV. Preklapljanje orodij ohrani spremembe; izbrani razdelek je označen v predogledu.
- **Obvestila in motnje:** seznam, iskanje, obrazec in predogled. Osnutki so zasebni. Oznaka prikaza določa vidnost po shranjevanju. Datum ni razpored objave; shranjevanje ne pošilja množične e-pošte.
- **Urniki odvoza:** območje, datumi in preverjanje naslova; ločeno ujemanje BIO, embalaže in MKO.

Podrobna slovenska navodila: [docs/ADMIN.md](docs/ADMIN.md). Vsebine imajo zgodovino in zaščito pred sočasnim prepisom. Pri delni napaki skupne objave že shranjeni deli ostanejo shranjeni, preostali ostanejo v osnutku.

## Podatki in pokritost

Odvozi temeljijo na [KPV-jevih urnikih za leto 2026](https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html). Viri in omejitve: `shared/official-collection-2026.json`; ponovljiv uvoz: `scripts/import-official-collection.mjs`. Privzete objavljene poti so v `shared/site-defaults.json` in jih uredništvo lahko dopolni.

Dokumenti ne določajo vseh hišnih mej za manjša vozila ali dele ulic. Sistem ne ugiba: nepotrjeno vrsto odpadka označi in poveže z virom. Po izteku datumov ne podaljšuje samodejno. Vnesite ulico/naselje, hišno številko in kraj; primer potrjenega naslova je `Verd 12, Vrhnika`. Uvoz koledarja ustvari kopijo brez samodejnih posodobitev.

Izmišljeni pokopališki zapisi, obvestila in zbirne točke so odstranjeni iz privzetih podatkov. Pokopališče brez evidence prikaže preverjene kontakte. Objavljen je zbirni center Tojnice z orientacijsko točko. Občinske cene vodijo do veljavnih KPV cenikov. Tržnica zbira povpraševanja za želeni datum; razpoložljivost in ceno potrdi upravljavec. Sobotne cene veljajo za zunanjo stojnico na Sodnijskem trgu z DDV. Plačil ni.

Oddaje se zasebno shranijo in pojavijo med nalogi. Potrdilo pomeni shranjeno oddajo; e-pošta je lahko še v čakalni vrsti. Naročnine na e-obvestila zahtevajo potrditev e-pošte. Urednik po objavi izbere območja in po potrebi posamezne naslove ter preveri prejemnike pred pošiljanjem. Vsako sporočilo vsebuje nastavitve in odjavo. Nujne zadeve uporabite dežurni telefon.

## Preverjanje in objava

```powershell
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
npm run test:smoke -- https://kpv.jakobtominc.com
```

`wrangler.jsonc` uporablja obstoječi Worker `kpv-portal`, D1 `kpv-portal` in zasebni R2 `kpv-portal-photos`. Skrivnosti ostanejo v Cloudflare. Običajna objava ne ustvarja novih virov. Pri selitvi uporabite `schema.sql` in prilagodite vezave, domene ter skrivnosti. Produkcijski smoke test ne ustvarja oddaj; preveri zavrnitev brez Turnstile žetona. Enotski testi preverjajo tudi uspešne oddaje, priponke, čakalno vrsto, pravice in konflikte.

Več: [docs/SERVICES.md](docs/SERVICES.md). OpenStreetMap ohrani navedbo vira. Pravice obstoječe fotografije Ljubljanice lastnik uskladi z imetnikom ali jo zamenja v urejevalniku.

## E-obvestila po naslovih

Območja upravljate v **Območja e-obveščanja**. Občine so pripravljene; dodate lahko naselja ali predele. Ob prijavi naročnik izbere območje, teme in celoten naslov. E-poštna potrditev velja 24 ur; stari zapisi obrazca se zaradi nepotrjenega lastništva e-pošte ne aktivirajo samodejno. Vsak e-naslov ima eno naročnino; spremembe prek nove prijave se uveljavijo šele po potrditvi. Osebna povezava v sporočilu omogoča takojšnjo spremembo nastavitev ali odjavo.

Pri obvestilu določite območja ter po potrebi celotne ulice ali posamezne hišne številke (eno pravilo na vrstico, dodajte kraj). Shranite, izberite **Preveri prejemnike in dostavo** in nato potrdite pošiljanje. Podvojeno pošiljanje iste različice je blokirano. Umik ali sprememba obvestila ustavi še neposlane kopije; že dostavljene pošte ni mogoče preklicati.

Cron vsako minuto pripravi del prejemnikov in pošlje do 20 sporočil; potrditve imajo prednost. Občasne napake se ponavljajo z istim ključem. Osem neuspešnih poskusov oziroma 20 ur od prvega poskusa zaključi dostavo z vidnim neuspehom. Pošiljanje ostaja odvisno od kvote obstoječega računa Resend. `SUBSCRIPTION_SIGNING_SECRET` je trajna zasebna skrivnost za povezave; ob selitvi jo ohranite, sicer stare povezave prenehajo veljati. Nove tabele so v `schema.sql`.
