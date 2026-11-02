# Objava in obratovanje portala

## Sprememba z dne 1. 11. 2026

Ta sprememba potrebuje migraciji `0001_baseline.sql` in `0002_editor_reliability.sql`. Prva varno vzpostavi tudi doslej ročno pripravljeno shemo z `IF NOT EXISTS`; druga doda pravice, preklic osebnih povezav, zaščito pred podvojenimi oddajami, osnutke in načrtovane objave. Nobena ne briše obstoječih vsebin, oddaj ali fotografij. Migracije se uporabljajo pred novo različico Workerja.

Pred objavo uporabite `npm ci`, `npm run check` in `npx wrangler deploy --dry-run`. Preizkusi vključujejo dejanski lokalni workerd z D1/R2 in ponovljive migracije; ne uporabljajo produkcijskih skrivnosti ali zunanje pošte. `npm run db:migrate:local` je lokalna migracija. `npm run db:status` in `npm run db:migrate:remote` namenoma delujeta na oddaljeni bazi iz konfiguracije. `npm run deploy` opravi preverjanje, poskusno pakiranje, oddaljene migracije in objavo; to ni ukaz za lokalni predogled.

## Nastavitve pred institucionalno objavo

- Potrdite dejansko domeno in nastavite `PUBLIC_ORIGIN`, Worker routes ter Turnstile hostname/site key. E-poštne povezave izhajajo iz istega `PUBLIC_ORIGIN`; koledarske povezave uporabljajo trenutno domeno brskalnika. Identitete že objavljenih koledarskih dogodkov ostanejo stabilne.
- Potrdite lastniški račun, prejemnika oddaj, domeno pošiljatelja in veljavne skrivnosti. Ne zamenjajte dostopov z izmišljenimi službenimi računi. Lastnik lahko prejemnika preveri in spremeni v administraciji.
- `observability.redact_query_string` mora ostati vključen. Predhodni dnevniki se s to nastavitvijo ne spremenijo za nazaj; preverite njihove dostope in politiko hrambe. Novi osebni naročniški žetoni so v fragmentu povezave in telesu API-zahteve, ne v API query parametrih.
- Preverite pravice do fotografij ter uradne podatke, kontakte, cenike, odvoze in morebitno evidenco pokopališča. Koda ne ustvarja manjkajočih dejanskih zapisov.
- Dogovorite roke hrambe in odgovornost za zahtevke glede osebnih podatkov. Samodejnega brisanja po izmišljenem roku ni. Lastniško orodje omogoča preverjen posamični izbris s predogledom.

## Administracija

Novi dostopi so lahko omejeni na vsebine, obravnavo oddaj in pošiljanje obvestil ali oboje. Doslej obstoječi uredniki ohranijo oba sklopa, dokler lastnik izrecno ne spremeni pravic. Sprememba pravic prekliče njihove obstoječe seje. Vsebinske omejitve veljajo tudi v API, ne samo v meniju.

»Shrani osnutek« zasebno shrani celoten preverjen osnutek v račun urednika in ne spremeni javne strani. Shranjeni osnutek lahko ponovno odprete po osvežitvi strani. Neveljaven JSON se zavrne pred zamenjavo obrazca. Ob poteku seje se trenutni vsebinski osnutek ohrani v pomnilniku istega okna do ponovne prijave iste osebe; za preživetje zaprtja okna uporabite shranjevanje osnutka.

Skupna objava spletne strani je transakcijska in preverja različice. Konflikt ne objavi nobenega izmed izbranih področij. Osvežitev objavljenih različic ob ohranitvi osnutka je izrecno dejanje urednika; pred novo objavo preverite spremembe drugih oseb. Zgodovina posameznega področja ostaja na voljo.

