import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Download,
  Info,
  Repeat2,
  Smartphone,
  X,
} from "lucide-react";
import "./calendar.css";
import AnimatedDisclosure from "./AnimatedDisclosure";

export type CalendarCollectionEvent = {
  id: string;
  date: string;
  type: string;
  label: string;
  color: string;
};
type CalendarChoice = "google" | "apple" | "other";

function suggestedCalendar(): CalendarChoice {
  if (/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) return "apple";
  if (/Android/.test(navigator.userAgent)) return "google";
  return "google";
}
function endDate(date: string, days: number) {
  const end = new Date(`${date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return end.toISOString().slice(0, 10);
}
const labelDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function CalendarDialog({
  event,
  address,
  onClose,
}: {
  event: CalendarCollectionEvent;
  address: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [calendar, setCalendar] = useState<CalendarChoice>(suggestedCalendar);
  const [repeat, setRepeat] = useState(false);
  const defaultInterval =
    event.type === "bio"
      ? 1
      : event.type === "packaging" || event.type === "embalaza"
        ? 2
        : 3;
  const [interval, setInterval] = useState(defaultInterval);
  const [countInput, setCountInput] = useState(
    String(Math.floor(13 / defaultInterval) + 1),
  );
  const [action, setAction] = useState<"google" | "file" | null>(null);
  const count = Number(countInput);
  const validCount = Number.isInteger(count) && count >= 2 && count <= 52;
  const valid = !repeat || validCount;
  const params = new URLSearchParams({
    address,
    eventId: event.id,
    repeat: repeat ? "weekly" : "once",
  });
  if (repeat && validCount) {
    params.set("interval", String(interval));
    params.set("count", String(count));
  }
  const icsUrl = `/api/calendar?${params}`;
  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: `PRIMER – odvoz: ${event.label}`,
    dates: `${event.date.replaceAll("-", "")}/${endDate(event.date, 1).replaceAll("-", "")}`,
    details:
      "Vzorčni termin KPV. To ni uradni urnik. Ponavljanje je vaša izbira, ne potrjen razpored odvoza. Dejanske datume preverite na https://www.kpv.si/.",
    location: address,
  });
  if (repeat && validCount)
    googleParams.set(
      "recur",
      `RRULE:FREQ=WEEKLY;INTERVAL=${interval};COUNT=${count}`,
    );
  const googleUrl = `https://calendar.google.com/calendar/render?${googleParams}`;

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const root = document.getElementById("root");
    const wasInert = root?.inert || false;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function keys(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href]:not([aria-disabled="true"]),input,select,summary',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (root) root.inert = wasInert;
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="calendar-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        className="calendar-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-title"
        aria-describedby="calendar-description"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="calendar-header">
          <span className="calendar-heading-icon">
            <CalendarDays size={23} />
          </span>
          <div>
            <span className="eyebrow">ODVOZ V VAŠEM KOLEDARJU</span>
            <h2 id="calendar-title">Dodaj v koledar</h2>
          </div>
          <button
            ref={closeButton}
            className="calendar-close"
            aria-label="Zapri izbiro koledarja"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="calendar-content">
          <p id="calendar-description" className="calendar-lead">
            Izberite ponavljanje in koledar. Dodajanje boste potrdili v svoji
            koledarski aplikaciji.
          </p>
          <div className="calendar-event-summary">
            <span style={{ background: event.color }} />
            <div>
              <strong>{event.label}</strong>
              <p>{labelDate(event.date)} · celodnevni dogodek</p>
              <small>{address}</small>
            </div>
          </div>
          <fieldset className="calendar-fieldset">
            <legend>
              <span>1</span>Enkrat ali s ponavljanjem?
            </legend>
            <div className="calendar-repeat-options">
              <label className={!repeat ? "selected" : ""}>
                <input
                  name="calendar-repeat"
                  type="radio"
                  checked={!repeat}
                  onChange={() => {
                    setRepeat(false);
                    setAction(null);
                  }}
                />
                <CalendarDays size={19} />
                <span>
                  <strong>Samo ta odvoz</strong>
                  <small>En dogodek na izbrani datum</small>
                </span>
                {!repeat && <Check size={17} />}
              </label>
              <label className={repeat ? "selected" : ""}>
                <input
                  name="calendar-repeat"
                  type="radio"
                  checked={repeat}
                  onChange={() => {
                    setRepeat(true);
                    setAction(null);
                  }}
                />
                <Repeat2 size={19} />
                <span>
                  <strong>Ponavljajoči se dogodek</strong>
                  <small>Sami določite razmik in konec</small>
                </span>
                {repeat && <Check size={17} />}
              </label>
            </div>
            <AnimatedDisclosure open={repeat}>
              <div className="calendar-recurrence">
                <div className="calendar-rule-inputs">
                  <label className="field">
                    Ponovi vsakih
                    <select
                      value={interval}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setInterval(value);
                        setCountInput(String(Math.floor(13 / value) + 1));
                        setAction(null);
                      }}
                    >
                      {Array.from({ length: 8 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}{" "}
                          {i === 0
                            ? "teden"
                            : i === 1
                              ? "tedna"
                              : i < 4
                                ? "tedne"
                                : "tednov"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Število terminov
                    <input
                      type="number"
                      inputMode="numeric"
                      min={2}
                      max={52}
                      step={1}
                      value={countInput}
                      onChange={(e) => {
                        setCountInput(e.target.value);
                        setAction(null);
                      }}
                      aria-invalid={!validCount}
                      aria-describedby="calendar-count-help"
                    />
                  </label>
                </div>
                <p
                  id="calendar-count-help"
                  className={
                    !validCount ? "calendar-invalid" : "calendar-rule-summary"
                  }
                >
                  {validCount
                    ? `${count} terminov, vključno z izbranim datumom. Zadnji: ${labelDate(endDate(event.date, (count - 1) * interval * 7))}.`
                    : "Vnesite celo število od 2 do 52."}
                </p>
                <small>
                  Začetna nastavitev zajame približno tri mesece. To ponavljanje
                  ni uradni razpored; prazniki in spremembe niso upoštevani.
                </small>
              </div>
            </AnimatedDisclosure>
          </fieldset>
          <fieldset className="calendar-fieldset">
            <legend>
              <span>2</span>Kateri koledar uporabljate?
            </legend>
            <div className="calendar-destinations">
              {[
                {
                  value: "google" as const,
                  name: "Google Koledar",
                  hint: "Android, iPhone ali računalnik",
                },
                {
                  value: "apple" as const,
                  name: "Apple Koledar",
                  hint: "iPhone, iPad ali Mac · datoteka .ics",
                },
                {
                  value: "other" as const,
                  name: "Outlook ali drug koledar",
                  hint: "Uvoz datoteke .ics",
                },
              ].map((item) => (
                <label
                  key={item.value}
                  className={calendar === item.value ? "selected" : ""}
                >
                  <input
                    name="calendar-destination"
                    type="radio"
                    checked={calendar === item.value}
                    onChange={() => {
                      setCalendar(item.value);
                      setAction(null);
                    }}
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.hint}</small>
                  </span>
                  {calendar === item.value && <Check size={17} />}
                </label>
              ))}
            </div>
            <p className="calendar-device-hint">
              <Smartphone size={14} />
              Izbiro smo predlagali glede na napravo. Vedno jo lahko spremenite.
            </p>
          </fieldset>
          <div className="calendar-demo-note">
            <Info size={17} />
            <p>
              <strong>Vzorčni podatki.</strong> Vsi dogodki imajo oznako
              »PRIMER«. Uvoz ustvari kopijo, ki se ne posodablja samodejno. Ob
              spremembi urnika star dogodek uredite ali izbrišite v koledarju.
              Čas opozorila nastavite v svoji koledarski aplikaciji.
            </p>
          </div>
          {calendar !== "google" && (
            <details className="calendar-help">
              <summary>Kako odprem datoteko .ics?</summary>
              <p>
                {calendar === "apple"
                  ? "Brskalnik odpre predogled ali prenese datoteko. V aplikaciji Koledar potrdite dodajanje. Če iPhone pokaže le predogled, lahko datoteko odprete iz e-poštne priloge ali tukaj izberete Google Koledar. Na Macu datoteko odprite z aplikacijo Koledar."
                  : "Odprite preneseno datoteko v koledarski aplikaciji. V Outlooku v spletu izberite Dodaj koledar → Naloži iz datoteke in potrdite uvoz. Google Koledar datoteke uvaža na računalniku; za telefon tukaj izberite možnost Google Koledar."}
              </p>
            </details>
          )}
        </div>
        <footer className="calendar-footer">
          <a
            className="button calendar-primary"
            href={
              valid ? (calendar === "google" ? googleUrl : icsUrl) : undefined
            }
            target={calendar === "google" ? "_blank" : undefined}
            rel={calendar === "google" ? "noreferrer" : undefined}
            aria-disabled={!valid}
            tabIndex={valid ? 0 : -1}
            onClick={(e) => {
              if (!valid) {
                e.preventDefault();
                return;
              }
              setAction(calendar === "google" ? "google" : "file");
            }}
          >
            {calendar === "google" ? (
              <>
                <CalendarDays size={19} />
                Odpri Google Koledar
                <ArrowUpRight size={18} />
              </>
            ) : (
              <>
                <Download size={19} />
                Prenesi za {calendar === "apple" ? "Apple Koledar" : "koledar"}
                <ArrowUpRight size={18} />
              </>
            )}
          </a>
          <p className="calendar-action-note" role="status">
            {action === "google"
              ? "Odprli smo Google Koledar. Preverite ponavljanje in tam pritisnite Shrani."
              : action === "file"
                ? "Po prenosu odprite datoteko .ics in potrdite uvoz. Dogodek še ni samodejno shranjen."
                : "Brez dostopa do vašega računa. Dogodek shranite šele s potrditvijo v koledarju."}
          </p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
