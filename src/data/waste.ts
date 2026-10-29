/** Content checked against the official KPV sources below, 28 October 2026.
 * Point coordinates except the approximate Tojnice location are illustrative,
 * not an operational register. Replace with the municipality's verified GIS feed.
 */
export const wasteSources = [
  {
    title: "KPV – koristni odpadki",
    url: "https://www.kpv.si/mDejavnosti/rzo/rzoKoristni.html",
  },
  {
    title: "KPV – mešani komunalni odpadki",
    url: "https://kpv.si/mDejavnosti/rzo/rzoMesani.html",
  },
  {
    title: "KPV – embalaža",
    url: "https://www.kpv.si/mDejavnosti/rzo/rzoEmb.html",
  },
  {
    title: "KPV – vprašanja o odpadkih",
    url: "https://www.kpv.si/mVprasanja/mVrzo.html",
  },
  {
    title: "KPV – abecednik odpadkov",
    url: "https://www.kpv.si/mDejavnosti/rzoDatoteke/AbecednikOdpadkov.pdf",
  },
  {
    title: "KPV – nevarni odpadki",
    url: "https://kpv.si/mDejavnosti/rzo/rzoNevarni.html",
  },
  {
    title: "KPV – odpadno jedilno olje",
    url: "https://www.kpv.si/Portals/0/Dokumenti/Dejavnosti/Odvajanje-ciscenje/OdpadnoOlje.pdf",
  },
];

export type WasteCategory =
  | "embalaza"
  | "papir"
  | "steklo"
  | "bio"
  | "mesani"
  | "nevarni"
  | "elektronika"
  | "center"
  | "tekstil";
export const categories: Record<
  WasteCategory,
  { title: string; destination: string; color: string; tip: string }
> = {
  embalaza: {
    title: "Odpadna embalaža",
    destination: "Zabojnik za embalažo",
    color: "#c79813",
    tip: "Embalažo izpraznite in po možnosti stisnite. Plastični predmeti niso isto kot plastična embalaža.",
  },
  papir: {
    title: "Papir in karton",
    destination: "Zabojnik za papir na ekološkem otoku",
    color: "#4683b1",
    tip: "Papir naj bo suh in čist. Kartonske škatle razstavite, da zavzamejo manj prostora.",
  },
  steklo: {
    title: "Steklena embalaža",
    destination: "Zabojnik za steklo na ekološkem otoku",
    color: "#27846e",
    tip: "Oddajte prazno stekleno embalažo brez pokrovčkov. Ogledala, keramika in okensko steklo sem ne sodijo.",
  },
  bio: {
    title: "Biološki odpadki",
    destination: "Zeleni zabojnik za BIO ali domači kompostnik",
    color: "#688c39",
    tip: "Odpadke ločite od embalaže. V domači kompostnik ne odlagajte mesa, kosti, maščob in iztrebkov hišnih živali.",
  },
  mesani: {
    title: "Preostanek odpadkov",
    destination: "Črni zabojnik za mešane odpadke",
    color: "#4f5c62",
    tip: "Sem sodijo preostanki, ki jih ni mogoče oddati v druge ločene frakcije. Nevarni odpadki in elektronika ne sodijo sem.",
  },
  nevarni: {
    title: "Nevarni odpadki",
    destination: "Zbirni center ali posebna zbiralna akcija",
    color: "#b96a45",
    tip: "Hranite ločeno, po možnosti v originalni zaprti embalaži. Ne zlivajte v odtok in ne mešajte različnih snovi.",
  },
  elektronika: {
    title: "Električna in elektronska oprema",
    destination: "Zbirni center ali zbiranje OEEO",
    color: "#7569aa",
    tip: "Naprave oddajte ločeno od mešanih odpadkov. Pred oddajo telefona ali računalnika izbrišite osebne podatke.",
  },
  center: {
    title: "Posebni in kosovni odpadki",
    destination: "Zbirni center Tojnice",
    color: "#8b765c",
    tip: "Pred obiskom preverite pogoje prevzema na uradni strani KPV. Uporabne predmete najprej ponudite v ponovno uporabo.",
  },
  tekstil: {
    title: "Tekstil in obutev",
    destination: "Zbirni center ali zbiralnik za tekstil",
    color: "#a7758a",
    tip: "Še uporabna oblačila in obutev oddajte čista in suha. Za poškodovan tekstil preverite pogoje konkretnega zbiralnika.",
  },
};

