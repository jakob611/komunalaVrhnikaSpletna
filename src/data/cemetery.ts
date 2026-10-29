export type Person = { name: string; born: string; died: string };
export type Grave = {
  id: string;
  section: string;
  row: number;
  number: number;
  x: number;
  y: number;
  people: Person[];
};

// All names, dates, positions and plot identifiers below are fictional fixtures.
// Future aerial image: keep the same 1000 × 760 coordinate space and replace
// the diagram artwork with an image; register verified plot polygons in that space.
export const cemeteryPlan = {
  width: 1000,
  height: 760,
  imageUrl: null as string | null,
};
const firstNames = [
  "Ana",
  "Jože",
  "Marija",
  "Franc",
  "Ivana",
  "Anton",
  "Marta",
  "Janez",
];
const lastNames = [
  "Novak",
  "Kovač",
  "Horvat",
  "Krajnc",
  "Zupan",
  "Potočnik",
  "Vidmar",
  "Kos",
  "Mlakar",
  "Rozman",
  "Turk",
  "Kralj",
];
const date = (year: number, index: number) =>
  `${year}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`;
export const graves: Grave[] = Array.from({ length: 96 }, (_, index) => {
  const block = Math.floor(index / 24);
  const row = Math.floor((index % 24) / 6) + 1;
  const number = (index % 6) + 1;
  const section = "ABCD"[block];
  const surname = lastNames[index % lastNames.length];
  const people = [
    {
      name: `${firstNames[Math.floor(index / 12) % 8]} ${surname}`,
      born: date(1920 + ((index * 7) % 60), index),
      died: date(2008 + (index % 17), index + 3),
    },
  ];
  if (index % 4 === 0)
    people.push({
      name: `${firstNames[(Math.floor(index / 12) + 3) % 8]} ${surname}`,
      born: date(1935 + (index % 36), index + 2),
      died: date(2018 + (index % 7), index + 5),
    });
  return {
    id: `${section}-${String(row).padStart(2, "0")}-${String(number).padStart(2, "0")}`,
    section,
    row,
    number,
    x: (block % 2 ? 574 : 144) + (number - 1) * 46,
    y: (block < 2 ? 123 : 405) + (row - 1) * 49,
    people,
  };
});

export function normalizeGraveSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sl")
    .trim();
}
export function findGraves(
  query: string,
  section = "all",
  records: Grave[] = graves,
) {
  const words = normalizeGraveSearch(query).split(/\s+/).filter(Boolean);
  return records.filter(
    (grave) =>
      (section === "all" || grave.section === section) &&
      (words.length === 0 ||
        words.every((word) => normalizeGraveSearch(grave.id).includes(word)) ||
        grave.people.some((person) =>
          words.every((word) =>
            normalizeGraveSearch(
              `${person.name} ${person.born} ${person.died} ${grave.id}`,
            ).includes(word),
          ),
        )),
  );
}
