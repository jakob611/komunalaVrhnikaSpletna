# Storitve in stroški predstavitve KPV

Stanje: 29. oktober 2026. Noben plačljiv paket ni bil dodan ali nadgrajen. Spletna stran ostaja predstavitev z vzorčnimi operativnimi podatki. Obrazci pošiljajo obvestila skrbniku predstavitve prek Resend; plačila so izključena.

| Storitev                               | Namen                                                      | Stanje                                                       |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Cloudflare Workers + statične datoteke | Spletna stran in API                                       | Že objavljeno na kpv.jakobtominc.com                         |
| Cloudflare D1                          | Obrazci, vsebine, skrbniške seje in delovni nalogi           | Že povezano; EU, baza kpv-portal                             |
| Cloudflare R2 Standard                 | Zasebne fotografije prijav in uredniške slike               | Že povezano; javne slike se strežejo ločeno prek API          |
| Cloudflare Turnstile Managed           | Zaščita obrazcev in skrbniške prijave pred boti             | Nameščeno; tiho preverjanje ali potrditveno polje po potrebi |
| Resend                                | Obvestilo skrbniku o oddaji katerega koli obrazca           | Integrirano z Workerjem in zasebno čakalno vrsto D1           |

## Brezplačne omejitve

- Workers Free: 100.000 dinamičnih zahtev na dan; 10 ms procesorskega časa na zahtevo. Statične datoteke imajo brezplačne in neomejene zahteve. [Uradne cene](https://developers.cloudflare.com/workers/platform/pricing/).
- D1 Free: 5 milijonov prebranih vrstic na dan, 100.000 zapisanih vrstic na dan in 5 GB skupne shrambe. [Uradne cene](https://developers.cloudflare.com/d1/platform/pricing/).
- R2 Standard: 10 GB-mesec shrambe, 1 milijon operacij razreda A in 10 milijonov razreda B na mesec; izhodni promet je brezplačen. Nad brezplačno vključeno porabo se R2 obračunava po uporabi, zato brezplačne porabe ni mogoče zagotavljati ne glede na količino. Omejitve veljajo na račun, tudi za druge njegove projekte. [Uradne cene](https://developers.cloudflare.com/r2/pricing/).
- Turnstile Free: neomejeno preverjanj, do 20 gradnikov in 10 gostiteljev na gradnik. Način Managed lahko po potrebi zahteva klik, ne uporablja slikovnih ugank. [Paketi](https://developers.cloudflare.com/turnstile/plans/) in [načini](https://developers.cloudflare.com/turnstile/concepts/widget/).

Za običajno majhno testno uporabo niso potrebne nadgradnje. Spremljajte skupno porabo računa, predvsem R2. Rešitve ne predstavljamo kot neomejeno brezplačne shrambe. Posamezna fotografija ima omejitev 5 MB in ni javno dostopna.

## Nastavitev e-pošte Resend

Javna predstavitev po uspešni oddaji najprej shrani zapis in obvestilo v D1. Worker obvestilo pošlje skrbniku na `tomincjakob@gmail.com` s pošiljateljem `KPV predstavitev <obvestila@kpv.jakobtominc.com>`. Odgovor na prejeto obvestilo je naslovljen na e-pošto, vneseno v obrazec. Podjetju KPV se sporočila ne posredujejo. Vsaka oddaja ustvari eno obvestilo; obrazci uporabnikom ne pošiljajo samodejnih potrdil. Fotografija prijave se priloži e-pošti iz zasebne shrambe R2, brez javne povezave.

Nastavitve Workerja:

- Skrivnost `RESEND_API_KEY`: ključ se vnese v Cloudflare Worker → Settings → Variables and Secrets oziroma prek `wrangler secret put`. Ne sodi v Git, odjemalsko kodo ali javne nastavitve API.
- Spremenljivka `EMAIL_ENABLED`: `"true"` vklopi pošiljanje, `"false"` ga izklopi.
- Spremenljivka `EMAIL_FROM`: pošiljatelj na domeni, preverjeni pri Resend.
- Spremenljivka `EMAIL_TO`: izbrani predal skrbnika predstavitve.
- Shema D1 vključuje trajno čakalno vrsto e-poštnih obvestil; ob selitvi uporabite posodobljeno `schema.sql`.

Občasne napake pri dostavi ne izbrišejo oddaje. Ponovne poskuse izvaja Worker s sprožilcem Cron vsakih pet minut; ponavljanje je omejeno na največ 20 ur. Enolični ključ Resend za vsako obvestilo preprečuje podvojeno pošiljanje pri ponovnem poskusu. Potrdilo vmesnika pove, da je obvestilo v čakalni vrsti, ne zagotavlja dostave v predal. Trajne napake in izčrpane poskuse preverite v zasebni čakalni vrsti ter v Resend.

Lokalni Node strežnik in samodejni testi e-pošte ne pošiljajo. `/api/health` sporoči `email: "resend"`, če je javno pošiljanje nastavljeno, sicer `"not-configured"`; `/api/config` razkrije samo, ali je vključeno. Ključ se prek API ne razkriva.

Za preizkus ostane paket Resend brez nadgradnje. Spremljajte njegove dnevne in mesečne omejitve ter skupno porabo računa. [Cene](https://resend.com/pricing), [preverjanje domene](https://resend.com/docs/dashboard/domains/introduction).

**Web3Forms ni potreben**, ker projekt že ima zaledje in zbirko podatkov. Njegov brezplačni paket ima 250 oddaj na mesec. Integracija Turnstile/reCAPTCHA in priponke so v plačljivih funkcijah; naša zaščita Turnstile deluje neposredno prek Workerja in ni vezana na Web3Forms. [Cene](https://web3forms.com/pricing).

Naročnine na obvestila za gospodinjstva še vedno shranjujejo samo preizkusne nastavitve; o oddaji je obveščen skrbnik. Za dejanska redna obvestila so potrebni uradni vir motenj, potrditev e-poštnega naslova naročnika, odjava in obravnava nedostavljenih sporočil. Vzorčnih obvestil o motnjah samodejno ne razpošiljamo.

## Kaj bo potrebno za uradno stran

Uradni podatki o odvoznih poteh in terminih, register zbirnih mest, potrjen cenik, kontakti oddelkov ter pravila obravnave so potrebni neodvisno od izbire ponudnikov. Zaščitena konzola `/admin` že vključuje urejanje in interno obravnavo vseh oddaj; navodila so v [ADMIN.md](ADMIN.md). E-poštna obvestila vsebujejo povezavo do naloga, ogled pa zahteva prijavo. Pred uradno uporabo uredite individualne uporabniške račune in pravice zaposlenih, potrjevanje naročnin in odjavo ter rok hrambe podatkov. Prava plačila na tržnici zahtevajo ločeno pogodbo s ponudnikom plačil; za preizkus ostanejo izključena. Dodatna plačljiva storitev za zemljevide ni nujna.
