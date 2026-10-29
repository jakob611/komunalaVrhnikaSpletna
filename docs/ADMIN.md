# Uredništvo portala in obravnava prijav

## Dostop

Odprite `https://kpv.jakobtominc.com/admin` ali v javno iskanje vpišite `/admin`. Konzola ni v javnih menijih. Vpišite svoj dovoljeni e-poštni naslov in geslo, nato še 8-mestno kodo iz e-pošte. Začetni lastnik je `tomincjakob@gmail.com` in uporablja dogovorjeno geslo. Seja nastane šele po uspešni potrditvi kode. Koda velja največ 10 minut, dovoljenih je pet poskusov; novo lahko zahtevate po 60 sekundah. Ponovno pošiljanje razveljavi prejšnjo kodo in ne podaljša prvotnega prijavnega okna. Na deljenih napravah se po delu odjavite. Seje potečejo po osmih urah.

Lastnik v **Dostop in skrbniki** povabi dodatne urednike po e-pošti. Povabilo velja 24 ur; povabljeni potrdi kodo in si nastavi lastno geslo z najmanj 12 znaki. Nato vsaka nova prijava zahteva tudi e-poštno kodo. Uredniki lahko urejajo portal in naloge, ne morejo pa dodajati ali odstranjevati drugih uporabnikov. Lastnik lahko uredniku odvzame dostop ali ponovno pošlje povabilo za novo nastavitev gesla; stare seje in kode se razveljavijo. Lastnikovega računa ni mogoče odstraniti iz konzole.

## Urejanje spletne strani

1. V levem meniju izberite vsebino. Spremenite polja in kliknite **Shrani in objavi**. Spremembe se shranijo v D1 in jih javna stran naloži ob naslednjem obisku ali vrnitvi v zavihek.
2. **Besedila na straneh** odpre predogled. Izberite stran in kliknite njen naslov, odstavek ali gumb. Gre za navadno besedilo; HTML in skripti niso podprti. Glava in noga veljata za vse strani. Besedila, vezana na podatke, raje urejajte v njihovem vsebinskem razdelku.
3. **Slike na straneh** omogočajo izbiro obstoječe fotografije ali dodajanje glavne slike podstrani. Slike najprej naložite v **Datoteke** (JPG, PNG ali WebP, največ 5 MB). Vnesite ustrezen opis za dostopnost. Javne uredniške slike imajo lastne naslove; fotografije prijav ostanejo zasebne.
4. **Zgodovina** ohrani prejšnje različice. Obnova izbrane različice ustvari novo objavo. Če je isto vsebino medtem uredil drug uporabnik ali zavihek, strežnik zahteva osvežitev in prepreči tihi prepis.
5. **Napredno** omogoča izvoz ter pripravo podatkov JSON za večji uvoz. Vse podatke preveri strežnik; napaka ne spremeni objavljene različice. Hranite izvoze pomembnih podatkov ločeno.

## Razporeditev, novi gumbi in strani

V **Razporeditev in nove strani** izberite stran. Obstoječe razdelke premikajte s puščicama ali začasno skrijte z ikono očesa. Dodajate lahko besedila, slike, kartice, gumbe, poudarjena obvestila in razmike; prilagodite širino, poravnavo in ozadje. Vrstni red na seznamu je vrstni red javne strani. Pri slikah uporabite javni naslov iz knjižnice **Datoteke**. Vsak gumb ima svoje besedilo, cilj in videz. Cilj je lahko `/kontakt`, druga notranja pot, javni naslov `https://…`, `mailto:` ali `tel:`. Zasebni API, skripti in poljuben HTML/CSS niso dovoljeni.

Nova vsebinska stran dobi naslov `/strani/izbrana-pot`. Dodajte povezavo v glavni meni ali gumb na obstoječi strani, nato shranite objavo. Prazen seznam lastnega menija ohrani izvirni meni s podmeniji. Lastni meni je raven seznam do 10 povezav. Pri obstoječih straneh polje naslova v tem urejevalniku spreminja naslov zavihka; glavni naslov v vsebini se ureja v **Besedila na straneh**.

