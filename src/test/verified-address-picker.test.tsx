import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
import VerifiedAddressPicker,{type VerifiedAddress} from '../components/VerifiedAddressPicker';
import SubscriptionForm from '../components/SubscriptionForm';
import SubscriptionPage from '../pages/SubscriptionPage';
import {CollectionPage} from '../pages/WastePages';

vi.mock('../components/BotProtection',()=>({default:()=>null,resetProtection:vi.fn()}));
const a:VerifiedAddress={id:'100400000000000012',address:'Verd 12, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika'};
const b:VerifiedAddress={id:'100400000000000014',address:'Verd 14, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika'};
const reply=(addresses:VerifiedAddress[])=>Response.json({addresses,source:{name:'GURS',updatedAt:'2026-11-03T00:00:00Z'},more:false});
function Harness({initial=''}:{initial?:string}){
  const [value,setValue]=useState(initial),[selected,setSelected]=useState<VerifiedAddress|null>(null);
  return <><VerifiedAddressPicker id="test-address" label="Naslov" value={value} onChange={setValue} onSelect={setSelected}/><output data-testid="selected">{selected?.id||'unverified'}</output><button onClick={()=>setValue('Saved alias')}>Use another saved value</button><button onClick={()=>setValue(a.address)}>Use first saved value</button></>;
}
beforeEach(()=>localStorage.clear());

it('requires explicit selection after typing and clears verification immediately after another edit',async()=>{
  const fetcher=vi.fn(async(_url:string)=>reply([a,b]));vi.stubGlobal('fetch',fetcher);render(<Harness/>);
  const input=screen.getByRole('combobox',{name:'Naslov'});
  fireEvent.change(input,{target:{value:'Verd 1'}});
  await screen.findByRole('option',{name:/Verd 12/});
  expect(screen.getByTestId('selected').textContent).toBe('unverified');
  expect(String(fetcher.mock.calls[0][0])).toContain('q=Verd+1');
  fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});
  expect(screen.getByTestId('selected').textContent).toBe(a.id);
  fireEvent.change(input,{target:{value:'Verd 999'}});
  expect(screen.getByTestId('selected').textContent).toBe('unverified');
});

it('ignores an obsolete result after a newer query has completed',async()=>{
  const pending:Array<(response:Response)=>void>=[];
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>pending.push(resolve)));vi.stubGlobal('fetch',fetcher);render(<Harness/>);
  const input=screen.getByRole('combobox',{name:'Naslov'});
  fireEvent.change(input,{target:{value:'Verd 12'}});await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
  fireEvent.change(input,{target:{value:'Verd 14'}});await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
  await act(async()=>pending[1](reply([b])));await screen.findByRole('option',{name:/Verd 14/});
  await act(async()=>pending[0](reply([a])));
  expect(screen.queryByRole('option',{name:/Verd 12/})).toBeNull();
  fireEvent.click(screen.getByRole('option',{name:/Verd 14/}));expect(screen.getByTestId('selected').textContent).toBe(b.id);
});

it('resolves a saved address to its canonical value and retries a temporary inspection failure',async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(reply([a]));vi.stubGlobal('fetch',fetcher);render(<Harness initial="Verd 12"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Poskusi znova'}));
  await waitFor(()=>expect(screen.getByTestId('selected').textContent).toBe(a.id));
  expect((screen.getByRole('combobox',{name:'Naslov'}) as HTMLInputElement).value).toBe(a.address);
  expect(fetcher.mock.calls[1][0]).toContain('address=Verd+12');
  expect(screen.queryByText('Preverjamo naslov …')).toBeNull();
});

it('re-verifies returning to an earlier saved address after another external value',async()=>{
  const fetcher=vi.fn(async(url:string)=>reply(url.includes('Saved')?[b]:[a]));vi.stubGlobal('fetch',fetcher);render(<Harness initial={a.address}/>);
  await waitFor(()=>expect(screen.getByTestId('selected').textContent).toBe(a.id));
  fireEvent.click(screen.getByRole('button',{name:'Use another saved value'}));
  await waitFor(()=>expect(screen.getByTestId('selected').textContent).toBe(b.id));
  fireEvent.click(screen.getByRole('button',{name:'Use first saved value'}));
  await waitFor(()=>expect(screen.getByTestId('selected').textContent).toBe(a.id));
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('does not silently verify a missing saved address',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>reply([])));render(<Harness initial="Unknown 9"/>);
  await screen.findByText(/Naslova ni v prikazanem seznamu/);
  expect(screen.getByTestId('selected').textContent).toBe('unverified');
});