export const wasteItems: {
  name: string;
  keywords: string[];
  category: WasteCategory;
  note?: string;
}[] = [
  {
    name: "Plastenka",
    keywords: [
      "plastenke",
      "plastika",
      "pet",
      "voda",
      "sok",
      "plasticna embalaza",
    ],
    category: "embalaza",
  },
  {
    name: "Jogurtov lonček",
    keywords: ["jogurt", "loncek", "skuta"],
    category: "embalaza",
  },
  {
    name: "Tetrapak mleka ali soka",
    keywords: ["tetrapak", "mleko", "sok", "karton od mleka", "papir od mleka"],
    category: "embalaza",
    note: "Sestavljena embalaža pijač sodi med embalažo, čeprav je na videz podobna kartonu.",
  },
  {
    name: "Pločevinka in konzerva",
    keywords: [
      "plocevinka",
      "konzerva",
      "pivo",
      "kovinska embalaza",
      "pokrovcek",
    ],
    category: "embalaza",
  },
  {
    name: "Kartonska škatla",
    keywords: ["karton", "skatla", "lepenka"],
    category: "papir",
  },
  {
    name: "Časopis, revija ali zvezek",
    keywords: ["casopis", "revija", "zvezek", "papir", "knjiga"],
    category: "papir",
  },
  {
    name: "Steklenica in kozarec za vlaganje",
    keywords: ["steklenica", "steklo", "kozarec", "vlaganje"],
    category: "steklo",
  },
  {
    name: "Pitni kozarec ali kristal",
    keywords: [
      "pitni kozarec",
      "kozarec",
      "kozarci",
      "kristal",
      "stekleni predmet",
    ],
    category: "center",
    note: "Pitni kozarci in kristal niso steklena embalaža. Oddajte jih ločeno v zbirnem centru; v zabojnik za steklo sodijo steklenice in kozarci za vlaganje.",
  },
  {
    name: "Olupki sadja in zelenjave",
    keywords: [
      "banana",
      "bananin olupek",
      "olupek",
      "jabolko",
      "sadje",
      "zelenjava",
      "bio",
    ],
    category: "bio",
  },
  {
    name: "Kavna usedlina in jajčne lupine",
    keywords: ["kava", "kavna usedlina", "jajce", "jajcna lupina", "caj"],
    category: "bio",
  },
  {
    name: "Listje in pokošena trava",
    keywords: ["listje", "trava", "vrt", "plevel"],
    category: "bio",
  },
  {
    name: "Plenice in higienski izdelki",
    keywords: ["plenica", "plenice", "vata", "higiena", "vlozek"],
    category: "mesani",
  },
  {
    name: "Vrečka iz sesalnika",
    keywords: ["sesalnik", "prah", "pometanje"],
    category: "mesani",
  },
  {
    name: "Peki papir",
    keywords: ["peki papir", "pecilni papir", "povoscen papir"],
    category: "mesani",
  },
  {
    name: "Z živili umazan papir ali karton",
    keywords: [
      "umazan papir",
      "umazan karton",
      "mastna skatla",
      "mastna embalaza",
      "skatla od pice",
    ],
    category: "mesani",
    note: "Z živili prepojen papir ni primeren za zbiralnik čistega papirja. Morebitni čisti, suhi del škatle lahko ločite in oddate med papir.",
  },
  {
    name: "Cigaretni ogorki",
    keywords: ["cigareta", "ogorek", "zvecilni gumi"],
    category: "mesani",
  },
  {
    name: "Baterije in akumulatorji",
    keywords: ["baterija", "baterije", "akumulator", "litij"],
    category: "nevarni",
    note: "Prenosne baterije lahko oddate tudi v namenske zbiralnike pri prodajalcih.",
  },
  {
    name: "Ostanki barv, lakov in topil",
    keywords: ["barva", "lak", "topilo", "kemikalija", "razredcilo"],
    category: "nevarni",
  },
  {
    name: "Odpadno motorno olje",
    keywords: ["motorno olje", "olje", "mazivo"],
    category: "nevarni",
    note: "Motorna olja hranite v zaprti posodi in oddajte kot nevarni odpadek v zbirnem centru. Ne mešajte jih z jedilnim oljem.",
  },
  {
    name: "Odpadno jedilno olje",
    keywords: ["jedilno olje", "olje", "olje za cvrtje", "friteza"],
    category: "nevarni",
    note: "Ohlajeno olje zberite v zaprti posodi in oddajte ločeno v zbirnem centru ali ob akciji nevarnih odpadkov. Ne zlivajte ga v odtok ali med biološke odpadke.",
  },
  {
    name: "Odpadna zdravila",
    keywords: ["zdravilo", "tableta", "sirup", "lekarna"],
    category: "nevarni",
    note: "Odpadna zdravila lahko oddate tudi v lekarni. O ravnanju z iglami se posvetujte z zbiralcem.",
  },
  {
    name: "Telefon, polnilec ali računalnik",
    keywords: [
      "telefon",
      "polnilec",
      "racunalnik",
      "kabel",
      "elektronika",
      "tablica",
    ],
    category: "elektronika",
  },
  {
    name: "Hladilnik ali pralni stroj",
    keywords: ["hladilnik", "pralni stroj", "stedilnik", "televizor", "aparat"],
    category: "elektronika",
  },
  {
    name: "Varčna ali LED sijalka",
    keywords: ["zarnica", "led", "sijalka", "neonska luc"],
    category: "elektronika",
    note: "Sijalk ne odlagajte v stekleno embalažo. Oddajte jih ločeno in preprečite razbitje.",
  },
  {
    name: "Ogledalo, keramika ali okensko steklo",
    keywords: ["ogledalo", "keramika", "kroznik", "porcelan", "okensko steklo"],
    category: "center",
  },
  {
    name: "Pohištvo in vzmetnica",
    keywords: [
      "kavc",
      "omara",
      "miza",
      "stol",
      "vzmetnica",
      "pohistvo",
      "kosovni",
    ],
    category: "center",
    note: "Za večje predmete lahko oddate povpraševanje za kosovni odvoz.",
  },
  {
    name: "Plastična igrača ali vedro",
    keywords: ["igraca", "vedro", "plasticni predmet", "trda plastika"],
    category: "center",
    note: "Predmet iz plastike še ni embalaža. O ustrezni oddaji konkretnega materiala vprašajte osebje zbirnega centra.",
  },
  {
    name: "Oblačila in čevlji",
    keywords: ["oblacila", "tekstil", "majica", "cevlji", "obutev", "hlace"],
    category: "tekstil",
  },
];

