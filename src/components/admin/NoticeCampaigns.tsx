import { useState } from "react";
import NoticeDelivery from "./NoticeDelivery";
import SubscriberOverview from "./SubscriberOverview";
import type { District } from "./DistrictsEditor";

/** Operations staff can deliver published notices without receiving CMS edit access. */
export default function NoticeCampaigns({
  notices,
  revision,
  csrfToken,
  onRefresh,
  onSessionExpired,
  districts = [],
}: {
  notices: { id: string; title: string; published?: boolean }[];
  revision: number;
  csrfToken: string;
  onRefresh: () => void;
  onSessionExpired?: () => void;
  districts?: District[];
}) {
  const published = notices.filter((notice) => notice.published !== false);
  const [selected, setSelected] = useState("");
  const id = published.some((notice) => notice.id === selected)
    ? selected
    : published[0]?.id || "";
  return (
    <section className="admin-panel" style={{ padding: 24 }}>
      <h2>Pošiljanje objavljenih obvestil</h2>
      <p>
        Izberite objavljeno obvestilo. Pred pošiljanjem preverite območja
        in prejemnike. Spreminjanje besedila je na voljo uredniku vsebin.
      </p>
      <button type="button" className="admin-button" onClick={onRefresh}>
        Osveži objavljena obvestila
      </button>
      {published.length ? (
        <>
          <label className="admin-field">
            <span>Obvestilo za pošiljanje</span>
            <select
              value={id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {published.map((notice) => (
                <option value={notice.id} key={notice.id}>
                  {notice.title}
                </option>
              ))}
            </select>
          </label>
          <NoticeDelivery
            key={id}
            noticeId={id}
            revision={revision}
            csrfToken={csrfToken}
            dirty={false}
            onSessionExpired={onSessionExpired}
          />
        </>
      ) : (
        <p>Ni objavljenih obvestil za pošiljanje. Obvestilo mora najprej objaviti urednik vsebin.</p>
      )}
      <SubscriberOverview
        districts={districts}
        onSessionExpired={onSessionExpired}
      />
    </section>
  );
}
