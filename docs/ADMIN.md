# Uredništvo portala in obravnava prijav

## Prijava in dostop

Odprite `https://kpv.jakobtominc.com/admin` ali v javno iskanje vpišite `/admin`. Konzola ni v javnem meniju. Vpišite dovoljeni e-poštni naslov in geslo, nato osemmestno kodo iz e-pošte. Seja nastane šele po potrditvi kode in poteče po osmih urah. Na deljeni napravi se po delu odjavite.

Koda velja največ deset minut. Dovoljenih je pet poskusov; novo kodo lahko zahtevate po 60 sekundah. Ponovno pošiljanje razveljavi prejšnjo kodo in ne podaljša prvotnega prijavnega okna.

Lastnik v **Dostop in skrbniki** povabi urednike. Povabilo velja 24 ur. Povabljeni potrdi kodo in nastavi geslo z najmanj 12 znaki. Uredniki lahko urejajo vsebine in obravnavajo naloge. Dostop skrbnikov in prejemnika obvestil spreminja samo lastnik. Odvzem dostopa ali novo povabilo razveljavi stare seje in kode urednika. Lastnikovega računa ni mogoče odstraniti iz konzole.

## Izberite opravilo

| Želite urediti | Odprite |
| --- | --- |
| Besedilo, fotografijo, povezavo, razdelke ali logotip | **Urejevalnik spletne strani** |
| Telefon, naslov, e-pošto ali besedilo noge | **Nastavitve portala** |
| Redni delovni čas | **Delovni časi** |
| Novico, načrtovana dela ali motnjo | **Obvestila in motnje** |
| Območja in dejanske datume odvozov | **Urniki odvoza** |
| Prijavo občana ali interno opravilo | **Delovni nalogi** |
| Predal za obvestila o novih oddajah | **E-poštna obvestila**; samo lastnik |
| Fotografije za večkratno uporabo | **Datoteke** |

Vsebinske spremembe so najprej osnutek. Gumb **Shrani in objavi** jih objavi na javni strani. Pri obvestilih prikaz posamezne objave dodatno določa polje **Prikaži na spletni strani**. Ob zapuščanju področja konzola opozori na neshranjene spremembe. **Zavrzi** vrne zadnjo shranjeno vsebino.

## Urejevalnik spletne strani

V enem urejevalniku so tri opravila. Med njimi lahko prehajate brez izgube skupnega osnutka.

1. **Besedila, slike in povezave:** izberite stran in v predogledu kliknite naslov, odstavek ali sliko. V poljih ob predogledu uredite vsebino. Za cilj gumba izberite opravilo **Povezava** in kliknite povezavo. Dovoljeni so javni naslovi `https://…`, notranje poti, kot je `/kontakt`, ter `mailto:` in `tel:`.
2. **Razdelki in meni:** kliknite oštevilčen razdelek v seznamu ali isti razdelek v predogledu. Zelena obroba pokaže, kaj urejate. Puščici premakneta razdelek za eno mesto. Oko spremeni vidnost. Skrit razdelek ostane v seznamu in ga lahko znova prikažete. **Uredi nastavitve razdelka** odpre njegove nastavitve.
3. **Logotip KPV:** naložite sliko ali jo izberite iz knjižnice in vpišite ime podjetja za bralnike zaslona. Slika velja za glavo in nogo vseh strani. Priporočljiv je PNG s prosojnim ozadjem. Brez slike se uporabi besedilna oznaka podjetja.
4. Preglejte rezultat in kliknite **Shrani in objavi**. Če se objavi samo del področij, konzola pove, koliko jih je uspelo shraniti. Preostali osnutek ostane v urejevalniku; odpravite napako in poskusite znova.

Slike lahko naložite neposredno ob urejanju. Dovoljeni so JPG, PNG in WebP do 5 MB. Naložena datoteka je javno dosegljiva; na stran jo dodate z izbiro in shranjevanjem vsebine. Fotografije prijav občanov ostanejo v ločeni zasebni shrambi.

