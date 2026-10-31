# Ceniki in informativni izračun

Podatki so preverjeni 31. oktobra 2026. Javna stran `/kalkulator` uporablja objavljeni razdelek CMS **Ceniki in izračun** (`tariffs`). Stari splošni zneski iz `rates` se za ta izračun ne uporabljajo. Cene tržničnih stojnic se urejajo ločeno.

## Uradni viri

- [Vrhnika – cenik od 1. 7. 2026](https://www.kpv.si/mCeniki/Datoteke/Cenik_GJS_Vrhnika_01jul2o26.pdf)
- [Borovnica – cenik od 1. 7. 2026](https://www.kpv.si/mCeniki/Datoteke/Cenik_GJS_Borovnica_01jul2o26.pdf)
- [Log - Dragomer – cenik od 1. 7. 2026](https://www.kpv.si/mCeniki/Datoteke/Cenik_GJS_LogDragomer_01jul2o26.pdf)
- [Priloga s količinami odpadkov za leto 2026](https://www.kpv.si/mCeniki/Datoteke/Priloga_cenikKomStoritev2o26d.pdf): gospodinjstva, str. 2, 4, 6, 8. Odpadki se obračunajo po osebah, zato javni kalkulator ne množi prostornine gospodinjskega zabojnika s poslovnimi faktorji. Mesečne mase na osebo so zbiranje 15,0478 kg, BIO 12,6954 kg, obdelava 4,5169 kg in odlaganje 0,4517 kg.
- [Posebne storitve – odpadki](https://www.kpv.si/mCeniki/mCpsrzo.html), velja od 1. 11. 2025. Enote preverjene tudi v izvornih atributih `data-enota`: ravnanje s kosovnimi odpadki €/kg, prevoz €/ura, najem zabojnika €/dan. Najem vsebuje 22 % DDV.
- [Posebne storitve – kanalizacija](https://www.kpv.si/mCeniki/mCpskan.html), velja od 1. 3. 2025. Izredni prevzem in lastna dostava sta €/m³; pregled s TV-kamero €/ura. Izredna storitev ni cena rednega praznjenja.
- [Pojasnila KPV k obračunu](https://www.kpv.si/mVprasanja/mVstor.html): premer DN, omrežnine, večstanovanjski objekti. Pri starejših besedilih imajo novejši ceniki prednost.

V izhodiščnih PDF-jih je pri posameznih bruto cenah zadnja decimalka neenotno zaokrožena; kalkulator zato uporablja objavljeno neto tarifo in DDV enkrat pri vsaki postavki. Omrežnine faktorja 1 se pomnožijo z uradnim faktorjem glede na razred DN. Okoljska dajatev nima DDV.

## Uporaba in vzdrževanje

1. V **Ceniki in izračun** izberite občino. Prepišite datum, vir in neto vodarino, odvajanje, čiščenje ter osnovne omrežnine.
2. Skupne tarife greznic/MKČN in okoljski dajatvi so v svojem razdelku. Dajatev za ustrezno MKČN je nižja; javni obrazec to pojasni.
3. Pri odpadkih posodobite tako cene kot mesečne gospodinjske količine iz uradne priloge. Neto cene ne pretvarjajte ročno v bruto.
4. Pri posebnih storitvah vnesite bruto ceno, DDV, pravo enoto in omejitve obsega. Ni znane paketne cene: ne predstavljajte cene za kilogram ali uro kot celotnega naročila.
5. Preverite primer osnutka, shranite in objavite. Na javnem kalkulatorju preverite isto občino in podatke.

Objava zamenja trenutno tabelo; ni arhivskega ali samodejno načrtovanega preklopa cenikov. Datum v prihodnosti prepreči izračun pred začetkom veljavnosti. Zgodovina CMS omogoča obnovo podatkov.

Ocena je za en cel mesec gospodinjskega odjema z merjeno porabo. Ne obsega poslovnega odjema, delitve skupnega računa, padavinskih voda, individualnih oprostitev, starih obdobij in posebnih del. Možne subvencije se ne ugibajo: privzeto je polni cenik, uporabnik lahko prepiše dejansko priznano mesečno znižanje iz svojega računa. Izračun jasno navede predpostavko DN 15/20; premer je mogoče prilagoditi, višina vodomera ni vhodni podatek.

Vnos spremeni samo lokalni izračun. Ne posodobi dejanskega obračuna, odjemnega mesta ali evidence KPV. Rezultat vsebuje razčlenitev in ga je mogoče natisniti.
