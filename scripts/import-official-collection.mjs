// Reviewed transcription of KPV's published 2026 schedules, checked 30 October 2026.
// This script is deterministic: it does not extrapolate annual schedules into 2027.
// Source documents and limitations are retained beside the CMS-compatible routes.
import { writeFileSync } from "node:fs";
import { generateCollectionEvents, normalizedAddress } from "../shared/collection-utils.js";

const base = "https://www.kpv.si/mDejavnosti/rzoDatoteke/Urniki/";
const sources = {
  packagingVrhnika: `${base}EMB_urnik_VRH_2o26.jpg`,
  packagingBorovnica: `${base}EMB_urnik_BOR_2o26.jpg`,
  packagingLog: `${base}EMB_urnik_LoD_2o26.jpg`,
  residualVrhnika: `${base}2026_URNIK_VRHNIKA.pdf`,
  residualBorovnica: `${base}2026_URNIK_BOROVNICAx.pdf`,
  residualLog: `${base}2026_URNIK_LOG_DRAGOMERa.pdf`,
  bio: "https://www.kpv.si/mDejavnosti/rzo/rzoUrnik.html",
  localityNames: "https://log-dragomer.si/act/67192",
};
const routes = [];
const sourceByRoute = {};
function add(id, name, addresses, type, dates, source) {
  routes.push({
    id, name, addresses,
    events: dates.map((date) => ({ id: `${type}-${date}`, date, type,
      label: {packaging:"Mešana embalaža",residual:"Mešani komunalni odpadki",bio:"Biološki odpadki"}[type] })),
  });
  sourceByRoute[id] = sources[source];
}
const fortnight = (start) => generateCollectionEvents({type:"packaging",start,end:"2026-12-31",weekday:new Date(`${start}T12:00:00Z`).getUTCDay(),interval:2}).map((event) => event.date);
const monthDates = (value) => value.split(" ").map((date) => date.length === 5 ? `2026-${date}` : date);
const qualify = (streets, town) => streets.map((street) => `${street}, ${town}`);

add("official-emb-vrh-e1", "Embalaža · E1e · Podlipa, Stara Vrhnika, del Rovt in Lavrovca", ["Podlipa","Rovte","Smrečje","Stara Vrhnika","Trčkov Grič"], "packaging", fortnight("2026-10-05"), "packagingVrhnika");
add("official-emb-vrh-k2", "Embalaža · K2e · Padež, Pokojišče, Zavrh", ["Padež","Pokojišče","Zavrh"], "packaging", fortnight("2026-10-06"), "packagingVrhnika");
const janezova = ["Brigadirska cesta","Cankarjevo nabrežje","Cesta krimskega odreda","Cesta na barju","Cesta na polju","Čolnarska cesta","Janezova cesta","Jagrova cesta","Kačurjeva cesta","Kotnikova cesta","Pionirska cesta","Stara stranska cesta","Sternenova cesta"];
add("official-emb-vrh-i3", "Embalaža · I3e · Bistra, Janezova vas, Verd", ["Bistra","Janezova vas",...qualify(janezova,"Vrhnika"),"Verd"], "packaging", fortnight("2026-10-07"), "packagingVrhnika");
add("official-emb-vrh-h4", "Embalaža · H4e · Bevke, Blatna Brezovica, Ligojna", ["Bevke","Blatna Brezovica","Mala Ligojna","Velika Ligojna"], "packaging", fortnight("2026-10-08"), "packagingVrhnika");
const embA = ["Betajnova","Gabrče","Grilčev grič","Hrastje","Mirke","Močilnik","Notranjska cesta","Pavkarjeva pot","Raskovec","Storžev grič","Švabičeva ulica","Turnovše"];
const trzaska = ["34","34a","37","38","38a","40","42","44","46","48","50","52","52a","53","55"].map((n)=>`Tržaška cesta ${n}, Vrhnika`);
add("official-emb-vrh-a6", "Embalaža · A6e · Vrhnika – navedene ulice in hišne številke", [...qualify(embA,"Vrhnika"),...trzaska], "packaging", fortnight("2026-10-12"), "packagingVrhnika");
add("official-emb-vrh-c8", "Embalaža · C8e · Zaplana, Rovte in okoliški kraji", ["Jamnik","Jerinov Grič","Marinčev Grič","Mizni Dol","Ograje","Prezid","Rovte","Strmica","Zaplana"], "packaging", fortnight("2026-10-14"), "packagingVrhnika");
// Rovte is divided between E1e and C8e in the source; equal rules intentionally
// stay ambiguous until a KPV editor supplies the household-level boundaries.
add("official-emb-vrh-f9", "Embalaža · F9e · Drenov Grič, Lesno Brdo, Sinja Gorica", ["Drenov Grič","Lesno Brdo","Sinja Gorica"], "packaging", fortnight("2026-10-01"), "packagingVrhnika");
const borK = ["Cesta pod goro","Demšarjeva ulica","Ljubljanska cesta","Obrtniška ulica","Ulica bratov Debevec"];
const borB = ["Cerkova ulica","Cesta na grič","Gradišnikova ulica","Mejačeva ulica","Miklavičeva cesta","Mikuževa ulica","Molkov trg","Paplerjeva ulica","Pot na Malence","Pot v Jele","Ramovševa ulica","Rimska cesta","Struge","Švigljeva ulica","Ulica bratov Mivšek","Zalarjeva cesta"];
add("official-emb-bor-k2", "Embalaža · K2e · Borovnica – območje K", [...qualify(borK,"Borovnica"),"Brezovica pri Borovnici","Breg, Borovnica","Dražica","Lašče","Niževec","Ohonica","Pako","Pristava, Borovnica","Zabočevo"], "packaging", fortnight("2026-10-06"), "packagingBorovnica");
add("official-emb-bor-b7", "Embalaža · B7e · Borovnica – območje B, Dol, Laze", [...qualify(borB.filter((street)=>street!=="Gradišnikova ulica"),"Borovnica"),"Dol, Borovnica","Laze, Borovnica"], "packaging", fortnight("2026-10-13"), "packagingBorovnica");
add("official-emb-log-g5", "Embalaža · G5e · Log", ["Log","Log pri Brezovici","Jordanov kot","Barjanska"], "packaging", fortnight("2026-10-09"), "packagingLog");
add("official-emb-log-j10", "Embalaža · J10e · Dragomer in Lukovica", ["Dragomer","Lukovica"], "packaging", fortnight("2026-10-02").map((date)=>date==="2026-12-25"?"2026-12-26":date), "packagingLog");