export type CollectionPoint = {
  id: number;
  name: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  center?: boolean;
};
export const collectionPoints: CollectionPoint[] = [
  {
    id: 1,
    name: "Zbirni center Tojnice",
    area: "Vrhnika",
    address: "Pot na Tojnice 40, Vrhnika",
    lat: 45.9711,
    lng: 14.3129,
    types: [
      "center",
      "papir",
      "steklo",
      "embalaza",
      "baterije",
      "elektronika",
      "tekstil",
    ],
    center: true,
  },
  {
    id: 2,
    name: "Primer ekološkega otoka · center",
    area: "Vrhnika",
    address: "Prikazna točka pri središču Vrhnike",
    lat: 45.9638,
    lng: 14.2936,
    types: ["papir", "steklo", "embalaza"],
  },
  {
    id: 3,
    name: "Primer zbiralnice · Verd",
    area: "Verd",
    address: "Prikazna točka v Verdu",
    lat: 45.9566,
    lng: 14.306,
    types: ["papir", "steklo", "embalaza", "tekstil"],
  },
  {
    id: 4,
    name: "Primer zbiralnice · Borovnica",
    area: "Borovnica",
    address: "Prikazna točka v Borovnici",
    lat: 45.9194,
    lng: 14.3632,
    types: ["papir", "steklo", "embalaza", "elektronika"],
  },
  {
    id: 5,
    name: "Primer zbiralnice · Log - Dragomer",
    area: "Log - Dragomer",
    address: "Prikazna točka v Logu - Dragomerju",
    lat: 46.0086,
    lng: 14.3831,
    types: ["papir", "steklo", "embalaza", "baterije"],
  },
  {
    id: 6,
    name: "Primer zbiralnice · Sinja Gorica",
    area: "Sinja Gorica",
    address: "Prikazna točka v Sinji Gorici",
    lat: 45.977,
    lng: 14.3186,
    types: ["papir", "steklo", "embalaza", "tekstil"],
  },
  {
    id: 7,
    name: "Primer javnega koša · park",
    area: "Vrhnika",
    address: "Prikazni koš za drobne odpadke s sprehoda",
    lat: 45.9609,
    lng: 14.2972,
    types: ["public"],
  },
  {
    id: 8,
    name: "Primer javnega koša · sprehajališče",
    area: "Vrhnika",
    address: "Prikazna točka ob sprehajališču",
    lat: 45.9665,
    lng: 14.2991,
    types: ["public"],
  },
];
export const pointTypes = [
  { id: "all", label: "Vse lokacije" },
  { id: "center", label: "Zbirni centri" },
  { id: "public", label: "Javni koši" },
  { id: "papir", label: "Papir" },
  { id: "steklo", label: "Steklo" },
  { id: "embalaza", label: "Embalaža" },
  { id: "baterije", label: "Baterije" },
  { id: "elektronika", label: "Elektronika" },
  { id: "tekstil", label: "Tekstil" },
];