Glava in noga sta skupni vsem stranem. Enako besedilo ali ista slika, ki se na isti strani ponovi večkrat, uporablja skupno zamenjavo. Podatke urnikov, obvestil in kontaktov zato urejajte v njihovem vsebinskem področju. Dodane lastne razdelke urejate pod **Razdelki in meni**.

Način **Urejanje** prestreže klik in izbere vsebino. **Preizkus** omogoča preizkus notranjih povezav in odpiranje razdelkov. Oddaja obrazcev in odpiranje zunanjih oken sta v predogledu izključena.

Dodajate lahko besedilo, slike, kartice, gumbe, poudarjena obvestila in razmike. Nova stran dobi pot `/strani/izbrano-ime`. Da jo obiskovalci najdejo, dodajte povezavo v meni ali gumb. Prazen seznam lastnega menija ohrani izvirni meni s podmeniji. Lastni meni ima največ deset povezav in je raven seznam. Pri obstoječi strani polje naslova v razporeditvi spreminja naslov zavihka; glavni naslov urejate v predogledu.

Poljuben HTML, CSS in skripti niso dovoljeni. Obrazci in zemljevidi ostanejo programski moduli; nov gumb sam ne ustvari novega zalednega postopka.

## Zgodovina in sočasne spremembe

**Zgodovina** ohrani prejšnje različice. V skupnem urejevalniku najprej izberite področje zgodovine: besedila, slike, povezave, razporeditev ali nastavitve. Obnova objavi izbrano vsebino kot novo različico; stare različice ostanejo ohranjene.

Če isti podatek spremeni drug urednik ali zavihek, strežnik prepreči prepis novejše različice. Pred osvežitvijo si zabeležite svoj popravek. Nato naložite nove podatke, preverite razliko in spremembo ponovite. **Napredno**, kjer je na voljo, omogoča izvoz in uvoz JSON. Uvoz najprej spremeni osnutek; objavo potrdi običajno shranjevanje. Pomembne izvoze hranite ločeno.

## Obvestila in motnje

1. Izberite obvestilo ali kliknite **Dodaj obvestilo**. Iskanje in filtra objav ter osnutkov olajšajo pregled.
2. Vnesite naslov, področje, območje, datum ter vsebino in navodila. Pri motnji navedite prizadete naslove, čas in ravnanje občanov.
3. Izberite stanje: informacija, načrtovana dela oziroma motnja, motnja v teku ali zaključeno. Zaključek motnje in umik objave sta ločeni dejanji.
4. Za objavo vključite **Prikaži na spletni strani** in shranite spremembe. Izključeno polje shrani uredniški osnutek, ki ni javen. Poznejši datum sam ne odloži objave.
5. Neobvezno vnesite obe koordinati za točko cestnih del. Brez točke je obvestilo še vedno vidno na seznamu.

Predogled pokaže besedilo in oznake. Spremembe obvestil ne pošiljajo množične e-pošte naročnikom. Izbris začne veljati po shranjevanju področja.

## Urniki odvoza

Urnik se sestavi ločeno za embalažo, biološke odpadke in mešane komunalne odpadke. Isti naslov ima zato lahko več odvoznih območij. Javna stran uporablja objavljene točne datume in ne ustvarja nadomestnih datumov za nepokrite naslove ali pretekle urnike.