const residualDates = {
  A:"01-26 02-23 03-23 04-20 05-18 06-15 07-13 08-10 09-07 10-05 11-02 11-30 12-28 2027-01-25",
  C:"01-12 02-09 03-09 04-07 05-04 06-01 06-29 07-27 08-24 09-21 10-19 11-16 12-14 2027-01-11",
  D:"01-19 02-16 03-16 04-13 05-11 06-08 07-06 08-03 08-31 09-28 10-26 11-23 12-21 2027-01-18",
  E:"01-27 02-24 03-24 04-21 05-19 06-16 07-14 08-11 09-08 10-06 11-03 12-01 12-29 2027-01-26",
  F:"01-06 02-03 03-03 03-31 04-28 05-26 06-23 07-21 08-18 09-15 10-13 11-10 12-08 2027-01-05",
  H:"01-20 02-17 03-17 04-14 05-12 06-09 07-07 08-04 09-01 09-29 10-27 11-24 12-22 2027-01-19",
  I:"01-02 01-29 02-26 03-26 04-23 05-21 06-18 07-16 08-13 09-10 10-08 11-05 12-03 12-31 2027-01-28",
  L:"01-28 02-25 03-25 04-22 05-20 06-17 07-15 08-12 09-09 10-07 11-04 12-02 12-30 2027-01-27",
  M:"01-14 02-11 03-11 04-09 05-06 06-03 07-01 07-29 08-26 09-23 10-21 11-18 12-16 2027-01-13",
  N:"01-22 02-19 03-19 04-16 05-14 06-11 07-09 08-06 09-03 10-01 10-29 11-26 12-24 2027-01-21",
  B:"01-05 02-02 03-02 03-30 04-27 05-25 06-22 07-20 08-17 09-14 10-12 11-09 12-07 2027-01-04",
  K:"01-15 02-12 03-12 04-10 05-07 06-04 07-02 07-30 08-27 09-24 10-22 11-19 12-17 2027-01-14",
  G:"01-13 02-10 03-10 04-08 05-05 06-02 06-30 07-28 08-25 09-22 10-20 11-17 12-15 2027-01-12",
  J:"01-08 02-05 03-05 04-02 04-30 05-28 06-26 07-23 08-20 09-17 10-15 11-12 12-10 2027-01-07",
};
const mkoA = ["Idrijska","Betajnova","Notranjska","Gabrče","Grilčev grič","Švabičeva","Turnovše","Raskovec","Pavkarjeva pot","Hrastje","Močilnik","Kolesarska","Med vrtovi","Pot k studencu","Prisojna pot","Ob potoku","Ob beli","Mokrice","Rožna","Kuclerjeva","Vrtnarija","Pod Hruševco","Zlatica","Kolodvorska","Možinova","Sivkina","Ob progi"];
const mkoC = ["Dobovičnikova","Dolge njive","Pri lipi","Pot na Košace","Na klancu","Pot k Trojici","Čuža","Petkovškova","Vas","Tičnica","Stara cesta","Cankarjev trg"];
const mkoD = ["Mirke","Lošca","Prečna pot","Pot v Močilnik","Usnjarska","Markova","Sušnikova","Kopališka","Ob Ljubljanici","Ribiška pot","Ob igrišču","Voljčeva","Na Klisu","Hrib","Kurirska","Cesta 6. maja","Na Zelenci","Krožna","Poštna","Krpanova","Cesta gradenj","Opekarska","Gradišče"];
for (const [code, name, addresses] of [
  ["A","Vrhnika – območje A",qualify(mkoA,"Vrhnika")],
  ["C","Vrhnika – klanci in Zaplana",[...qualify(mkoC,"Vrhnika"),"Zaplana"]],
  ["D","Vrhnika – območje D",qualify(mkoD,"Vrhnika")],
  ["E","Janezova vas, Stara Vrhnika, Podlipa, Krošljev Grič",["Janezova vas",...qualify(janezova,"Vrhnika"),"Stara Vrhnika","Podlipa","Krošljev Grič"]],
  ["F","Sinja Gorica, Drenov Grič, Lesno Brdo",["Sinja Gorica","Drenov Grič","Lesno Brdo"]],
  ["H","Bevke, Blatna Brezovica, Ligojna in del Vrhnike",["Bevke","Blatna Brezovica","Mala Ligojna","Velika Ligojna",...qualify(["Delavsko naselje","Partizanski tabor"],"Vrhnika")]],
  ["I","Verd in Bistra",["Verd","Bistra"]],
  ["L","Malo vozilo – Stara Vrhnika, Ligojna, Bevke in okolica",["Stara Vrhnika","Trojica","Tankovska","Star maln","Mala Ligojna","Velika Ligojna","Mirke, Vrhnika","Bevke","Blatna Brezovica"]],
  ["M","Malo vozilo – Pokojišče, Drenov Grič, Lesno Brdo",["Pokojišče","Drenov Grič","Lesno Brdo"]],
  ["N","Malo vozilo – Podlipa in Smrečje",["Podlipa","Smrečje"]],
]) add(`official-mko-vrh-${code.toLowerCase()}`,`MKO · ${code} · ${name}`,addresses,"residual",monthDates(residualDates[code]),"residualVrhnika");
add("official-mko-bor-b","MKO · B · Borovnica – območje B, Laze in Dol",[...qualify(borB.filter((street)=>street!=="Cerkova ulica"),"Borovnica"),"Laze, Borovnica","Dol, Borovnica"],"residual",monthDates(residualDates.B),"residualBorovnica");
add("official-mko-bor-k","MKO · K · Borovnica – območje K in okoliška naselja",[...qualify(borK,"Borovnica"),"Ohonica","Dražica","Brezovica pri Borovnici","Niževec","Zabočevo","Pako","Breg, Borovnica"],"residual",monthDates(residualDates.K),"residualBorovnica");
add("official-mko-bor-m","MKO · M · Malo vozilo – Borovnica in okoliška naselja",["Cerkova ulica, Borovnica","Pot v Jele, Borovnica","Brezovica pri Borovnici","Zabočevo","Breg, Borovnica","Pako","Dol, Borovnica"],"residual",monthDates(residualDates.M),"residualBorovnica");
add("official-mko-log-g","MKO · G · Log, Jordanov kot, Barjanska",["Log","Log pri Brezovici","Jordanov kot","Barjanska"],"residual",monthDates(residualDates.G),"residualLog");
add("official-mko-log-j","MKO · J · Dragomer, Lukovica, Pot na mah, Pot na Plešivico",["Dragomer","Lukovica","Pot na mah","Pot na Plešivico"],"residual",monthDates(residualDates.J),"residualLog");
add("official-mko-log-m","MKO · M · Malo vozilo – del Loga in Dragomer",["Cesta na breg","Pot na Ferjanko","Jordanov kot","Dragomer"],"residual",monthDates(residualDates.M),"residualLog");

