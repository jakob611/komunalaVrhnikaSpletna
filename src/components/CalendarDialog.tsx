import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, CalendarDays, Check, Info, X } from "lucide-react";
import { calendarLinks } from "../../shared/calendar-links.js";
import "./calendar.css";

export type CalendarCollectionEvent = {
  id: string;
  date: string;
  type: string;
  label: string;
  color: string;
};
type CalendarChoice = "google" | "apple" | "outlook" | "other";
const names = {
  google: "Google Koledar",
  apple: "Apple Koledar",
  outlook: "Outlook",
  other: "Drug koledar",
};
const labelDate = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const suggestedCalendar = (): CalendarChoice =>
  /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ? "apple" : "google";

export function CalendarDialog({
  event,
  events,
  address,
  routeId,
  onClose,
}: {
  event: CalendarCollectionEvent;
  events: CalendarCollectionEvent[];
  address: string;
  routeId?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const [calendar, setCalendar] = useState<CalendarChoice>(suggestedCalendar),
    [repeat, setRepeat] = useState(false),
    [outlookWork, setOutlookWork] = useState(false),
    [opened, setOpened] = useState(false);
  const links = calendarLinks({ event, address, routeId, outlookWork });
  const series = events.filter((item) => item.type === event.type);
  const destination =
    repeat && links.upcoming ? links.upcoming[calendar] : links.once[calendar];
  const external =
    destination.startsWith("https://calendar.google.com/") ||
    destination.startsWith("https://outlook.");
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
      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href]:not([aria-disabled="true"]),input:not(:disabled),select:not(:disabled),summary',
        ) || [],
      ).filter(
        (element) =>
          !element.closest("details:not([open])") ||
          element.tagName === "SUMMARY",
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
            Izberite svoj koledar in tam potrdite dodajanje.
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
            <legend>Kateri koledar uporabljate?</legend>
            <div className="calendar-destinations">
              {(Object.keys(names) as CalendarChoice[]).map((key) => (
                <label key={key} className={calendar === key ? "selected" : ""}>
                  <input
                    type="radio"
                    name="calendar-destination"
                    checked={calendar === key}
                    onChange={() => {
                      setCalendar(key);
                      setOpened(false);
                    }}
                  />
                  <span>
                    <strong>{names[key]}</strong>
                    <small>
                      {key === "google"
                        ? "Android, iPhone ali računalnik"
                        : key === "apple"
                          ? "iPhone, iPad ali Mac"
                          : key === "outlook"
                            ? "Microsoftov koledar"
                            : "Aplikacija za koledar na napravi"}
                    </small>
                  </span>
                  {calendar === key && <Check size={17} />}
                </label>
              ))}
            </div>
          </fieldset>
          {calendar === "outlook" && (
            <label className="calendar-repeat-toggle">
              <input
                type="checkbox"
                checked={outlookWork}
                onChange={(e) => {
                  setOutlookWork(e.target.checked);
                  setOpened(false);
                }}
              />
              <span>Službeni ali šolski račun Microsoft 365</span>
            </label>
          )}
          <label className="calendar-repeat-toggle">
            <input
              type="checkbox"
              checked={repeat}
              disabled={!links.upcoming}
              onChange={(e) => {
                setRepeat(e.target.checked);
                setOpened(false);
              }}
            />
            <span>
              <strong>Vključi tudi prihodnje odvoze te vrste</strong>
              <small>
                {repeat
                  ? "Koledar bo spremljal objavljene termine in spremembe."
                  : "Brez te izbire dodate samo zgornji datum."}
              </small>
            </span>
          </label>
          {repeat && (
            <details className="calendar-help">
              <summary>Trenutno objavljeni datumi ({series.length})</summary>
              <ul className="calendar-date-list">
                {series.map((item) => (
                  <li key={item.id}>
                    <time dateTime={item.date}>{labelDate(item.date)}</time>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="calendar-demo-note">
            <Info size={17} />
            <p>
              {repeat
                ? "Odvoze dodate kot ločen koledar. Posodabljanje vodi vaša koledarska aplikacija; spremembe se lahko prikažejo z zamikom."
                : "Dogodek se odpre v izbranem koledarju. Pred shranjevanjem preverite datum; posamezna kopija se pozneje ne posodablja samodejno."}
            </p>
          </div>
          <details className="calendar-help">
            <summary>Druga možnost dodajanja</summary>
            <p>
              Če vaša aplikacija povezave ne odpre, lahko uporabite datoteko za
              koledar.
            </p>
            <a
              href={repeat && links.feed ? links.feed : links.once.apple}
              download="kpv-odvozi.ics"
            >
              Prenesi datoteko za koledar
            </a>
          </details>
        </div>
        <footer className="calendar-footer">
          <a
            className="button calendar-primary"
            href={destination}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            onClick={() => setOpened(true)}
          >
            <CalendarDays size={19} />
            {calendar === "other"
              ? "Odpri izbrani koledar"
              : "Odpri " + names[calendar]}
            <ArrowUpRight size={18} />
          </a>
          <p className="calendar-action-note" role="status">
            {opened
              ? "V koledarju potrdite dodajanje. Tukaj s klikom še ne shranimo ničesar v vaš račun."
              : repeat
                ? "Enkrat potrdite dodajanje koledarja s prihodnjimi odvozi."
                : "Dogodek shranite s potrditvijo v svojem koledarju."}
          </p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
