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
      <h3>Kakšen strošek lahko pričakujete?</h3>
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
            Objavljene cene posameznih postavk. Končni znesek je odvisen od
            količine in obsega; spodnje postavke niso paketna cena.
          </p>
          <ul>
            {prices.map((price) => (
              <PriceRow key={price.id} price={price} />
            ))}
          </ul>
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
      {service === "bulky" && (
        <p>
          Pred naročilom preverimo tudi možnost prevzema v okviru redne
          storitve. Zgornja cena za kilogram velja za plačljivo ravnanje z
          odpadki in sama ne vključuje odvoza z vašega naslova.
        </p>
      )}
    </div>
  );
}
