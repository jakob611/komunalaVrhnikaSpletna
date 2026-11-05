# Trajne oznake vsebine

Razdelki, vključeni neposredno v `CmsLayout`, imajo izrecen trajni ključ. `nativeSection` v `src/content/native-sections.ts` ohrani natančne oznake že objavljenih razporeditev. Imena in njihove stare vzdevke ohranite pri premikanju, vstavljanju ali preimenovanju izvorne kode. Nova vsebina dobi nov trajni ključ. Oznake ne določajte iz trenutnega vrstnega reda otrok.

Stari vodnik storitve je imel različne ključe glede na izbrano storitev. Združljivostni adapter jih združi v en trajni razdelek tako pri prikazu kot v urejevalniku. Ob več starih nastavitvah velja prva po shranjenem vrstnem redu.

`CmsText` in `CmsImage` vsebino izrišeta z Reactom. Njun `id` oziroma `fieldId` je trajen tudi po spremembi privzetega besedila ali slike. Ključ za shranjevanje je izpeljan iz te oznake in ostane združljiv s shemo obstoječih zapisov. `legacy-fields.ts` ohranja izvirna besedila za branje starejših uredniških popravkov. Teh vzdevkov ne posodabljajte ob popravljanju privzetih besedil.

Če je starejši popravek veljal za več enakih besedil, ga vsa ustrezna polja še naprej podedujejo. Prvo nadaljnje urejanje trajnega polja ustvari njegov ločen popravek; drugih ponovitev ne spremeni. Predogled uporablja isti Reactov prikaz in dobi skupni osnutek prek preverjenih sporočil istega izvora.

Prehod je postopen. Statični naslovi, odstavki in glavna fotografija so preneseni v trajna polja. `ContentBridge` ostaja združljivostni adapter za stare zapise, dinamična besedila, preostale oznake ter izbiro elementov v predogledu. Preostali adapter še vedno pregleduje in prepisuje nepremaknjena besedilna vozlišča; njegova popolna odstranitev zahteva prenos preostalih polj in povezav. Obstoječi ključi povezav še vedno uporabljajo cilj in izvirni naziv.

Javni prikaz pred prvo uspešno pridobitvijo objavljenih vsebin pokaže nalaganje oziroma napako z možnostjo ponovitve. Ne nadomesti nedosegljivih podatkov s privzetimi cenami ali kontakti iz gradnje. Po uspešnem branju lahko med napako obdrži zadnjo objavo v pomnilniku trenutnega obiska, ob tem pa jasno označi, da aktualnosti ni mogel preveriti. Prijava v administracijo je dosegljiva tudi med nedosegljivostjo javnih vsebin.
