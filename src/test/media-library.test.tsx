import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import WebsiteEditor, {
  type WebsiteDraft,
} from "../components/admin/WebsiteEditor";
import defaults from "../../shared/site-defaults.json";

it("makes older library images selectable in the unified logo editor", () => {
  let latest = {
    copy: [],
    images: [],
    links: [],
    layout: defaults.layout,
    settings: defaults.settings,
  } as WebsiteDraft;
  const loadMore = vi.fn();
  function Editor() {
    const [value, setValue] = useState(latest),
      [older, setOlder] = useState(false);
    return (
      <WebsiteEditor
        value={value}
        onChange={(next) => {
          latest = next;
          setValue(next);
        }}
        pages={[["/", "Domov"]]}
        media={
          older
            ? [
                { id: "new", url: "/api/media/new", name: "new.png" },
                { id: "old", url: "/api/media/old", name: "old.png" },
              ]
            : [{ id: "new", url: "/api/media/new", name: "new.png" }]
        }
        onUpload={async () => undefined}
        hasMoreMedia={!older}
        onMoreMedia={() => {
          loadMore();
          setOlder(true);
        }}
      />
    );
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "3. Logotip KPV" }));
  fireEvent.click(screen.getByText(/Izberi obstoječo sliko/));
  fireEvent.click(
    screen.getByRole("button", { name: "Naloži starejše slike" }),
  );
  expect(loadMore).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Uporabi old.png" }));
  expect(latest.settings.logoUrl).toBe("/api/media/old");
  expect(
    screen.queryByRole("button", { name: "Naloži starejše slike" }),
  ).toBeNull();
});
