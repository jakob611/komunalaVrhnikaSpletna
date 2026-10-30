import { useState, type FormEvent } from 'react';
import { Bell, ArrowRight } from 'lucide-react';
import { useSiteContent } from '../content/SiteContent';
import BotProtection, { resetProtection } from './BotProtection';

export default function SubscriptionForm() {
  const { districts } = useSiteContent();
  const [topics,setTopics]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    if(!topics.length) {setError('Izberite vsaj eno temo.');return;}
    const values=Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      const response=await fetch('/api/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,topics,consent:true}),signal:AbortSignal.timeout(20000)});
      const data=await response.json(); if(!response.ok) throw Error(data.error||'Prijava ni uspela.');
      setMessage(data.message);
    } catch(cause) {setError(cause instanceof Error?cause.message:'Povezava ni uspela. Poskusite znova.');}
    finally {setBusy(false);resetProtection('subscriptions');}
  }
  return <section className="panel svc-subscribe" id="narocilo"><div className="svc-icon"><Bell size={24}/></div><div><div className="eyebrow">OBVESTILA ZA MOJ DOM</div><h2>Pravo obvestilo za vaš naslov.</h2><p>Izberite območje in teme. Po prijavi potrdite povezavo v e-pošti. Prejemali boste obvestila za izbrano območje; obvestilo za posamezno ulico ali hišo prejmete samo, če se vaš naslov ujema.</p></div><form onSubmit={submit}><fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}><div className="form-grid">
    <label className="field"><span>Ime in priimek</span><input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label>
    <label className="field"><span>E-poštni naslov</span><input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
    <label className="field svc-wide"><span>Območje obveščanja</span><select name="districtId" required defaultValue=""><option value="" disabled>Izberite območje svojega naslova</option>{districts.filter(d=>d.active).map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
    <label className="field svc-wide"><span>Ulica ali naselje, hišna številka in kraj</span><input name="address" required minLength={3} maxLength={250} autoComplete="street-address" placeholder="Npr. Verd 12, Vrhnika"/><small>Napišite celoten naslov, da se lahko ujemajo tudi obvestila za posamezno ulico ali hišo.</small></label></div>
    <fieldset className="svc-topics"><legend>O čem želite biti obveščeni?</legend>{Object.entries({water:'Voda in kanalizacija',roads:'Ceste in javne površine',waste:'Odpadki',general:'Splošno'}).map(([key,label])=><label key={key}><input type="checkbox" checked={topics.includes(key)} onChange={e=>setTopics(old=>e.target.checked?[...old,key]:old.filter(t=>t!==key))}/>{label}</label>)}</fieldset>
    <label className="svc-consent"><input type="checkbox" name="consent" required/><span>Želim prejemati izbrana e-obvestila in dovoljujem obdelavo naslova ter e-pošte za ta namen. V vsakem sporočilu je povezava za spremembo nastavitev in odjavo.</span></label>
    <BotProtection action="subscriptions"/><button className="button" disabled={busy||!topics.length}>{busy?'Prijavljamo …':'Pošlji potrditveno povezavo'}<ArrowRight size={17}/></button>
    </fieldset>{error&&<p className="svc-error" role="alert">{error}</p>}{message&&<p className="svc-success" role="status">{message}</p>}</form></section>;
}
