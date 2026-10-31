import {
  CmsLayout,
  CmsLink as Link,
  CmsAnchor,
  CustomCmsPage,
} from "./content/PageComposer";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import PageMotion from "./components/PageMotion";
import ContentBridge from "./content/ContentBridge";
import { CmsPageImage, useSiteContent, telephone } from "./content/SiteContent";
import {mapAddressUrl} from '../shared/location.js';
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Droplets,
  ExternalLink,
  Flower2,
  Leaf,
  MapPin,
  Menu,
  Phone,
  Recycle,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trees,
  Truck,
  Waves,
  X,
} from "lucide-react";

const waste = () => import("./pages/WastePages");
const services = () => import("./pages/ServicePages");
const WasteMapPage = lazy(() =>
  waste().then((m) => ({ default: m.WasteMapPage })),
);
const WasteWizardPage = lazy(() =>
  waste().then((m) => ({ default: m.WasteWizardPage })),
);
const CollectionPage = lazy(() =>
  waste().then((m) => ({ default: m.CollectionPage })),
);
const NoticesPage = lazy(() =>
  services().then((m) => ({ default: m.NoticesPage })),
);
const RoadsPage = lazy(() =>
  services().then((m) => ({ default: m.RoadsPage })),
);
const ReportPage = lazy(() =>
  services().then((m) => ({ default: m.ReportPage })),
);
const ServicesPage = lazy(() =>
  services().then((m) => ({ default: m.ServicesPage })),
);
const MarketPage = lazy(() =>
  services().then((m) => ({ default: m.MarketPage })),
);
const CalculatorPage = lazy(() =>
  services().then((m) => ({ default: m.CalculatorPage })),
);
const DepoPage = lazy(() => services().then((m) => ({ default: m.DepoPage })));
const ContactPage = lazy(() =>
  services().then((m) => ({ default: m.ContactPage })),
);
const AboutPage = lazy(() =>
  services().then((m) => ({ default: m.AboutPage })),
);
const CemeteryPage = lazy(() => import("./pages/CemeteryPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));

const links = [
  {
    label: "Odpadki",
    to: "/odpadki",
    items: [
      ["Urnik odvoza", "/odpadki/urnik"],
      ["Kam z odpadkom?", "/odpadki/kam-z-odpadki"],
      ["Zbirna mesta in centri", "/odpadki/lokacije"],
      ["Kosovni odvoz", "/storitve?service=bulky"],
    ],
  },
  {
    label: "Voda in odvajanje",
    to: "/voda",
    items: [
      ["Oskrba s pitno vodo", "/voda"],
      ["Obvestila o oskrbi", "/obvestila?category=water"],
      ["Praznjenje greznic", "/storitve?service=septic"],
    ],
  },
  {
    label: "Javni prostor",
    to: "/javni-prostor",
    items: [
      ["Ceste in zapore", "/ceste"],
      ["Prijavite težavo", "/prijavi"],
      ["Javna razsvetljava", "/prijavi?category=lighting"],
      ["Pokopališče – poiščite grob", "/pokopalisce"],
    ],
  },
  {
    label: "Storitve",
    to: "/storitve",
    items: [
      ["Naročilo storitve", "/storitve"],
      ["Tržnica Vrhnika", "/trznica"],
      ["Ceniki in obračun", "/kalkulator"],
      ["DEPO – ponovna uporaba", "/depo"],
    ],
  },
  {
    label: "O podjetju",
    to: "/o-podjetju",
    items: [
      ["Spoznajte komunalo", "/o-podjetju"],
      ["Kontakti", "/kontakt"],
    ],
  },
];

const searchable = [
  [
    "Urnik odvoza odpadkov",
    "Poiščite naslednji odvoz za svoj naslov",
    "/odpadki/urnik",
  ],
  [
    "Kam z odpadkom?",
    "Čarovnik za pravilno ločevanje",
    "/odpadki/kam-z-odpadki",
  ],
  [
    "Zbirna mesta in centri",
    "Ekološki otoki, baterije, tekstil in elektronika",
    "/odpadki/lokacije",
  ],
  ["Obvestila in motnje", "Voda, odpadki, ceste in e-obvestila", "/obvestila"],
  ["Ceste in zapore", "Dela na cestah in poškodovana vozišča", "/ceste"],
  [
    "Prijavite težavo",
    "Luč, cesta, zabojnik ali druga infrastruktura",
    "/prijavi",
  ],
  [
    "Naročite storitev",
    "Kosovni odvoz, greznica in druge storitve",
    "/storitve",
  ],
  [
    "Tržnica Vrhnika",
    "Preverite termine in pošljite povpraševanje za prodajno mesto",
    "/trznica",
  ],
  [
    "Ceniki in obračun",
    "Preverite veljavne cene za svojo občino",
    "/kalkulator",
  ],
  ["DEPO", "Predmeti z zgodbo in ponovna uporaba", "/depo"],
  ["Kontakt", "Telefoni, e-pošta in lokacija podjetja", "/kontakt"],
  [
    "Pokopališče",
    "Iskanje pokojnikov, grobov in interaktivni načrt pokopališča",
    "/pokopalisce",
  ],
  [
    "Pitna voda in odvajanje",
    "Oskrba, vodomer, računi, plačila, e-račun in greznice",
    "/voda",
  ],
  ["Moj dom", "Shranjeni naslov, moji odvozi in obvestila", "/moj-dom"],
  [
    "Odpadki in ločevanje",
    "Vse informacije o zbiranju in odvozu odpadkov",
    "/odpadki",
  ],
  ["Javni prostor", "Ceste, javne površine in razsvetljava", "/javni-prostor"],
  [
    "O podjetju",
    "Komunalno podjetje Vrhnika in območja delovanja",
    "/o-podjetju",
  ],
  [
    "Zasebnost in dostopnost",
    "Osebni podatki in delovanje portala",
    "/zasebnost",
  ],
  ["Začetna stran", "Domov in najpogostejša opravila", "/"],
];

function Logo() {
  const { settings } = useSiteContent();
  return (
    <Link className="brand" to="/" aria-label={`${settings.siteName} – domov`}>
      {settings.logoUrl ? (
        <img
          className="cms-brand-image"
          src={settings.logoUrl}
          alt={settings.logoAlt}
        />
      ) : (
        <>
          <span className="brand-symbol">
            <Leaf size={27} />
            <Waves size={25} />
          </span>
          <span>
            {settings.siteName === "Komunala Vrhnika" ? (
              <>
                komunala<span>VRHNIKA</span>
              </>
            ) : (
              settings.siteName
            )}
          </span>
        </>
      )}
    </Link>
  );
}

function readSavedAddress() {
  try {
    return localStorage.getItem("kpv-address") || "";
  } catch {
    return "";
  }
}
function saveHomeAddress(address: string) {
  try {
    localStorage.setItem("kpv-address", address);
  } catch {
    /* Address persistence is optional. */
  }
}
function forgetHomeAddress() {
  try {
    localStorage.removeItem("kpv-address");
  } catch {
    /* Storage may be disabled. */
  }
}
function SiteSearch({ close }: { close: () => void }) {
  const { layout } = useSiteContent();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".search-dialog input,.search-dialog button,.search-dialog a",
          ),
        );
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [close]);
  const normalize = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const results =
    query.trim().toLowerCase() === "/admin"
      ? [["Upravljanje portala", "Prijava za skrbnika", "/admin"]]
      : [
          ...searchable,
          ...layout.pages
            .filter((p) => p.path.startsWith("/strani/"))
            .map((p) => [p.title, "Vsebinska stran", p.path]),
        ].filter((v) =>
          normalize(query)
            .trim()
            .split(/\s+/)
            .every((word) => normalize(v[0] + " " + v[1]).includes(word)),
        );
  return (
    <div className="search-overlay" onClick={close}>
      <section
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Iskanje po portalu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-input-row">
          <Search />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kaj želite urediti?"
            aria-label="Iskalni niz"
          />
          <button
            className="icon-button"
            onClick={close}
            aria-label="Zapri iskanje"
          >
            <X />
          </button>
        </div>
        <p className="search-caption">
          {query ? `${results.length} zadetkov` : "Priljubljene poti"}
        </p>
        <div className="search-results">
          {results.length ? (
            results.map(([title, desc, to]) => (
              <Link key={to} to={to} onClick={close}>
                <span>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
                <ArrowUpRight size={19} />
              </Link>
            ))
          ) : (
            <p className="empty-state">
              Ni zadetkov. Poskusite »odvoz«, »voda« ali »kontakt«.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Header() {
  const { settings, layout } = useSiteContent();
  const navigation = layout.navigation.length
    ? layout.navigation.map((item) => ({
        label: item.label,
        to: item.url,
        items: [] as string[][],
      }))
    : links;
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const location = useLocation();
  useEffect(() => {
    setMobile(false);
    setSearch(false);
    setExpanded(null);
  }, [location]);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".primary-nav")
      )
        setExpanded(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>Vaša komunala. Vaš vsakdan.</span>
          <div>
            <CmsAnchor href={`tel:${telephone(settings.phone)}`}>
              <Phone size={12} />
              {settings.phone}
            </CmsAnchor>
            <Link to="/obvestila">
              <Bell size={12} />
              Obvestila
            </Link>
            <Link to="/kontakt">
              Kontakt
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav
            className={`${mobile ? "primary-nav is-open" : "primary-nav"}${layout.navigation.length ? " custom-nav" : ""}`}
            aria-label="Glavna navigacija"
          >
            {navigation.map((nav, index) => (
              <div
                className={`nav-group${expanded === nav.label ? " is-expanded" : ""}`}
                key={nav.label}
                onPointerEnter={(event) => {
                  if (
                    event.pointerType === "mouse" &&
                    window.matchMedia("(min-width: 951px) and (hover: hover)")
                      .matches
                  )
                    setExpanded(nav.label);
                }}
                onPointerLeave={(event) => {
                  if (
                    event.pointerType === "mouse" &&
                    !event.currentTarget.contains(document.activeElement)
                  )
                    setExpanded(null);
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setExpanded((current) =>
                      current === nav.label ? null : current,
                    );
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setExpanded(null);
                    event.currentTarget
                      .querySelector<HTMLButtonElement>(".nav-expand")
                      ?.focus();
                  }
                }}
              >
                {layout.navigation.length ? (
                  <Link to={nav.to}>{nav.label}</Link>
                ) : (
                  <NavLink to={nav.to}>{nav.label}</NavLink>
                )}
                {!!nav.items.length && (
                  <button
                    type="button"
                    className="nav-expand"
                    aria-label={`Možnosti: ${nav.label}`}
                    aria-expanded={expanded === nav.label}
                    aria-controls={`nav-dropdown-${index}`}
                    onClick={() =>
                      setExpanded(expanded === nav.label ? null : nav.label)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setExpanded(nav.label);
                        const group = event.currentTarget.parentElement;
                        requestAnimationFrame(() =>
                          group
                            ?.querySelector<HTMLAnchorElement>(
                              ".nav-dropdown a",
                            )
                            ?.focus(),
                        );
                      }
                    }}
                  >
                    <ChevronDown size={13} />
                  </button>
                )}
                <div className="nav-dropdown" id={`nav-dropdown-${index}`}>
                  {nav.items.map(([label, to]) => (
                    <Link key={to} to={to}>
                      {label}
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button search-toggle"
              onClick={() => {
                setMobile(false);
                setSearch(true);
              }}
              aria-label="Išči po portalu"
            >
              <Search size={21} />
            </button>
            <Link
              to="/moj-dom"
              className="home-button"
              aria-label="Moj dom – naslov in odvozi"
            >
              <MapPin size={16} />
              <span>Moj dom</span>
            </Link>
            <button
              className="icon-button menu-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label={mobile ? "Zapri meni" : "Odpri meni"}
              aria-expanded={mobile}
            >
              {mobile ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {search && <SiteSearch close={() => setSearch(false)} />}
    </>
  );
}

function Home() {
  const navigate = useNavigate();
  const [address, setAddress] = useState(() => readSavedAddress());
  const [notices, setNotices] = useState<
    {
      id: string;
      title: string;
      category: string;
      area: string;
      date: string;
      summary: string;
    }[]
  >([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/notices", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => setNotices(d.notices.slice(0, 3)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const shortcuts = [
    {
      icon: CalendarDays,
      label: "Kdaj odpeljete odpadke?",
      desc: "Urnik odvoza za vaš naslov",
      to: "/odpadki/urnik",
      color: "green",
    },
    {
      icon: Recycle,
      label: "Kam s tem odpadkom?",
      desc: "Pomoč pri pravilnem ločevanju",
      to: "/odpadki/kam-z-odpadki",
      color: "lime",
    },
    {
      icon: MapPin,
      label: "Kje je zbirno mesto?",
      desc: "Zbirni centri in ekološki otoki",
      to: "/odpadki/lokacije",
      color: "blue",
    },
    {
      icon: Truck,
      label: "Potrebujem storitev",
      desc: "Kosovni odvoz, greznice in več",
      to: "/storitve",
      color: "orange",
    },
  ];
  return (
    <CmsLayout>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            SKUPAJ ZA NAŠ KRAJ
          </div>
          <h1>
            Čisto okolje.
            <br />
            Boljši <span>vsakdan.</span>
          </h1>
          <p>
            Za vse, kar vaš dom in naš kraj potrebujeta.
            <br className="desktop-break" /> Uredite preprosto, na enem mestu.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/odpadki/urnik">
              Moj urnik odvoza
              <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" to="/storitve">
              Vse storitve
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-community">
            <span className="community-icon">
              <Trees size={18} />
            </span>
            <span>Tu za Vrhniko, Borovnico in Log – Dragomer.</span>
          </div>
        </div>
        <div className="hero-visual">
          <img
            src="/images/ljubljanica.webp"
            alt="Zelena pokrajina in vijugasta struga Ljubljanice"
            fetchPriority="high"
          />
          <div className="image-grain" />
          <div className="hero-photo-label">
            <MapPin size={14} />
            Naš kraj. Naša odgovornost.
          </div>
          <div className="floating-eco">
            <span>
              <Sprout size={23} />
            </span>
            <div>
              <strong>
                Majhna dejanja.
                <br />
                Velike spremembe.
              </strong>
              <small>Za zeleno prihodnost naših krajev.</small>
            </div>
          </div>
          <CmsAnchor
            className="hero-circle"
            href="#opravila"
            aria-label="Poglej najpogostejša opravila"
          >
            <ArrowDown size={21} />
          </CmsAnchor>
        </div>
      </section>
      <section
        id="opravila"
        className="container quick-section"
        aria-label="Najpogostejša opravila"
      >
        <div className="section-overline">KAKO VAM LAHKO POMAGAMO?</div>
        <div className="quick-grid">
          {shortcuts.map(({ icon: Icon, label, desc, to, color }, i) => (
            <Link
              key={to}
              className="quick-card"
              to={to}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className={`quick-icon ${color}`}>
                <Icon size={23} />
              </div>
              <ArrowUpRight className="quick-arrow" size={19} />
              <h2>{label}</h2>
              <p>{desc}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="container home-address">
        <div className="address-heading">
          <span className="round-icon">
            <MapPin size={23} />
          </span>
          <div>
            <h2>Vaš naslov. Vaše informacije.</h2>
            <p>Odvozi in obvestila, ki zadevajo vaš dom.</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveHomeAddress(address);
            navigate("/moj-dom");
          }}
        >
          <label className="sr-only" htmlFor="home-address">
            Vaš naslov
          </label>
          <MapPin size={18} />
          <input
            id="home-address"
            required
            minLength={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Vnesite ulico, hišno številko in kraj"
          />
          <button type="submit" aria-label="Prikaži podatke za naslov">
            <ArrowRight size={21} />
          </button>
        </form>
      </section>
      <section className="container home-notices">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DOBRO JE VEDETI</span>
            <h2>
              Aktualno v vašem kraju

            </h2>
          </div>
          <Link className="text-link" to="/obvestila">
            Vsa obvestila
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="notices-grid">
          {notices.length ? (
            notices.map((n) => (
              <Link
                to={`/obvestila#${n.id}`}
                className="notice-preview"
                key={n.id}
              >
                <div className="notice-meta">
                  <span className={`notice-category ${n.category}`}>
                    {n.category === "water" ? (
                      <Droplets size={13} />
                    ) : n.category === "roads" ? (
                      <Trees size={13} />
                    ) : (
                      <Recycle size={13} />
                    )}{" "}
                    {n.category === "water"
                      ? "OSKRBA Z VODO"
                      : n.category === "roads"
                        ? "CESTE IN ZAPORE"
                        : "ODPADKI"}
                  </span>
                  <span>
                    {new Date(n.date).toLocaleDateString("sl-SI", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <h3>{n.title}</h3>
                <p>{n.summary}</p>
                <div className="notice-bottom">
                  <span>
                    <MapPin size={13} />
                    {n.area}
                  </span>
                  <ArrowUpRight size={18} />
                </div>
              </Link>
            ))
          ) : (
            <div className="panel notice-unavailable">
              <Bell size={24} />
              <h3>Obvestila za vaš kraj</h3>
              <p>Preverite objavljena obvestila.</p>
              <Link className="text-link" to="/obvestila">
                Odpri obvestila
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>
      <section className="home-services-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">VEDNO BLIZU VAS</span>
              <h2>Vse za urejen dom in okolje.</h2>
            </div>
            <p>
              Prava pot do storitve.
              <br />
              Brez odvečnega iskanja.
            </p>
          </div>
          <div className="service-overview-grid">
            {[
              {
                icon: Recycle,
                title: "Odpadki in ločevanje",
                text: "Manj odpadkov. Več priložnosti za naš planet.",
                to: "/odpadki",
                links: "Urniki · Zbirna mesta · Ločevanje",
              },
              {
                icon: Droplets,
                title: "Voda in odvajanje",
                text: "Skrb za vodo se začne z zanesljivo oskrbo.",
                to: "/voda",
                links: "Pitna voda · Greznice · Obvestila",
              },
              {
                icon: Trees,
                title: "Naš javni prostor",
                text: "Urejene poti in varnejše ulice za vse.",
                to: "/javni-prostor",
                links: "Ceste · Razsvetljava · Prijava težav",
              },
            ].map(({ icon: Icon, title, text, to, links }) => (
              <Link to={to} className="service-overview" key={to}>
                <Icon size={30} strokeWidth={1.4} />
                <h3>{title}</h3>
                <p>{text}</p>
                <div>
                  {links}
                  <ArrowUpRight size={19} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="container depo-banner">
        <div className="depo-art" aria-hidden="true">
          <span>
            depo<span>↗</span>
          </span>
          <small>NOVA ZGODBA. ISTI PREDMET.</small>
          <div className="depo-ring" />
        </div>
        <div className="depo-copy">
          <span className="eyebrow">PONOVNA UPORABA</span>
          <h2>
            Nekomu odveč.
            <br />
            Vam ravno prav.
          </h2>
          <p>
            Dobri predmeti si zaslužijo novo priložnost. Odkrijte DEPO, našo
            trgovino ponovne uporabe.
          </p>
          <Link className="text-link" to="/depo">
            Spoznajte DEPO
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="container help-strip">
        <span className="round-icon">
          <Phone size={23} />
        </span>
        <div>
          <h2>Včasih je najlažje poklicati.</h2>
          <p>Tu smo, da skupaj najdemo odgovor.</p>
        </div>
        <CmsAnchor className="text-link" href="tel:+38617502960">
          01 750 29 60
          <ArrowUpRight size={20} />
        </CmsAnchor>
        <Link className="button secondary" to="/kontakt">
          Vsi kontakti
          <ArrowRight size={17} />
        </Link>
      </section>
    </CmsLayout>
  );
}

function CategoryPage({ kind }: { kind: "waste" | "water" | "public" }) {
  const data = {
    waste: {
      eyebrow: "ODPADKI IN LOČEVANJE",
      title: "Vsak odpadek ima svoje mesto.",
      intro:
        "Poiščite datum odvoza, najbližje zbirno mesto ali odgovor, kam odložiti odpadek.",
      icon: Recycle,
      cards: [
        [
          "Urnik odvoza",
          "Preverite objavljene termine za svoj naslov.",
          "/odpadki/urnik",
          CalendarDays,
        ],
        [
          "Kam z odpadkom?",
          "Od baterije do embalaže. Poiščite pravo pot za svoj odpadek.",
          "/odpadki/kam-z-odpadki",
          Recycle,
        ],
        [
          "Zbirna mesta",
          "Raziščite zemljevid in odprite pot v Google Zemljevidih.",
          "/odpadki/lokacije",
          MapPin,
        ],
        [
          "Naročite kosovni odvoz",
          "Oddajte povpraševanje za odvoz večjih predmetov.",
          "/storitve?service=bulky",
          Truck,
        ],
      ],
    },
    water: {
      eyebrow: "VODA IN ODVAJANJE",
      title: "Za vodo, ki ji zaupamo.",
      intro:
        "Informacije o oskrbi, odvajanje odpadne vode in storitve za vaše gospodinjstvo.",
      icon: Droplets,
      cards: [
        [
          "Obvestila o oskrbi",
          "Objavljena dela in motnje na vodovodnem omrežju.",
          "/obvestila?category=water",
          Bell,
        ],
        [
          "Greznice in male čistilne naprave",
          "Oddajte povpraševanje za praznjenje in čiščenje.",
          "/storitve?service=septic",
          Truck,
        ],
        [
          "Prijavite težavo",
          "Opozorite na puščanje ali drugo težavo na javni infrastrukturi.",
          "/prijavi?category=other",
          Droplets,
        ],
        [
          "Stanje vodomera in računi",
          "Obstoječi uporabniški portal za podatke vašega odjemnega mesta.",
          "https://www.komunala.info",
          ExternalLink,
        ],
      ],
    },
    public: {
      eyebrow: "JAVNI PROSTOR",
      title: "Lepši kraj se začne z nami.",
      intro:
        "Pregled del na cestah in preprosta prijava težav, ki jih opazite na poti.",
      icon: Trees,
      cards: [
        [
          "Ceste in zapore",
          "Objavljena dela, zapore in prijave poškodb vozišča.",
          "/ceste",
          MapPin,
        ],
        [
          "Prijavite poškodovano cesto",
          "Priložite lokacijo in fotografijo opažene poškodbe.",
          "/prijavi?category=roads",
          Trees,
        ],
        [
          "Javna razsvetljava",
          "Sporočite, katera svetilka ne sveti.",
          "/prijavi?category=lighting",
          Sparkles,
        ],
        [
          "Poškodovan zabojnik",
          "Oddajte prijavo s fotografijo in opisom.",
          "/prijavi?category=bins",
          Recycle,
        ],
        [
          "Pokopališče",
          "Informacije in kontakti za pokopališko dejavnost.",
          "/pokopalisce",
          Flower2,
        ],
      ],
    },
  }[kind];
  return (
    <div className="container inner-page">
      <CmsLayout>
        <div className="page-intro">
          <span className="eyebrow">{data.eyebrow}</span>
          <h1>{data.title}</h1>
          <p>{data.intro}</p>
        </div>
        <div className="category-grid">
          {data.cards.map(([title, desc, to, Icon]) => {
            const Component = Icon as typeof Recycle;
            const content = (
              <>
                <span className="quick-icon green">
                  <Component size={26} />
                </span>
                <h2>{String(title)}</h2>
                <p>{String(desc)}</p>
                <ArrowUpRight className="category-arrow" />
              </>
            );
            return String(to).startsWith("https") ? (
              <CmsAnchor
                className="panel category-card"
                key={String(to)}
                href={String(to)}
                target="_blank"
                rel="noreferrer"
              >
                {content}
              </CmsAnchor>
            ) : (
              <Link
                className="panel category-card"
                key={String(to)}
                to={String(to)}
              >
                {content}
              </Link>
            );
          })}
        </div>
        {kind === "water" && (
          <div className="notice water-note">
            <ShieldCheck />
            <div>
              <strong>Potrebujete nujno pomoč?</strong>
              <p>
                Za nujne težave z vodovodom ali kanalizacijo pokličite dežurno
                službo{" "}
                <CmsAnchor href="tel:+38641364681">041 364 681</CmsAnchor>.
                Za nujne primere ne uporabljajte obrazca.
              </p>
            </div>
          </div>
        )}
      </CmsLayout>
    </div>
  );
}

function MyHome() {
  const [address, setAddress] = useState(() => readSavedAddress());
  const [saved, setSaved] = useState(() => readSavedAddress());
  const [events, setEvents] = useState<
    { date: string; label: string; color: string }[]
  >([]);
  const [error, setError] = useState("");
  const [scheduleWarning, setScheduleWarning] = useState("");
  const [loading, setLoading] = useState(!!saved);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setEvents([]);
    setError("");
    setScheduleWarning("");
    if (!saved) {
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    fetch("/api/collection?address=" + encodeURIComponent(saved), {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Naslova ni mogoče prikazati.");
        if (!Array.isArray(d.events))
          throw Error("Prejetega urnika ni mogoče prikazati. Poskusite znova.");
        return d;
      })
      .then((d) => {
        if (active) {
          setEvents(d.events.slice(0, 3));
          setScheduleWarning(d.complete === false ? d.message || "Urnik je delno določen. Preverite vse vrste odpadkov v celotnem urniku." : "");
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e.name === "AbortError"
              ? "Urnik se ni pravočasno naložil. Preverite povezavo in poskusite znova."
              : e instanceof TypeError
                ? "Urnika ni mogoče naložiti. Preverite internetno povezavo."
                : e.message,
          );
          setEvents([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
        window.clearTimeout(timer);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [saved, attempt]);
  return (
    <div className="container inner-page">
      <CmsLayout>
        <div className="page-intro">
          <span className="eyebrow">VAŠE OSEBNO IZHODIŠČE</span>
          <h1>Moj dom.</h1>
          <p>
            Vaš naslov si zapomnimo v tem brskalniku. Prijava in uporabniški
            račun nista potrebna.
          </p>
        </div>
        <form
          className="panel address-setting"
          onSubmit={(e) => {
            e.preventDefault();
            saveHomeAddress(address);
            setEvents([]);
            setError("");
            setLoading(true);
            setSaved(address.trim());
            setAttempt((previous) => previous + 1);
          }}
        >
          <label className="field">
            Naslov vašega doma
            <input
              required
              minLength={3}
              maxLength={250}
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Tržaška cesta 1, Vrhnika"
            />
          </label>
          <button className="button">
            Shrani naslov
            <Check size={17} />
          </button>
          {saved && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                forgetHomeAddress();
                setSaved("");
                setAddress("");
                setEvents([]);
              }}
            >
              Pozabi naslov
              <X size={15} />
            </button>
          )}
        </form>
        {saved && (
          <>
            <div className="section-heading">
              <h2>
                Naslednji odvozi{" "}

              </h2>
              <Link className="text-link" to="/odpadki/urnik">
                Celoten urnik
                <ArrowRight size={17} />
              </Link>
            </div>
            {scheduleWarning && !loading && !error && <div className="notice" role="status"><span>{scheduleWarning}</span><Link to="/odpadki/urnik">Preveri celoten urnik</Link></div>}
            {loading ? (
              <div className="notice" role="status">
                <span className="loading-spinner" />
                Nalagam odvoze za naslov {saved} …
              </div>
            ) : error ? (
              <div className="notice" role="alert">
                <span>{error}</span>
                <button
                  className="button secondary"
                  onClick={() => setAttempt((previous) => previous + 1)}
                >
                  Poskusi znova
                </button>
              </div>
            ) : events.length ? (
              <div className="card-grid">
                {events.map((ev, i) => (
                  <div className="panel my-event" key={i}>
                    <CalendarDays style={{ color: ev.color }} />
                    <span>
                      {new Date(ev.date).toLocaleDateString("sl-SI", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    <h3>{ev.label}</h3>
                    <small>Objavljeni datum odvoza</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice">
                Za ta naslov trenutno ni prikazanih terminov. Preverite naslov
                ali odprite celoten urnik.
              </div>
            )}
          </>
        )}
        <div className="category-grid my-home-links">
          <Link className="panel category-card" to="/obvestila#narocilo">
            <Bell />
            <h2>Obvestila za moj dom</h2>
            <p>
              Prijavite se na e-obvestila za svoje območje in naslov.
            </p>
            <ArrowUpRight className="category-arrow" />
          </Link>
          <Link className="panel category-card" to="/prijavi">
            <MapPin />
            <h2>Sporočite nam težavo</h2>
            <p>Prijavite poškodbo infrastrukture v svoji okolici.</p>
            <ArrowUpRight className="category-arrow" />
          </Link>
        </div>
      </CmsLayout>
    </div>
  );
}

function Privacy() {
  return (
    <div className="container inner-page prose-page">
      <CmsLayout>
        <div className="page-intro">
          <span className="eyebrow">PODATKI IN ZASEBNOST</span>
          <h1>Zasebnost in dostopnost.</h1>
          <p>Kako obdelujemo podatke in uporabljamo zunanje storitve.</p>
        </div>
        <section className="panel">
          <h2>Vaši podatki</h2>
          <p>
            Naslov v razdelku Moj dom se shrani samo v lokalni pomnilnik tega
            brskalnika. Izbrišete ga z gumbom »Pozabi naslov«. Analitičnih in
            oglaševalskih piškotkov ne uporabljamo.
          </p>
          <h2>Obrazci in obravnava oddaj</h2><p>Vnesene podatke in fotografije shranimo za obravnavo vaše oddaje. Dostop imajo prijavljeni skrbniki portala. E-poštno obvestilo s podatki oddaje pošljemo nastavljenemu skrbniku prek Resend. Oddaja povpraševanja ali prijave na tržnico še ne potrjuje izvedbe ali termina in ne izvede plačila. Za vprašanja o podatkih in zahtevo za izbris pišite skrbniku portala na tomincjakob@gmail.com ter navedite referenco oddaje. Zahteve glede portala trenutno obravnava njegov skrbnik.</p>
          <h2>Naročnina na e-obvestila</h2><p>Po prijavi pošljemo potrditveno povezavo. Šele po potrditvi uporabimo izbrano območje, naslov in teme za ciljno dostavo obvestil prek Resend. Osebna povezava v sporočilu omogoča spremembo nastavitev in odjavo. Po odjavi nove dostave ustavimo; že dostavljenih sporočil iz vašega predala ne moremo odstraniti. Za izbris evidenc pišite skrbniku portala.</p><h2>Zunanji ponudniki</h2>
          <p>
            Interaktivni zemljevidi nalagajo kartografske ploščice
            OpenStreetMap, pri čemer ponudnik prejme vaš IP-naslov. Povezave do
            Google Zemljevidov, Google Koledarja, uradne komunale in DEPO
            odprejo zunanje storitve z lastnimi pravili zasebnosti.
          </p>
          <p>
            Oddaje obrazcev varuje Cloudflare Turnstile. Za varnostno
            preverjanje Cloudflare obdeluje tehnične podatke o brskalniku in
            naslov IP.
            Vnesena vsebina in varnostni žeton se ne zapisujeta v javne
            dnevnike; žetona ne hranimo med oddanimi sporočili. Podatke iz
            javnih obrazcev za dostavo e-poštnega obvestila obdeluje Resend,
            prejemnik pa je nastavljeni skrbnik portala. Fotografije hranimo zasebno v
            Cloudflare R2 ter jih prek Resend pošljemo skrbniku portala kot
            priponke k prijavi.
          </p>
          <h2>Dostopnost</h2>
          <p>
            Portal podpira upravljanje s tipkovnico, preskok na vsebino,
            označena polja in zmanjšano gibanje. Zemljevid dopolnjujejo
            besedilni seznami lokacij. Za težave pri dostopu do vsebine uporabite kontaktni obrazec.
          </p>
          <Link className="text-link" to="/kontakt">
            Kontakti podjetja
            <ArrowRight size={17} />
          </Link>
        </section>
      </CmsLayout>
    </div>
  );
}

function Footer() {
  const { settings } = useSiteContent();
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <Logo />
          <p>{settings.footerText}</p>
          <span>
            <MapPin size={14} />
            Vrhnika · Borovnica · Log – Dragomer
          </span>
        </div>
        <div>
          <h3>Za vaš vsakdan</h3>
          <Link to="/odpadki/urnik">Urnik odvoza</Link>
          <Link to="/odpadki/kam-z-odpadki">Kam z odpadkom?</Link>
          <Link to="/odpadki/lokacije">Zbirna mesta</Link>
          <Link to="/storitve">Naročite storitev</Link>
        </div>
        <div>
          <h3>Naš kraj</h3>
          <Link to="/obvestila">Obvestila in motnje</Link>
          <Link to="/ceste">Ceste in zapore</Link>
          <Link to="/prijavi">Prijavite težavo</Link>
          <Link to="/trznica">Tržnica Vrhnika</Link>
          <Link to="/pokopalisce">Pokopališče</Link>
        </div>
        <div>
          <h3>Ostanimo povezani</h3>
          <CmsAnchor href={`tel:${telephone(settings.phone)}`}>
            {settings.phone}
            <ArrowUpRight size={13} />
          </CmsAnchor>
          <CmsAnchor href={`mailto:${settings.email}`}>
            {settings.email}
            <ArrowUpRight size={13} />
          </CmsAnchor>
          <CmsAnchor href={mapAddressUrl(settings.address)||'/kontakt'} target="_blank" rel="noreferrer">{settings.address}</CmsAnchor>
          <Link to="/kontakt">
            Vsi kontakti
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} · Komunala Vrhnika
        </span>
        <div>
          <Link to="/zasebnost">Zasebnost in dostopnost</Link>
          <CmsAnchor href="https://www.kpv.si" target="_blank" rel="noreferrer">
            Uradna spletna stran
            <ArrowUpRight size={12} />
          </CmsAnchor>
        </div>
      </div>
    </footer>
  );
}

function ScrollManager() {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    const changed = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (location.hash) {
      let anchor = location.hash.slice(1);
      try {
        anchor = decodeURIComponent(anchor);
      } catch {
        /* Keep malformed fragments harmless. */
      }
      let frame = 0;
      const reveal = () => {
        const target = document.getElementById(anchor);
        if (!target) return;
        observer.disconnect();
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() =>
          target.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
          }),
        );
      };
      const observer = new MutationObserver(reveal);
      observer.observe(document.body, { childList: true, subtree: true });
      reveal();
      const timer = setTimeout(() => observer.disconnect(), 5000);
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        observer.disconnect();
      };
    }
    window.scrollTo(0, 0);
    if (changed)
      document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);
  return null;
}

export default function App() {
  const location = useLocation();
  const { layout } = useSiteContent();
  const admin = location.pathname.replace(/\/+$/, "") === "/admin";
  useEffect(() => {
    const match = searchable.find((v) => v[2] === location.pathname);
    document.title =
      (location.pathname === "/"
        ? "Skupaj za lepši vsakdan"
        : location.pathname === "/admin"
          ? "Upravljanje portala"
          : layout.pages.find((p) => p.path === location.pathname)?.title ||
            match?.[0] ||
            "Vaša komunala") + " · Komunala Vrhnika";
  }, [location.pathname, layout]);
  return (
    <>
      <CmsAnchor className="skip-link" href="#main">
        Preskoči na vsebino
      </CmsAnchor>
      <ScrollManager />
      {!admin && <Header />}
      {!admin && <PageMotion />}
      <ContentBridge />
      <main id="main" tabIndex={-1}>
        {!admin && location.pathname !== "/" && (
          <div className="container breadcrumbs">
            <Link to="/">Domov</Link>
            <span>/</span>
            <span>
              {searchable.find((s) => s[2] === location.pathname)?.[0] ||
                {
                  "/odpadki": "Odpadki",
                  "/voda": "Voda in odvajanje",
                  "/javni-prostor": "Javni prostor",
                  "/moj-dom": "Moj dom",
                  "/o-podjetju": "O podjetju",
                  "/zasebnost": "Zasebnost in dostopnost",
                }[location.pathname] ||
                layout.pages.find((p) => p.path === location.pathname)?.title ||
                "Stran"}
            </span>
          </div>
        )}
        {!admin && <CmsPageImage page={location.pathname} />}
        <Suspense
          fallback={
            <div className="container loading-state" role="status">
              <span className="loading-spinner" />
              Pripravljamo vsebino …
            </div>
          }
        >
          <Routes>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/" element={<Home />} />
            <Route path="/odpadki" element={<CategoryPage kind="waste" />} />
            <Route path="/voda" element={<CategoryPage kind="water" />} />
            <Route
              path="/javni-prostor"
              element={<CategoryPage kind="public" />}
            />
            <Route
              path="/odpadki/urnik"
              element={
                <div className="container inner-page">
                  <CollectionPage />
                </div>
              }
            />
            <Route
              path="/odpadki/kam-z-odpadki"
              element={
                <div className="container inner-page">
                  <WasteWizardPage />
                </div>
              }
            />
            <Route
              path="/odpadki/lokacije"
              element={
                <div className="container inner-page">
                  <WasteMapPage />
                </div>
              }
            />
            <Route
              path="/obvestila"
              element={
                <div className="container inner-page">
                  <NoticesPage />
                </div>
              }
            />
            <Route
              path="/ceste"
              element={
                <div className="container inner-page">
                  <RoadsPage />
                </div>
              }
            />
            <Route
              path="/prijavi"
              element={
                <div className="container inner-page">
                  <ReportPage />
                </div>
              }
            />
            <Route
              path="/storitve"
              element={
                <div className="container inner-page">
                  <ServicesPage />
                </div>
              }
            />
            <Route
              path="/trznica"
              element={
                <div className="container inner-page">
                  <MarketPage />
                </div>
              }
            />
            <Route
              path="/kalkulator"
              element={
                <div className="container inner-page">
                  <CalculatorPage />
                </div>
              }
            />
            <Route
              path="/depo"
              element={
                <div className="container inner-page">
                  <DepoPage />
                </div>
              }
            />
            <Route
              path="/pokopalisce"
              element={
                <div className="container inner-page">
                  <CemeteryPage />
                </div>
              }
            />
            <Route
              path="/kontakt"
              element={
                <div className="container inner-page">
                  <ContactPage />
                </div>
              }
            />
            <Route
              path="/o-podjetju"
              element={
                <div className="container inner-page">
                  <AboutPage />
                </div>
              }
            />
            <Route path="/moj-dom" element={<MyHome />} />
            <Route path="/zasebnost" element={<Privacy />} />
            <Route path="/obvestila/narocnina" element={<SubscriptionPage />} />
            <Route path="*" element={<CustomCmsPage />} />
          </Routes>
        </Suspense>
      </main>
      {!admin && <Footer />}
    </>
  );
}
