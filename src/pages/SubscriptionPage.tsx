import { useEffect,useState,type FormEvent } from 'react';
import { useSiteContent } from '../content/SiteContent';
import { useSearchParams,Link } from 'react-router-dom';

type Preferences={status?:string;address:string;districtId:string;topics:string[]};
export default function SubscriptionPage() {
  const [params]=useSearchParams(),{districts}=useSiteContent();
  const token=params.get('token')||'',action=params.get('action')==='confirm'?'confirm':'manage';
  const [value,setValue]=useState<Preferences|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function request(method='GET',data:Record<string,unknown>={}) {
    const response=await fetch(`/api/subscriptions/${action}?token=${encodeURIComponent(token)}`,{method,cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body:method==='POST'?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Zahteva ni uspela.');return result;
  }
  useEffect(()=>{let active=true;setError('');void request().then(data=>{if(active)setValue(data);}).catch(cause=>{if(active)setError(cause.message);});return()=>{active=false;};},[token,action]);
  async function save(event:FormEvent,unsubscribe=false) {
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try{const data=await request('POST',unsubscribe?{action:'unsubscribe'}:{...value});setMessage(data.message);if(unsubscribe||action==='confirm')setValue(null);}
    catch(cause){setError(cause instanceof Error?cause.message:'Zahteva ni uspela.');}finally{setBusy(false);}
  }
  return <div className="container inner-page"><header className="page-intro"><span className="eyebrow">E-OBVESTILA KPV</span><h1>{action==='confirm'?'Potrdite naročnino.':'Vaša e-obvestila.'}</h1><p>Povezava je osebna. Ne posredujte je drugim.</p></header><section className="panel" style={{maxWidth:720}}>
    {error&&<p className="svc-error" role="alert">{error}</p>}{message&&<p className="svc-success" role="status">{message}</p>}
    {!value&&!error&&!message&&<p role="status">Nalagamo nastavitve …</p>}
    {value&&(action==='confirm'?<form onSubmit={save}><p>Območje: <strong>{districts.find(d=>d.id===value.districtId)?.name||value.districtId}</strong></p><p>Naslov: {value.address}</p><p>Po potrditvi boste prejemali izbrane teme za ta naslov.</p><button className="button" disabled={busy}>{busy?'Potrjujemo …':'Potrdi naročnino'}</button></form>:<form onSubmit={save}><p>Stanje: {value.status==='active'?'Potrjena naročnina':value.status==='unsubscribed'?'Odjavljena naročnina':'Naročnina še ni aktivna'}</p>
      <fieldset disabled={busy||value.status!=='active'} style={{border:0,padding:0}}><label className="field"><span>Območje</span><select value={value.districtId} onChange={e=>setValue({...value,districtId:e.target.value})}>{districts.filter(d=>d.active||d.id===value.districtId).map(d=><option key={d.id} value={d.id}>{d.name}{d.active?'':' (umaknjeno)'}</option>)}</select></label><label className="field"><span>Celoten naslov</span><input required minLength={3} maxLength={250} value={value.address} onChange={e=>setValue({...value,address:e.target.value})}/></label>
      <fieldset className="svc-topics"><legend>Teme obveščanja</legend>{Object.entries({water:'Voda',roads:'Ceste',waste:'Odpadki',general:'Splošno'}).map(([key,label])=><label key={key}><input type="checkbox" checked={value.topics.includes(key)} onChange={e=>setValue({...value,topics:e.target.checked?[...value.topics,key]:value.topics.filter(t=>t!==key)})}/>{label}</label>)}</fieldset><button className="button" disabled={busy||!value.topics.length}>Shrani nastavitve</button></fieldset>
      <button type="button" className="button secondary" style={{marginTop:20}} disabled={busy} onClick={e=>void save(e,true)}>Odjavi vsa e-obvestila</button></form>)}
    <p style={{marginTop:24}}><Link to="/obvestila#narocilo">Nova prijava ali nova potrditvena povezava</Link></p></section></div>;
}
