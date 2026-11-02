import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/AdminPage';
import WebsiteEditor, { type WebsiteDraft } from '../components/admin/WebsiteEditor';
import LayoutEditor from '../components/admin/LayoutEditor';
import NoticesEditor, { type EditableNotice } from '../components/admin/NoticesEditor';
import CollectionEditor, { type CollectionData } from '../components/admin/CollectionEditor';
import CemeteryEditor from '../components/admin/CemeteryEditor';
import TariffsEditor from '../components/admin/TariffsEditor';
import type { TariffData } from '../../shared/utility-pricing.js';
import type { CemeteryData } from '../data/cemetery';
import type { CmsLayoutData } from '../../shared/page-layout';
import { validateLayout } from '../../shared/page-layout';
import defaults from '../../shared/site-defaults.json';
import { validateSection } from '../../shared/cms-validation.js';

const message = (data: object) => fireEvent(window, new MessageEvent('message', { origin: location.origin, source: document.querySelector('iframe')!.contentWindow, data }));
const notice = (): EditableNotice => ({ id:'audit-notice',title:'Motnja v Verdu',category:'water',area:'Verd',date:'2026-11-01',summary:'Navodila za občane.',status:'active',latitude:null,longitude:null,published:false,addressRules:['Verd 1, Vrhnika'] });
const block = (id: string, title: string) => ({ id,type:'text' as const,title,text:'Vsebina',links:[],tone:'plain' as const,align:'left' as const,width:'wide' as const,hidden:false });

it('AE01 resets a custom page layout while retaining its identity, title and menu destination',()=>{
  let latest: CmsLayoutData={pages:[{path:'/strani/vprasanja',title:'Vprašanja',blocks:[block('one','Prvi')]}],navigation:[{id:'nav',label:'Vprašanja',url:'/strani/vprasanja',variant:'text'}]};
  function Editor(){const[value,setValue]=useState(latest);return <LayoutEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]}/>;}
  render(<Editor/>);vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.change(screen.getByLabelText('Stran in razporeditev'),{target:{value:'/strani/vprasanja'}});
  fireEvent.click(screen.getByRole('button',{name:'Ponastavi razporeditev te strani'}));
  expect(latest.pages).toEqual([{path:'/strani/vprasanja',title:'Vprašanja',blocks:[]}]);
  expect(latest.navigation[0].url).toBe(latest.pages[0].path);
  expect((screen.getByLabelText('Stran in razporeditev') as HTMLSelectElement).value).toBe('/strani/vprasanja');
});

it('AE02 adds, edits, duplicates, moves, hides and removes independent custom blocks',()=>{
  let latest: CmsLayoutData={pages:[{path:'/strani/audit',title:'Audit',blocks:[block('one','Prvi'),block('two','Drugi')]}],navigation:[]};
  function Editor(){const[value,setValue]=useState(latest);return <LayoutEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]}/>;}
  render(<Editor/>);vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.change(screen.getByLabelText('Stran in razporeditev'),{target:{value:'/strani/audit'}});
  message({type:'kpv-cms-structure',page:'/strani/audit',native:[]});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj razdelek'}));
  fireEvent.change(screen.getByLabelText('Naslov razdelka'),{target:{value:'Tretji'}});
  fireEvent.click(screen.getByRole('button',{name:'Podvoji razdelek'}));
  expect(latest.pages[0].blocks).toHaveLength(4);
  expect(new Set(latest.pages[0].blocks.map(item=>item.id)).size).toBe(4);
  fireEvent.click(screen.getByRole('button',{name:'Premakni 4. Tretji navzgor'}));
  fireEvent.click(screen.getByRole('button',{name:'Skrij razdelek 3'}));
  expect(latest.pages[0].blocks[2].hidden).toBe(true);
  expect(latest.pages[0].blocks[3].hidden).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Odstrani razdelek 3'}));
  expect(latest.pages[0].blocks.map(item=>item.title)).toEqual(['Prvi','Drugi','Tretji']);
});

it('AE03 keeps multiline audience typing intact and displays an external imported draft for the same notice',()=>{
  let latest=[notice()];
  function Editor({imported}:{imported?:EditableNotice[]}){const[value,setValue]=useState(latest);return <NoticesEditor value={imported||value} onChange={next=>{latest=next;setValue(next);}} districts={[]} revision={0} csrfToken="test" dirty canDeliver={false}/>;}
  const view=render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:/Motnja v Verdu/}));
  const field=screen.getByLabelText(/Omejitev na ulice ali hiše/) as HTMLTextAreaElement;
  fireEvent.change(field,{target:{value:'Verd 1, Vrhnika\n\n'}});
  expect(field.value).toBe('Verd 1, Vrhnika\n\n');
  expect(latest[0].addressRules).toEqual(['Verd 1, Vrhnika']);
  view.rerender(<Editor imported={[{...notice(),addressRules:['Verd 12, Vrhnika','Verd 14, Vrhnika']}]}/>);
  expect(field.value).toBe('Verd 12, Vrhnika\nVerd 14, Vrhnika');
});

it('AE04 stable field edits retain legacy fallback and survive tool and branding changes',()=>{
  const stable='a'.repeat(64),legacy='b'.repeat(64);
  let latest:WebsiteDraft={copy:[{page:'/',key:legacy,original:'Izvirnik',value:'Podedovano'}],images:[],links:[],layout:{pages:[],navigation:[]},settings:structuredClone(defaults.settings)};
  function Editor(){const[value,setValue]=useState(latest);return <WebsiteEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]} media={[{id:'logo',url:'/api/media/logo',name:'Logotip'}]} onUpload={async()=>undefined}/>;}
  render(<Editor/>);
  message({type:'kpv-cms-select',kind:'text',page:'/',key:stable,legacyKey:legacy,original:'Izvirnik'});
  expect((screen.getByLabelText('Besedilo') as HTMLTextAreaElement).value).toBe('Podedovano');
  fireEvent.change(screen.getByLabelText('Besedilo'),{target:{value:'Ločeno polje'}});
  expect(latest.copy).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:'3. Logotip KPV'}));
  fireEvent.click(screen.getByRole('button',{name:'Uporabi Logotip'}));
  expect(latest.settings.logoUrl).toBe('/api/media/logo');
  fireEvent.click(screen.getByRole('button',{name:'1. Besedila, slike in povezave'}));
  fireEvent.click(screen.getByRole('button',{name:'Povrni podedovano vsebino'}));
  expect(latest.copy).toHaveLength(1);
  expect(latest.copy[0].value).toBe('Podedovano');
  expect(latest.settings.logoUrl).toBe('/api/media/logo');
});

