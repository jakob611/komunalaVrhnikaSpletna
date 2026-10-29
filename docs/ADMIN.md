# Uredništvo portala in obravnava prijav

## Dostop

Odprite `https://kpv.jakobtominc.com/admin` ali v javno iskanje vpišite `/admin`. Konzola ni v menijih, dostop do podatkov in sprememb pa vedno zahteva strežniško prijavo. Uporabite dogovorjeno geslo. Na deljenih napravah se po delu odjavite. Seje potečejo po osmih urah.

## Urejanje spletne strani

1. V levem meniju izberite vsebino. Spremenite polja in kliknite **Shrani in objavi**. Spremembe se shranijo v D1 in jih javna stran naloži ob naslednjem obisku ali vrnitvi v zavihek.
2. **Besedila na straneh** odpre predogled. Izberite stran in kliknite njen naslov, odstavek ali gumb. Gre za navadno besedilo; HTML in skripti niso podprti. Glava in noga veljata za vse strani. Besedila, vezana na podatke, raje urejajte v njihovem vsebinskem razdelku.
3. **Slike na straneh** omogočajo izbiro obstoječe fotografije ali dodajanje glavne slike podstrani. Slike najprej naložite v **Datoteke** (JPG, PNG ali WebP, največ 5 MB). Vnesite ustrezen opis za dostopnost. Javne uredniške slike imajo lastne naslove; fotografije prijav ostanejo zasebne.
4. **Zgodovina** ohrani prejšnje različice. Obnova izbrane različice ustvari novo objavo. Če je isto vsebino medtem uredil drug uporabnik ali zavihek, strežnik zahteva osvežitev in prepreči tihi prepis.
5. **Napredno** omogoča izvoz ter pripravo podatkov JSON za večji uvoz. Vse podatke preveri strežnik; napaka ne spremeni objavljene različice. Hranite izvoze pomembnih podatkov ločeno.

## Kaj ureja posamezni razdelek

| Razdelek | Vsebina |
|---|---|
| Nastavitve portala | Ime, logotip, telefon, e-pošta, naslov, dežurni kontakt, povezava DEPO, besedilo noge |
| Delovni časi | Ločeni urniki, dnevi, ure ter telefonski in e-poštni kontakti |
| Obvestila in motnje | Naslov, območje, vrsta, stanje, datum, besedilo, točka na zemljevidu |
| Urniki odvoza | Odvozne poti, naslovi oziroma naselja in točni datumi za embalažo, BIO in mešane odpadke |
| Zbirna mesta | Naziv, naslov, območje, GPS in sprejete vrste odpadkov |
| Čarovnik in vrste odpadkov | Predmeti, iskalne besede, zabojniki, barve in navodila |
| Komunalne storitve | Opisi, kaj pripraviti pred oddajo in primeri vnosa |
| Ceniki in kalkulator | Postavke kalkulatorja in prikazne cene stojnic; spletna plačila niso vključena |
| Tržnica | Dovoljeni in zaprti datumi; prazna izbira dovoljenih datumov ohrani prikaz prihodnjih sobot |
| Pokopališče | Imena, datumi, oddelki, oznake, koordinate grobov ter slika in mere načrta |

Pri odvozih imajo natančnejši vzorci naslova prednost pred splošnim naseljem. Če je vnesena vsaj ena pot, portal za druge naslove ne izmišljuje terminov. Pretekli termini se ne prikazujejo med prihodnjimi odvozi. Prazna zbirka poti ohrani prvotni prikazni urnik. Navodila za pravo geografsko poravnavo pokopališča so v [CEMETERY.md](CEMETERY.md); sama zamenjava fotografije ne določi pravih položajev grobov.

## Delovni nalogi

Vsaka oddaja obrazca se takoj pojavi v konzoli: prijava ceste, svetilke, zabojnika, drugo sporočilo, povpraševanje, tržnica ali naročilo obvestil. Za prikaz naloga ni potrebna uspešna dostava e-pošte.

