import { useState, type FormEvent } from 'react';
import { Bell, ArrowRight } from 'lucide-react';
import { useSiteContent } from '../content/SiteContent';
import BotProtection, { resetProtection } from './BotProtection';
import { NOTIFICATION_TOPICS } from '../../shared/notification-rules.js';
import { readSavedAddress } from '../data/saved-address';
import VerifiedAddressPicker, { type VerifiedAddress } from './VerifiedAddressPicker';

export default function SubscriptionForm() {
  const { districts } = useSiteContent();
  const [topics,setTopics]=useState<string[]>([]);
  const [address,setAddress]=useState('');
  const [verified,setVerified]=useState<VerifiedAddress|null>(null);
  const savedAddress=readSavedAddress();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const district=verified ? districts.find(d=>d.id===verified.municipalityId&&d.active) : undefined;
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setError(''); setMessage('');
    if(!verified||!district) {setError('Izberite preverjen naslov iz seznama.');return;}
    if(!topics.length) {setError('Izberite vsaj eno temo.');return;}
    const values=Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      const response=await fetch('/api/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,address:verified.address,addressId:verified.id,districtId:verified.municipalityId,topics,consent:true}),signal:AbortSignal.timeout(20000)});
      const data=await response.json(); if(!response.ok) throw Error(data.error||'Prijava ni uspela.');
      setMessage(data.message);
    } catch(cause) {setError(cause instanceof Error?cause.message:'Povezava ni uspela. Poskusite znova.');}
    finally {setBusy(false);resetProtection('subscriptions');}
  }
  return <section className="panel svc-subscribe" id="narocilo"><div className="svc-icon"><Bell size={24}/></div><div><div className="eyebrow">E-OBVESTILA</div><h2>Naročite se na obvestila po e-pošti</h2><p>Izberite svoj naslov iz uradnega registra in teme obveščanja. Občino določimo po naslovu. Naročnino nato potrdite prek povezave v e-pošti. Obvestila za posamezne hiše prejmete samo, če vključujejo vaš naslov.</p></div><form onSubmit={submit} onChange={()=>{setError('');setMessage('');}}><fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}><div className="form-grid">
    <label className="field"><span>Ime in priimek</span><input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label>
    <label className="field"><span>E-poštni naslov</span><input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
    <div className="svc-wide"><VerifiedAddressPicker id="subscription-address" name="address" label="Ulica ali naselje, hišna številka in kraj" required disabled={busy} value={address} onChange={value=>{setAddress(value);setError('');setMessage('');}} onSelect={setVerified}/></div>
    <div className="field svc-wide"><span>Občina obveščanja</span><p role="status">{verified ? `Občina ${verified.municipality}` : 'Določena bo po izbiri naslova.'}</p>{verified&&!district&&<small role="alert">Za to občino prijava na e-obvestila trenutno ni omogočena. Obrnite se na KPV.</small>}</div>
    </div>
    {savedAddress&&address!==savedAddress&&<p className="svc-small"><button type="button" className="text-link" onClick={()=>{setVerified(null);setAddress(savedAddress);setError('');setMessage('');}}>Uporabi shranjeni naslov: {savedAddress}</button><br/>Shranjeni naslov najprej preverimo v registru.</p>}
    <p>Na en e-poštni naslov je vezana ena naročnina za en naslov. Ob ponovni prijavi nove nastavitve nadomestijo prejšnje šele po potrditvi povezave v e-pošti. Nastavitve lahko uredite tudi prek povezave v vsakem obvestilu.</p>
    <fieldset className="svc-topics"><legend>O čem želite biti obveščeni?</legend>{Object.entries(NOTIFICATION_TOPICS).map(([key,label])=><label key={key}><input type="checkbox" checked={topics.includes(key)} onChange={e=>setTopics(old=>e.target.checked?[...old,key]:old.filter(t=>t!==key))}/>{label}</label>)}</fieldset>
    <label className="svc-consent"><input type="checkbox" name="consent" required/><span>Želim prejemati izbrana e-obvestila in dovoljujem obdelavo naslova ter e-pošte za ta namen. V vsakem sporočilu je povezava za spremembo nastavitev in odjavo.</span></label>
    <BotProtection action="subscriptions"/><button className="button" disabled={busy||!topics.length||!verified||!district}>{busy?'Prijavljamo …':'Pošlji potrditveno povezavo'}<ArrowRight size={17}/></button>
    </fieldset>{error&&<p className="svc-error" role="alert">{error}</p>}{message&&<p className="svc-success" role="status">{message}</p>}</form></section>;
}
