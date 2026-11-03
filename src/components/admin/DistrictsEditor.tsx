import SubscriberOverview from "./SubscriberOverview";
export type District = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};
export default function DistrictsEditor({
  value,
  onChange,
  disabled = false,
  canViewSubscribers = true,
  onSessionExpired,
}: {
  value: District[];
  onChange: (next: District[]) => void;
  disabled?: boolean;
  canViewSubscribers?: boolean;
  onSessionExpired?: () => void;
}) {
  function patch(id: string, change: Partial<District>) {
    onChange(value.map((d) => (d.id === id ? { ...d, ...change } : d)));
  }
  return (
    <section>
      <div className="notice-editor-guide">
        <h2>Območja e-obveščanja</h2>
        <p>
          Občino novega naročnika določimo po izbranem naslovu iz uradnega
          registra. Za posamezne ulice ali hiše pri obvestilu izberite občino
          in dodajte prizadete naslove, vsak naslov v svojo vrstico.
        </p>
        <p>
          Opis je pojasnilo za urednike, ne pravilo za razvrščanje naslovov.
          Dodatna območja ohranijo morebitne stare naročnike; nove prijave se
          razvrščajo samo v tri občine. Območja niso povezana v hierarhijo.
        </p>
        <p>
          Obstoječega območja ne preimenujte v drug kraj: naročniki so vezani
          nanj. Umaknjena območja ne sprejemajo novih prijav in ne prejmejo
          novih obvestil.
        </p>
      </div>
      <fieldset disabled={disabled} style={{ display: "grid", gap: 16 }}>
        {value.map((d) => (
          <article className="admin-panel" style={{ padding: 20 }} key={d.id}>
            <label className="admin-field">
              <span>Naziv območja</span>
              <input
                maxLength={160}
                value={d.name}
                onChange={(e) => patch(d.id, { name: e.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Kateri naslovi sodijo sem?</span>
              <textarea
                maxLength={600}
                rows={2}
                value={d.description}
                onChange={(e) => patch(d.id, { description: e.target.value })}
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={d.active}
                onChange={(e) => patch(d.id, { active: e.target.checked })}
              />
              Aktivno za obveščanje{["vrhnika", "borovnica", "log-dragomer"].includes(d.id) ? " in nove prijave" : " obstoječih naročnikov"}
            </label>
          </article>
        ))}
        <button
          type="button"
          className="admin-button"
          disabled={value.length >= 100}
          onClick={() =>
            onChange([
              ...value,
              {
                id: `obmocje-${crypto.randomUUID()}`,
                name: "Novo območje",
                description: "",
                active: true,
              },
            ])
          }
        >
          Dodaj območje obveščanja
        </button>
      </fieldset>
      {canViewSubscribers && (
        <SubscriberOverview
          districts={value}
          onSessionExpired={onSessionExpired}
        />
      )}
    </section>
  );
}