1. Izberite ali dodajte območje. Vpišite naslovna pravila, vsako v svojo vrstico. Kraj loči enako imenovane ulice: na primer `Tržaška cesta, Vrhnika`. Celotno naselje vključite le, če zanj velja isti urnik. Hišna številka `1` ne vključuje `12` ali `1a`.
2. Za redne odvoze izberite vrsto odpadkov, dan, interval ter začetni in končni datum. Preverite predogled, nato kliknite **Dodaj predogledane termine v osnutek**. Sama izbira ponavljanja še ne doda terminov.
3. Dodajte posamezne odvoze in uredite praznične izjeme. Spremenite datum ali označene termine skupaj premaknite. Odvozi iste vrste na isti datum se ne smejo podvojiti.
4. Vnesite preizkusni naslov. Preverite rezultate za vsako vrsto in prihodnje datume. Dvoumnih poti portal ne izbere sam; razmejite jih po potrjenih naslovih. Enako pravilo v območjih različnih vrst je dovoljeno.
5. Kliknite **Shrani in objavi**. Preverite isti naslov na javni strani. Koledar vsebuje prikazane datume. Prenesene datoteke ICS se ne posodobijo samodejno; spremembe preverite na strani.

### Vir in meje uvoženih podatkov

Začetni podatki so prepisani iz [uradnih urnikov KPV](https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html), preverjenih 30. oktobra 2026. Izvorni dokumenti, povezave po območjih in pojasnila so v `shared/official-collection-2026.json`; ponovljiv uvoz je v `scripts/import-official-collection.mjs`.

- Embalaža je potrjena do konca 2026. MKO vključuje samo januarske datume 2027, izrecno navedene v virih. BIO vključuje objavljene zimske tedne do februarja 2027. Po koncu datumov je treba vnesti nov potrjen urnik.
- Meje med običajnim in majhnim vozilom ponekod niso razmejene po hišnih številkah. Ta naselja ostajajo dvoumna za ustrezno vrsto; drugi potrjeni odvozi se lahko prikažejo kot delni urnik.
- Del Lavrovca in razmejitev Rovt, delitev BIO na Vrhniki ter delno navedene ulice potrebujejo potrditev po naslovih. Embalaža Gradišnikove ulice ni samodejno dodeljena, ker vir navaja le lihe hišne številke.
- BIO med 14. in 18. decembrom 2026 nima odvoza. Nejasna petkova praznična izjema ob božiču ni prenesena kot domnevni datum.

Delni urnik ni popoln seznam odvozov za gospodinjstvo. Opozorila ne odstranite samo s spremembo besedila: najprej preverite manjkajoče poti in datume pri pristojni službi.

## Delovni nalogi

Javne oddaje se po shranjevanju pojavijo kot nalogi: kontaktna sporočila, prijave napak, povpraševanja, prijave na tržnico in zahteve za obvestila. Dostava e-pošte ni pogoj za prikaz naloga.

1. Odprite **Delovni nalogi**. Števci in filtri ločijo nova, odprta, zamujena, zaključena in neželena sporočila. Iščite po referenci, osebi, lokaciji ali opisu. Števci niso omejeni na trenutno stran seznama.
2. Odprite nalog in preberite izvirno oddajo ter morebitno fotografijo. Po potrebi uporabite **Začni obravnavo**.
3. Določite prioriteto, odgovorno osebo ali ekipo ter rok. Odgovorna oseba je interna oznaka; vpis ne ustvari računa ali pošlje obvestila.
4. Uredite kontrolni seznam in dodajte interne opombe. Potrdite z **Shrani obravnavo**.
5. Z **Zaključi nalog** zaključite obravnavo. Če ostanejo neopravljeni predlagani koraki, konzola zahteva potrditev. Koraki ostanejo zapisani. Zaključen nalog lahko ponovno odprete.
6. Neželene oddaje označite ustrezno. Niso trajno izbrisane in jih lahko poiščete s filtrom stanja.

**Nov interni nalog** ustvari opravilo brez javne oddaje. Interni nalogi se ne objavijo in ne pošiljajo e-pošte. Ponovitev ustvarjanja po omrežni napaki uporablja zaščito pred podvojitvijo.

Zgodovina zabeleži urednika in spremembe. Sočasni popravki ne prepišejo novejšega naloga. Zaključek ne pošlje odgovora obiskovalcu. Za odgovor uporabite kontakt oddajatelja; za nujno nevarnost obvestite pristojno službo.

