import { validatePreferences, matchesNotice } from '../shared/notification-rules.js';

const ORIGIN = 'https://kpv.jakobtominc.com';
const encoder = new TextEncoder();
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail = (status,message) => { throw Object.assign(Error(message),{status}); };
export async function digest(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join(''); }
async function signature(env, value) {
  if (!env.SUBSCRIPTION_SIGNING_SECRET) fail(503,'Obveščanje trenutno ni na voljo. Poskusite pozneje.');
  const key = await crypto.subtle.importKey('raw',encoder.encode(env.SUBSCRIPTION_SIGNING_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function subscriptionToken(env, id, purpose, version = 0) {
  const data = `${purpose}.${id}.${version}`;
  return `${data}.${await signature(env,data)}`;
}
async function tokenSubject(env, token, purpose) {
  if (typeof token !== 'string' || token.length > 220) fail(400,'Povezava ni veljavna.');
  const parts=token.split('.');
  if (parts.length!==4 || parts[0]!==purpose || !/^[a-f0-9-]{36}$/.test(parts[1]) || !/^\d{1,12}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) fail(400,'Povezava ni veljavna.');
  const expected=await signature(env,parts.slice(0,3).join('.'));
  let different=0; for(let i=0;i<64;i++) different|=expected.charCodeAt(i)^parts[3].charCodeAt(i);
  if(different) fail(400,'Povezava ni veljavna.');
  const row=await env.DB.prepare('SELECT * FROM email_subscribers WHERE id=?').bind(parts[1]).first();
  if(!row) fail(400,'Povezava ni več veljavna.');
  return {row,version:Number(parts[2])};
}
const queueStatement=(db,id,message,now)=>db.prepare('INSERT OR IGNORE INTO email_outbox(id,created_at,next_attempt,message) VALUES(?,?,?,?)').bind(id,now,now,JSON.stringify(message));
const link=(token,action)=>`${ORIGIN}/obvestila/narocnina?action=${action}&token=${encodeURIComponent(token)}`;
const mail=(env,email,subject,text)=>({from:env.EMAIL_FROM,to:[email],subject,text,html:`<div lang="sl" style="font:16px/1.6 Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#183a2d">${text.split(/(https:\/\/kpv\.jakobtominc\.com\/[^\s]+)/).map(part=>part.startsWith(ORIGIN+'/')?`<a href="${escape(part)}" style="color:#19543d;overflow-wrap:anywhere">${part.includes('action=confirm')?'Odpri potrditev naročnine':part.includes('action=manage')?'Nastavitve in odjava':'Odpri obvestilo'}</a>`:escape(part).replace(/\n/g,'<br>')).join('')}</div>`});

export async function requestSubscription(env, data, districts, ip = 'unknown', now = Date.now()) {
  if (!env.DB || (!env.LOCAL_STORAGE && !(env.EMAIL_ENABLED==='true' && env.RESEND_API_KEY && env.EMAIL_FROM))) fail(503,'Pošiljanje potrditve trenutno ni na voljo. Poskusite pozneje.');
  const prefs=validatePreferences(data,districts);
  const email=String(data.email||'').trim().toLowerCase();
  if(email.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) fail(400,'Vnesite veljaven e-poštni naslov.');
  if(data.consent!==true && data.consent!=='true') fail(400,'Za obveščanje potrebujemo vašo privolitev.');
  for(const [key,limit] of [[`email:${email}`,3],[`ip:${ip}`,15]]) {
    const hashed=await digest(key);
    const rate=await env.DB.prepare('INSERT INTO subscription_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(hashed,Math.floor(now/3600000)).first();
    if(rate.attempts>limit) fail(429,'Preveč zahtev za potrditev. Poskusite čez eno uro.');
  }
  const current=await env.DB.prepare('SELECT * FROM email_subscribers WHERE email=?').bind(email).first();
  // Identical responses prevent leaking whether somebody already subscribes.
  const receipt={id:`KPV-${crypto.randomUUID()}`,status:'confirmation-required',emailStatus:'queued',message:'Na vaš e-poštni naslov smo uvrstili potrditveno povezavo. Naročnina oziroma sprememba začne veljati šele po potrditvi. Preverite tudi neželeno pošto.'};
  if(current && now-current.last_request<60000) return receipt;
  const id=current?.id || crypto.randomUUID(), version=(current?.pending_version||0)+1;
  const token=await subscriptionToken(env,id,'confirm',version);
  const manage=await subscriptionToken(env,id,'manage');
  const confirmUrl=link(token,'confirm'), manageUrl=link(manage,'manage');
  const district=districts.find(d=>d.id===prefs.districtId);
  const text=`Potrdite e-obvestila KPV\n\nObmočje: ${district.name}\nNaslov: ${prefs.address}\n\nZa potrditev odprite povezavo in pritisnite Potrdi naročnino:\n${confirmUrl}\n\nPovezava velja 24 ur. Če tega niste zahtevali, je ne potrdite.\nOdjava obstoječe naročnine: ${manageUrl}`;
  const outboxId=`subscriber-confirm-${id}-${version}`;
  const statements=[env.DB.prepare(`INSERT INTO email_subscribers(id,email,status,name,address,district_id,topics,created_at,updated_at,pending_payload,pending_version,confirm_until,last_request)
    VALUES(?,?,'pending',?,?,?, ?,?,?,?, ?,?,?) ON CONFLICT(email) DO UPDATE SET pending_payload=excluded.pending_payload,pending_version=email_subscribers.pending_version+1,confirm_until=excluded.confirm_until,last_request=excluded.last_request,updated_at=excluded.updated_at
    WHERE email_subscribers.pending_version=? AND email_subscribers.last_request<=? RETURNING id`)
    .bind(id,email,prefs.name,prefs.address,prefs.districtId,JSON.stringify(prefs.topics),now,now,JSON.stringify(prefs),version,now+86400000,now,current?.pending_version||0,now-60000),
    // Guard queue inserts against concurrent signup/version races.
    env.DB.prepare(`INSERT OR IGNORE INTO email_outbox(id,created_at,next_attempt,message)
      SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM email_subscribers WHERE id=? AND pending_version=? AND last_request=?)`)
      .bind(outboxId,now,now,JSON.stringify(mail(env,email,'Potrdite e-obvestila KPV',text)),id,version,now),
    env.DB.prepare(`INSERT OR IGNORE INTO subscription_deliveries(outbox_id,subscriber_id,generation,kind) SELECT ?,?,?,'confirmation' WHERE EXISTS(SELECT 1 FROM email_outbox WHERE id=?)`).bind(outboxId,id,version,outboxId)];
  await env.DB.batch(statements);
  return receipt;
}

export async function subscriptionAction(request,env,{json,readJson,readDistricts}) {
  const url=new URL(request.url), path=url.pathname;
  if(!['/api/subscriptions/confirm','/api/subscriptions/manage','/api/subscriptions/unsubscribe'].includes(path)) return null;
  if(!env.DB) fail(503,'Shramba naročnin ni na voljo.');
  const confirming=path.endsWith('/confirm');
  const isPost=request.method==='POST';
  if(!isPost && request.method!=='GET') fail(405,'Metoda ni dovoljena.');
  // Signed links are capabilities; GET only inspects, never subscribes or unsubscribes.
  if(isPost && ((request.headers.get('origin') && request.headers.get('origin')!==url.origin) || request.headers.get('sec-fetch-site')==='cross-site')) fail(403,'Oddaja z druge spletne strani ni dovoljena.');
  let data={};
  if(isPost) {
    if(request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
      const reader=request.body?.getReader();let size=0,text='';const decoder=new TextDecoder();
      if(reader) while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>4096){await reader.cancel();fail(413,'Zahteva je prevelika.');}text+=decoder.decode(chunk.value,{stream:true});}
      data=Object.fromEntries(new URLSearchParams(text));
    }
    else data=await readJson(request);
  }
  const token=url.searchParams.get('token') || data.token;
  const {row,version}=await tokenSubject(env,token,confirming?'confirm':'manage');
  if(confirming) {
    if(version!==row.pending_version || row.confirm_until<Date.now() || !row.pending_payload) fail(410,'Potrditev je potekla ali je že uporabljena. Za novo povezavo ponovno izpolnite prijavo.');
    const prefs=validatePreferences(JSON.parse(row.pending_payload),await readDistricts());
    if(!isPost) return json({action:'confirm',districtId:prefs.districtId,address:prefs.address,topics:prefs.topics});
    const confirmed=await env.DB.prepare(`UPDATE email_subscribers SET status='active',name=?,address=?,district_id=?,topics=?,pending_payload=NULL,confirmed_at=?,updated_at=?,generation=generation+1 WHERE id=? AND pending_version=? AND pending_payload IS NOT NULL AND confirm_until>=? RETURNING id`)
      .bind(prefs.name,prefs.address,prefs.districtId,JSON.stringify(prefs.topics),Date.now(),Date.now(),row.id,version,Date.now()).first();
    if(!confirmed)fail(409,'Naročnina se je medtem spremenila. Uporabite najnovejšo povezavo.');
    return json({message:'Naročnina je potrjena. Prejemali boste obvestila za izbrano območje in teme.'});
  }
  if(!isPost) return json({action:'manage',status:row.status,address:row.address,districtId:row.district_id,topics:JSON.parse(row.topics)});
  if(path.endsWith('/unsubscribe') || data.action==='unsubscribe') {
    await env.DB.prepare(`UPDATE email_subscribers SET status='unsubscribed',pending_payload=NULL,pending_version=pending_version+1,generation=generation+1,updated_at=? WHERE id=?`).bind(Date.now(),row.id).run();
    return json({message:'Odjava je shranjena. Nadaljnjih obvestil ne boste prejemali.'});
  }
  if(row.status!=='active') fail(400,'Za ponovno prijavo izpolnite obrazec in potrdite e-pošto.');
  const prefs=validatePreferences({...data,name:row.name},await readDistricts());
  await env.DB.prepare(`UPDATE email_subscribers SET address=?,district_id=?,topics=?,pending_payload=NULL,pending_version=pending_version+1,generation=generation+1,updated_at=? WHERE id=? AND status='active'`).bind(prefs.address,prefs.districtId,JSON.stringify(prefs.topics),Date.now(),row.id).run();
  return json({message:'Območje in teme obveščanja so shranjeni.'});
}

export function campaignNotice(notice) {
  return {id:notice.id,title:notice.title,summary:notice.summary,category:notice.category,area:notice.area,date:notice.date,status:notice.status,published:notice.published!==false,allDistricts:notice.allDistricts===true,districtIds:[...(notice.districtIds||[])].sort(),addressRules:[...(notice.addressRules||[])].sort()};
}
export async function createCampaign(env,notice,revision,expected,actor,districts,preview=false) {
  if(revision!==expected) fail(409,'Obvestilo je bilo spremenjeno. Shranite spremembe in osvežite predogled.');
  if(notice.published===false) fail(400,'Najprej objavite obvestilo.');
  if(!notice.allDistricts && !(notice.districtIds||[]).length) fail(400,'Izberite prejemnike: vsaj eno območje ali vsa območja.');
  if(!notice.allDistricts && (notice.districtIds||[]).some(id=>!districts.some(d=>d.id===id&&d.active))) fail(400,'Izbrano območje je umaknjeno. Popravite izbor.');
  if(!env.SUBSCRIPTION_SIGNING_SECRET || (!env.LOCAL_STORAGE && !(env.EMAIL_ENABLED==='true'&&env.RESEND_API_KEY))) fail(503,'Pošiljanje naročnikom trenutno ni vključeno.');
  const payload=campaignNotice(notice), id=await digest(JSON.stringify(payload));
  const existing=await env.DB.prepare('SELECT * FROM notification_campaigns WHERE id=?').bind(id).first();
  // Count in bounded pages; no subscriber details leave the authenticated server.
  let cursor='',count=0;
  for(let page=0;page<100;page++) {
    const {results}=await env.DB.prepare("SELECT * FROM email_subscribers WHERE status='active' AND id>? ORDER BY id LIMIT 200").bind(cursor).all();
    for(const s of results) if(districts.some(d=>d.id===s.district_id&&d.active) && matchesNotice({...s,districtId:s.district_id,topics:JSON.parse(s.topics)},payload)) count++;
    if(results.length<200) break;
    cursor=results.at(-1).id;
    if(page===99) fail(413,'Preveč prejemnikov za en predogled. Razdelite obvestilo na manjša območja.');
  }
  if(!preview && !existing) {
    if(!count) fail(400,'Ni potrjenih naročnikov za izbrano območje, naslove in temo.');
    await env.DB.prepare('INSERT OR IGNORE INTO notification_campaigns(id,notice_id,payload,created_at,created_by) VALUES(?,?,?,?,?)').bind(id,notice.id,JSON.stringify(payload),Date.now(),actor.email).run();
  }
  const stats=await env.DB.prepare(`SELECT o.status,COUNT(*) AS count FROM email_outbox o JOIN subscription_deliveries d ON d.outbox_id=o.id WHERE d.campaign_id=? GROUP BY o.status`).bind(id).all();
  return {id,recipients:count,alreadyQueued:!!existing,status:existing?.status||(!preview?'pending':null),deliveries:Object.fromEntries(stats.results.map(r=>[r.status,r.count]))};
}

export async function processCampaigns(env,{now=Date.now()}={}) {
  if(!env.DB || !env.SUBSCRIPTION_SIGNING_SECRET || (!env.LOCAL_STORAGE && !(env.EMAIL_ENABLED==='true'&&env.RESEND_API_KEY))) return;
  const {results:campaigns}=await env.DB.prepare("SELECT * FROM notification_campaigns WHERE status='pending' ORDER BY created_at LIMIT 2").all();
  const currentRow=await env.DB.prepare("SELECT value FROM cms_content WHERE section='notices'").first();
  const currentNotices=currentRow?JSON.parse(currentRow.value):[];
  const districtRow=await env.DB.prepare("SELECT value FROM cms_content WHERE section='districts'").first();
  const activeDistricts=districtRow?JSON.parse(districtRow.value).filter(d=>d.active).map(d=>d.id):['vrhnika','borovnica','log-dragomer'];
  for(const campaign of campaigns) {
    const notice=JSON.parse(campaign.payload);
    const current=currentNotices.find(n=>n.id===notice.id&&n.published!==false);
    if(!current || await digest(JSON.stringify(campaignNotice(current)))!==campaign.id) {
      await env.DB.prepare("UPDATE notification_campaigns SET status='cancelled' WHERE id=?").bind(campaign.id).run();
      continue;
    }
    const {results}=await env.DB.prepare("SELECT * FROM email_subscribers WHERE id>? AND status='active' AND confirmed_at<=? ORDER BY id LIMIT 40").bind(campaign.cursor,campaign.created_at).all();
    const statements=[];
    for(const row of results) {
      if(!activeDistricts.includes(row.district_id) || !matchesNotice({...row,districtId:row.district_id,topics:JSON.parse(row.topics)},notice)) continue;
      const token=await subscriptionToken(env,row.id,'manage');
      const manageUrl=link(token,'manage'), unsubscribe=`${ORIGIN}/api/subscriptions/unsubscribe?token=${encodeURIComponent(token)}`;
      const publicUrl=`${ORIGIN}/obvestila#${encodeURIComponent(notice.id)}`;
      const message=mail(env,row.email,`[KPV] ${notice.title}`,`${notice.title}\n${notice.area} · ${notice.date}\n\n${notice.summary}\n\nObvestilo: ${publicUrl}\n\nPrejemate temo ${notice.category} za izbrano območje in naslov.\nNastavitve in odjava: ${manageUrl}\n\nKomunala Vrhnika, Pot na Tojnice 40, 1360 Vrhnika`);
      message.headers={'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'};
      const id=`subscriber-notice-${campaign.id}-${row.id}`;
      statements.push(queueStatement(env.DB,id,message,now),env.DB.prepare("INSERT OR IGNORE INTO subscription_deliveries(outbox_id,subscriber_id,generation,kind,campaign_id) VALUES(?,?,?,'notice',?)").bind(id,row.id,row.generation,campaign.id));
    }
    statements.push(env.DB.prepare("UPDATE notification_campaigns SET cursor=?,status=? WHERE id=? AND cursor=?").bind(results.at(-1)?.id||campaign.cursor,results.length<40?'complete':'pending',campaign.id,campaign.cursor));
    await env.DB.batch(statements);
  }
}

export async function subscriberDeliveryAllowed(env,id,now=Date.now()) {
  if(!id.startsWith('subscriber-')) return true;
  const row=await env.DB.prepare(`SELECT s.*,d.kind,d.generation AS delivery_generation,d.campaign_id,c.status AS campaign_status,c.notice_id,n.value AS notices_value,ds.value AS districts_value
    FROM subscription_deliveries d JOIN email_subscribers s ON s.id=d.subscriber_id
    LEFT JOIN notification_campaigns c ON c.id=d.campaign_id LEFT JOIN cms_content n ON n.section='notices' LEFT JOIN cms_content ds ON ds.section='districts'
    WHERE d.outbox_id=?`).bind(id).first();
  if(!row) return false;
  if(row.kind==='confirmation') return row.pending_version===row.delivery_generation&&!!row.pending_payload&&row.confirm_until>=now;
  if(row.status!=='active'||row.generation!==row.delivery_generation) return false;
  if(!row.campaign_status||row.campaign_status==='cancelled')return false;
  const notice=row.notices_value?JSON.parse(row.notices_value).find(n=>n.id===row.notice_id&&n.published!==false):null;
  if(row.districts_value&&!JSON.parse(row.districts_value).some(d=>d.id===row.district_id&&d.active))return false;
  return !!notice&&await digest(JSON.stringify(campaignNotice(notice)))===row.campaign_id;
}
