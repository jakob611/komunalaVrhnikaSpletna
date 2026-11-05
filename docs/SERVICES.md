# Infrastruktura in e-pošta KPV

Stanje: 30. oktober 2026. Obstoječi Cloudflare Worker `kpv-portal`, D1, zasebni R2 in preverjena Resend domena `kpv.jakobtominc.com`. Plačil ni; prenova ne zahteva nadgradnje paketa.

## Sprememba prejemnika

Lastnik odpre `/admin` → **E-poštna obvestila**, vnese en predal in izbere **Shrani prejemnika**. Začetna vrednost je `tomincjakob@gmail.com`. Sprememba ne zahteva nove objave. Nastavitev je v zasebni tabeli D1 `notification_settings`; javni API je ne objavi in uredniki nimajo dostopa.

Velja za prihodnje oddaje. Že ustvarjena obvestila ohranijo prejšnjega prejemnika. Prijavne kode in povabila skrbnikov ostanejo vezani na njihov osebni račun. Vrnitev začetnega predala izključi preglasitev in uporabi `EMAIL_TO`.

## Nastavitve Workerja

- `EMAIL_ENABLED`: vklop obvestil o oddajah.
- `EMAIL_FROM`: pošiljatelj na preverjeni domeni Resend.
- `EMAIL_TO`: začetni prejemnik, preglasljiv v konzoli.
- `ADMIN_OWNER_EMAIL`: začetni lastniški račun.
- Skrivnosti `RESEND_API_KEY`, `ADMIN_PASSWORD_HASH` in `TURNSTILE_SECRET` ostanejo v Cloudflare, nikoli v Gitu ali javnih podatkih. Geslo je soljen PBKDF2-SHA256 izpeljan ključ.
- `TURNSTILE_SITE_KEY` in `TURNSTILE_HOSTNAMES`: javni ključ in omejitev na natančna javna gostiteljska imena.

Oddaja in obvestilo se atomarno shranita v D1. Fotografija se pripne iz zasebnega R2. Odgovor na prejeto obvestilo je naslovljen na pošiljatelja obrazca. Prijava na e-obvestila pošlje potrditveno povezavo; šele potrjena naročnina lahko prejema ciljana obvestila. Ostali obrazci uporabnikom ne pošiljajo samodejnih odgovorov.

Cron vsako minuto ponovi začasno neuspešne dostave, največ osemkrat oziroma 20 ur od prvega poskusa, ne od uvrstitve v vrsto. Potrditve imajo prednost, en prehod pošlje do 20 sporočil s primernim razmikom. Isti idempotentni ključ in vsebina preprečujeta podvajanje. Trajna napaka ne izbriše oddaje: ostane v nalogih. Potrdilo oddaje ne zagotavlja dostave v predal.

## Dostop in selitev

Fotografije prijav in oddaje zahtevajo prijavo. Uredniške slike imajo ločen javni API ter preverjanje podpisa; največ 5 MB. Prijava zahteva e-pošto, geslo, kodo in v produkciji Turnstile. Spremembe preverjajo izvor, CSRF in revizijo.

Običajna objava ne potrebuje novih virov. Pri selitvi pripravite D1 s `schema.sql`, zasebni R2, vezave/domene v `wrangler.jsonc`, skrivnosti in preverjeno domeno pošiljatelja. Lokalni strežnik ne pošilja zunanje e-pošte; `KPV_DATA_DIR` omogoča ločeno podatkovno mapo. Vite blokira dostop do nje in do `.dev.vars`.

Spremljajte porabo računa, dnevne omejitve pošiljanja in čakalno vrsto. Aktualni pogoji: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Resend](https://resend.com/pricing).

Naročnine, potrditve in generacije nastavitev so v `email_subscribers`; ciljana pošiljanja v `notification_campaigns` in `subscription_deliveries`. Nastavitve naročnikov niso javne. `SUBSCRIPTION_SIGNING_SECRET` je zasebna stabilna skrivnost za osebne povezave; nikoli je ne objavite ali zamenjajte ob običajni objavi. `email_delivery_windows` beleži začetek poskusov dostave. Sporočila, ki še čakajo na prvi poskus, zaradi dolžine vrste ne potečejo.
