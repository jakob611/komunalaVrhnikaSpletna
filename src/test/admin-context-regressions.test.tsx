import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import WebsiteEditor, {
  type WebsiteDraft,
} from "../components/admin/WebsiteEditor";
import NoticeDelivery from "../components/admin/NoticeDelivery";
import defaults from "../../shared/site-defaults.json";

describe("website editor context changes", () => {
  it("still opens a newly created custom page in the shared draft", () => {
    let latest: WebsiteDraft = {
      copy: [],
      images: [],
      links: [],
      layout: defaults.layout,
      settings: defaults.settings,
    };
    function Editor() {
      const [value, setValue] = useState(latest);
      return (
        <WebsiteEditor
          value={value}
          onChange={(next) => {
            latest = next;
            setValue(next);
          }}
          pages={[["/", "Domov"]]}
          media={[]}
          onUpload={async () => undefined}
        />
      );
    }
    render(<Editor />);
    fireEvent.click(
      screen.getByRole("button", { name: "2. Razdelki in meni" }),
    );
    fireEvent.change(screen.getByLabelText("Naslov nove strani"), {
      target: { value: "Pogosta vprašanja" },
    });
    fireEvent.change(screen.getByLabelText("Pot nove strani · /strani/"), {
      target: { value: "pogosta-vprasanja" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ustvari stran" }));
    expect(
      (screen.getByLabelText("Stran in razporeditev") as HTMLSelectElement)
        .value,
    ).toBe("/strani/pogosta-vprasanja");
    expect(
      latest.layout.pages.some(
        (page) => page.path === "/strani/pogosta-vprasanja",
      ),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "1. Besedila, slike in povezave" }),
    );
    expect(
      (screen.getByLabelText("Stran za urejanje") as HTMLSelectElement).value,
    ).toBe("/strani/pogosta-vprasanja");
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe(
      "/strani/pogosta-vprasanja?cms-preview=1",
    );
  });
  it("clears the old page selection after layout navigation while retaining its unsaved change", () => {
    let latest: WebsiteDraft = {
      copy: [],
      images: [],
      links: [],
      layout: defaults.layout,
      settings: defaults.settings,
    };
    function Editor() {
      const [value, setValue] = useState(latest);
      return (
        <WebsiteEditor
          value={value}
          onChange={(next) => {
            latest = next;
            setValue(next);
          }}
          pages={[
            ["/", "Domov"],
            ["/kontakt", "Kontakt"],
          ]}
          media={[]}
          onUpload={async () => undefined}
        />
      );
    }
    render(<Editor />);
    const frame = document.querySelector<HTMLIFrameElement>("iframe")!;
    fireEvent(
      window,
      new MessageEvent("message", {
        origin: location.origin,
        source: frame.contentWindow,
        data: {
          type: "kpv-cms-select",
          kind: "text",
          page: "/",
          key: "a".repeat(64),
          original: "Prvotni naslov",
        },
      }),
    );
    fireEvent.change(screen.getByLabelText("Besedilo"), {
      target: { value: "Neshranjeni popravek" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "2. Razdelki in meni" }),
    );
    fireEvent.change(screen.getByLabelText("Stran in razporeditev"), {
      target: { value: "/kontakt" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "1. Besedila, slike in povezave" }),
    );
    expect(
      (screen.getByLabelText("Stran za urejanje") as HTMLSelectElement).value,
    ).toBe("/kontakt");
    expect(screen.queryByLabelText("Besedilo")).toBeNull();
    expect(latest.copy[0].value).toBe("Neshranjeni popravek");
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe(
      "/kontakt?cms-preview=1",
    );
  });
});

describe("notice audience request context", () => {
  it("ignores an old notice response and keeps the new preview busy until its own response arrives", async () => {
    const responses: ((value: Response) => void)[] = [];
    const fetcher = vi.fn(
      () => new Promise<Response>((resolve) => responses.push(resolve)),
    );
    vi.stubGlobal("fetch", fetcher);
    const view = render(
      <NoticeDelivery
        noticeId="A"
        revision={1}
        csrfToken="test"
        dirty={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preveri prejemnike in dostavo" }),
    );
    view.rerender(
      <NoticeDelivery
        noticeId="B"
        revision={1}
        csrfToken="test"
        dirty={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preveri prejemnike in dostavo" }),
    );
    await act(async () =>
      responses[0](
        Response.json({
          recipients: 99,
          alreadyQueued: false,
          status: null,
          deliveries: {},
        }),
      ),
    );
    expect(
      screen.queryByRole("button", { name: /Potrdi pošiljanje/ }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Preverjamo …",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () =>
      responses[1](
        Response.json({
          recipients: 2,
          alreadyQueued: false,
          status: null,
          deliveries: {},
        }),
      ),
    );
    const confirm = await screen.findByRole("button", {
      name: "Potrdi pošiljanje za 2 naročnikov",
    });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    const options = fetcher.mock.calls[2] as unknown as [string, RequestInit];
    expect(JSON.parse(options[1].body as string)).toEqual({
      noticeId: "B",
      revision: 1,
      preview: false,
    });
  });
  it("invalidates an in-flight preview when its draft changes and ignores a late error", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const view = render(
      <NoticeDelivery
        noticeId="A"
        revision={1}
        csrfToken="test"
        dirty={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preveri prejemnike in dostavo" }),
    );
    view.rerender(
      <NoticeDelivery
        noticeId="A"
        revision={2}
        csrfToken="test"
        dirty={true}
      />,
    );
    await act(async () =>
      resolve(Response.json({ error: "Stara napaka" }, { status: 503 })),
    );
    expect(screen.queryByText("Stara napaka")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Potrdi pošiljanje/ }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Preveri prejemnike in dostavo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    view.rerender(
      <NoticeDelivery
        noticeId="A"
        revision={2}
        csrfToken="test"
        dirty={false}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Preveri prejemnike in dostavo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
