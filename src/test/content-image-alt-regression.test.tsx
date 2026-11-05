import {useState} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import ContentBridge from '../content/ContentBridge';
import {contentKey} from '../content/SiteContent';

const bridge = vi.hoisted(()=>({copy:[],images:[] as {page:string;key:string;original:string;url:string;alt:string}[]}));
vi.mock('../content/SiteContent',async()=>{
  const actual=await vi.importActual<typeof import('../content/SiteContent')>('../content/SiteContent');
  return {...actual,useSiteContent:()=>bridge};
});
afterEach(()=>{bridge.images=[];document.getElementById('root')?.remove();});
const frames=()=>act(async()=>{await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));});
function Picture({custom=false}:{custom?:boolean}){
  const[alt,setAlt]=useState('Original description'),[revision,setRevision]=useState(0);
  const [src,setSrc]=useState('/images/original.webp');
  return <><button onClick={()=>{setAlt('Edited accessible description');if(custom)setRevision(n=>n+1);}}>Edit description</button>
    <button onClick={()=>setSrc('/images/new.webp')}>Replace base image</button>
    <span>Revision {revision}</span><section data-cms-custom-block={custom?'true':undefined}><img src={src} alt={alt}/></section></>;
}
function mount(custom=false){
  const root=document.createElement('div');root.id='root';document.body.appendChild(root);
  const tree=()=> <MemoryRouter><Picture custom={custom}/><ContentBridge/></MemoryRouter>;
  return {view:render(tree(),{container:root}),tree};
}

it('retains an edited custom-image alt after unrelated preview mutations and another scan',async()=>{
  mount(true);await frames();
  fireEvent.click(screen.getByRole('button',{name:'Edit description'}));await frames();
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Edited accessible description');
  expect(screen.getByRole('img').getAttribute('src')).toBe('/images/original.webp');
});

it('drops the previous image override when React changes the source alone',async()=>{
  bridge.images=[{page:'/',key:contentKey('/images/original.webp'),original:'/images/original.webp',url:'/images/published.webp',alt:'Old override description'}];
  mount();await frames();
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Old override description');
  fireEvent.click(screen.getByRole('button',{name:'Replace base image'}));await frames();
  expect(screen.getByRole('img').getAttribute('src')).toBe('/images/new.webp');
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Original description');
});

it('preserves a published native-image override and restores the newly edited base description when that override is removed',async()=>{
  bridge.images=[{page:'/',key:contentKey('/images/original.webp'),original:'/images/original.webp',url:'/images/published.webp',alt:'Published description'}];
  const{view,tree}=mount();await frames();
  expect(screen.getByRole('img').getAttribute('src')).toBe('/images/published.webp');
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Published description');
  fireEvent.click(screen.getByRole('button',{name:'Edit description'}));await frames();
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Published description');
  bridge.images=[];view.rerender(tree());await frames();
  expect(screen.getByRole('img').getAttribute('src')).toBe('/images/original.webp');
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Edited accessible description');
});