it('AE05 creates an actual collection area, previews recurrence, adds dates and refuses duplicate holiday dates atomically',()=>{
  let latest:CollectionData={routes:[]};
  function Editor(){const[value,setValue]=useState(latest);return <CollectionEditor value={value} onChange={next=>{latest=next;setValue(next);}}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:'Dodaj območje'}));
  fireEvent.change(screen.getByLabelText('Naziv območja'),{target:{value:'Verd'}});
  fireEvent.change(screen.getByLabelText('Naslovi, ulice ali naselja · eno pravilo v vsako vrstico'),{target:{value:'Verd, Vrhnika'}});
  fireEvent.click(screen.getByRole('button',{name:/Nadaljuj na termine/}));
  fireEvent.change(screen.getByLabelText('Od datuma'),{target:{value:'2027-01-01'}});
  fireEvent.change(screen.getByLabelText('Do vključno'),{target:{value:'2027-01-31'}});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj predogledane termine v osnutek'}));
  expect(latest.routes[0].events.map(item=>item.date)).toEqual(['2027-01-04','2027-01-18']);
  const previous=structuredClone(latest.routes[0].events);
  fireEvent.change(screen.getAllByLabelText('Datum termina')[0],{target:{value:'2027-01-18'}});
  expect(screen.getByRole('alert').textContent).toContain('že termin');
  expect(latest.routes[0].events).toEqual(previous);
});

it('AE06 bulk cemetery onboarding retains identities on sector rename and refuses duplicate batches',()=>{
  let latest:CemeteryData={plan:{width:1000,height:1000,imageUrl:null},graves:[],sectors:[]};
  function Editor(){const[value,setValue]=useState(latest);return <CemeteryEditor value={value} onChange={next=>{latest=next;setValue(next);}}/>;}
  render(<Editor/>);
  fireEvent.change(screen.getByLabelText('Oznaka novega sektorja'),{target:{value:'A'}});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj sektor'}));
  fireEvent.click(screen.getByRole('button',{name:'Dodaj vrsto'}));
  fireEvent.change(screen.getByLabelText('Število novih mest'),{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj grobna mesta'}));
  expect(latest.graves).toHaveLength(3);
  const ids=latest.graves.map(grave=>grave.id);
  fireEvent.change(screen.getByLabelText('Oznaka novega sektorja'),{target:{value:'B'}});
  fireEvent.click(screen.getByRole('button',{name:'Preimenuj izbrani sektor z vpisano oznako'}));
  expect(latest.graves.map(grave=>grave.id)).toEqual(ids);
  expect(latest.graves.every(grave=>grave.section==='B'&&grave.positioned===false)).toBe(true);
  fireEvent.change(screen.getByLabelText('Začetna številka'),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj grobna mesta'}));
  expect(screen.getByRole('alert').textContent).toContain('že obstaja');
  expect(latest.graves).toHaveLength(3);
});

it('AE07 menu editing preserves controlled destinations through reorder, remove and restoring the built-in menu',()=>{
  let latest:CmsLayoutData={pages:[],navigation:[]};
  function Editor(){const[value,setValue]=useState(latest);return <LayoutEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:'Pripravi meni za urejanje'}));
  expect(latest.navigation).toHaveLength(5);
  fireEvent.change(screen.getByLabelText('Naziv povezave v meniju 2'),{target:{value:'Pitna voda'}});
  fireEvent.change(screen.getByLabelText('Cilj povezave v meniju 2'),{target:{value:'/voda'}});
  fireEvent.click(screen.getByRole('button',{name:'Premakni menijsko povezavo 2 navzgor'}));
  expect(latest.navigation[0]).toMatchObject({label:'Pitna voda',url:'/voda'});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj povezavo v meni'}));
  expect(latest.navigation).toHaveLength(6);
  fireEvent.click(screen.getByRole('button',{name:'Odstrani menijsko povezavo 6'}));
  expect(latest.navigation).toHaveLength(5);
  fireEvent.click(screen.getByRole('button',{name:'Povrni izvirni meni'}));
  expect(latest.navigation).toEqual([]);
});

it('AE08 edits selected image metadata and an independent link without dropping text or branding drafts',()=>{
  let latest:WebsiteDraft={copy:[],images:[],links:[],layout:{pages:[],navigation:[]},settings:structuredClone(defaults.settings)};
  function Editor(){const[value,setValue]=useState(latest);return <WebsiteEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]} media={[{id:'picture',url:'/api/media/picture',name:'Fotografija'}]} onUpload={async()=>undefined}/>;}
  render(<Editor/>);
  message({type:'kpv-cms-select',kind:'image',page:'/',key:'c'.repeat(64),original:'/images/ljubljanica.webp',src:'/images/ljubljanica.webp',alt:'Reka'});
  fireEvent.click(screen.getByRole('button',{name:'Uporabi Fotografija'}));
  fireEvent.change(screen.getByLabelText(/Kratek opis slike/),{target:{value:'Ljubljanica v Vrhniki'}});
  expect(latest.images[0]).toMatchObject({url:'/api/media/picture',alt:'Ljubljanica v Vrhniki'});
  fireEvent.change(screen.getByLabelText('Opravilo'),{target:{value:'link'}});
  message({type:'kpv-cms-select',kind:'link',page:'/',key:'d'.repeat(64),original:'/kontakt',url:'/kontakt',label:'Kontakt'});
  fireEvent.change(screen.getByLabelText('Besedilo povezave'),{target:{value:'Povprašajte nas'}});
  fireEvent.change(screen.getByLabelText(/Kam vodi povezava/),{target:{value:'/storitve'}});
  expect(latest.links[0]).toMatchObject({label:'Povprašajte nas',url:'/storitve'});
  expect(latest.images[0].url).toBe('/api/media/picture');
  fireEvent.click(screen.getByRole('button',{name:'Povrni izvirno vsebino'}));
  expect(latest.links).toHaveLength(0);
  expect(latest.images).toHaveLength(1);
});