V **Povezave in gumbi** lahko spremenite cilj in besedilo že obstoječe povezave. Vizualni predogled ima dva načina: **Urejanje** klik prestreže in izbere element, **Preizkus** pa omogoči navigacijo ter odpiranje razdelkov. Oddaja obrazcev in zunanja okna so v predogledu izključeni. Po navigaciji lahko preklopite nazaj na urejanje; izbira strani in **Osveži predogled** ostaneta na voljo. Obrazci, koledarji, izračuni in zemljevidi ostajajo preverjeni programski moduli: njihove podatke in položaj urejate v konzoli, poljubnega novega zalednega dejanja pa urejevalnik gumbov ne ustvari.

## Kaj ureja posamezni razdelek

| Razdelek | Vsebina |
|---|---|
| Nastavitve portala | Ime, logotip, telefon, e-pošta, naslov, dežurni kontakt, povezava DEPO, besedilo noge |
| Razporeditev in nove strani | Vrstni red in vidnost razdelkov, nove vsebine, gumbi, kartice, meni in dodatne strani |
| Povezave in gumbi | Besedilo in cilj že obstoječih povezav |
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

## Upravljanje odvozov po območjih

1. V **Urniki odvoza** dodajte območje in vpišite pravila naslovov, vsako v svojo vrstico. Uporabite npr. `Tržaška cesta, Vrhnika`; kraj loči ulice z enakim imenom. Celotno naselje vključite samo, kadar povsod velja isti urnik. Številka `1` ne zadene `12` ali `1a`.
2. Za vsako vrsto odpadkov izberite dan, ponavljanje in časovno obdobje. Preverite predogled, nato dodajte datume v osnutek. V zbirko se shranijo dejanski datumi; sistem urnika po koncu obdobja ne podaljša samodejno.
3. Praznike uredite s premikom posameznih ali izbranih datumov. Dodate lahko izredni odvoz ali odstranite izpuščeni termin. Podvojeni odvozi iste vrste na isti datum niso dovoljeni. Ob premiku ostanejo identifikatorji dogodkov enaki.
4. S preizkusnim naslovom preverite razporeditev. Enako preverjanje uporablja javni API. Podvojena pravila različnih območij so zavrnjena; dvoumno ujemanje ne pripiše napačnega urnika. Območje lahko kopirate, nato spremenite njegova pravila.
5. Kliknite **Shrani in objavi**. Prejšnje različice so na voljo v zgodovini. Koledarski dogodki, ki jih je uporabnik že uvozil, se ob spremembah samodejno ne posodobijo.

## Delovni nalogi

Vsaka oddaja obrazca se takoj pojavi v konzoli: prijava ceste, svetilke, zabojnika, drugo sporočilo, povpraševanje, tržnica ali naročilo obvestil. Za prikaz naloga ni potrebna uspešna dostava e-pošte.

Z gumbom **Nov interni nalog** dodajte tudi napako spletne strani, opaženo težavo ali interno opravilo brez javnega obrazca. Vnesite področje, naslov, opis, prioriteto, odgovorno osebo in po potrebi rok. Interni nalogi so jasno ločeni s filtrom vrste; ne pošiljajo e-pošte in se ne objavijo. Ponovni poskus po omrežni napaki ne ustvari podvojene naloge.

1. Odprite **Delovni nalogi**. Števci ločijo nove, odprte, obravnavane, zamujene in zaključene oddaje. Iščite po opisu, lokaciji, imenu ali referenci; uporabite filtre.
2. Odprite nalog. Na eni strani ostane izvirna oddaja, na drugi so interna obravnava in fotografija, če je priložena.
3. Določite prioriteto, odgovorno osebo ali ekipo in po potrebi rok. Ime odgovorne osebe je interna oznaka, ne uporabniški račun ali samodejno obveščanje te osebe.
4. Uredite kontrolni seznam, označujte opravljene korake in dodajajte interne opombe. Kliknite **Shrani obravnavo**. Brez shranjevanja spremembe niso potrjene.
5. Ko so potrebni koraki opravljeni, izberite **Zaključeno** in shranite. Neuporabne korake lahko odstranite; za zaključek mora ostati vsaj en opravljen korak. Napako je mogoče ponovno odpreti z izbiro **V obravnavi**.
6. Neželene oddaje označite ustrezno; niso trajno izbrisane. Zaključene in neželene zapise najdete z izbiro **Vsa stanja**.