export const normalizeWaste = (value: string) =>
  value
    .toLocaleLowerCase("sl-SI")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Match meaningful words without inferring an unsafe category from one word in
 * an otherwise unrecognized phrase (e.g. "barva v plastenki"). */
export function findWasteItems(
  query: string,
  category: WasteCategory | "all" = "all",
  items: typeof wasteItems = wasteItems,
) {
  const normalized = normalizeWaste(query)
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ");
  const ignored = new Set([
    "kam",
    "naj",
    "dam",
    "gre",
    "sodi",
    "sodijo",
    "odlozim",
    "odloziti",
    "odvrzem",
    "odpadek",
    "odpadki",
    "z",
    "s",
    "je",
    "to",
    "za",
    "od",
    "v",
    "in",
  ]);
  const tokens = normalized
    .split(" ")
    .filter((token) => token && !ignored.has(token));
  return items
    .map((item) => {
      const title = normalizeWaste(item.name);
      const keywords = item.keywords.map(normalizeWaste);
      const corpus = `${title} ${keywords.join(" ")}`;
      const score = !normalized
        ? 1
        : title === normalized
          ? 5
          : keywords.includes(normalized)
            ? 4
            : title.includes(normalized)
              ? 3
              : keywords.some((k) => k.includes(normalized))
                ? 2
                : tokens.length > 0 &&
                    tokens.every((token) => corpus.includes(token))
                  ? 1
                  : 0;
      return { ...item, score };
    })
    .filter(
      (item) =>
        item.score > 0 && (category === "all" || item.category === category),
    )
    .sort((a, b) => b.score - a.score);
}