it('AE09 notice creation, diacritic-insensitive search, publication filtering and cancelled deletion preserve the draft',()=>{
  let latest:EditableNotice[]=[];
  function Editor(){const[value,setValue]=useState(latest);return <NoticesEditor value={value} onChange={next=>{latest=next;setValue(next);}} districts={[]} revision={0} csrfToken="test" dirty canDeliver={false}/>;}
  render(<Editor/>);vi.spyOn(window,'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button',{name:'Dodaj obvestilo'}));
  fireEvent.change(screen.getByLabelText('Naslov obvestila *'),{target:{value:'Čiščenje omrežja'}});
  fireEvent.change(screen.getByLabelText(/Območje \/ prizadeti naslovi/),{target:{value:'Vrhnika'}});
  fireEvent.change(screen.getByLabelText('Poišči obvestilo'),{target:{value:'ciscenje'}});
  expect(screen.getByRole('button',{name:/Čiščenje omrežja/})).toBeTruthy();
  expect(latest[0].published).toBe(false);
  fireEvent.change(screen.getByLabelText('Prikaz'),{target:{value:'published'}});
  expect(screen.queryByRole('button',{name:/Čiščenje omrežja/})).toBeNull();
  fireEvent.click(screen.getByRole('checkbox',{name:/Prikaži na spletni strani/}));
  expect(latest[0].published).toBe(true);
  expect(screen.getByRole('button',{name:/Čiščenje omrežja/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Izbriši'}));
  expect(latest).toHaveLength(1);
});

function persistentEditorBackend(overrides:Record<string,unknown>={}) {
  const published=structuredClone(defaults) as Record<string,unknown>;
  Object.assign(published,structuredClone(overrides));
  const revisions=Object.fromEntries(Object.keys(defaults).map(key=>[key,0]));
  const drafts=new Map<string,object>();
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
    if(input==='/api/admin/session')return Response.json({authenticated:true,csrfToken:'audit',scope:'content',user:{email:'editor@example.test',role:'editor',accessScope:'content'}});
    if(input==='/api/admin/content')return Response.json({sections:published,revisions});
    if(input.startsWith('/api/admin/drafts/')){
      const section=input.split('/').at(-1)!;
      if(init?.method==='PUT'){
        const payload=JSON.parse(String(init.body));
        drafts.set(section,{value:payload.value,baseRevisions:payload.baseRevisions,revision:1,savedAt:Date.now()});
        return Response.json({revision:1,savedAt:Date.now()});
      }
      return Response.json({draft:drafts.get(section)||null});
    }
    if(input.startsWith('/api/admin/content/')&&init?.method==='PUT'){
      const section=input.split('/').at(-1)!,payload=JSON.parse(String(init.body));
      if(payload.revision!==revisions[section])return Response.json({error:'Konflikt različice.'},{status:409});
      published[section]=validateSection(section,payload.value);
      return Response.json({value:published[section],revision:++revisions[section]});
    }
    return Response.json({items:[]});
  }));
  return {published,revisions};
}
const adminView=()=>render(<MemoryRouter><AdminPage/></MemoryRouter>);