1. Odprite **Delovni nalogi**. Števci ločijo nove, odprte, obravnavane, zamujene in zaključene oddaje. Iščite po opisu, lokaciji, imenu ali referenci; uporabite filtre.
2. Odprite nalog. Na eni strani ostane izvirna oddaja, na drugi so interna obravnava in fotografija, če je priložena.
3. Določite prioriteto, odgovorno osebo ali ekipo in po potrebi rok. Ime odgovorne osebe je interna oznaka, ne uporabniški račun ali samodejno obveščanje te osebe.
4. Uredite kontrolni seznam, označujte opravljene korake in dodajajte interne opombe. Kliknite **Shrani obravnavo**. Brez shranjevanja spremembe niso potrjene.
5. Ko so potrebni koraki opravljeni, izberite **Zaključeno** in shranite. Neuporabne korake lahko odstranite; za zaključek mora ostati vsaj en opravljen korak. Napako je mogoče ponovno odpreti z izbiro **V obravnavi**.
6. Neželene oddaje označite ustrezno; niso trajno izbrisane. Zaključene in neželene zapise najdete z izbiro **Vsa stanja**.

Zgodovina obravnave beleži spremembe stanja, prioritete, roka, odgovorne osebe in napredka. Sočasno spreminjanje uporablja različice; starejši zapis ne prepiše novejšega. Zaključek samodejno ne pošlje odgovora obiskovalcu. Za nujne nevarnosti je še vedno treba uporabiti pristojno dežurno službo.

## E-poštna obvestila

Resend po uspešni oddaji pošlje obvestilo na nastavljeni predal skrbnika. Sporočilo vsebuje vrsto oddaje, referenco, podatke in gumb **Odpri v skrbniški konzoli**. Povezava `/admin?case=…` zahteva prijavo in ne vsebuje dostopnega žetona. Fotografije prijav se pripnejo obvestilu.

Oddaje so shranjene pred pošiljanjem. Trajna čakalna vrsta ponavlja začasno neuspešna pošiljanja in preprečuje podvajanje. Konzola prikaže neuspešna obvestila; stanje »posredovano Resend« pomeni, da je ponudnik sprejel sporočilo, ne zagotavlja prejetja v predal. Obvestila so namenjena skrbniku, ne poljubnemu e-poštnemu naslovu iz obrazca. Podjetju KPV sporočil ne pošiljamo samodejno.

## Varnost in vzdrževanje

Geslo ni v odjemalski kodi. `ADMIN_PASSWORD_HASH` je skrivnost Workerja v obliki `v1:100000:<saltHex>:<derivedHex>` (PBKDF2-SHA256, 256 bitov, naključna sol). Skrivnosti, baze, fotografij prijav in datotek `.dev.vars` ne dodajajte v Git. Zamenjava skrivnosti razveljavi obstoječe seje.

Prijavo varujejo Turnstile, omejitve poskusov po naslovu IP ter skupna omejitev preverjenih poskusov. Produkcijski sejni piškotek je `Secure`, `HttpOnly`, `SameSite=Strict`, z vezavo na gostitelja. Strežnik hrani samo zgoščeno vrednost seje; spremembe zahtevajo pravilen izvor in žeton CSRF. Potekle seje in omejitve se redno čistijo. `/admin` se streže z oznako `noindex` in prepovedjo vstavljanja v okvir; javne strani so v skrbniškem predogledu lahko v okviru istega izvora.

Po selitvi izvedite `wrangler d1 execute kpv-portal --remote --file schema.sql`, nastavite skrbniško skrivnost in izvedite običajno objavo. Obstoječe oddaje se ohranijo. Lokalni razvoj uporablja `.data/cms.sqlite` in potrebuje isto obliko skrivnosti v prezrti `.dev.vars`; e-pošte ne pošilja. Dodatna plačljiva storitev za konzolo ni potrebna.
