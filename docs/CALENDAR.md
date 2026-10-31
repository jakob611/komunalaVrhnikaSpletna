# Odvozi v osebnem koledarju

Na `/odpadki/urnik` vnesite celoten naslov in kliknite **Prikaži urnik**. Pri želenem odvozu kliknite **Dodaj v koledar**.

1. **Samo ta datum** shrani en celodnevni dogodek.
2. **Ponavljajoči se odvozi te vrste** shrani izbrani in vse poznejše objavljene odvoze iste vrste odpadkov. Pred prenosom lahko odprete seznam vseh datumov. Ponavljanje se konča z zadnjim objavljenim datumom; praznični premiki in izpusti ostanejo upoštevani. Če je objavljen samo en datum, druga možnost ni na voljo.
3. Za posamezni datum izberite **Google Koledar** in tam potrdite shranjevanje. Za Apple ali Outlook prenesite datoteko `.ics` in potrdite uvoz v svojem koledarju.
4. Ponavljanje se za vse koledarje prenese kot `.ics`. Google podpira uvoz na računalniku: **Nastavitve → Uvoz in izvoz → Izberite datoteko iz računalnika → Uvozi**. Navodila so tudi v pogovornem oknu. Mobilna aplikacija Google tega uvoza ne podpira.

Gumb **Vsi prikazani termini (.ics)** nad seznamom prenese vse prikazane datume vseh vrst odpadkov kot posamezne dogodke.

Uvoz ustvari kopijo. Spremembe na portalu se vanjo ne prenesejo samodejno. Ob spremembi urnika odstranite oziroma popravite stare dogodke in uvozite nove. Čas opomnika izberete v svoji koledarski aplikaciji.

## Za urednika

**Administracija → Urniki odvoza → izbrano območje → Termini odvozov**: uredite datum v seznamu, dodajte posamezni odvoz ali pripravite ponavljanje z začetkom, koncem, dnevom in intervalom. Generirane termine morate dodati v osnutek z gumbom **Dodaj predogledane termine v osnutek**. Praznične izjeme nato popravite v seznamu; nepotrjenih datumov ne objavljajte. Pod **Preveri naslov** preverite vsako vrsto odpadkov in kliknite **Shrani in objavi**.

Novi prenosi koledarja vedno berejo zadnje objavljene datume. Že prenesene kopije ostanejo pri prejemniku. Območja odvozov in območja e-obveščanja so ločena sistema.

## Oblika in preverjanje

Ponavljanje je omejeno z `UNTIL`, uporablja dneve dejanskih odvozov (`BYDAY`) ter z `EXDATE` izključi vse druge pojavitve. Tako koledar ohrani točen seznam objavljenih datumov, tudi če se interval med poletnim in zimskim urnikom spremeni. Izvoz ne dodaja predvidenih prihodnjih odvozov. Stare povezave za tedensko ponavljanje se zavrnejo, če vsebujejo katerikoli nepotrjen datum.

Vira: [iCalendar, RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html), [uradna navodila za uvoz v Google Koledar](https://support.google.com/calendar/answer/37118?hl=sl).