it('submits a selected canonical address and automatic municipality, never arbitrary typed text',async()=>{
  const fetcher=vi.fn(async(url:string,_init?:RequestInit)=>url.startsWith('/api/addresses')?reply([a]):Response.json({message:'Check your email'}));vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter><SubscriptionForm/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Ime in priimek'),{target:{value:'Test resident'}});
  fireEvent.change(screen.getByLabelText('E-poštni naslov'),{target:{value:'resident@example.test'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Odpadki'}));
  fireEvent.click(screen.getByRole('checkbox',{name:/Želim prejemati izbrana/}));
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Verd 12'}});
  expect(screen.getByRole('button',{name:'Pošlji potrditveno povezavo'}).matches(':disabled')).toBe(true);
  fireEvent.click(await screen.findByRole('option',{name:/Verd 12/}));
  expect(screen.queryByRole('combobox',{name:'Območje obveščanja'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Pošlji potrditveno povezavo'}));await screen.findByText('Check your email');
  const submitted=fetcher.mock.calls.find(([url])=>url==='/api/subscriptions');
  const body=JSON.parse(String((submitted?.[1] as RequestInit).body));
  expect(body).toMatchObject({address:a.address,addressId:a.id,districtId:'vrhnika',topics:['waste']});
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Nonsense'}});
  expect(screen.getByRole('button',{name:'Pošlji potrditveno povezavo'}).matches(':disabled')).toBe(true);
  expect(screen.queryByText('Check your email')).toBeNull();
});

it('verifies the remembered collection address before automatically loading its schedule once',async()=>{
  localStorage.setItem('kpv-address','Verd 12');
  const fetcher=vi.fn(async(url:string)=>url.startsWith('/api/addresses')?reply([a]):Response.json({address:a.address,events:[],complete:true}));vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter><CollectionPage/></MemoryRouter>);
  await screen.findByRole('heading',{name:a.address});
  expect(fetcher.mock.calls.filter(([url])=>String(url).startsWith('/api/collection'))).toHaveLength(1);
  expect(localStorage.getItem('kpv-address')).toBe(a.address);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Verd 14'}});
  expect(screen.queryByRole('heading',{name:a.address})).toBeNull();
  expect(screen.getByRole('button',{name:'Prikaži urnik'}).matches(':disabled')).toBe(true);
});

it('keeps explicit unsubscribe usable even when an old address cannot be verified',async()=>{
  const fetcher=vi.fn(async(url:string,init?:RequestInit)=>url.startsWith('/api/addresses')?reply([]):Response.json(JSON.parse(String(init?.body)).action==='inspect'?{status:'active',address:'Old unverified place',districtId:'vrhnika',topics:['water']}:{message:'Unsubscribed'}));vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter initialEntries={['/obvestila/narocnina#action=manage&token=test']}><SubscriptionPage/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Odjavi vsa e-obvestila'}));await screen.findByText('Unsubscribed');
  expect(fetcher.mock.calls.some(([,init])=>init&&JSON.parse(String(init.body)).action==='unsubscribe')).toBe(true);
});

it('resolving a legacy managed address derives its municipality without losing topics edited during the wait',async()=>{
  let resolveAddress!:(value:Response)=>void;
  const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
    if(url.startsWith('/api/addresses'))return new Promise<Response>(resolve=>{resolveAddress=resolve;});
    return Response.json(JSON.parse(String(init?.body)).action==='inspect'?{status:'active',address:a.address,districtId:'borovnica',topics:['water']}:{message:'Preferences saved'});
  });vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter initialEntries={['/obvestila/narocnina#action=manage&token=test']}><SubscriptionPage/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('checkbox',{name:'Odpadki'}));
  expect(screen.getByRole('button',{name:'Shrani nastavitve'}).matches(':disabled')).toBe(true);
  await waitFor(()=>expect(resolveAddress).toBeTypeOf('function'));
  await act(async()=>resolveAddress(reply([a])));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Shrani nastavitve'}).matches(':disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Shrani nastavitve'}));await screen.findByText('Preferences saved');
  const call=fetcher.mock.calls.find(([url,init])=>url==='/api/subscriptions/manage'&&JSON.parse(String(init?.body)).action!=='inspect');
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({address:a.address,addressId:a.id,districtId:'vrhnika',topics:['water','waste']});
});
