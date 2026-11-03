import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import SubscriptionPage from "../pages/SubscriptionPage";
import { addressApiResponse, selectAddress } from "./address-fixtures";

async function saveVerifiedPreferences() {
  const button = await screen.findByRole("button", {name:"Shrani nastavitve"});
  await waitFor(() => expect(button.matches(":disabled")).toBe(false));
  fireEvent.click(button);
}

const preferences = (address = "Verd 1, Vrhnika") => ({ status: "active", address, districtId: "vrhnika", topics: ["water"] });
function show(action = "manage") {
  return render(<MemoryRouter initialEntries={[`/obvestila/narocnina#action=${action}&token=first-token`]}>
    <SubscriptionPage/>
    <Link to="/obvestila/narocnina#action=manage&token=second-token">Open another personal link</Link>
  </MemoryRouter>);
}

it.each(["address", "district", "topic"])("editing the %s clears an earlier saved preferences claim", async field => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => addressApiResponse(url) ?? Response.json(
    JSON.parse(String(init.body)).action === "inspect" ? preferences() : {message:"Preferences saved."},
  )));
  show();
  await saveVerifiedPreferences();
  await screen.findByText("Preferences saved.");
  if (field === "address") fireEvent.change(screen.getByLabelText("Celoten naslov"), {target:{value:"Verd 2, Vrhnika"}});
  if (field === "district") {
    await selectAddress("Celoten naslov", "Borovnica 1, Borovnica");
    expect(screen.getByText("Občina obveščanja: Borovnica.")).toBeTruthy();
  }
  if (field === "topic") fireEvent.click(screen.getByLabelText("Odpadki"));
  expect(screen.queryByText("Preferences saved.")).toBeNull();
});

it.each(["success", "failure"])("a late mutation %s cannot replace another capability's current state or unlock its pending save", async outcome => {
  let finishFirst!: (value: Response) => void;
  let finishSecond!: (value: Response) => void;
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    const addressResponse=addressApiResponse(url); if(addressResponse)return addressResponse;
    const body=JSON.parse(String(init.body));
    if (body.action === "inspect") return Response.json(preferences(body.token === "first-token" ? "Verd 1, Vrhnika" : "Verd 2, Vrhnika"));
    return new Promise<Response>(resolve=>{ if(body.token === "first-token") finishFirst=resolve; else finishSecond=resolve; });
  });
  vi.stubGlobal("fetch", fetcher);
  show();
  await saveVerifiedPreferences();
  fireEvent.click(screen.getByRole("link", {name:"Open another personal link"}));
  await waitFor(()=>expect((screen.getByLabelText("Celoten naslov") as HTMLInputElement).value).toBe("Verd 2, Vrhnika"));
  await saveVerifiedPreferences();
  await act(async()=>finishFirst(Response.json(outcome === "success" ? {message:"Earlier token saved."} : {error:"Earlier token failed."}, {status:outcome === "success" ? 200 : 503})));
  expect(screen.queryByText(/Earlier token/)).toBeNull();
  expect(screen.getByRole("button", {name:"Shrani nastavitve"}).matches(":disabled")).toBe(true);
  expect((screen.getByLabelText("Celoten naslov") as HTMLInputElement).value).toBe("Verd 2, Vrhnika");
  await act(async()=>finishSecond(Response.json({message:"Current token saved."})));
  expect(screen.getByText("Current token saved.")).toBeTruthy();
  expect(screen.getByRole("button", {name:"Shrani nastavitve"}).matches(":disabled")).toBe(false);
});

it("a late confirmation cannot inject its management token or clear a newly opened subscription", async()=>{
  let confirm!: (value:Response)=>void;
  vi.stubGlobal("fetch",vi.fn(async (url:string,init:RequestInit)=>{
    const addressResponse=addressApiResponse(url); if(addressResponse)return addressResponse;
    const body=JSON.parse(String(init.body));
    if(body.action === "inspect")return Response.json(preferences());
    return new Promise<Response>(resolve=>{confirm=resolve;});
  }));
  show("confirm");
  fireEvent.click(await screen.findByRole("button",{name:"Potrdi naročnino"}));
  fireEvent.click(screen.getByRole("link",{name:"Open another personal link"}));
  await screen.findByLabelText("Celoten naslov");
  await act(async()=>confirm(Response.json({message:"Earlier confirmation saved.",manageToken:"earlier-capability"})));
  expect(screen.queryByText("Earlier confirmation saved.")).toBeNull();
  expect(screen.queryByRole("link",{name:"Uredi nastavitve in naslov"})).toBeNull();
  expect(screen.getByLabelText("Celoten naslov")).toBeTruthy();
});

it.each([
  {action:"manage", failure:"503", loadedButton:"Shrani nastavitve"},
  {action:"manage", failure:"network", loadedButton:"Shrani nastavitve"},
  {action:"confirm", failure:"network", loadedButton:"Potrdi naročnino"},
  {action:"unsubscribe", failure:"503", loadedButton:"Odjavi vsa e-obvestila"},
])("retries only inspection of the same $action capability after $failure failure", async ({action,failure,loadedButton})=>{
  const inspections=vi.fn().mockImplementationOnce(async()=>{
    if(failure === "network")throw new TypeError("Failed to fetch");
    return Response.json({error:"Naročnine trenutno niso dosegljive."},{status:503});
  }).mockResolvedValueOnce(Response.json(preferences()));
  const fetcher=vi.fn(async (url:string, init:RequestInit) => addressApiResponse(url) ?? inspections(url,init));
  vi.stubGlobal("fetch",fetcher);
  show(action);
  fireEvent.click(await screen.findByRole("button",{name:"Poskusi znova"}));
  const loaded = await screen.findByRole("button",{name:loadedButton});
  if(action === "manage")await waitFor(()=>expect(loaded.matches(":disabled")).toBe(false));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button",{name:"Poskusi znova"})).toBeNull();
  expect(inspections).toHaveBeenCalledTimes(2);
  for(const [url,init] of fetcher.mock.calls.filter(([url])=>!url.startsWith("/api/addresses"))){
    expect(url).toBe(`/api/subscriptions/${action}`);
    expect(JSON.parse(String(init.body))).toEqual({action:"inspect",token:"first-token"});
  }
});

it("an expired capability keeps new-link guidance instead of offering transient inspection retry",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({error:"Potrditev je potekla. Za novo povezavo ponovno izpolnite prijavo."},{status:400})));
  show("confirm");
  await screen.findByRole("alert");
  expect(screen.queryByRole("button",{name:"Poskusi znova"})).toBeNull();
  expect(screen.getByRole("link",{name:"Nova prijava ali nova potrditvena povezava"}).getAttribute("href")).toBe("/obvestila#narocilo");
});

it("a failed explicit confirmation never becomes an automatic inspection or mutation retry",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json(preferences()))
    .mockResolvedValueOnce(Response.json({error:"Potrditve trenutno ni mogoče shraniti."},{status:503}));
  vi.stubGlobal("fetch",fetcher);
  show("confirm");
  fireEvent.click(await screen.findByRole("button",{name:"Potrdi naročnino"}));
  await screen.findByText("Potrditve trenutno ni mogoče shraniti.");
  expect(screen.queryByRole("button",{name:"Poskusi znova"})).toBeNull();
  expect(screen.getByRole("button",{name:"Potrdi naročnino"}).matches(":disabled")).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
