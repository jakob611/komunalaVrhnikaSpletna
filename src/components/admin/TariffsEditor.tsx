import { useState } from "react";
import {
  calculateHousehold,
  tariffDate,
  type TariffData,
  type MunicipalityTariff,
  type ServicePrice,
} from "../../../shared/utility-pricing.js";
import "../utility-pricing.css";

const labels: Record<string, string> = {
  waterM3: "Vodarina (€/m³)",
  waterNetwork: "Omrežnina – vodovod, faktor 1 (€/mesec)",
  drainageM3: "Odvajanje (€/m³)",
  drainageNetwork: "Omrežnina – odvajanje, faktor 1 (€/mesec)",
  cleaningM3: "Čiščenje (€/m³)",
  cleaningNetwork: "Omrežnina – čiščenje, faktor 1 (€/mesec)",
  serviceM3: "Storitev greznice/MKČN (€/m³)",
  network: "Omrežnina greznice/MKČN, faktor 1 (€/mesec)",
  levySepticM3: "Okoljska dajatev – greznica (€/m³; brez DDV)",
  levyTreatedM3: "Okoljska dajatev – ustrezno čiščenje (€/m³; brez DDV)",
  collectionKgPerPerson: "Zbiranje: obračunski kg na osebo/mesec",
  treatmentKgPerPerson: "Obdelava: obračunski kg na osebo/mesec",
  disposalKgPerPerson: "Odlaganje: obračunski kg na osebo/mesec",
  bioKgPerPerson: "BIO: obračunski kg na osebo/mesec",
  collectionKg: "Zbiranje (€/kg)",
  collectionInfrastructureKg: "Infrastruktura zbiranja (€/kg)",
  treatmentKg: "Obdelava (€/kg)",
  treatmentInfrastructureKg: "Infrastruktura obdelave (€/kg)",
  disposalKg: "Odlaganje (€/kg)",
  disposalInfrastructureKg: "Infrastruktura odlaganja (€/kg)",
  bioKg: "BIO (€/kg)",
};
export default function TariffsEditor({
  value,
  onChange,
  disabled,
}: {
  value: TariffData;
  onChange: (value: TariffData) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState(
    value.municipalities[0]?.id || "vrhnika",
  );
  const m =
    value.municipalities.find((item) => item.id === selected) ||
    value.municipalities[0];
  function municipality(patch: Partial<MunicipalityTariff>) {
    onChange({
      ...value,
      municipalities: value.municipalities.map((item) =>
        item.id === m.id ? { ...item, ...patch } : item,
      ),
    });
  }
  function price(id: string, patch: Partial<ServicePrice>) {
    onChange({
      ...value,
      servicePrices: value.servicePrices.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }
  function numeric(
    key: string,
    current: number,
    change: (next: number) => void,
  ) {
    return (
      <label className="admin-field" key={key}>
        <span>{labels[key] || key}</span>
        <input
          type="number"
          min="0"
          max="100000"
          step="0.0001"
          required
          value={current}
          onChange={(e) => change(Number(e.target.value))}
        />
      </label>
    );
  }
  let preview = "";
  try {
    const result = calculateHousehold(value, {
      municipalityId: m.id,
      scope: "all",
      consumptionM3: 12,
      meterBand: 0,
      wastewater: "sewer",
      people: 3,
      bio: true,
    });
    preview = new Intl.NumberFormat("sl-SI", {
      style: "currency",
      currency: "EUR",
    }).format(result.totalCents / 100);
  } catch {
    preview = "Cenik za primer še ne velja ali ni popoln.";
  }
  return (
    <fieldset
      disabled={disabled}
      className="tariff-editor"
      style={{ border: 0, padding: 0, minWidth: 0 }}
    >
      <div className="notice-editor-guide">
        <h2>Cene z jasnim virom in datumom</h2>
        <p>
          Tu spreminjate izračun na strani »Cenik« in prikazane cene posebnih
          storitev. Občinske tarife in redne storitve vpisujte{" "}
          <strong>brez DDV</strong>; cene posebnih storitev so{" "}
          <strong>z DDV</strong>. Vedno prepišite potrjen cenik in priložite
          vir.
        </p>
        <p>
          Sprememba ne spreminja izdanih računov. Objava zamenja cenik za
          izračun; za starejša obdobja ni arhivskega obračuna. Prihodnji datum
          ne načrtuje preklopa: do tega datuma izračun s takšnim cenikom ne bo
          na voljo.
        </p>
      </div>
      <div className="admin-field-grid">
        <label className="admin-field">
          <span>Datum preverjanja virov</span>
          <input
            type="date"
            required
            value={value.checkedOn}
            onChange={(e) => onChange({ ...value, checkedOn: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>DDV rednih storitev (%)</span>
          <input
            type="number"
            min="0"
            max="30"
            step="0.1"
            required
            value={value.vatPercent}
            onChange={(e) =>
              onChange({ ...value, vatPercent: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <section className="admin-panel" style={{ padding: 20 }}>
        <h3>1. Voda in kanalizacija po občinah</h3>
        <label className="admin-field">
          <span>Občina za urejanje</span>
          <select value={m.id} onChange={(e) => setSelected(e.target.value)}>
            {value.municipalities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-field-grid">
          <label className="admin-field">
            <span>Cenik velja od</span>
            <input
              type="date"
              required
              value={m.effectiveFrom}
              onChange={(e) => municipality({ effectiveFrom: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>Povezava do uradnega cenika</span>
            <input
              type="url"
              required
              value={m.sourceUrl}
              onChange={(e) => municipality({ sourceUrl: e.target.value })}
            />
          </label>
          {(
            [
              "waterM3",
              "waterNetwork",
              "drainageM3",
              "drainageNetwork",
              "cleaningM3",
              "cleaningNetwork",
            ] as const
          ).map((key) =>
            numeric(key, m[key], (next) => municipality({ [key]: next })),
          )}
        </div>
        <p className="svc-small">
          Omrežnine so za faktor 1 (DN 15/20). Večje premere kalkulator pomnoži
          z objavljenimi faktorji 3, 10, 15, 30, 50, 100 in 200.
        </p>
      </section>
      <details className="admin-panel" style={{ padding: 20 }}>
        <summary>2. Greznice, MKČN in okoljska dajatev · vse občine</summary>
        <div className="admin-field-grid">
          {Object.keys(value.septic).map((key) =>
            numeric(
              key,
              value.septic[key as keyof typeof value.septic],
              (next) =>
                onChange({
                  ...value,
                  septic: { ...value.septic, [key]: next },
                }),
            ),
          )}
        </div>
        <p className="svc-small">
          Vir je občinski cenik zgoraj. Okoljski dajatvi se DDV ne prišteje.
        </p>
      </details>
      <details className="admin-panel" style={{ padding: 20 }}>
        <summary>
          3. Odpadki · cene in obračunske količine za gospodinjstva
        </summary>
        <p>
          Za gospodinjstva je obračun na osebo, ne prostornina celotnega
          zabojnika. Količine prepišite iz vrstice »Gospodinjstva« v uradni
          prilogi; poslovnih vrstic ne uporabljajte.
        </p>
        <div className="admin-field-grid">
          <label className="admin-field">
            <span>Cenik odpadkov velja od</span>
            <input
              type="date"
              required
              value={value.waste.effectiveFrom}
              onChange={(e) =>
                onChange({
                  ...value,
                  waste: { ...value.waste, effectiveFrom: e.target.value },
                })
              }
            />
          </label>
          {(["sourceUrl", "annexUrl"] as const).map((key) => (
            <label className="admin-field" key={key}>
              <span>
                {key === "sourceUrl"
                  ? "Uradni cenik"
                  : "Priloga z obračunskimi količinami"}
              </span>
              <input
                type="url"
                required
                value={value.waste[key]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    waste: { ...value.waste, [key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
          {Object.keys(value.waste)
            .filter(
              (key) =>
                typeof value.waste[key as keyof typeof value.waste] ===
                "number",
            )
            .map((key) =>
              numeric(
                key,
                value.waste[key as keyof typeof value.waste] as number,
                (next) =>
                  onChange({
                    ...value,
                    waste: { ...value.waste, [key]: next },
                  }),
              ),
            )}
        </div>
      </details>
      <details className="admin-panel" style={{ padding: 20 }}>
        <summary>4. Posebne storitve · prikaz cen ob povpraševanju</summary>
        <p>
          Vsi zneski v tem delu so <strong>z DDV</strong>. Navedite enoto,
          omejitve in kaj cena vključuje.
        </p>
        {value.servicePrices.map((p) => (
          <article key={p.id} className="tariff-price-card">
            <div className="admin-field-grid">
              <label className="admin-field">
                <span>Naziv postavke</span>
                <input
                  required
                  maxLength={200}
                  value={p.name}
                  onChange={(e) => price(p.id, { name: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Prikaži pri storitvi</span>
                <select
                  value={p.category}
                  onChange={(e) =>
                    price(p.id, {
                      category: e.target.value as ServicePrice["category"],
                    })
                  }
                >
                  <option value="bulky">Kosovni odpadki</option>
                  <option value="septic">Greznice/MKČN</option>
                  <option value="water">Vodovod</option>
                  <option value="other">Druge storitve</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Cena z DDV (€ na enoto)</span>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="0.0001"
                  required
                  value={p.priceWithVat}
                  onChange={(e) =>
                    price(p.id, { priceWithVat: Number(e.target.value) })
                  }
                />
              </label>
              <label className="admin-field">
                <span>Enota</span>
                <select
                  value={p.unit}
                  onChange={(e) =>
                    price(p.id, {
                      unit: e.target.value as ServicePrice["unit"],
                    })
                  }
                >
                  {["kg", "m³", "ura", "dan", "kos", "storitev"].map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Vključeni DDV (%)</span>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.1"
                  required
                  value={p.vatPercent}
                  onChange={(e) =>
                    price(p.id, { vatPercent: Number(e.target.value) })
                  }
                />
              </label>
              <label className="admin-field">
                <span>Velja od</span>
                <input
                  type="date"
                  required
                  value={p.effectiveFrom}
                  onChange={(e) =>
                    price(p.id, { effectiveFrom: e.target.value })
                  }
                />
              </label>
              <label className="admin-field">
                <span>Vir cenika</span>
                <input
                  type="url"
                  required
                  value={p.sourceUrl}
                  onChange={(e) => price(p.id, { sourceUrl: e.target.value })}
                />
              </label>
            </div>
            <label className="admin-field">
              <span>Kaj vključuje in kaj se obračuna posebej?</span>
              <textarea
                required
                maxLength={600}
                rows={3}
                value={p.note}
                onChange={(e) => price(p.id, { note: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="admin-button"
              onClick={() =>
                onChange({
                  ...value,
                  servicePrices: value.servicePrices.filter(
                    (item) => item.id !== p.id,
                  ),
                })
              }
            >
              Odstrani postavko iz prikaza
            </button>
          </article>
        ))}
        <button
          type="button"
          className="admin-button"
          disabled={value.servicePrices.length >= 50}
          onClick={() =>
            onChange({
              ...value,
              servicePrices: [
                ...value.servicePrices,
                {
                  id: `cena-${crypto.randomUUID()}`,
                  category: "other",
                  name: "Nova storitev",
                  unit: "storitev",
                  priceWithVat: 0,
                  vatPercent: 9.5,
                  effectiveFrom: tariffDate(),
                  sourceUrl: "https://www.kpv.si/mCeniki/",
                  note: "Vpišite obseg in pogoje cene pred objavo.",
                },
              ],
            })
          }
        >
          Dodaj cenovno postavko
        </button>
      </details>
      <section className="notice-editor-preview">
        <h3>Preverjanje osnutka</h3>
        <p>
          Primer: {m.name}, 12 m³ vode, javna kanalizacija, DN 15/20, 3 osebe,
          odvoz BIO, brez subvencije: <strong>{preview}</strong> na mesec.
        </p>
        <p>
          Preverite z uradnim cenikom. Nato »Shrani in objavi« ter preizkusite
          javni kalkulator. Cene stojnic urejate ločeno v »Cene tržničnih
          stojnic«.
        </p>
      </section>
    </fieldset>
  );
}
