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

Oddaje se zasebno shranijo in pojavijo med nalogi. Potrdilo pomeni shranjeno oddajo; e-pošta je lahko še v čakalni vrsti. Želje za obveščanje zahtevajo obravnavo, avtomatskega pošiljanja naročnikom ni. Nujne zadeve uporabite dežurni telefon.

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