## E-poštna obvestila in predaja KPV

Lastnik v **E-poštna obvestila** določi en predal za nova obvestila o oddajah. Vpišite samo e-poštni naslov, brez imena ali seznama prejemnikov, in kliknite **Shrani prejemnika**. Konzola pokaže prejemnika, pošiljatelja in zadnjo spremembo. Pred predajo preverite, da je izbran pravi predal za obravnavo prijav.

Sprememba velja za obvestila, ustvarjena po shranjevanju. Že čakajoča obvestila obdržijo prejšnjega prejemnika. Naslovi skrbnikov, prijavne kode in pošiljatelj se ne spremenijo. **Uporabi začetni naslov** pripravi vrnitev na konfiguracijski naslov; tudi to spremembo je treba shraniti.

Oddaja in obvestilo se najprej shranita. Trajna čakalna vrsta ponavlja začasno neuspešno pošiljanje. Stanje »posredovano Resend« pomeni, da je ponudnik sprejel sporočilo, ne potrjuje prejema v predal. Sporočilo vsebuje referenco in povezavo `/admin?case=…`, ki zahteva prijavo. Fotografije prijav se pripnejo obvestilu.

Ta obvestila so namenjena skrbniku. Objavljanje obvestil, zaključevanje nalogov in oddaja zahteve za prejemanje informacij sami ne pošiljajo množične pošte ali samodejnih odgovorov občanom.

## Druga področja

**Zbirna mesta** urejajo potrjene naslove, koordinate in sprejete vrste odpadkov. **Čarovnik in vrste odpadkov** urejajo pravila ločevanja. **Komunalne storitve** urejajo navodila za povpraševanja. Cene stojnic in želene termine tržnice usklajujte z veljavnim cenikom. Prijava ne potrdi razpoložljivosti ali rezervacije in ne izvede plačila. Javna stran s ceniki vodi na uradne cenike občin.

**Pokopališče** podpira potrjeno evidenco in načrt. Brez objavljenih grobnih mest prikaže uporabne kontakte. Slika sama ne določi koordinat grobov; načrt in zapise je treba poravnati ter preveriti. Tehnično ozadje je v [CEMETERY.md](CEMETERY.md).

## Varnost in vzdrževanje

Geslo ni v odjemalski kodi. `ADMIN_PASSWORD_HASH` je skrivnost Workerja v obliki `v1:100000:<saltHex>:<derivedHex>`; uporablja PBKDF2-SHA256. Skrivnosti, baze, fotografij prijav in `.dev.vars` ne dodajajte v Git. Zamenjava skrbniške skrivnosti razveljavi seje.

Prijavo varujejo Turnstile in omejitve poskusov. Produkcijski piškotek je `Secure`, `HttpOnly` in `SameSite=Strict`. Strežnik hrani zgoščeno vrednost seje; spremembe zahtevajo pravilen izvor in CSRF. Skrbniška stran uporablja `noindex` in prepoved vstavljanja v okvir. Javne strani so lahko v predogledu istega izvora.

Ob selitvi prenesite shemo in podatke D1, datoteke R2, skrivnosti, `ADMIN_OWNER_EMAIL`, Resend in omejitve gostiteljev Turnstile. Obstoječih produkcijskih virov ne ustvarjajte znova. E-poštna koda ne ponastavi lastnikovega gesla; pozabljeno geslo ali sprememba začetnega lastnika zahtevata nadzorovan poseg.

Lokalni razvoj uporablja `.data/cms.sqlite` in skrivnost v prezrti `.dev.vars`. Ne pošilja dejanske pošte. Zadnje prijavno sporočilo je v zasebni `.data/admin-auth-mail.json`, ki ni dosegljiva prek Vite HTTP. Produkcijska prijava in obvestila uporabljajo obstoječi račun Resend.
