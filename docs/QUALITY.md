# Preverjanje portala in vzdrževanje

Pregled: 1. 11. 2026. Namen je preprečevanje ponavljajočih se napak v dejanskih postopkih, ne zgolj uspešna gradnja.

## Obvezni pregled pred objavo

1. `npm run check`: strežniški preizkusi, preizkusi komponent v simuliranem DOM in produkcijska gradnja z zahtevnim tipovnim pregledom.
2. `npx wrangler deploy --dry-run`: preverjanje paketa in obstoječih vezav Cloudflare.
3. Po objavi `npm run test:smoke -- https://kpv.jakobtominc.com`: dosegljivost API, dejanski urnik/koledar in varnost javnih obrazcev. V produkciji ta preizkus preverja zavrnitev brez Turnstile in ne ustvarja oddaj ali pošilja pošte.
4. V brskalniku preverite ključni popravljeni postopek na računalniku in telefonu. Simulirani DOM ne potrjuje dejanskih mer, dotika, delovanja zunanjih koledarskih aplikacij ali dostave v predal.

## Pokritost

| Področje | Kaj preverjamo |
| --- | --- |
| Javne strani | Vseh 21 vgrajenih poti se izriše; notranje povezave vodijo na podprte poti. |
| Administracija | Odpiranje vseh 19 področij z overjenim vsebinskim odgovorom. |
| Dostop | Geslo in enkratne kode, omejitve poskusov, vloge, povabila, preklic sej, izvor in CSRF. |
| Vsebine | Shema vsakega področja, zasebni osnutki, zgodovina/obnova, konflikti različic, uvoz in javno/zasebno ločevanje. |
| Nalogi in obrazci | Oddaje, fotografije, kombinirani filtri, preprečevanje starih rezultatov ob napaki, stanja, opombe in sočasne spremembe. |
| E-obvestila | Potrditev, območje in tema, različne oblike naslovov, točne hiše, osebne povezave, odjava, ponovitve ter preklic neposlane pošte. |
| Odvozi in koledar | Ločene frakcije, datumi, praznične izjeme, neposredne povezave Google/Apple/Outlook, naročniški koledar brez domačega naslova, spremembe in umiki ter združljivost prejšnjih izvozov. |
| Cenik | Tri občine, osnovne omrežnine, DN, poraba, gospodinjske količine odpadkov, izključujoče kanalizacijske/greznične postavke, DDV in datumi veljavnosti. |
| Pokopališče | Sektorji/vrste, več oseb, neznani datumi, preverjeni položaji, robovi in razmiki, menjava načrta brez izgube identitet, preklic. |
| Lokacije | Veljavna točka ima neposredno povezavo; prazne koordinate ne postanejo (0, 0); pošta vsebuje klikljivo povezavo. |
| Tržnica | Izbor objavljenih terminov, blokada zaprtih/preteklih datumov, sprememba razpoložljivosti in nevtralno povpraševanje brez obljube rezervacije. |
| Knjižnica | Dostop do več kot 100 slik, isti čas nalaganja ne povzroči izpustov/podvojitev; starejša slika ostane uporabna v urejevalniku. |

Ponovni pregled uporabnosti je odpravil obvezni ročni uvoz prihodnjih odvozov, ponavljajoče klikanje za primerjave izračuna, zavračanje oznake groba med tipkanjem, izgubljeno bližnjico za cestna obvestila in predolg razširjen cenovni blok pred naročilom storitve. Strežniški preizkus potrjuje, da prihodnja tarifa ne more prepisati trenutnega cenika in onesposobiti izračuna. Ti preizkusi preverjajo konkretna uporabniška dejanja; zgolj uspešna gradnja ni dokaz uporabnosti.

Dodatni pregled ohranja že delujoče postopke in preverja izgubljen kontekst: izbor druge strani odstrani prejšnjo izbiro v pregledovalniku brez izgube osnutka; pozni odgovor za prejšnje obvestilo ne pokaže napačnega števila prejemnikov. Obrazec za kontakt ohrani ročno napisano zadevo tudi po spremembi področja. Prazno cenovno polje med urejanjem ne postane samodejno ničla. Sporočilo po nalaganju v knjižnico ne zahteva gumba za objavo, ki ga tam ni.

## Organizacija kode

Računska pravila so v `shared/utility-pricing.js`, dejanske tarife in viri v `shared/official-tariffs-2026.json`. `shared/calendar-series.js` hrani pravilo točnega ponavljanja. `shared/location.js` sestavlja varne povezave. Pokopališki postopki so v `src/data/cemetery.ts` in namenskem `CemeteryEditor`; cene ureja `TariffsEditor`. Enaka strežniška validacija velja za urejevalnik, napredni uvoz in obnovo zgodovine.

Odstranjeni so neuporabljeni podvojeni obrazci in stari trdo vpisani opisi. TypeScript zavrača nove neuporabljene spremenljivke/importirane simbole. Nekdanji splošni prikazni zneski za komunalne storitve se ob branju starih nastavitev zavržejo; tržnični cenik ostane ločen.

## Meje in predaja

Noben programski preizkus ne potrdi pravilnosti fizične evidence grobov. Orientacijski osnutek nima uradnih oznak in se ne objavi samodejno. Dejanske zapise in položaje potrdi KPV.

Tarife in odvoze je treba posodabljati ob novih uradnih objavah. Preverjene tarife imajo vir in datum. Izračun za gospodinjstvo je ocena rednih mesečnih storitev, ne sprememba dejanskega računa.

Prvi izvedbeni pregled 1. 11. 2026 je potrdil lokalno prijavo z geslom in kodo, klik za urejanje migriranega polja, zasebni osnutek, skupno objavo, zavrnitev neveljavnega JSON, načrtovanje in mobilno prazno stanje pokopališča. Takrat je opravilo preverjanje 162 strežniških/skupnih in 62 UI primerov, tudi dejanski lokalni workerd z D1/R2 ter posnetke nad 2 MB.

Nadaljnji [funkcionalni pregled](qa/FUNCTIONAL-REVIEW-2026-11-01.md) vsebuje popis 164 skupin dejanj/stanj za obiskovalce, urejevalnike in skrbnike. Ločuje pregled kode, simulirani DOM, dejanski API in brskalnik. Zabeleženi so konkretni popravki, ponovljivi preizkusi, dejanske lokalne oddaje s fotografijo, celoten življenjski cikel naročnine in naloga, paginacija naročnikov, izvoz/uvoz datoteke, načrtovanje/preklic ter predogled tiska. Aktualne skupne rezultate in preostale meje vsebuje navedeno poročilo.

To ne potrjuje vseh naprav ali popolne dostopnosti. Sporočila ponudniku niso isto kot prejem v predal; testne kampanje se ne pošiljajo občanom brez izrecnega navodila. Potrditev fizičnih evidenc, tarif, produkcijske dostave, dejanskih naprav in operativnih postopkov ostaja ločena od uspešne gradnje.
