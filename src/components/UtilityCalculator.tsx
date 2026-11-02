import { CmsText } from "../content/ContentFields";
import { useMemo, useState, type FormEvent } from "react";
import { Calculator, ArrowRight, Info, Printer } from "lucide-react";
import { useSiteContent } from "../content/SiteContent";
import { CmsLayout, nativeSection, CmsLink as Link, CmsAnchor } from "../content/PageComposer";
import {
  calculateHousehold,
  METER_BANDS,
  type HouseholdInput,
} from "../../shared/utility-pricing.js";
import "./utility-pricing.css";

const money = (cents: number) =>
  new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
const number = (value: number, max = 4) =>
  new Intl.NumberFormat("sl-SI", { maximumFractionDigits: max }).format(value);
const date = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("sl-SI");
const wastewaterNames: Record<HouseholdInput["wastewater"], string> = {
  sewer: "Javna kanalizacija s čistilno napravo",
  septic: "Greznica",
  mkcn: "MKČN z ustreznim čiščenjem",
  "water-only": "Brez obračuna odpadne vode",
};
export default function UtilityCalculator() {
  const { tariffs } = useSiteContent();
  const [municipalityId, setMunicipality] = useState(""),
    [scope, setScope] = useState<HouseholdInput["scope"]>("all");
  const [consumption, setConsumption] = useState(""),
    [people, setPeople] = useState(""),
    [bio, setBio] = useState(true);
  const [wastewater, setWastewater] =
      useState<HouseholdInput["wastewater"]>("sewer"),
    [meterBand, setMeterBand] = useState(0),
    [deduction, setDeduction] = useState("");
  const [hasCalculated, setHasCalculated] = useState(false);
  const water = scope !== "waste",
    waste = scope !== "water";
  const { result, submitted, error } = useMemo(() => {
    if (!hasCalculated) return { result: null, submitted: null, error: "" };
    if (
      !municipalityId ||
      (water && !consumption.trim()) ||
      (waste && !people.trim())
    )
      return {
        result: null,
        submitted: null,
        error: "Dopolnite obvezne podatke. Izračun se nato posodobi samodejno.",
      };
    const input: HouseholdInput = {
      municipalityId,
      scope,
      consumptionM3: Number(consumption),
      people: Number(people),
      bio,
      wastewater,
      meterBand,
      monthlyDeduction: Number(deduction),
    };
    try {
      return {
        result: calculateHousehold(tariffs, input),
        submitted: input,
        error: "",
      };
    } catch (cause) {
      return {
        result: null,
        submitted: null,
        error: cause instanceof Error ? cause.message : "Preverite vnos.",
      };
    }
  }, [
    tariffs,
    hasCalculated,
    municipalityId,
    scope,
    consumption,
    people,
    bio,
    wastewater,
    meterBand,
    deduction,
    water,
    waste,
  ]);
  function changed(update: () => void) {
    update();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setHasCalculated(true);
  }
  return (
    <CmsLayout>
      <header key={nativeSection("UtilityCalculator.page-intro")} className="page-intro">
        <div className="eyebrow">CENIK IN MESEČNI STROŠKI</div>
        <h1><CmsText id="UtilityCalculator.h1-1">{"Izračunajte strošek za svoj dom."}</CmsText></h1>
        <p>
          <CmsText id="UtilityCalculator.p-1">{"Izberite občino in prepišite porabo ter število oseb z računa. Videli boste posamezne postavke, omrežnino in DDV."}</CmsText></p>
      </header>
      <div key={nativeSection("UtilityCalculator.utility-workspace")} className="utility-workspace">
        <form className="panel utility-form" onSubmit={submit}>
          <h2>
            <Calculator size={23} /> <CmsText id="UtilityCalculator.h2-1">{"Vaši podatki"}</CmsText></h2>
          <label className="field">
            <span>Občina odjemnega mesta</span>
            <select
              required
              value={municipalityId}
              onChange={(e) => changed(() => setMunicipality(e.target.value))}
            >
              <option value="" disabled>
                Izberite občino
              </option>
              {tariffs.municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Kaj želite izračunati?</span>
            <select
              value={scope}
              onChange={(e) =>
                changed(() =>
                  setScope(e.target.value as HouseholdInput["scope"]),
                )
              }
            >
              <option value="all">Vodo, odpadno vodo in odpadke</option>
              <option value="water">Vodo in odpadno vodo</option>
              <option value="waste">Samo odpadke</option>
            </select>
          </label>
          {water && (
            <>
              <label className="field">
                <span>Mesečna poraba vode v m³</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="10000"
                  step="0.001"
                  required
                  value={consumption}
                  onChange={(e) =>
                    changed(() => setConsumption(e.target.value))
                  }
                  placeholder="Npr. 12"
                />
                <small>
                  <CmsText id="UtilityCalculator.small-1">{"Na računu poiščite količino pri vodarini. Vnesite porabo za en cel mesec."}</CmsText></small>
              </label>
              <label className="field">
                <span>Kam odteka odpadna voda?</span>
                <select
                  value={wastewater}
                  onChange={(e) =>
                    changed(() =>
                      setWastewater(
                        e.target.value as HouseholdInput["wastewater"],
                      ),
                    )
                  }
                >
                  <option value="sewer">
                    Javna kanalizacija s čistilno napravo
                  </option>
                  <option value="septic">Greznica</option>
                  <option value="mkcn">
                    Mala čistilna naprava z ustreznim čiščenjem
                  </option>
                  <option value="water-only">
                    Izračunaj samo oskrbo s pitno vodo
                  </option>
                </select>
                <small>
                  <CmsText id="UtilityCalculator.small-2">{"Izberite način za svoj objekt. Pri MKČN mora biti priznano ustrezno čiščenje za nižjo okoljsko dajatev."}</CmsText></small>
              </label>
            </>
          )}
          {waste && (
            <>
              <label className="field">
                <span>Število oseb za obračun odpadkov</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  step="1"
                  required
                  value={people}
                  onChange={(e) => changed(() => setPeople(e.target.value))}
                  placeholder="Npr. 3"
                />
                <small>
                  <CmsText id="UtilityCalculator.small-3">{"Vsi stalno in začasno prijavljeni člani gospodinjstva."}</CmsText></small>
              </label>
              <label className="utility-check">
                <input
                  type="checkbox"
                  checked={bio}
                  onChange={(e) => changed(() => setBio(e.target.checked))}
                />
                <span>Uporabljamo odvoz bioloških odpadkov</span>
              </label>
              <p className="svc-small">
                <CmsText id="UtilityCalculator.p-2">{"Če imate urejeno domače kompostiranje in se vam odvoz BIO ne obračunava, oznako izključite."}</CmsText></p>
            </>
          )}
          <details className="utility-advanced">
            <summary><CmsText id="UtilityCalculator.summary-1">{"Prilagoditev po vašem računu"}</CmsText></summary>
            {water && (
              <label className="field">
                <span>Premer vodomera (DN)</span>
                <select
                  value={meterBand}
                  onChange={(e) =>
                    changed(() => setMeterBand(Number(e.target.value)))
                  }
                >
                  {METER_BANDS.map((b, i) => (
                    <option key={b.factor} value={i}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <small>
                  <CmsText id="UtilityCalculator.small-4">{"Za začetni izračun velja DN 15/20 (faktor 1). DN je premer, ne višina ali odčitek vodomera. Poiščite ga na računu pri omrežnini; za stanovanje brez svojega obračunskega vodomera se praviloma uporabi DN 20."}</CmsText></small>
              </label>
            )}
            <label className="field">
              <span>
                Priznano mesečno znižanje za izbrane storitve, z DDV (€)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={deduction}
                onChange={(e) => changed(() => setDeduction(e.target.value))}
                placeholder="0,00"
              />
              <small>
                <CmsText id="UtilityCalculator.small-5">{"Neobvezno: prepišite samo dejansko subvencijo oziroma znižanje s svojega računa. Brez vnosa izračun uporablja polni cenik."}</CmsText></small>
            </label>
          </details>
          {water && (
            <p className="utility-assumption">
              <CmsText id="UtilityCalculator.p-3">{"Omrežnina: "}</CmsText>{METER_BANDS[meterBand].label}<CmsText id="UtilityCalculator.p-4">{", faktor"}</CmsText>{" "}
              {METER_BANDS[meterBand].factor}<CmsText id="UtilityCalculator.p-5">{". Po potrebi spremenite pod »Prilagoditev po vašem računu«."}</CmsText></p>
          )}
          <button className="button" type="submit">
            Izračunaj mesečni strošek <ArrowRight size={18} />
          </button>
          {hasCalculated && (
            <p className="svc-small">
              <CmsText id="UtilityCalculator.p-6">{"Ob spremembi podatkov se izračun posodobi samodejno."}</CmsText></p>
          )}
          {error && (
            <p className="svc-error" role="alert">
              {error}
            </p>
          )}
        </form>
        <section
          className="panel utility-result"
          aria-label="Rezultat izračuna"
          aria-live="polite"
        >
          {result && submitted ? (
            <>
              <p className="utility-print-brand">Komunala Vrhnika · Informativni mesečni izračun</p>
              <span className="eyebrow">
                OCENA ZA EN CEL MESEC · {result.municipality.name}
              </span>
              <h2>{money(result.totalCents)}</h2>
              <p>
                {result.deductionCents
                  ? "Po vnesenem znižanju."
                  : "Po polnem ceniku, z DDV."}{" "}
                <CmsText id="UtilityCalculator.p-7">{"Vključeni DDV: "}</CmsText>{money(result.vatCents)}
                {result.deductionCents ? " pred znižanjem" : ""}{"."}</p>
              <dl className="utility-input-summary" aria-label="Podatki in predpostavke izračuna">
                <div><dt>Obseg</dt><dd>{submitted.scope === "waste" ? "Samo odpadki" : submitted.scope === "water"
                  ? submitted.wastewater === "water-only" ? "Samo pitna voda" : "Voda in odpadna voda"
                  : submitted.wastewater === "water-only" ? "Pitna voda in odpadki" : "Voda, odpadna voda in odpadki"}</dd></div>
                {submitted.scope !== "waste" && <>
                  <div><dt>Poraba vode</dt><dd>{number(submitted.consumptionM3, 3)} m³/mesec</dd></div>
                  <div><dt>Odpadna voda</dt><dd>{wastewaterNames[submitted.wastewater]}</dd></div>
                  <div><dt>Vodomer in omrežnina</dt><dd>{METER_BANDS[submitted.meterBand].label} · faktor {METER_BANDS[submitted.meterBand].factor}</dd></div>
                </>}
                {submitted.scope !== "water" && <>
                  <div><dt>Osebe za obračun odpadkov</dt><dd>{submitted.people}</dd></div>
                  <div><dt>Odvoz BIO</dt><dd>{submitted.bio ? "Da" : "Ne"}</dd></div>
                </>}
                {result.deductionCents > 0 && <div><dt>Priznano mesečno znižanje</dt><dd>{money(result.deductionCents)} z DDV</dd></div>}
              </dl>
              <div className="utility-table-wrap">
                <table>
                  <caption>Razčlenitev mesečnega stroška</caption>
                  <thead>
                    <tr>
                      <th>Postavka</th>
                      <th>Količina × cena brez DDV</th>
                      <th>Z DDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">
                          {row.label}
                          <small>
                            {row.vatPercent
                              ? `${number(row.vatPercent)} % DDV`
                              : "Brez DDV"}
                          </small>
                        </th>
                        <td>
                          {number(row.quantity)} {row.unit} ×{" "}
                          {number(row.unitNet)} €
                        </td>
                        <td>{money(row.grossCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {result.deductionCents > 0 && (
                      <>
                        <tr>
                          <th colSpan={2}>Pred znižanjem</th>
                          <td>{money(result.beforeDeductionCents)}</td>
                        </tr>
                        <tr>
                          <th colSpan={2}>Vaše vneseno znižanje</th>
                          <td>−{money(result.deductionCents)}</td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <th colSpan={2}>Skupaj za izbrane storitve</th>
                      <td>{money(result.totalCents)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="svc-small">
                {submitted.scope !== "waste" &&
                  `Voda: cenik od ${date(result.municipality.effectiveFrom)}. `}
                {submitted.scope !== "water" &&
                  `Odpadki: cenik od ${date(tariffs.waste.effectiveFrom)}. `}
                <CmsText id="UtilityCalculator.p-9">{"Zneski so zaokroženi po postavkah; končni račun lahko odstopa za nekaj centov."}</CmsText></p>
              <button
                className="button secondary utility-print"
                type="button"
                onClick={() => window.print()}
              >
                <Printer size={17} /> Natisni izračun
              </button>
            </>
          ) : (
            <div className="utility-empty">
              <Calculator size={36} />
              <h2><CmsText id="UtilityCalculator.h2-2">{"Najprej vnesite podatke."}</CmsText></h2>
              <p>
                <CmsText id="UtilityCalculator.p-10">{"Izračun ne potrebuje vašega imena, e-pošte ali številke odjemnega mesta. Podatki se ne pošiljajo v obravnavo."}</CmsText></p>
            </div>
          )}
          <div className="utility-limits">
            <Info size={19} />
            <div>
              <strong><CmsText id="UtilityCalculator.strong-1">{"Kaj vključuje ocena?"}</CmsText></strong>
              <p>
                <CmsText id="UtilityCalculator.p-11">{"Izbrane redne storitve gospodinjstva za cel mesec. Odpadki uporabljajo obračunske količine na osebo iz uradne priloge, ne dejansko stehtanih odpadkov. Posebna dela, delitev skupnega računa, poračuni, oprostitve, padavinske vode in poslovni odjem niso vključeni."}</CmsText></p>
              <p>
                <CmsText id="UtilityCalculator.p-12">{"Pri greznici/MKČN sta vključena redna mesečna storitev in ustrezna dajatev; izrednega praznjenja ne prištevamo."}</CmsText></p>
            </div>
          </div>
        </section>
      </div>
      <section key={nativeSection("UtilityCalculator.sources")} className="panel utility-sources">
        <h2><CmsText id="UtilityCalculator.h2-3">{"Ceniki in pojasnila"}</CmsText></h2>
        <p>
          <CmsText id="UtilityCalculator.p-13">{"Podatki preverjeni "}</CmsText>{date(tariffs.checkedOn)}<CmsText id="UtilityCalculator.p-14">{". Izračun uporablja objavljene cene brez DDV ter posebej doda DDV. Morebitno individualno znižanje velja samo, če ga vnesete."}</CmsText></p>
        <div>
          {tariffs.municipalities.map((m) => (
            <CmsAnchor
              key={m.id}
              href={m.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Cenik {m.name} (PDF)
            </CmsAnchor>
          ))}
          <CmsAnchor
            href={tariffs.waste.annexUrl}
            target="_blank"
            rel="noreferrer"
          >
            Obračunske količine odpadkov (PDF)
          </CmsAnchor>
        </div>
        <p>
          <CmsText id="UtilityCalculator.p-15">{"Za razlago dejanskega računa navedite občino in obračunsko obdobje."}</CmsText></p>
        <Link
          className="svc-inline-link"
          to="/kontakt?category=billing&subcategory=invoice#kontakt-obrazec"
        >
          Vprašanje o računu <ArrowRight size={17} />
        </Link>
      </section>
    </CmsLayout>
  );
}
