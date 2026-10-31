export type Person = { name: string; born: string; died: string };
export type Grave = {
  id: string;
  section: string;
  row: number;
  number: number;
  x: number;
  y: number;
  people: Person[];
  /** False until an editor confirms the position on the plan. */
  positioned?: boolean;
};
export type CemeterySector = { name: string; rows: number[] };
export type CemeteryData = {
  plan: { width: number; height: number; imageUrl: string | null };
  sectors?: CemeterySector[];
  graves: Grave[];
};
export const GRAVE_WIDTH = 36;
export const GRAVE_HEIGHT = 32;

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
  records: Grave[] = [],
) {
  const words = normalizeGraveSearch(query).split(/\s+/).filter(Boolean);
  return records.filter(
    (grave) =>
      (section === "all" || grave.section === section) &&
      (words.length === 0 ||
        words.every((word) =>
          normalizeGraveSearch(
            `${grave.id} ${grave.section} ${grave.row} ${grave.number}`,
          ).includes(word),
        ) ||
        grave.people.some((person) =>
          words.every((word) =>
            normalizeGraveSearch(
              `${person.name} ${person.born} ${person.died} ${grave.id}`,
            ).includes(word),
          ),
        )),
  );
}
/** Retains explicitly created empty sectors and rows, including older flat records. */
export function cemeterySectors(data: CemeteryData): CemeterySector[] {
  const sectors = (data.sectors || []).map((sector) => ({
    name: sector.name,
    rows: [...sector.rows],
  }));
  for (const grave of data.graves) {
    let sector = sectors.find((item) => item.name === grave.section);
    if (!sector) {
      sector = { name: grave.section, rows: [] };
      sectors.push(sector);
    }
    if (!sector.rows.includes(grave.row)) sector.rows.push(grave.row);
  }
  return sectors.map((sector) => ({
    ...sector,
    rows: sector.rows.sort((a, b) => a - b),
  }));
}
export function addCemeterySector(
  data: CemeteryData,
  name: string,
): CemeteryData {
  name = name.trim();
  if (!name || name.length > 60 || /[<>\r\n]/.test(name))
    throw Error("Vnesite oznako sektorja z največ 60 znaki.");
  const sectors = cemeterySectors(data);
  if (
    sectors.some(
      (sector) =>
        sector.name.toLocaleLowerCase("sl") === name.toLocaleLowerCase("sl"),
    )
  )
    throw Error("Ta sektor že obstaja.");
  if (sectors.length >= 100) throw Error("Dovoljenih je največ 100 sektorjev.");
  return { ...data, sectors: [...sectors, { name, rows: [] }] };
}
export function addCemeteryRow(
  data: CemeteryData,
  name: string,
  row: number,
): CemeteryData {
  const sectors = cemeterySectors(data),
    sector = sectors.find((item) => item.name === name);
  if (!sector) throw Error("Najprej izberite sektor.");
  if (!Number.isInteger(row) || row < 1 || row > 10000)
    throw Error("Številka vrste naj bo med 1 in 10000.");
  if (sector.rows.includes(row)) throw Error("Ta vrsta že obstaja.");
  if (sector.rows.length >= 1000)
    throw Error("Sektor lahko vsebuje največ 1000 vrst.");
  return {
    ...data,
    sectors: sectors.map((item) =>
      item.name === name
        ? { ...item, rows: [...item.rows, row].sort((a, b) => a - b) }
        : item,
    ),
  };
}
export function renameCemeterySector(
  data: CemeteryData,
  from: string,
  to: string,
): CemeteryData {
  const sectors = cemeterySectors(data),
    existing = sectors.find((item) => item.name === from);
  if (!existing) throw Error("Sektor ne obstaja.");
  const validated = addCemeterySector(
    {
      ...data,
      sectors: sectors.filter((item) => item.name !== from),
      graves: [],
    },
    to,
  );
  const name = validated.sectors!.at(-1)!.name;
  return {
    ...data,
    sectors: sectors.map((item) =>
      item.name === from ? { ...item, name } : item,
    ),
    graves: data.graves.map((grave) =>
      grave.section === from ? { ...grave, section: name } : grave,
    ),
  };
}
/** Empty plots are explicit records, never generated people or assumed map positions. */
export function addCemeteryGraves(
  data: CemeteryData,
  section: string,
  row: number,
  first: number,
  count: number,
): CemeteryData {
  if (
    !cemeterySectors(data).some(
      (sector) => sector.name === section && sector.rows.includes(row),
    )
  )
    throw Error("Najprej izberite sektor in vrsto.");
  if (
    !Number.isInteger(first) ||
    first < 1 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    first + count - 1 > 100000
  )
    throw Error("Izberite začetno številko in od 1 do 100 grobov.");
  if (data.graves.length + count > 5000)
    throw Error("Dovoljenih je največ 5000 grobov.");
  const added: Grave[] = [];
  const stem =
    normalizeGraveSearch(section)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sektor";
  for (let number = first; number < first + count; number++) {
    if (
      data.graves.some(
        (grave) =>
          grave.section === section &&
          grave.row === row &&
          grave.number === number,
      )
    )
      throw Error(
        `Grob ${number} v tej vrsti že obstaja. Spremenite začetno številko.`,
      );
    const base = `${stem}-${String(row).padStart(2, "0")}-${String(number).padStart(2, "0")}`;
    let id = base,
      suffix = 2;
    while ([...data.graves, ...added].some((grave) => grave.id === id))
      id = `${base}-${suffix++}`;
    added.push({
      id,
      section,
      row,
      number,
      x: 0,
      y: 0,
      people: [],
      positioned: false,
    });
  }
  return {
    ...data,
    sectors: cemeterySectors(data),
    graves: [...data.graves, ...added],
  };
}
export function positionCemeteryGrave(
  data: CemeteryData,
  id: string,
  point: { x: number; y: number },
): CemeteryData {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw Error("Izberite položaj na načrtu.");
  return {
    ...data,
    graves: data.graves.map((grave) =>
      grave.id === id
        ? {
            ...grave,
            positioned: true,
            x: Math.round(
              Math.max(0, Math.min(data.plan.width - GRAVE_WIDTH, point.x)),
            ),
            y: Math.round(
              Math.max(0, Math.min(data.plan.height - GRAVE_HEIGHT, point.y)),
            ),
          }
        : grave,
    ),
  };
}
/** Two operator-chosen endpoints place a whole row without retyping each coordinate. */
export function positionCemeteryRow(
  data: CemeteryData,
  section: string,
  row: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
): CemeteryData {
  const plots = data.graves
    .filter((grave) => grave.section === section && grave.row === row)
    .sort((a, b) => a.number - b.number);
  if (!plots.length) throw Error("V izbrani vrsti še ni grobov.");
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite))
    throw Error("Izberite položaj na načrtu.");
  const bounded = (point: { x: number; y: number }) => ({
    x: Math.round(
      Math.max(0, Math.min(data.plan.width - GRAVE_WIDTH, point.x)),
    ),
    y: Math.round(
      Math.max(0, Math.min(data.plan.height - GRAVE_HEIGHT, point.y)),
    ),
  });
  start = bounded(start);
  end = bounded(end);
  const distance = plots.length - 1;
  if (
    distance > 0 &&
    Math.abs(end.x - start.x) / distance < GRAVE_WIDTH &&
    Math.abs(end.y - start.y) / distance < GRAVE_HEIGHT
  )
    throw Error(
      "Razmak je premajhen. Izberite bolj oddaljeni krajišči ali postavite grobove posamično.",
    );
  return plots.reduce((next, grave, index) => {
    const ratio = plots.length === 1 ? 0 : index / (plots.length - 1);
    return positionCemeteryGrave(next, grave.id, {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    });
  }, data);
}
