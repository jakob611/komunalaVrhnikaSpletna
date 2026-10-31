import { useMemo, useState, type FormEvent } from "react";
import { Calculator, ArrowRight, Info, Printer } from "lucide-react";
import { useSiteContent } from "../content/SiteContent";
import { CmsLayout, CmsLink as Link, CmsAnchor } from "../content/PageComposer";
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
  const [submitted, setSubmitted] = useState<HouseholdInput | null>(null),
    [error, setError] = useState("");
  const water = scope !== "waste",
    waste = scope !== "water";
  const result = useMemo(() => {
    if (!submitted) return null;
    try {
      return calculateHousehold(tariffs, submitted);
    } catch {
      return null;
    }
  }, [tariffs, submitted]);
  function changed(update: () => void) {
    update();
    setSubmitted(null);
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
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
      calculateHousehold(tariffs, input);
      setSubmitted(input);
    } catch (cause) {
      setSubmitted(null);
      setError(cause instanceof Error ? cause.message : "Preverite vnos.");
    }
  }
  return (
    <CmsLayout>
      <header className="page-intro">
        <div className="eyebrow">CENIK IN MESEČNI STROŠKI</div>
        <h1>Izračunajte strošek za svoj dom.</h1>
        <p>
          Izberite občino in prepišite porabo ter število oseb z računa. Videli
          boste posamezne postavke, omrežnino in DDV.
        </p>
      </header>
      <div className="utility-workspace">
        <form className="panel utility-form" onSubmit={submit}>
          <h2>
            <Calculator size={23} /> Vaši podatki
          </h2>
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
                  Na računu poiščite količino pri vodarini. Vnesite porabo za en
                  cel mesec.
                </small>
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
                  Izberite način za svoj objekt. Pri MKČN mora biti priznano
                  ustrezno čiščenje za nižjo okoljsko dajatev.
                </small>
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
                  Vsi stalno in začasno prijavljeni člani gospodinjstva.
                </small>
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
                Če imate urejeno domače kompostiranje in se vam odvoz BIO ne
                obračunava, oznako izključite.
              </p>
            </>
          )}
          <details className="utility-advanced">
            <summary>Prilagoditev po vašem računu</summary>
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
                  Za začetni izračun velja DN 15/20 (faktor 1). DN je premer, ne
                  višina ali odčitek vodomera. Poiščite ga na računu pri
                  omrežnini; za stanovanje brez svojega obračunskega vodomera se
                  praviloma uporabi DN 20.
                </small>
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
                Neobvezno: prepišite samo dejansko subvencijo oziroma znižanje s
                svojega računa. Brez vnosa izračun uporablja polni cenik.
              </small>
            </label>
          </details>
          {water && (
            <p className="utility-assumption">
              Omrežnina: {METER_BANDS[meterBand].label}, faktor{" "}
              {METER_BANDS[meterBand].factor}. Po potrebi spremenite pod
              »Prilagoditev po vašem računu«.
            </p>
          )}
          <button className="button" type="submit">
            Izračunaj mesečni strošek <ArrowRight size={18} />
          </button>
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
              <span className="eyebrow">
                OCENA ZA EN CEL MESEC · {result.municipality.name}
              </span>
              <h2>{money(result.totalCents)}</h2>
              <p>
                {result.deductionCents
                  ? "Po vnesenem znižanju."
                  : "Po polnem ceniku, z DDV."}{" "}
                Vključeni DDV: {money(result.vatCents)}
                {result.deductionCents ? " pred znižanjem" : ""}.
              </p>
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
                Zneski so zaokroženi po postavkah; končni račun lahko odstopa za
                nekaj centov.
              </p>
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
              <h2>Najprej vnesite podatke.</h2>
              <p>
                Izračun ne potrebuje vašega imena, e-pošte ali številke
                odjemnega mesta. Podatki se ne pošiljajo v obravnavo.
              </p>
            </div>
          )}
          <div className="utility-limits">
            <Info size={19} />
            <div>
              <strong>Kaj vključuje ocena?</strong>
              <p>
                Izbrane redne storitve gospodinjstva za cel mesec. Odpadki
                uporabljajo obračunske količine na osebo iz uradne priloge, ne
                dejansko stehtanih odpadkov. Posebna dela, delitev skupnega
                računa, poračuni, oprostitve, padavinske vode in poslovni odjem
                niso vključeni.
              </p>
              <p>
                Pri greznici/MKČN sta vključena redna mesečna storitev in
                ustrezna dajatev; izrednega praznjenja ne prištevamo.
              </p>
            </div>
          </div>
        </section>
      </div>
      <section className="panel utility-sources">
        <h2>Ceniki in pojasnila</h2>
        <p>
          Podatki preverjeni {date(tariffs.checkedOn)}. Izračun uporablja
          objavljene cene brez DDV ter posebej doda DDV. Morebitno individualno
          znižanje velja samo, če ga vnesete.
        </p>
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
          Za razlago dejanskega računa navedite občino in obračunsko obdobje.
        </p>
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