Zgodovina obravnave beleži spremembe stanja, prioritete, roka, odgovorne osebe in napredka ter e-pošto urednika. Enaka sled urednika je v zgodovini objav vsebin. Sočasno spreminjanje uporablja različice; starejši zapis ne prepiše novejšega. Zaključek samodejno ne pošlje odgovora obiskovalcu. Za nujne nevarnosti je še vedno treba uporabiti pristojno dežurno službo.

## E-poštna obvestila

Resend po uspešni oddaji pošlje obvestilo na nastavljeni predal skrbnika. Sporočilo vsebuje vrsto oddaje, referenco, podatke in gumb **Odpri v skrbniški konzoli**. Povezava `/admin?case=…` zahteva prijavo in ne vsebuje dostopnega žetona. Fotografije prijav se pripnejo obvestilu.

Oddaje so shranjene pred pošiljanjem. Trajna čakalna vrsta ponavlja začasno neuspešna pošiljanja in preprečuje podvajanje. Konzola prikaže neuspešna obvestila; stanje »posredovano Resend« pomeni, da je ponudnik sprejel sporočilo, ne zagotavlja prejetja v predal. Obvestila so namenjena skrbniku, ne poljubnemu e-poštnemu naslovu iz obrazca. Podjetju KPV sporočil ne pošiljamo samodejno.

## Varnost in vzdrževanje

Geslo ni v odjemalski kodi. `ADMIN_PASSWORD_HASH` je skrivnost Workerja v obliki `v1:100000:<saltHex>:<derivedHex>` (PBKDF2-SHA256, 256 bitov, naključna sol). Skrivnosti, baze, fotografij prijav in datotek `.dev.vars` ne dodajajte v Git. Zamenjava skrivnosti razveljavi obstoječe seje.

Prijavo varujejo Turnstile, omejitve poskusov po naslovu IP ter skupna omejitev preverjenih poskusov. Produkcijski sejni piškotek je `Secure`, `HttpOnly`, `SameSite=Strict`, z vezavo na gostitelja. Strežnik hrani samo zgoščeno vrednost seje; spremembe zahtevajo pravilen izvor in žeton CSRF. Potekle seje in omejitve se redno čistijo. `/admin` se streže z oznako `noindex` in prepovedjo vstavljanja v okvir; javne strani so v skrbniškem predogledu lahko v okviru istega izvora.

Po selitvi izvedite `wrangler d1 execute kpv-portal --remote --file schema.sql`, nastavite skrbniško skrivnost, izrecno določite `ADMIN_OWNER_EMAIL` in povežite Resend. Lastnik se privzeto inicializira samo za ta naslov. Stare prijave brez drugega koraka po posodobitvi ne veljajo več. Sprememba lastnikovega naslova ali pozabljeno lastnikovo geslo zahtevata nadzorovan poseg v konfiguracijo; e-poštna koda sama ne spreminja lastnikovega gesla.

Obstoječe oddaje se ohranijo. Lokalni razvoj uporablja `.data/cms.sqlite` in potrebuje isto obliko skrivnosti v prezrti `.dev.vars`; dejanskih e-pošt ne pošilja. Za lokalno preverjanje prijave se zadnje sporočilo shrani samo v zasebno prezrto `.data/admin-auth-mail.json`. Vite dostop do razvojne baze, te datoteke in skrivnosti prek HTTP zavrne. Dodatni plačljivi paket ni potreben; prijavne kode porabljajo običajno kvoto obstoječega Resend računa.
