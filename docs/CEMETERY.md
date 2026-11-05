# Pokopališče: evidenca in orientacijski načrt

Ureja se v `/admin` → **Pokopališče**. Javno je na `/pokopalisce`. Začetna evidenca je prazna: portal ne ustvarja izmišljenih oseb, sektorjev ali položajev grobov. Brez objavljene evidence obiskovalca usmeri k upravljavcu.

## Prvi vnos

1. V **1. Sektor** vnesite oznako iz evidence in izberite **Dodaj sektor**.
2. V **2. Vrsta** izberite številko in **Dodaj vrsto**. Prazni sektorji in vrste se ohranijo tudi po shranjevanju.
3. V **3. Grobovi** vnesite začetno številko in število mest (največ 100 naenkrat), nato **Dodaj grobna mesta**. Obstoječih mest ne prepišemo. Nova mesta še nimajo oseb ali potrjenega položaja.
4. Izberite grob in **Dodaj osebo v ta grob**. Isti grob lahko vsebuje do 10 oseb; za nov pokop v obstoječem grobu ne ustvarjajte novega grobnega mesta. Neznane datume pustite prazne. Datum smrti ne sme biti pred rojstvom ali v prihodnosti.
5. Za osnovo načrta izberite **Uporabi orientacijski osnutek** ali naložite svoj načrt. Priloženi osnutek je izvirna vektorska skica poti in površin na podlagi uporabnikove slikovne reference. Ni geodetski načrt in ne vsebuje uradnih sektorjev ali grobov. Uporabi se samo po izrecni izbiri urednika.
6. Pri izbranem grobu izberite **Postavi grob na načrt** in kliknite njegovo sredino. **Razporedi izbrano vrsto** omogoča dva klika: prvi grob z najnižjo številko in zadnji grob. Vmesna mesta se enakomerno razporedijo; vsakega preverite in po potrebi popravite posamično. Povečava in drsnika omogočajo natančen položaj.
7. Preverite podatke in položaje ter na vrhu kliknite **Shrani in objavi**. Na javni strani preverite iskanje osebe, oznako in položaj.

## Vsakodnevno urejanje

- Iskanje v administraciji išče po vseh sektorjih. Izberite obstoječi grob, dodajte osebo oziroma popravite podatke in objavite.
- Za preimenovanje sektorja vpišite novo oznako v polje novega sektorja in izberite **Preimenuj izbrani sektor z vpisano oznako**. Povezane grobove ohranimo.
- Prazno vrsto oziroma sektor lahko odstranite. Grob z osebami odstranite šele po preverjanju opozorila. Spremembe se uveljavijo ob objavi; zgodovina področja omogoča obnovo.
- **Umakni položaj z načrta** ohrani evidenco in osebe, vendar odstrani nepotrjeno točko iz javnega načrta. Iskalnik jasno pove, da položaj ni potrjen.
- Prazno mesto ne pomeni, da je na voljo za najem. Portal ne upravlja najemnih pogodb, kontaktov najemnikov ali razpoložljivosti.
- Menjava slike oziroma mer ne poravna obstoječih položajev samodejno. Pred objavo preverite vse položaje glede na ozadje.

## Javni iskalnik

Obiskovalec išče po imenu, priimku, letu ali oznaki. Šumniki in vrstni red besed niso pomembni. Vsaka oseba v skupnem grobu je iskalna. Filter sektorja zoži rezultate. Klik na grob ali rezultat odpre podatke vseh oseb; osebno povezavo do groba je mogoče kopirati.

Načrt omogoča povečavo, premik in izbiro s tipkovnico. Pri večji povečavi pokaže imena na grobovih; celotna imena so v podatkih izbranega groba. Prikaže samo potrjene položaje, iskalnik pa lahko vsebuje tudi osebe, katerih položaj še ni potrjen.

## Podatki in meje

Objavljajte samo potrjene podatke, namenjene javni evidenci. Fotografija sama ne razkrije identitete, uradnih oznak ali dovoljenja za objavo. Ne uvažajte kontaktov najemnikov. Podprtih je do 5000 grobov in največ 1 MiB vsebine celotnega področja; večjo evidenco je treba razdeliti oziroma prilagoditi shrambo. Datumi so neobvezni, kadar niso znani.

Podatki imajo strukturo `plan`, `graves` in neobvezno `sectors`. Starejši zapisi brez `sectors` ostanejo združljivi; sektorji in vrste se razberejo iz njih. Nov grob dobi `positioned: false`, dokler urednik ne potrdi položaja. Starejši zapisi brez tega polja obdržijo obstoječi položaj. Skupna validacija prepreči podvojene oznake in mesta ter napačne datume in sektorje.
