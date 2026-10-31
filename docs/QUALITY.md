# Preverjanje portala in vzdrževanje

Pregled: 31. 10. 2026. Namen je preprečevanje ponavljajočih se napak v dejanskih postopkih, ne zgolj uspešna gradnja.

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
| Odvozi in koledar | Ločene frakcije, dvoumna pokritost, datumi, praznične izjeme, omejeno ponavljanje in zaščita pred zastarelim datumom. |
| Cenik | Tri občine, osnovne omrežnine, DN, poraba, gospodinjske količine odpadkov, izključujoče kanalizacijske/greznične postavke, DDV in datumi veljavnosti. |
| Pokopališče | Sektorji/vrste, več oseb, neznani datumi, preverjeni položaji, robovi in razmiki, menjava načrta brez izgube identitet, preklic. |
| Lokacije | Veljavna točka ima neposredno povezavo; prazne koordinate ne postanejo (0, 0); pošta vsebuje klikljivo povezavo. |
| Tržnica | Izbor objavljenih terminov, blokada zaprtih/preteklih datumov, sprememba razpoložljivosti in nevtralno povpraševanje brez obljube rezervacije. |
| Knjižnica | Dostop do več kot 100 slik, isti čas nalaganja ne povzroči izpustov/podvojitev; starejša slika ostane uporabna v urejevalniku. |

## Organizacija kode

Računska pravila so v `shared/utility-pricing.js`, dejanske tarife in viri v `shared/official-tariffs-2026.json`. `shared/calendar-series.js` hrani pravilo točnega ponavljanja. `shared/location.js` sestavlja varne povezave. Pokopališki postopki so v `src/data/cemetery.ts` in namenskem `CemeteryEditor`; cene ureja `TariffsEditor`. Enaka strežniška validacija velja za urejevalnik, napredni uvoz in obnovo zgodovine.

Odstranjeni so neuporabljeni podvojeni obrazci in stari trdo vpisani opisi. TypeScript zavrača nove neuporabljene spremenljivke/importirane simbole. Nekdanji splošni prikazni zneski za komunalne storitve se ob branju starih nastavitev zavržejo; tržnični cenik ostane ločen.

## Meje in predaja

Noben programski preizkus ne potrdi pravilnosti fizične evidence grobov. Orientacijski osnutek nima uradnih oznak in se ne objavi samodejno. Dejanske zapise in položaje potrdi KPV.

Tarife in odvoze je treba posodabljati ob novih uradnih objavah. Preverjene tarife imajo vir in datum. Izračun za gospodinjstvo je ocena rednih mesečnih storitev, ne sprememba dejanskega računa.

Zadnje brskalniško preverjanje tega sklopa je omejeno: nastavitev računa je zavrnila uporabo lokalnega brskalnika. Samodejni DOM-preizkusi niso označeni kot vizualni preizkusi. Sporočila ponudniku niso isto kot prejem v predal; testne kampanje se ne pošiljajo občanom brez izrecnega navodila.
