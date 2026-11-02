import { useSiteContent } from "../content/SiteContent";
import { CmsAnchor, CmsLink as Link } from "../content/PageComposer";
import { tariffDate, type ServicePrice } from "../../shared/utility-pricing.js";
import "./utility-pricing.css";

function PriceRow({ price }: { price: ServicePrice }) {
  return (
    <li>
      <strong>
        {price.name}:{" "}
        {new Intl.NumberFormat("sl-SI", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: price.priceWithVat < 2 ? 4 : 2,
          maximumFractionDigits: 4,
        }).format(price.priceWithVat)}{" "}
        / {price.unit}
      </strong>
      <small>
        {price.note} Vključuje {price.vatPercent.toLocaleString("sl-SI")} % DDV.
        Velja od{" "}
        {new Date(price.effectiveFrom + "T12:00:00").toLocaleDateString(
          "sl-SI",
        )}
        .
      </small>
      <CmsAnchor href={price.sourceUrl} target="_blank" rel="noreferrer">
        Vir: cenik KPV
      </CmsAnchor>
    </li>
  );
}
export default function ServicePriceGuide({ service }: { service: string }) {
  const { tariffs } = useSiteContent();
  const today = tariffDate();
  const prices = tariffs.servicePrices.filter(
    (price) => price.category === service && price.effectiveFrom <= today,
  );
  return (
    <div className="utility-service-price">
      <h3>Cene in obračun storitve</h3>
      {service === "bulky" && (
        <p>
          Kosovne odpadke iz gospodinjstva lahko sami brezplačno pripeljete v
          zbirni center. Poseben prevoz z vašega naslova se plača po dogovoru.{" "}
          <CmsAnchor
            href="https://www.kpv.si/mDejavnosti/rzo/rzoKosovni.html"
            target="_blank"
            rel="noreferrer"
          >
            Pogoji oddaje in organiziranih odvozov
          </CmsAnchor>
          .
        </p>
      )}
      {prices.length ? (
        <>
          <p>
            {prices
              .slice(0, service === "bulky" ? 2 : 1)
              .map((price, index) => (
                <span key={price.id}>
                  {index > 0 ? " · " : ""}
                  <strong>
                    {price.name}:{" "}
                    {new Intl.NumberFormat("sl-SI", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 4,
                    }).format(price.priceWithVat)}{" "}
                    / {price.unit}
                  </strong>
                </span>
              ))}
            . Z DDV; posamezne postavke niso paketna cena.
          </p>
          <details>
            <summary>Cene in pogoji</summary>
            <p>
              Končni znesek je odvisen od količine in obsega del. Spodaj so
              navedene posamezne postavke in pogoji obračuna.
            </p>
            <ul>
              {prices.map((price) => (
                <PriceRow key={price.id} price={price} />
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p>
          Za to storitev cena ni enotna: odvisna je od materiala, dostopa in
          potrebnih del. V povpraševanju opišite obseg in prosite za predračun
          pred potrditvijo izvedbe.
        </p>
      )}
      {service === "septic" && (
        <p>
          Redno praznjenje je povezano z mesečno obračunano storitvijo
          greznice/MKČN. Pred naročilom izrednega prevzema preverite
          upravičenost in termin redne storitve.{" "}
          <Link to="/kalkulator">Izračun mesečnega stroška</Link>.
        </p>
      )}
    </div>
  );
}