it('AE22 edits settings, saves privately, reopens after remount, publishes and reloads the published values',async()=>{
  const backend=persistentEditorBackend();
  let view=adminView();
  // Loading a clean section disables draft save, so wait on its actual field.
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Nastavitve portala'}));
  await screen.findByLabelText('Ime portala');
  fireEvent.change(screen.getByLabelText('Ime portala'),{target:{value:'Komunala – uredniški popravek'}});
  fireEvent.change(screen.getByLabelText('Dežurni telefon'),{target:{value:'041 123 456'}});
  fireEvent.change(screen.getByLabelText('Besedilo v nogi strani'),{target:{value:'Objavljeno uredniško besedilo.'}});
  await waitFor(()=>expect((screen.getByRole('button',{name:'Shrani osnutek'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Shrani osnutek'}));
  await screen.findByText('Osnutek je zasebno shranjen za vaš račun. Javna stran ostaja nespremenjena.');
  expect((backend.published.settings as typeof defaults.settings).siteName).toBe(defaults.settings.siteName);
  view.unmount();view=adminView();
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Nastavitve portala'}));
  fireEvent.click(await screen.findByRole('button',{name:'Odpri shranjeni osnutek'}));
  expect((screen.getByLabelText('Ime portala') as HTMLInputElement).value).toBe('Komunala – uredniški popravek');
  fireEvent.click(screen.getByRole('button',{name:'Shrani in objavi'}));
  await waitFor(()=>expect(backend.revisions.settings).toBe(1));
  await screen.findByText('Spremembe so shranjene in objavljene na spletni strani.');
  view.unmount();adminView();
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Nastavitve portala'}));
  expect((await screen.findByLabelText('Ime portala') as HTMLInputElement).value).toBe('Komunala – uredniški popravek');
  expect((screen.getByLabelText('Dežurni telefon') as HTMLInputElement).value).toBe('041 123 456');
  expect((screen.getByLabelText('Besedilo v nogi strani') as HTMLTextAreaElement).value).toBe('Objavljeno uredniško besedilo.');
});

it('AE23 edits and reorders office hours pairs, privately recovers them, publishes and reloads the same office data',async()=>{
  const backend=persistentEditorBackend();
  let view=adminView();vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Delovni časi'}));
  const name=await screen.findByDisplayValue(defaults.hours[0].name);
  const office=name.closest('details')!;
  fireEvent.change(within(office).getByLabelText('Telefon'),{target:{value:'01 123 45 67'}});
  fireEvent.click(within(office).getByRole('button',{name:'Dodaj vnos'}));
  fireEvent.change(within(office).getAllByLabelText('Dan oziroma dnevi')[1],{target:{value:'Sobota'}});
  fireEvent.change(within(office).getAllByLabelText('Delovni čas')[1],{target:{value:'10.00–12.00'}});
  fireEvent.click(within(office).getByRole('button',{name:'Premakni Vrstice urnika 2 navzgor'}));
  const oldRow=within(office).getByDisplayValue(defaults.hours[0].rows[0][0]).closest('details')!;
  fireEvent.click(within(oldRow).getByRole('button',{name:'Odstrani vnos'}));
  fireEvent.click(within(office).getByRole('button',{name:`Premakni ${defaults.hours[0].name} navzdol`}));
  await waitFor(()=>expect((screen.getByRole('button',{name:'Shrani osnutek'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Shrani osnutek'}));
  await screen.findByText('Osnutek je zasebno shranjen za vaš račun. Javna stran ostaja nespremenjena.');
  expect(backend.published.hours).toEqual(defaults.hours);
  view.unmount();view=adminView();
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Delovni časi'}));
  fireEvent.click(await screen.findByRole('button',{name:'Odpri shranjeni osnutek'}));
  const recoveredOffice=screen.getByDisplayValue(defaults.hours[0].name).closest('details')!;
  expect(within(recoveredOffice).getByDisplayValue('Sobota')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Shrani in objavi'}));
  await waitFor(()=>expect(backend.revisions.hours).toBe(1));
  const saved=backend.published.hours as typeof defaults.hours;
  expect(saved[1]).toMatchObject({name:defaults.hours[0].name,phone:'01 123 45 67',rows:[['Sobota','10.00–12.00']]});
  await screen.findByText('Spremembe so shranjene in objavljene na spletni strani.');
  view.unmount();adminView();
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Delovni časi'}));
  const reloadedOffice=(await screen.findByDisplayValue(defaults.hours[0].name)).closest('details')!;
  expect(within(reloadedOffice).getByDisplayValue('Sobota')).toBeTruthy();
  expect(within(reloadedOffice).getByDisplayValue('10.00–12.00')).toBeTruthy();
});

it.each(['image','buttons','cards','callout','spacer'] as const)('AE12/14 edits and duplicates the %s block while preserving custom page and independent child links',type=>{
  let latest:CmsLayoutData={pages:[{path:'/strani/variant',title:'Izvirni naslov strani',blocks:[]}],navigation:[{id:'nav',label:'Stran',url:'/strani/variant',variant:'text'}]};
  function Editor(){const[value,setValue]=useState(latest);return <LayoutEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]} media={[{id:'image',url:'/api/media/image',name:'Fotografija'}]}/>;}
  render(<Editor/>);
  fireEvent.change(screen.getByLabelText('Stran in razporeditev'),{target:{value:'/strani/variant'}});
  message({type:'kpv-cms-structure',page:'/strani/variant',native:[]});
  fireEvent.change(screen.getByLabelText('Vrsta novega razdelka'),{target:{value:type}});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj razdelek'}));
  fireEvent.change(screen.getByLabelText('Poravnava besedila'),{target:{value:'center'}});
  fireEvent.change(screen.getByLabelText('Širina'),{target:{value:'narrow'}});
  fireEvent.change(screen.getByLabelText('Videz'),{target:{value:'dark'}});
  if(type==='image'){
    fireEvent.click(screen.getByRole('button',{name:'Uporabi Fotografija'}));
    fireEvent.change(screen.getByLabelText('Opis slike'),{target:{value:'Uredniško potrjena fotografija'}});
  }else if(type==='buttons'){
    fireEvent.change(screen.getByLabelText('Besedilo gumba 1'),{target:{value:'Odpadki'}});
    fireEvent.change(screen.getByLabelText('Cilj gumba 1'),{target:{value:'/odpadki'}});
    fireEvent.click(screen.getByRole('button',{name:'Dodaj gumb'}));
    fireEvent.change(screen.getByLabelText('Besedilo gumba 2'),{target:{value:'Voda'}});
    fireEvent.change(screen.getByLabelText('Cilj gumba 2'),{target:{value:'/voda'}});
    fireEvent.click(screen.getByRole('button',{name:'Premakni gumb 2 navzgor'}));
    expect(latest.pages[0].blocks[0].links?.[0].url).toBe('/voda');
    fireEvent.click(screen.getByRole('button',{name:'Odstrani gumb 1'}));
    expect(latest.pages[0].blocks[0].links?.[0]).toMatchObject({label:'Odpadki',url:'/odpadki'});
  }else if(type==='cards'){
    fireEvent.change(screen.getByLabelText('Naslov kartice 1'),{target:{value:'Odpadki'}});
    fireEvent.change(screen.getByLabelText('Cilj povezave kartice 1'),{target:{value:'/odpadki'}});
    fireEvent.click(screen.getByRole('button',{name:'Dodaj kartico'}));
    fireEvent.change(screen.getByLabelText('Naslov kartice 2'),{target:{value:'Voda'}});
    fireEvent.change(screen.getByLabelText('Cilj povezave kartice 2'),{target:{value:'/voda'}});
    fireEvent.click(screen.getByRole('button',{name:'Premakni kartico 2 navzgor'}));
    expect(latest.pages[0].blocks[0].cards?.[0].url).toBe('/voda');
    fireEvent.click(screen.getAllByRole('button',{name:'Odstrani kartico'})[0]);
    expect(latest.pages[0].blocks[0].cards?.[0]).toMatchObject({title:'Odpadki',url:'/odpadki'});
  }else if(type==='callout'){
    fireEvent.change(screen.getByLabelText('Naslov razdelka'),{target:{value:'Nujno obvestilo'}});
    fireEvent.change(screen.getByLabelText(/Besedilo razdelka/),{target:{value:'Prva vrstica.\n\nDrugi odstavek.'}});
    fireEvent.click(screen.getByRole('button',{name:'Dodaj gumb'}));
    fireEvent.change(screen.getByLabelText('Cilj gumba 1'),{target:{value:'/obvestila'}});
  }else{
    fireEvent.change(screen.getByLabelText('Višina razmika'),{target:{value:'large'}});
  }
  const original=structuredClone(latest.pages[0].blocks[0]);
  fireEvent.click(screen.getByRole('button',{name:'Podvoji razdelek'}));
  const copied=latest.pages[0].blocks[1];
  expect(copied.id).not.toBe(original.id);
  expect(copied).toMatchObject({type,align:'center',width:'narrow',tone:'dark'});
  if(original.links){expect(copied.links?.map(item=>item.url)).toEqual(original.links.map(item=>item.url));expect(copied.links?.[0]?.id).not.toBe(original.links[0]?.id);}
  if(original.cards){expect(copied.cards?.map(item=>item.url)).toEqual(original.cards.map(item=>item.url));expect(copied.cards?.[0]?.id).not.toBe(original.cards[0]?.id);}
  expect(latest.pages[0]).toMatchObject({path:'/strani/variant',title:'Izvirni naslov strani'});
  expect(latest.navigation[0].url).toBe('/strani/variant');
  expect(()=>validateLayout(latest,['/'])).not.toThrow();
});

it('AE46 collection pagination reaches older rows and filter changes clear hidden selections without altering dates',()=>{
  let latest:CollectionData={routes:[{id:'audit-route',name:'Verd',addresses:['Verd, Vrhnika'],events:Array.from({length:30},(_,index)=>({id:`event-${index}`,date:`2027-01-${String(index+1).padStart(2,'0')}`,type:index<26?'packaging':'bio',label:index<26?'Embalaža':'BIO'}))}]};
  const original=structuredClone(latest);
  function Editor(){const[value,setValue]=useState(latest);return <CollectionEditor value={value} onChange={next=>{latest=next;setValue(next);}}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:/Termini odvozov/}));
  expect(screen.getAllByLabelText('Datum termina')).toHaveLength(25);
  fireEvent.click(screen.getByRole('checkbox',{name:'Izberi termin Embalaža 2027-01-01'}));
  fireEvent.click(screen.getByRole('button',{name:'Naslednja'}));
  expect(screen.getAllByLabelText('Datum termina')).toHaveLength(5);
  expect(screen.getByText('1 izbranih skupaj')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Filter vrste'),{target:{value:'bio'}});
  expect(screen.getAllByLabelText('Datum termina')).toHaveLength(4);
  expect(screen.getByText('0 izbranih skupaj')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Počisti filtre'}));
  expect(screen.getAllByLabelText('Datum termina')).toHaveLength(25);
  expect((screen.getByRole('checkbox',{name:'Izberi termin Embalaža 2027-01-01'}) as HTMLInputElement).checked).toBe(false);
  expect(latest).toEqual(original);
});

it('AE55 cemetery deletion protects occupied rows and sectors and removes only explicitly emptied structure',()=>{
  let latest:CemeteryData={plan:{width:1000,height:1000,imageUrl:null},sectors:[{name:'A',rows:[1,2]}],graves:[{id:'A-1-1',section:'A',row:1,number:1,x:0,y:0,positioned:false,people:[{name:'Oseba',born:'',died:''}]}]};
  function Editor(){const[value,setValue]=useState(latest);return <CemeteryEditor value={value} onChange={next=>{latest=next;setValue(next);}}/>;}
  render(<Editor/>);vi.spyOn(window,'confirm').mockReturnValue(true);
  expect((screen.getByRole('button',{name:'Odstrani prazno vrsto'}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button',{name:'Odstrani prazen sektor'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Izbrana vrsta'),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Odstrani prazno vrsto'}));
  expect(latest.sectors?.[0].rows).toEqual([1]);
  expect(latest.graves[0].people[0].name).toBe('Oseba');
  fireEvent.click(screen.getByRole('button',{name:/A-1-1/}));
  fireEvent.click(screen.getByRole('button',{name:'Odstrani grob'}));
  expect(latest.graves).toEqual([]);
  fireEvent.click(screen.getByRole('button',{name:'Odstrani prazno vrsto'}));
  expect(latest.sectors?.[0].rows).toEqual([]);
  fireEvent.click(screen.getByRole('button',{name:'Odstrani prazen sektor'}));
  expect(latest.sectors).toEqual([]);
});

it('AE11 rejects blank, malformed and duplicate custom page identities without losing existing content',()=>{
  let latest:CmsLayoutData={pages:[{path:'/strani/existing',title:'Obstoječa stran',blocks:[block('original','Vsebina')]}],navigation:[]};
  const original=structuredClone(latest);
  function Editor(){const[value,setValue]=useState(latest);return <LayoutEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:'Ustvari stran'}));
  expect(screen.getByRole('alert').textContent).toContain('Vnesite naslov');
  expect(latest).toEqual(original);
  fireEvent.change(screen.getByLabelText('Naslov nove strani'),{target:{value:'Nov naslov'}});
  fireEvent.change(screen.getByLabelText('Pot nove strani · /strani/'),{target:{value:'Slab Naslov'}});
  fireEvent.click(screen.getByRole('button',{name:'Ustvari stran'}));
  expect(latest).toEqual(original);
  fireEvent.change(screen.getByLabelText('Pot nove strani · /strani/'),{target:{value:'existing'}});
  fireEvent.click(screen.getByRole('button',{name:'Ustvari stran'}));
  expect(screen.getByRole('alert').textContent).toContain('Ta pot že obstaja');
  expect(latest).toEqual(original);
  fireEvent.change(screen.getByLabelText('Pot nove strani · /strani/'),{target:{value:'nov-naslov'}});
  fireEvent.click(screen.getByRole('button',{name:'Ustvari stran'}));
  expect(latest.pages[0]).toEqual(original.pages[0]);
  expect(latest.pages[1]).toMatchObject({path:'/strani/nov-naslov',title:'Nov naslov'});
});

it('AE43 copied collection areas start without address rules and editing/deleting the copy does not mutate the source',()=>{
  let latest:CollectionData={routes:[{id:'original',name:'Verd',addresses:['Verd, Vrhnika'],events:[{id:'bio-first',type:'bio',date:'2027-01-04',label:'BIO'}]}]};
  const original=structuredClone(latest.routes[0]);
  function Editor(){const[value,setValue]=useState(latest);return <CollectionEditor value={value} onChange={next=>{latest=next;setValue(next);}}/>;}
  render(<Editor/>);const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button',{name:'Kopiraj termine v novo območje'}));
  expect(latest.routes[1].addresses).toEqual([]);
  expect(latest.routes[1].events).toEqual(original.events);
  expect(latest.routes[1].id).not.toBe(original.id);
  fireEvent.change(screen.getByLabelText('Naslovi, ulice ali naselja · eno pravilo v vsako vrstico'),{target:{value:'Sinja Gorica, Vrhnika'}});
  fireEvent.click(screen.getByRole('button',{name:/Termini odvozov/}));
  fireEvent.change(screen.getByLabelText('Datum termina'),{target:{value:'2027-01-05'}});
  expect(latest.routes[0]).toEqual(original);
  expect(latest.routes[1].events[0].date).toBe('2027-01-05');
  fireEvent.click(screen.getByRole('button',{name:/Območje in naslovi/}));
  fireEvent.click(screen.getByRole('button',{name:'Odstrani izbrano območje'}));
  expect(latest.routes).toHaveLength(2);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button',{name:'Odstrani izbrano območje'}));
  expect(latest.routes).toEqual([original]);
});

it('AE25 waste wizard item CRUD, synonym ordering and category edits survive publishing and reload',async()=>{
  const original=structuredClone(defaults.wasteItems[0]);
  const backend=persistentEditorBackend({wasteItems:[original]});
  let view=adminView();vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Čarovnik za odpadke'}));
  await screen.findByDisplayValue(original.name);
  fireEvent.click(screen.getAllByRole('button',{name:'Dodaj vnos'})[0]);
  const name=screen.getAllByLabelText('Ime').at(-1)!;
  fireEvent.change(name,{target:{value:'Tesnilna masa'}});
  const item=name.closest('details')!;
  fireEvent.change(within(item).getByLabelText('Področje'),{target:{value:'nevarni'}});
  fireEvent.click(within(item).getByRole('button',{name:'Dodaj vnos'}));
  fireEvent.change(within(item).getByLabelText('Vrednost'),{target:{value:'Silikon'}});
  fireEvent.click(within(item).getByRole('button',{name:'Dodaj vnos'}));
  fireEvent.change(within(item).getAllByLabelText('Vrednost')[1],{target:{value:'Tesnilo'}});
  fireEvent.click(within(item).getByRole('button',{name:'Premakni Iskalne besede 2 navzgor'}));
  const old=screen.getByDisplayValue(original.name).closest('details')!;
  fireEvent.click(within(old).getAllByRole('button',{name:'Odstrani vnos'})[0]);
  fireEvent.click(screen.getByRole('button',{name:'Shrani in objavi'}));
  await waitFor(()=>expect(backend.revisions.wasteItems).toBe(1));
  expect((backend.published.wasteItems as {name:string;category:string;keywords:string[]}[])[0]).toMatchObject({name:'Tesnilna masa',category:'nevarni',keywords:['Tesnilo','Silikon']});
  await screen.findByText('Spremembe so shranjene in objavljene na spletni strani.');
  view.unmount();view=adminView();
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Čarovnik za odpadke'}));
  expect(await screen.findByDisplayValue('Tesnilna masa')).toBeTruthy();
  expect(screen.getByDisplayValue('Silikon')).toBeTruthy();
});

it('AE25 waste category guidance edits publish without changing its machine identity or other categories',async()=>{
  const backend=persistentEditorBackend();adminView();
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Vrste odpadkov'}));
  const title=await screen.findByDisplayValue(defaults.wasteCategories.embalaza.title);
  const category=title.closest<HTMLElement>('.admin-field-grid')!;
  fireEvent.change(title,{target:{value:'Embalaža – navodila'}});
  fireEvent.change(within(category).getByLabelText('Mesto oddaje'),{target:{value:'Rumeni zabojnik'}});
  fireEvent.change(within(category).getByLabelText('Nasvet za ločevanje'),{target:{value:'Embalažo izpraznite pred oddajo.'}});
  fireEvent.change(within(category).getByLabelText('Barva'),{target:{value:'#aabb22'}});
  fireEvent.click(screen.getByRole('button',{name:'Shrani in objavi'}));
  await waitFor(()=>expect(backend.revisions.wasteCategories).toBe(1));
  const saved=backend.published.wasteCategories as typeof defaults.wasteCategories;
  expect(saved.embalaza).toEqual({title:'Embalaža – navodila',destination:'Rumeni zabojnik',tip:'Embalažo izpraznite pred oddajo.',color:'#aabb22'});
  expect(saved.papir).toEqual(defaults.wasteCategories.papir);
  expect(Object.keys(saved)).toEqual(Object.keys(defaults.wasteCategories));
});

it('AE25 fixed service identities cannot be added/removed while preparation instructions and order remain editable',async()=>{
  const backend=persistentEditorBackend();adminView();vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Komunalne storitve'}));
  const title=await screen.findByDisplayValue(defaults.services[0].title);
  const service=title.closest('details')!;
  fireEvent.click(service.querySelector('summary')!);
  expect(within(service.querySelector('.admin-row-tools')! as HTMLElement).queryByRole('button',{name:'Odstrani vnos'})).toBeNull();
  fireEvent.change(title,{target:{value:'Kosovni odvoz po dogovoru'}});
  const prepare=within(service).getAllByRole('button',{name:'Dodaj vnos'})[0];
  fireEvent.click(prepare);
  const values=within(service).getAllByLabelText('Vrednost');
  fireEvent.change(values.at(-1)!,{target:{value:'Pripravite fotografijo odpadkov.'}});
  fireEvent.click(within(service).getByRole('button',{name:`Premakni Kosovni odvoz po dogovoru navzdol`}));
  fireEvent.click(screen.getByRole('button',{name:'Shrani in objavi'}));
  await waitFor(()=>expect(backend.revisions.services).toBe(1));
  const saved=backend.published.services as typeof defaults.services;
  expect(saved).toHaveLength(defaults.services.length);
  expect(saved[1]).toMatchObject({value:defaults.services[0].value,title:'Kosovni odvoz po dogovoru'});
  expect(saved[1].prepare).toContain('Pripravite fotografijo odpadkov.');
  expect(new Set(saved.map(item=>item.value))).toEqual(new Set(defaults.services.map(item=>item.value)));
});

it('AE59 special-price CRUD keeps category, gross price, unit, VAT and scope together and enforces the catalog capacity',()=>{
  let latest=structuredClone({...defaults.tariffs,servicePrices:[]}) as TariffData;
  function Editor(){const[value,setValue]=useState(latest);return <TariffsEditor value={value} onChange={next=>{latest=next;setValue(next);}} disabled={false}/>;}
  const view=render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:'Dodaj cenovno postavko'}));
  fireEvent.change(screen.getByLabelText('Naziv postavke'),{target:{value:'Najem zabojnika'}});
  fireEvent.change(screen.getByLabelText('Prikaži pri storitvi'),{target:{value:'bulky'}});
  fireEvent.change(screen.getByLabelText('Cena z DDV (€ na enoto)'),{target:{value:'12.5'}});
  fireEvent.change(screen.getByLabelText('Enota'),{target:{value:'dan'}});
  fireEvent.change(screen.getByLabelText('Vključeni DDV (%)'),{target:{value:'22'}});
  fireEvent.change(screen.getByLabelText('Kaj vključuje in kaj se obračuna posebej?'),{target:{value:'Najem za en dan; odvoz in teža odpadkov se obračunata posebej.'}});
  const original=structuredClone(latest.servicePrices[0]);
  fireEvent.click(screen.getByRole('button',{name:'Dodaj cenovno postavko'}));
  fireEvent.click(screen.getAllByRole('button',{name:'Odstrani postavko iz prikaza'})[1]);
  expect(latest.servicePrices).toEqual([original]);
  expect(original).toMatchObject({category:'bulky',priceWithVat:12.5,unit:'dan',vatPercent:22});
  expect(()=>validateSection('tariffs',latest)).not.toThrow();
  const full={...latest,servicePrices:Array.from({length:50},(_,index)=>({...original,id:`price-${index}`}))};
  view.rerender(<TariffsEditor value={full} onChange={()=>{throw Error('Capacity control must block adding another item');}} disabled={false}/>);
  expect((screen.getByRole('button',{name:'Dodaj cenovno postavko'}) as HTMLButtonElement).disabled).toBe(true);
});

it('AE19 a late website upload updates only its original image and retains edits to another image and branding',async()=>{
  let latest:WebsiteDraft={copy:[],images:[],links:[],layout:{pages:[],navigation:[]},settings:structuredClone(defaults.settings)};
  let finish!:(value:{id:string;url:string})=>void;
  const upload=vi.fn(()=>new Promise<{id:string;url:string}>(resolve=>{finish=resolve;}));
  function Editor(){const[value,setValue]=useState(latest);return <WebsiteEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]} media={[]} onUpload={upload}/>;}
  render(<Editor/>);
  message({type:'kpv-cms-select',kind:'image',page:'/',key:'1'.repeat(64),original:'/images/first.webp',src:'/images/first.webp',alt:'Prva'});
  fireEvent.change(screen.getByLabelText(/Naloži in uporabi sliko/),{target:{files:[new File(['png'],'first.png',{type:'image/png'})]}});
  message({type:'kpv-cms-select',kind:'image',page:'/',key:'2'.repeat(64),original:'/images/second.webp',src:'/images/second.webp',alt:'Druga'});
  fireEvent.change(screen.getByLabelText(/Kratek opis slike/),{target:{value:'Novo besedilo druge slike'}});
  fireEvent.click(screen.getByRole('button',{name:'3. Logotip KPV'}));
  fireEvent.change(screen.getByLabelText('Ime podjetja za bralnike zaslona'),{target:{value:'Novo ime logotipa'}});
  await act(async()=>{finish({id:'uploaded',url:'/api/media/uploaded'});});
  expect(latest.images.find(item=>item.key==='1'.repeat(64))?.url).toBe('/api/media/uploaded');
  expect(latest.images.find(item=>item.key==='2'.repeat(64))).toMatchObject({url:'/images/second.webp',alt:'Novo besedilo druge slike'});
  expect(latest.settings.logoAlt).toBe('Novo ime logotipa');
});

it('AE19 a late custom-block upload retains a newly selected block and menu edits instead of replacing their draft',async()=>{
  let latest:CmsLayoutData={pages:[{path:'/strani/upload',title:'Stran',blocks:[{id:'first',type:'image',image:'/images/first.webp',alt:'Prva',tone:'plain',align:'left',width:'wide',hidden:false},{id:'second',type:'image',image:'/images/second.webp',alt:'Druga',tone:'plain',align:'left',width:'wide',hidden:false}]}],navigation:[]};
  let finish!:(value:{url:string})=>void;
  function Editor(){const[value,setValue]=useState(latest);return <LayoutEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]} onUpload={()=>new Promise(resolve=>{finish=resolve;})}/>;}
  render(<Editor/>);
  fireEvent.change(screen.getByLabelText('Stran in razporeditev'),{target:{value:'/strani/upload'}});
  fireEvent.click(screen.getByText('1. Slika').closest('button')!);
  fireEvent.change(screen.getByLabelText('Naloži in uporabi sliko'),{target:{files:[new File(['png'],'first.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByText('2. Slika').closest('button')!);
  fireEvent.change(screen.getByLabelText('Opis slike'),{target:{value:'Popravljena druga slika'}});
  fireEvent.click(screen.getByRole('button',{name:'Pripravi meni za urejanje'}));
  fireEvent.change(screen.getByLabelText('Naziv povezave v meniju 1'),{target:{value:'Moj popravljeni meni'}});
  await act(async()=>{finish({url:'/api/media/new-image'});});
  expect(latest.pages[0].blocks[0].image).toBe('/api/media/new-image');
  expect(latest.pages[0].blocks[1]).toMatchObject({image:'/images/second.webp',alt:'Popravljena druga slika'});
  expect(latest.navigation[0].label).toBe('Moj popravljeni meni');
});

it('AE19 removing a custom image block during upload does not resurrect it when the upload completes',async()=>{
  let latest:CmsLayoutData={pages:[{path:'/strani/upload',title:'Stran',blocks:[{id:'first',type:'image',image:'/images/first.webp',alt:'Prva',tone:'plain',align:'left',width:'wide',hidden:false}]}],navigation:[]};
  let finish!:(value:{url:string})=>void;
  function Editor(){const[value,setValue]=useState(latest);return <LayoutEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]} onUpload={()=>new Promise(resolve=>{finish=resolve;})}/>;}
  render(<Editor/>);vi.spyOn(window,'confirm').mockReturnValue(true);
  fireEvent.change(screen.getByLabelText('Stran in razporeditev'),{target:{value:'/strani/upload'}});
  fireEvent.click(screen.getByText('1. Slika').closest('button')!);
  fireEvent.change(screen.getByLabelText('Naloži in uporabi sliko'),{target:{files:[new File(['png'],'first.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Odstrani razdelek 1'}));
  await act(async()=>{finish({url:'/api/media/new-image'});});
  expect(latest.pages[0].blocks).toEqual([]);
});

it('AE19 the full admin upload displays failure, preserves the image and retries the same file successfully',async()=>{
  persistentEditorBackend();const backendFetch=globalThis.fetch;
  let uploads=0;
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
    if(input==='/api/admin/media'&&init?.method==='POST'){
      uploads++;
      return uploads===1?Response.json({error:'Shramba slik ni dosegljiva.'},{status:503}):Response.json({id:'retry',url:'/api/media/retry',name:'retry.png'},{status:201});
    }
    return backendFetch(input,init);
  }));
  adminView();fireEvent.click(within(await screen.findByRole('navigation')).getByRole('button',{name:'Urejevalnik spletne strani'}));
  await screen.findByRole('heading',{level:1,name:'Urejevalnik spletne strani'});
  message({type:'kpv-cms-select',kind:'image',page:'/',key:'3'.repeat(64),original:'/images/old.webp',src:'/images/old.webp',alt:'Prvotna'});
  const file=new File(['png'],'retry.png',{type:'image/png'});
  fireEvent.change(screen.getByLabelText(/Naloži in uporabi sliko/),{target:{files:[file]}});
  await screen.findByText('Shramba slik ni dosegljiva.');
  expect((screen.getByLabelText('Naslov slike') as HTMLInputElement).value).toBe('/images/old.webp');
  fireEvent.change(screen.getByLabelText(/Naloži in uporabi sliko/),{target:{files:[file]}});
  await waitFor(()=>expect((screen.getByLabelText('Naslov slike') as HTMLInputElement).value).toBe('/api/media/retry'));
  expect(uploads).toBe(2);
});

it('AE19 cemetery plan upload retains the latest dimensions and graves added while the upload is pending',async()=>{
  let latest:CemeteryData={plan:{width:1000,height:1000,imageUrl:null},sectors:[{name:'A',rows:[1]}],graves:[{id:'A-1',section:'A',row:1,number:1,x:0,y:0,positioned:false,people:[]}]};
  let finish!:(value:{url:string})=>void;
  function Editor(){const[value,setValue]=useState(latest);return <CemeteryEditor value={value} onChange={next=>{latest=next;setValue(next);}} onUpload={()=>new Promise(resolve=>{finish=resolve;})}/>;}
  render(<Editor/>);
  fireEvent.change(screen.getByLabelText('Naloži svoj načrt'),{target:{files:[new File(['png'],'plan.png',{type:'image/png'})]}});
  fireEvent.change(screen.getByLabelText('Začetna številka'),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj grobna mesta'}));
  fireEvent.change(screen.getByLabelText('Širina'),{target:{value:'1200'}});
  fireEvent.blur(screen.getByLabelText('Širina'));
  expect(latest.plan.width).toBe(1200);
  await act(async()=>{finish({url:'/api/media/plan'});});
  expect(latest.plan).toMatchObject({width:1200,height:1000,imageUrl:'/api/media/plan'});
  expect(latest.graves).toHaveLength(2);
  expect(latest.graves.every(grave=>grave.positioned===false)).toBe(true);
});

it('AE19 superseded cemetery plan upload cannot overwrite the newer completed upload',async()=>{
  let latest:CemeteryData={plan:{width:1000,height:1000,imageUrl:null},sectors:[],graves:[]};
  const finishes:((value:{url:string})=>void)[]=[];
  function Editor(){const[value,setValue]=useState(latest);return <CemeteryEditor value={value} onChange={next=>{latest=next;setValue(next);}} onUpload={()=>new Promise(resolve=>{finishes.push(resolve);})}/>;}
  render(<Editor/>);
  const input=screen.getByLabelText('Naloži svoj načrt');
  fireEvent.change(input,{target:{files:[new File(['old'],'old.png',{type:'image/png'})]}});
  fireEvent.change(input,{target:{files:[new File(['new'],'new.png',{type:'image/png'})]}});
  await act(async()=>{finishes[1]({url:'/api/media/new-plan'});});
  await act(async()=>{finishes[0]({url:'/api/media/old-plan'});});
  expect(latest.plan.imageUrl).toBe('/api/media/new-plan');
});

it('AE19 a pending brand upload merges with text edited after switching back to content',async()=>{
  let latest:WebsiteDraft={copy:[],images:[],links:[],layout:{pages:[],navigation:[]},settings:structuredClone(defaults.settings)};
  let finish!:(value:{id:string;url:string})=>void;
  function Editor(){const[value,setValue]=useState(latest);return <WebsiteEditor value={value} onChange={next=>{latest=next;setValue(next);}} pages={[[ '/', 'Domov' ]]} media={[]} onUpload={()=>new Promise(resolve=>{finish=resolve;})}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:'3. Logotip KPV'}));
  fireEvent.change(screen.getByLabelText(/Naloži in uporabi sliko/),{target:{files:[new File(['png'],'logo.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('button',{name:'1. Besedila, slike in povezave'}));
  message({type:'kpv-cms-select',kind:'text',page:'/',key:'4'.repeat(64),original:'Prvotni naslov'});
  fireEvent.change(screen.getByLabelText('Besedilo'),{target:{value:'Popravek med nalaganjem logotipa'}});
  await act(async()=>{finish({id:'logo',url:'/api/media/logo'});});
  expect(latest.settings.logoUrl).toBe('/api/media/logo');
  expect(latest.copy[0].value).toBe('Popravek med nalaganjem logotipa');
});

it.each(['website','layout','cemetery'] as const)('AE19 an upload completing after the %s editor unmounts cannot mutate its former draft',async(kind)=>{
  const changed=vi.fn();
  let finish!:(value:{id:string;url:string})=>void;
  const upload=()=>new Promise<{id:string;url:string}>(resolve=>{finish=resolve;});
  let view;
  if(kind==='website'){
    const value:WebsiteDraft={copy:[],images:[],links:[],layout:{pages:[],navigation:[]},settings:structuredClone(defaults.settings)};
    view=render(<WebsiteEditor value={value} onChange={changed} pages={[[ '/', 'Domov' ]]} media={[]} onUpload={upload}/>);
    message({type:'kpv-cms-select',kind:'image',page:'/',key:'5'.repeat(64),original:'/images/original.webp',src:'/images/original.webp',alt:'Slika'});
    fireEvent.change(screen.getByLabelText(/Naloži in uporabi sliko/),{target:{files:[new File(['png'],'image.png',{type:'image/png'})]}});
  }else if(kind==='layout'){
    const value:CmsLayoutData={pages:[{path:'/strani/unmount',title:'Stran',blocks:[{id:'image',type:'image',image:'/images/original.webp',alt:'Slika',tone:'plain',align:'left',width:'wide',hidden:false}]}],navigation:[]};
    view=render(<LayoutEditor value={value} onChange={changed} pages={[[ '/', 'Domov' ]]} onUpload={upload}/>);
    fireEvent.change(screen.getByLabelText('Stran in razporeditev'),{target:{value:'/strani/unmount'}});
    fireEvent.click(screen.getByText('1. Slika').closest('button')!);
    fireEvent.change(screen.getByLabelText('Naloži in uporabi sliko'),{target:{files:[new File(['png'],'image.png',{type:'image/png'})]}});
  }else{
    view=render(<CemeteryEditor value={{plan:{width:1000,height:1000,imageUrl:null},graves:[]}} onChange={changed} onUpload={upload}/>);
    fireEvent.change(screen.getByLabelText('Naloži svoj načrt'),{target:{files:[new File(['png'],'plan.png',{type:'image/png'})]}});
  }
  view.unmount();
  await act(async()=>{finish({id:'late',url:'/api/media/late'});});
  expect(changed).not.toHaveBeenCalled();
});
