import {useState} from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import NoticesEditor,{type EditableNotice} from '../components/admin/NoticesEditor';
import CollectionEditor,{type CollectionData} from '../components/admin/CollectionEditor';
import {matchesNotice,validateDeliveryFields} from '../../shared/notification-rules.js';

afterEach(() => vi.unstubAllGlobals());

it('the notice editor keeps a few-house OR-list when all active districts are selected',()=>{
  let latest:EditableNotice={id:'local-house-audit',title:'Dve hiši',category:'water',area:'Opis za objavo',date:'2026-11-02',summary:'Synthetic editor-only audit.',status:'active',latitude:null,longitude:null,published:true,districtIds:['vrhnika'],addressRules:[]};
  const districts=['vrhnika','verd','borovnica'].map(id=>({id,name:id,description:'Local area',active:true}));
  function Editor(){const[value,setValue]=useState([latest]);return <NoticesEditor value={value} onChange={next=>{latest=next[0];setValue(next);}} districts={districts} revision={1} csrfToken="local-only" dirty canDeliver={false}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:/Dve hiši/}));
  fireEvent.change(screen.getByLabelText(/Omejitev na ulice ali hiše/),{target:{value:'Verd 12, Vrhnika\n\nVerd 14, Vrhnika\n'}});
  fireEvent.click(screen.getByLabelText('Vsa aktivna območja obveščanja'));
  expect(latest.allDistricts).toBe(true);
  expect(latest.area).toBe('Opis za objavo');
  expect(validateDeliveryFields(latest).addressRules).toEqual(['Verd 12, Vrhnika','Verd 14, Vrhnika']);
  const subscriber={status:'active',districtId:'verd',topics:['water']};
  expect(matchesNotice({...subscriber,address:'Verd 14, Vrhnika'},latest)).toBe(true);
  for(const address of ['Verd 13, Vrhnika','Verd 12a, Vrhnika','Verd 12, Ljubljana'])expect(matchesNotice({...subscriber,address},latest)).toBe(false);
});

it('collection draft preview matches listed houses and excludes a verified unlisted neighbor',async()=>{
  const registeredAddresses=[
    {id:'100400000155780921',address:'Verd 12, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika'},
    {id:'100400000184889651',address:'Verd 13, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika'},
    {id:'100400000155781143',address:'Verd 14, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika'},
  ];
  vi.stubGlobal('fetch',vi.fn(async () => Response.json({addresses:registeredAddresses})));
  const data:CollectionData={routes:[{id:'two-houses',name:'Dve hiši',addresses:['Verd 12, Vrhnika','Verd 14, Vrhnika'],events:['bio','packaging','residual'].map(type=>({id:type,type:type as 'bio'|'packaging'|'residual',label:type,date:'2099-12-01'}))}]};
  function Editor(){const[value,setValue]=useState(data);return <CollectionEditor value={value} onChange={setValue}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:/^3.*Preveri naslov/}));
  const input=screen.getByRole('combobox',{name:'Preizkusni naslov'});
  fireEvent.change(input,{target:{value:'Verd 13, Vrhnika'}});
  fireEvent.click(await screen.findByRole('option',{name:/Verd 13, Vrhnika/}));
  expect(screen.getAllByText('Ni ustreznega naslovnega pravila za to vrsto odpadkov.')).toHaveLength(3);
  for (const number of [12,14]) {
    fireEvent.change(input,{target:{value:`Verd ${number}`}});
    fireEvent.click(await screen.findByRole('option',{name:new RegExp(`Verd ${number}, Vrhnika`)}));
    expect(screen.getByText(/Naslov je razporejen za vse tri vrste/)).toBeTruthy();
    expect(screen.getAllByText('Dve hiši · 1 prihodnjih terminov')).toHaveLength(3);
  }
});