const bio = [
  ["a",1,"Ponedeljek",["Janezova vas",...qualify(janezova,"Vrhnika"),"Log","Log pri Brezovici","Jordanov kot","Pod Hruševco","Mokrice","Stara Vrhnika","Sinja Gorica","Ligojna","Mala Ligojna","Velika Ligojna"]],
  ["b",2,"Torek",["Verd","Bistra","Podlipa"]],
  ["c",3,"Sreda",["Borovnica","Laze, Borovnica","Dol, Borovnica","Ohonica","Dražica","Brezovica pri Borovnici","Niževec","Zabočevo","Pako","Breg, Borovnica"]],
  ["d",4,"Četrtek",["Dragomer","Lukovica","Robova","Partizanski tabor","Delavsko naselje"]],
  ["e",5,"Petek",["Bevke","Blatna Brezovica","Drenov Grič","Lesno Brdo"]],
];
for (const [code,weekday,label,addresses] of bio) {
  const dates = generateCollectionEvents({type:"bio",start:"2026-10-01",end:"2026-12-13",weekday,interval:1}).map((event)=>event.date);
  // Winter collection weeks are explicitly published. The source does not name
  // the Friday Christmas replacement date; omit that unverified date.
  for (const monday of ["2026-12-21","2027-01-04","2027-01-18","2027-02-01","2027-02-15"]) {
    const date = new Date(`${monday}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+weekday-1);
    const value = date.toISOString().slice(0,10);if(value!=="2026-12-25") dates.push(value);
  }
  add(`official-bio-${code}`,`BIO · ${code} · ${label}`,addresses,"bio",dates,"bio");
}

// Street names are not globally unique. Require their locality/municipality,
// rather than accepting e.g. Barjanska cesta in Ljubljana as a KPV address.
const streetScopes = new Map([
  ...["Janezova vas","Krošljev Grič","Trojica","Tankovska","Star maln","Robova","Mokrice","Pod Hruševco","Partizanski tabor","Delavsko naselje"].map((name)=>[normalizedAddress(name),["Vrhnika"]]),
  ...["Jordanov kot","Barjanska","Cesta na breg","Pot na Ferjanko"].map((name)=>[normalizedAddress(name),["Log","Log pri Brezovici","Log - Dragomer"]]),
  ...["Pot na mah","Pot na Plešivico"].map((name)=>[normalizedAddress(name),["Log","Log pri Brezovici","Dragomer","Lukovica","Log - Dragomer"]]),
]);
for (const route of routes) {
  route.addresses = [...new Set(route.addresses.flatMap((rule)=>{
    if (rule.includes(",")) return [rule];
    const scopes = streetScopes.get(normalizedAddress(rule));
    if (scopes) return scopes.map((scope)=>`${rule}, ${scope}`);
    const municipality = route.id.includes("-bor-") || route.id === "official-bio-c" ? "Borovnica"
      : route.id.includes("-log-") || ["Log","Log pri Brezovici","Dragomer","Lukovica"].includes(rule) ? "Log - Dragomer" : "Vrhnika";
    if (rule === "Lukovica") return [rule,`${rule}, ${municipality}`,"Lukovica pri Brezovici",`Lukovica pri Brezovici, ${municipality}`];
    return normalizedAddress(rule) === normalizedAddress(municipality) ? [rule] : [rule, `${rule}, ${municipality}`];
  }))];
}

writeFileSync(new URL("../shared/official-collection-2026.json",import.meta.url),JSON.stringify({
  verifiedAt:"2026-10-30",sources,sourceByRoute,
  notes:[
    "Odvozna območja se razlikujejo glede na vrsto odpadkov; urnik se sestavi za vsako vrsto posebej.",
    "Kadar vir isti kraj navaja za običajno in malo vozilo brez hišnih številk, ostane izbira dvoumna. Portal teh datumov ne dodeli samodejno.",
    "Del Lavrovca je v območju E1e; brez podrobnejše razmejitve naslovov je treba območje potrditi pri KPV. Rovte so razdeljene med E1e in C8e.",
    "Vrhnika ima ponedeljkov in torkov BIO odvoz. Za naslov brez dovolj natančnega pravila portal ne ugiba.",
    "BIO: med 14. in 18. decembrom 2026 ni odvoza. Zimski odvozi so v objavljenih tednih od 21. decembra; petkova praznična izjema 25. decembra ni dovolj natančno navedena in ni uvožena.",
    "Embalaža je potrjena samo do 31. decembra 2026; MKO vključuje le januarske datume 2027, ki so izrecno v virih. Portal ne podaljšuje potrjenih terminov.",
    "Gradišnikova ulica: vir embalaže navaja le lihe hišne številke; brez potrditve številk se embalaža za to ulico ne dodeli samodejno. Nekatere izvorne ulice MKO so podane skrajšano, zato so ohranjeni izvorni koreni imen.",
    "Kratka ulična pravila so omejena na ustrezni kraj ali občino. Imena znotraj sestavljenega imena občine ne določajo naselja: Log ni samodejno Dragomer. Kadar je občina vpisana, mora ustrezati objavljenemu območju.",
  ],routes},null,2)+"\n");
console.log(`Prepared ${routes.length} official routes with ${routes.reduce((sum,route)=>sum+route.events.length,0)} dates.`);