Načrtovana objava shrani nespremenljiv posnetek in pričakovane različice. Izberite prihodnji slovenski datum; objava se izvede pri prvem uspešnem minutnem cron prehodu tega datuma. Prihodnjih tarif ni treba ročno objavljati ob polnoči. Spremenjene javne različice ali preklican dostop avtorja ustavijo načrt in zahtevajo pregled. Začasna napaka shrambe sproži varen ponovni poskus. Načrtovano objavo lahko avtor ali lastnik prekliče, dokler še ne teče. Objava obvestila sama ne pošlje množične pošte.

Stare osebne upravljavske povezave brez nove različice so namenoma preklicane. Naročnik do nove povezave pride s ponovno prijavo in potrditvijo e-pošte. Stare še veljavne potrditvene povezave ostanejo uporabne do njihovega roka. Ločena odjavna povezava ne omogoča branja domačega naslova ali spreminjanja nastavitev.

## Nadzor delovanja

`/api/live` odgovori, ali Worker deluje. `/api/health` preverja vezavo baze, zahtevane tabele ter nastavitve prijave, pošte, fotografij, naročnin in zaščite obrazcev; pri nepripravljenosti vrne 503. Uspešen odgovor še ne dokazuje dostave pošte v predal. Po objavi preverite tudi administracijo, dejansko dostavo z odobrenim prejemnikom, prikaz zemljevidov in objavljeno vsebino.

Javni obrazci imajo preverjanje Turnstile in kvoti desetih oddaj na minuto ter sto na uro za zaščiten identifikator povezave. Ponovitev uspešno shranjene oddaje z istim naključnim requestId in istimi podatki vrne isto potrdilo. Spremenjena vsebina potrebuje novo identiteto. Stare stranke brez requestId ostanejo združljive.

## Izbris in zunanji izvodi

Lastnik v razdelku »Osebni podatki« najprej preveri obseg po e-pošti ali referenci oddaje, nato potrdi trajni izbris. Potrdilo je vezano na predogled in poteče po desetih minutah. Spremenjena evidenca zahteva nov predogled. Napaka pri odstranjevanju fotografije ohrani izvorne evidence za ponovitev, ustavi pa čakajočo dostavo; preverite opozorilo in ponovite postopek.

Že dostavljena oziroma trenutno poslana pošta, kopije pri ponudniku in varnostne kopije potrebujejo ločeno obravnavo. Revizijska sled izbrisa hrani samo čas, naključno oznako in števila odstranjenih zapisov. Množični avtomatski izbris ni omogočen.

## Varnostne kopije in vaja obnove

Pred prvo produkcijsko migracijo določite odgovorno osebo ter zajemite in zaščitite usklajeni kopiji D1 in R2. Preverite dejansko razpoložljivost časovne obnove D1 v uporabljenem računu; ne zanašajte se na nedokumentirano predpostavko. Izvoz D1 vsebuje osebne podatke in sodi v zasebno shrambo. Fotografij in skrivnosti ne dodajajte v Git.

Vajo izvedite v ločenem Workerju, ločeni D1 in zasebnem R2, z onemogočeno zunanjostjo pošte ter ločenimi testnimi domenami. Obnovite bazo in objekte z istimi ključi, pripravite ustrezne skrivnosti, preverite shemo, vsebinske revizije, reference fotografij ter dovoljenja. Pred omogočanjem crona preglejte obnovljeno poštno vrsto in načrtovane objave: časovna obnova lahko vrne že poslana opravila. Produkcijski ključ naročnin ohranite samo, če nameravate ohraniti tudi veljavnost njihovih osebnih povezav.

V tej spremembi sta avtomatsko preverjena sveža vzpostavitev in nadgradnja obstoječe baze z ohranitvijo vsebin, zgodovine, zasebnih oddaj in ključev fotografij. Obnova dejanskih produkcijskih kopij D1/R2 še ni bila izvedena. Zabeležite čas kopije, rezultat vaje, izmerjeni čas obnove in dovoljeno izgubo podatkov, preden razglasite postopek za preverjen.

Pri povrnitvi različice Workerja ohranite dodane tabele. Nova shema je dodajalna; brisanje tabel zaradi povrnitve aplikacije bi izgubilo nove osnutke, identitete oddaj in varnostne revizije.
