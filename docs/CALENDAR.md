# Dodajanje odvozov v koledar

Na `/odpadki/urnik` poiščite svoj naslov in pri terminu izberite **Dodaj v koledar**.

1. Izberite **Google Koledar**, **Apple Koledar**, **Outlook** ali drugo aplikacijo.
2. Za en termin pustite **Vključi tudi prihodnje odvoze te vrste** izključeno. Gumb odpre dodajanje posameznega dogodka; v koledarju ga potrdite. Google ohrani prejšnjo neposredno povezavo, Outlook odpre svoj obrazec, Apple uporabi prejšnjo povezavo za aplikacijo.
3. Za prihodnje odvoze vključite možnost. Isti glavni gumb odpre dodajanje koledarja v izbranem ponudniku oziroma aplikaciji. Datoteke ni treba ročno prenašati ali uvažati.
4. Pri službenem/šolskem Outlooku vključite **Službeni ali šolski račun Microsoft 365**.

Prihodnji odvozi so ločen koledar z dejanskimi objavljenimi termini izbrane vrste odpadkov za odvozno območje. Praznični premiki, izpusti in poznejše objave se upoštevajo ob osvežitvi. Čas osveževanja določa aplikacija oziroma ponudnik; spremembe niso nujno vidne takoj. Odstranitev naročnine uredite v svoji aplikaciji.

Posamezni dogodek je kopija in se ne osvežuje. Prenos datoteke ostaja samo pod **Druga možnost dodajanja**, če aplikacija povezave ne odpre. Stari izvozi `.ics` so še podprti.

## Za urednika

V **Administracija → Urniki odvoza** uredite datume in jih objavite. Pri rednem vzorcu pripravite predogled in **Dodaj predogledane termine v osnutek**; praznične izjeme uredite posamično. Preverite naslov in **Shrani in objavi**.

Koledarske naročnine so vezane na obstoječa odvozna območja. Pri novih urnikih praviloma dopolnite datume obstoječega območja. Če območje izbrišete in ustvarite novo, morajo uporabniki dodati nov koledar. Izpraznjeno ali odstranjeno območje vrne prazen veljaven koledar.

## Tehnično preverjanje

`/api/calendar/feed` bere objavljene podatke po oznaki območja in vrsti odpadkov. Povezava ne vsebuje domačega naslova ali oznake posameznega dogodka. Začetek je dan dodajanja po času v Ljubljani, da premik na zgodnejši prihodnji datum ne izpade. Identitete dogodkov ostanejo stabilne tudi po premiku datuma.

Preizkusi preverjajo neposredne povezave ponudnikov, posamezni datum, vrste odpadkov, objavljene datume, spremembe, odstranitve, prazna območja in odsotnost domačega naslova v naročniški povezavi. Preizkus povezave ni isto kot dejanska potrditev v uporabnikovem računu.

Viri: [Google – javni koledar](https://support.google.com/calendar/answer/37100), [Microsoft – naročanje na koledar](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web), [Apple – naročanje na koledarje](https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac). Oblike povezav sledijo tudi javni implementaciji [Google](https://github.com/add2cal/add-to-calendar-button/blob/main/src/generators/google.ts) in [Outlook](https://github.com/add2cal/add-to-calendar-button/blob/main/src/generators/outlook.ts).
