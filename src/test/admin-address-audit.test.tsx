import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import CollectionEditor, { type CollectionData } from '../components/admin/CollectionEditor';

it('collection draft preview refuses a slash address, explains correction and resolves all fractions without publishing',()=>{
  const data:CollectionData={routes:[{id:'verd',name:'Verd',addresses:['Verd, Vrhnika'],events:['bio','packaging','residual'].map(type=>({id:type,type:type as 'bio'|'packaging'|'residual',label:type,date:'2099-12-01'}))}]};
  function Editor(){const[value,setValue]=useState(data);return <CollectionEditor value={value} onChange={setValue}/>;}
  render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:/^3.*Preveri naslov/}));
  const input=screen.getByLabelText('Preizkusni naslov');
  fireEvent.change(input,{target:{value:'Verd 12/1, Vrhnika'}});
  expect(screen.getByRole('alert').textContent).toContain('stanovanje dodajte za vejico');
  expect(screen.getAllByText('Ni ustreznega naslovnega pravila za to vrsto odpadkov.')).toHaveLength(3);
  fireEvent.change(input,{target:{value:'Verd 12, stanovanje 1, 1360 Vrhnika'}});
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('vse tri vrste');
  expect(screen.getAllByText('Verd · 1 prihodnjih terminov')).toHaveLength(3);
  expect(screen.getByText(/Preverjanje uporablja trenutni osnutek/).textContent).toContain('šele po objavi');
});

it('collection editor exposes an imported ambiguous rule before publication and permits replacing it with exact houses',()=>{
  const data:CollectionData={routes:[{id:'verd',name:'Verd',addresses:['Verd 12–14, Vrhnika'],events:[]}]};
  function Editor(){const[value,setValue]=useState(data);return <CollectionEditor value={value} onChange={setValue}/>;}
  render(<Editor/>);
  expect(screen.getByRole('alert').textContent).toContain('ni mogoče objaviti');
  fireEvent.change(screen.getByLabelText(/Naslovi, ulice ali naselja/),{target:{value:'Verd 12, Vrhnika\nVerd 14, Vrhnika'}});
  expect(screen.queryByRole('alert')).toBeNull();
});
