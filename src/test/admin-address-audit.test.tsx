import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CollectionEditor, { type CollectionData } from '../components/admin/CollectionEditor';

afterEach(() => vi.unstubAllGlobals());

it('collection draft preview rejects ambiguous and nonexistent addresses before matching a selected house', async () => {
  const registeredAddress = {id:'100400000155780921',address:'Verd 12, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika'};
  vi.stubGlobal('fetch',vi.fn(async (url: string) => {
    const query = new URL(url, 'http://localhost').searchParams.get('q');
    if (query === 'Verd 12/1, Vrhnika') {
      return Response.json({error:'Vnesite eno hišno številko. Stanovanje navedite za vejico.'}, {status:400});
    }
    return Response.json({addresses:query === 'Verd 12, stanovanje 1, 1360 Vrhnika' ? [registeredAddress] : []});
  }));
  const data:CollectionData={routes:[{id:'verd',name:'Verd',addresses:['Verd, Vrhnika'],events:['bio','packaging','residual'].map(type=>({id:type,type:type as 'bio'|'packaging'|'residual',label:type,date:'2099-12-01'}))}]};
  function Editor(){const[value,setValue]=useState(data);return <CollectionEditor value={value} onChange={setValue}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:/^3.*Preveri naslov/}));
  const input=screen.getByRole('combobox',{name:'Preizkusni naslov'});
  fireEvent.change(input,{target:{value:'Verd 12/1, Vrhnika'}});
  expect((await screen.findByRole('alert')).textContent).toContain('Stanovanje navedite za vejico');
  expect(screen.queryByText(/Urnik za ta naslov je delni/)).toBeNull();
  fireEvent.change(input,{target:{value:'Verd 999999, Vrhnika'}});
  await screen.findByText(/Naslova ni v prikazanem seznamu/);
  expect(screen.queryByText(/Naslov je razporejen/)).toBeNull();
  fireEvent.change(input,{target:{value:'Verd 12, stanovanje 1, 1360 Vrhnika'}});
  const option=await screen.findByRole('option',{name:/Verd 12, Vrhnika/});
  expect(screen.queryByText(/Naslov je razporejen/)).toBeNull();
  fireEvent.click(option);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText(/Naslov je razporejen za vse tri vrste/)).toBeTruthy();
  expect(screen.getAllByText('Verd · 1 prihodnjih terminov')).toHaveLength(3);
  expect(screen.getByText(/Preverjanje uporablja trenutni osnutek/).textContent).toContain('šele po objavi');
  fireEvent.change(input,{target:{value:'Verd 999999, Vrhnika'}});
  expect(screen.queryByText(/Naslov je razporejen/)).toBeNull();
});

it('collection editor exposes an imported ambiguous rule before publication and permits replacing it with exact houses',()=>{
  const data:CollectionData={routes:[{id:'verd',name:'Verd',addresses:['Verd 12–14, Vrhnika'],events:[]}]};
  function Editor(){const[value,setValue]=useState(data);return <CollectionEditor value={value} onChange={setValue}/>;}
  render(<Editor/>);
  expect(screen.getByRole('alert').textContent).toContain('ni mogoče objaviti');
  fireEvent.change(screen.getByLabelText(/Naslovi, ulice ali naselja/),{target:{value:'Verd 12, Vrhnika\nVerd 14, Vrhnika'}});
  expect(screen.queryByRole('alert')).toBeNull();
});
