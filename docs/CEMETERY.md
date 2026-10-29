# Predstavitveni iskalnik grobov

Stran `/pokopalisce` je predogled prihodnje funkcije. Vseh 96 grobov, 120 oseb, datumi, oznake, orientacija in pot od vhoda so izmišljeni. Ne uporabljajte je za navigacijo do resničnega groba. Uradna stran [KPV](https://www.kpv.si/mDejavnosti/pok/pokOstalo.html) potrjuje upravljanje centralnega pokopališča Vrhnika; druga pokopališča imajo druge upravljavce.

## Delujoče funkcije

- Iskanje po imenu in priimku, letnici ali oznaki groba. Šumniki in vrstni red besed niso pomembni; iskanje pregleda vsako osebo v skupnem grobu.
- Filter oddelka, vsi zadetki na načrtu in seznam z možnostjo prikaza dodatnih rezultatov.
- Izbira vsakega groba z miško ali tipkovnico (Tab, puščice, Enter/Space), podatki o osebah in datumih.
- Povečava, premik povečanega načrta in ponastavitev. Navpično drsenje strani je na telefonu ohranjeno, dokler uporabnik načrta ne poveča.
- URL `?grob=A-01-01`, po potrebi tudi `iskanje` in `oddelek`, ter kopiranje povezave. Če odložišče ni na voljo, je povezavo mogoče označiti in kopirati ročno.
- Umirjene animacije; sistemska nastavitev zmanjšanega gibanja se upošteva.

## Prehod na pravi posnetek

Podatke, mere in sliko lahko urejate v `/admin` → **Pokopališče**, večji uvoz pa pripravite v naprednem urejevalniku JSON. Začetni podatki so v `shared/site-defaults.json`, tipi in iskanje v `src/data/cemetery.ts`, prikaz pa v `src/pages/CemeteryPage.tsx`. Trenutni koordinatni prostor meri 1000 × 760 enot.

1. Pridobite ustrezen posnetek iz zraka s pravico objave in brez motečih prepoznavnih obiskovalcev. Shranite ga kot lokalni optimizirani JPG/WebP v `public/images/` ali na namensko javno shrambo. Zasebni bucket fotografij prijav naj ostane zaseben.
2. Posnetek poravnajte z istim koordinatnim prostorom ali v skrbniški konzoli posodobite mere načrta. Naložite ga v **Datoteke** in njegov javni naslov vnesite v polje slike načrta; SVG bo uporabil sliko za ozadje.
3. Iz uradne evidence uvozite samo potrjene javne podatke: oznako groba, oddelek, vrsto, imena ter dovoljene datume. Ne uvažajte kontaktov najemnikov. Imena in datumi niso izpeljani iz fotografije.
4. Premerite položaje oziroma poligone grobov glede na posnetek. Trenutne pravokotnike nadomestite z dejanskimi označenimi ploskvami, posodobite vhod, orientacijo in poti. Samo menjava ozadja še ne pomeni pravilne geografske poravnave.
5. S KPV preverite vsak položaj, dostopnost poti, način popravkov in redno posodabljanje. Šele nato odstranite oznake izmišljenih podatkov.

Za trenutni predogled ni potreben nov račun, plačljiv zemljevid ali nova strežniška storitev. Začetna evidenca je izmišljena; skrbniške objave se shranjujejo v D1 in so javno vidne na portalu. Objavite samo podatke, za katere imate dovoljenje.
