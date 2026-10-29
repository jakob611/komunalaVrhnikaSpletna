# Storitve in stroški predstavitve KPV

Stanje: 28. oktober 2026. Noben plačljiv paket ni bil dodan ali nadgrajen. Spletna stran ostaja predstavitev z vzorčnimi operativnimi podatki, brez pošiljanja e-pošte in brez plačil.

| Storitev                               | Namen                                                      | Stanje                                                       |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Cloudflare Workers + statične datoteke | Spletna stran in API                                       | Že objavljeno na kpv.jakobtominc.com                         |
| Cloudflare D1                          | Shranjevanje vseh petih vrst obrazcev                      | Že povezano; EU, baza kpv-portal                             |
| Cloudflare R2 Standard                 | Zasebne fotografije prijav                                 | Že povezano; bucket kpv-portal-photos                        |
| Cloudflare Turnstile Managed           | Zaščita obrazcev pred boti                                 | Nameščeno; tiho preverjanje ali potrditveno polje po potrebi |
| Pošiljanje e-pošte                     | Kontaktna obvestila, potrditve in obvestila gospodinjstvom | Še ni nastavljeno                                            |

## Brezplačne omejitve

- Workers Free: 100.000 dinamičnih zahtev na dan; 10 ms procesorskega časa na zahtevo. Statične datoteke imajo brezplačne in neomejene zahteve. [Uradne cene](https://developers.cloudflare.com/workers/platform/pricing/).
- D1 Free: 5 milijonov prebranih vrstic na dan, 100.000 zapisanih vrstic na dan in 5 GB skupne shrambe. [Uradne cene](https://developers.cloudflare.com/d1/platform/pricing/).
- R2 Standard: 10 GB-mesec shrambe, 1 milijon operacij razreda A in 10 milijonov razreda B na mesec; izhodni promet je brezplačen. Nad brezplačno vključeno porabo se R2 obračunava po uporabi, zato brezplačne porabe ni mogoče zagotavljati ne glede na količino. Omejitve veljajo na račun, tudi za druge njegove projekte. [Uradne cene](https://developers.cloudflare.com/r2/pricing/).
- Turnstile Free: neomejeno preverjanj, do 20 gradnikov in 10 gostiteljev na gradnik. Način Managed lahko po potrebi zahteva klik, ne uporablja slikovnih ugank. [Paketi](https://developers.cloudflare.com/turnstile/plans/) in [načini](https://developers.cloudflare.com/turnstile/concepts/widget/).

Za običajno majhno testno uporabo niso potrebne nadgradnje. Spremljajte skupno porabo računa, predvsem R2. Rešitve ne predstavljamo kot neomejeno brezplačne shrambe. Posamezna fotografija ima omejitev 5 MB in ni javno dostopna.

## Kaj potrebujete za e-pošto

Za sedanjo predstavitev nič: obrazci se shranjujejo in ob oddaji jasno povedo, da e-pošta ni poslana.

Za dejanska sporočila in obvestila poljubnim naročnikom priporočamo **Resend Free** z obstoječim Workerjem. Ob preverjanju je brezplačni paket omogočal 3.000 e-poštnih sporočil na mesec, največ 100 na dan. Potrebni so račun, API-ključ, preverjena pošiljateljska domena (lahko poddomena jakobtominc.com) in izbrani prejemniki po področjih. Ključ mora ostati v skrivnostih Workerja. Nato je treba dodati dostavo, ponovne poskuse, potrjevanje naročnine in odjavo. [Cene](https://resend.com/pricing), [preverjanje domene](https://resend.com/docs/dashboard/domains/introduction).

**Web3Forms ni potreben**, ker projekt že ima zaledje in zbirko podatkov. Njegov brezplačni paket ima 250 oddaj na mesec. Integracija Turnstile/reCAPTCHA in priponke so v plačljivih funkcijah; naša zaščita Turnstile deluje neposredno prek Workerja in ni vezana na Web3Forms. [Cene](https://web3forms.com/pricing).

Možna alternativa samo za dostavo v upravljavčev preverjeni predal je Cloudflare Email Service: pošiljanje na preverjene ciljne naslove v računu je brezplačno. Pošiljanje poljubnim naslovom zahteva Workers Paid, zato ga za ta brezplačni preizkus nismo vklopili. [Uradne cene](https://developers.cloudflare.com/email-service/platform/pricing/).

Računa pri ponudniku e-pošte nismo odprli, DNS za pošto nismo spreminjali in sporočil nismo pošiljali.

## Kaj bo potrebno za uradno stran

Uradni podatki o odvoznih poteh in terminih, register zbirnih mest, potrjen cenik, kontakti oddelkov ter pravila obravnave so potrebni neodvisno od izbire ponudnikov. Za produkcijo dodajte interno obravnavo prijav z dostopnimi pravicami, potrjevanje naročnin in odjavo, rok hrambe podatkov ter po potrebi omejitve hitrosti. Prava plačila na tržnici zahtevajo ločeno pogodbo s ponudnikom plačil; za preizkus ostanejo izključena. Dodatna plačljiva storitev za zemljevide ni nujna.
