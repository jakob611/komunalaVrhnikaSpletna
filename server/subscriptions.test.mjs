import test from 'node:test';
import assert from 'node:assert/strict';
import {localD1} from './local-d1.mjs';
import {handleRequest} from './worker.js';
import {requestSubscription,subscriptionToken,createCampaign,processCampaigns,subscriberDeliveryAllowed} from './subscriptions.js';
import {deliverPending} from './email.js';
import {matchesNotice,validatePreferences} from '../shared/notification-rules.js';
import defaults from '../shared/site-defaults.json' with {type:'json'};

function environment(){return {DB:localD1(':memory:'),LOCAL_STORAGE:{},SUBSCRIPTION_SIGNING_SECRET:'test-only-private-signing-key',EMAIL_FROM:'KPV <test@example.com>',EMAIL_TO:'owner@example.com',RESEND_API_KEY:'test-only',EMAIL_ENABLED:'true'};}
const prefs={name:'Testna oseba',email:'reader@example.com',address:'Verd 12, Vrhnika',districtId:'vrhnika',topics:['water'],consent:true};
const notice={id:'notice-1',title:'Prekinitev oskrbe',summary:'Preverjanje dostave obvestila za naslov.',category:'water',area:'Verd',date:'2026-10-30',status:'active',published:true,districtIds:['vrhnika'],addressRules:['Verd, Vrhnika'],latitude:null,longitude:null};
const req=(path,data,headers={})=>new Request('https://kpv.example'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://kpv.example',...headers},body:data===undefined?undefined:JSON.stringify(data)});
async function signup(env,data=prefs){return requestSubscription(env,data,defaults.districts,'192.0.2.10');}
async function subscriber(env){return env.DB.prepare('SELECT * FROM email_subscribers WHERE email=?').bind(prefs.email).first();}
async function confirm(env){const row=await subscriber(env),token=await subscriptionToken(env,row.id,'confirm',row.pending_version);const response=await handleRequest(req('/api/subscriptions/confirm',{token}),env);assert.equal(response.status,200,await response.text());return subscriber(env);}
async function saveNotice(env,value=notice){await env.DB.prepare("INSERT INTO cms_content(section,value,revision,updated_at,source) VALUES('notices',?,1,?,'test') ON CONFLICT(section) DO UPDATE SET value=excluded.value,revision=revision+1").bind(JSON.stringify([value]),Date.now()).run();}

test('subscription requires valid district, exact preferences, consent and available delivery configuration',async()=>{
 const env=environment();for(const change of [{districtId:'unknown'},{topics:[]},{email:'bad\r\nBcc:a@b.com'},{consent:false}])await assert.rejects(signup(env,{...prefs,...change}),e=>e.status===400);
 await assert.rejects(signup({...env,LOCAL_STORAGE:undefined,RESEND_API_KEY:undefined}),e=>e.status===503);
 const response=await handleRequest(req('/api/subscriptions',prefs),env);assert.equal(response.status,201);assert.equal((await response.json()).status,'confirmation-required');
 assert.equal((await subscriber(env)).status,'pending');assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM email_outbox').first()).n,1);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions').first()).n,0);
});
test('confirmation GET does not subscribe, POST confirms once; forged, expired and cross-origin tokens fail',async()=>{
 const env=environment();await signup(env);const row=await subscriber(env),token=await subscriptionToken(env,row.id,'confirm',row.pending_version);
 assert.equal((await handleRequest(req('/api/subscriptions/confirm?token='+token),env)).status,200);assert.equal((await subscriber(env)).status,'pending');
 assert.equal((await handleRequest(req('/api/subscriptions/confirm',{token},{Origin:'https://evil.example'}),env)).status,403);
 assert.equal((await handleRequest(req('/api/subscriptions/confirm',{token:token.slice(0,-1)+(token.endsWith('0')?'1':'0')}),env)).status,400);
 await confirm(env);assert.equal((await subscriber(env)).status,'active');assert.equal((await handleRequest(req('/api/subscriptions/confirm',{token}),env)).status,410);
 assert.equal(await subscriberDeliveryAllowed(env,`subscriber-confirm-${row.id}-${row.pending_version}`),false);
});
test('matching requires topic AND district AND exact whole address rules, including suffixes and diacritics',()=>{
 const s={...prefs,status:'active'};assert.equal(matchesNotice(s,notice),true);
 for(const other of [{districtId:'borovnica'},{topics:['roads']},{address:'Verd 112, Vrhnika'},{address:'Verd 12a, Vrhnika'}])assert.equal(matchesNotice({...s,...other},{...notice,addressRules:['Verd 12, Vrhnika']}),false);
 assert.equal(matchesNotice({...s,address:'Trzaska cesta 48, Vrhnika'},{...notice,addressRules:['Tržaška cesta 48, Vrhnika']}),true);
 assert.equal(matchesNotice(s,{...notice,published:false}),false);assert.equal(matchesNotice(s,{...notice,districtIds:[]}),false);
 assert.equal(matchesNotice(s,{...notice,districtIds:[],allDistricts:true}),true);
});
test('campaigns snapshot only confirmed audience, deduplicate repeated dispatch and send through outbox once',async()=>{
 const env=environment();await signup(env);await saveNotice(env);
 const empty=await createCampaign(env,notice,1,1,{email:'editor@example.com'},defaults.districts,true);assert.equal(empty.recipients,0);
 await confirm(env);const first=await createCampaign(env,notice,1,1,{email:'editor@example.com'},defaults.districts);assert.equal(first.recipients,1);
 assert.equal((await createCampaign(env,notice,1,1,{email:'editor@example.com'},defaults.districts)).alreadyQueued,true);
 await processCampaigns(env);await processCampaigns(env);const {results}=await env.DB.prepare("SELECT * FROM email_outbox WHERE id LIKE 'subscriber-notice-%'").all();assert.equal(results.length,1);
 let sends=0;const live={...env,LOCAL_STORAGE:undefined};const fetcher=async(_url,init)=>{sends++;const message=JSON.parse(init.body);assert.deepEqual(message.to,[prefs.email]);assert.ok(message.headers['List-Unsubscribe']);assert.ok(message.text.includes('Nastavitve in odjava'));return Response.json({id:'provider-id'});};
 await deliverPending(live,{id:results[0].id,fetcher});await deliverPending(live,{id:results[0].id,fetcher});assert.equal(sends,1);
});
test('unsubscribe is idempotent, GET safe, and immediately blocks queued notices and pending confirmations',async()=>{
 const env=environment();await signup(env);const row=await confirm(env);await saveNotice(env);await createCampaign(env,notice,1,1,{email:'editor'},defaults.districts);await processCampaigns(env);
 const token=await subscriptionToken(env,row.id,'manage'),url='/api/subscriptions/unsubscribe?token='+token;
 assert.equal((await handleRequest(req(url),env)).status,200);assert.equal((await subscriber(env)).status,'active');
 assert.equal((await handleRequest(req(url,{action:'unsubscribe'}),env)).status,200);assert.equal((await handleRequest(req(url,{action:'unsubscribe'}),env)).status,200);
 const queued=await env.DB.prepare("SELECT id FROM email_outbox WHERE id LIKE 'subscriber-notice-%'").first();assert.equal(await subscriberDeliveryAllowed(env,queued.id),false);
 let calls=0;await deliverPending({...env,LOCAL_STORAGE:undefined},{id:queued.id,fetcher:async()=>{calls++;return Response.json({id:'bad'});}});assert.equal(calls,0);
 assert.equal((await subscriber(env)).status,'unsubscribed');
});
test('preference updates require the personal capability and invalidate queued targeting; retracted notices are not sent',async()=>{
 const env=environment();await signup(env);const row=await confirm(env);await saveNotice(env);await createCampaign(env,notice,1,1,{email:'editor'},defaults.districts);await processCampaigns(env);
 const queued=await env.DB.prepare("SELECT id FROM email_outbox WHERE id LIKE 'subscriber-notice-%'").first();assert.equal(await subscriberDeliveryAllowed(env,queued.id),true);
 await saveNotice(env,{...notice,published:false});assert.equal(await subscriberDeliveryAllowed(env,queued.id),false);
 const token=await subscriptionToken(env,row.id,'manage');assert.equal((await handleRequest(req('/api/subscriptions/manage',{token,address:'Cerkova 1, Borovnica',districtId:'borovnica',topics:['roads']}),env)).status,200);
 assert.equal((await subscriber(env)).district_id,'borovnica');assert.equal(await subscriberDeliveryAllowed(env,queued.id),false);
 assert.equal((await handleRequest(req('/api/subscriptions/manage',{token:'bad'}),env)).status,400);
});
test('confirmation resend is throttled, does not replace active preferences until confirmed, and stale tokens expire',async()=>{
 const env=environment();await signup(env);const active=await confirm(env);await signup(env,{...prefs,districtId:'borovnica'});assert.equal((await subscriber(env)).district_id,'vrhnika');
 await env.DB.prepare('UPDATE email_subscribers SET last_request=last_request-61000').run();await signup(env,{...prefs,districtId:'borovnica'});
 const row=await subscriber(env);assert.equal(row.status,'active');assert.equal(row.district_id,'vrhnika');assert.equal(row.pending_version,2);
 const old=await subscriptionToken(env,row.id,'confirm',1);assert.equal((await handleRequest(req('/api/subscriptions/confirm',{token:old}),env)).status,410);
 await confirm(env);assert.equal((await subscriber(env)).district_id,'borovnica');
 await assert.rejects(signup(env),e=>e.status===429);
});

test('never-attempted backlog survives old creation dates and drains across bounded batches',async()=>{
 const env={...environment(),LOCAL_STORAGE:undefined},now=Date.now(),old=now-3*86400000;
 for(let i=0;i<25;i++) await env.DB.prepare('INSERT INTO email_outbox(id,created_at,next_attempt,message) VALUES(?,?,?,?)')
  .bind(`KPV-backlog-${String(i).padStart(2,'0')}`,old,old,JSON.stringify({from:env.EMAIL_FROM,to:['reader@example.com'],subject:'Backlog test',text:'Test'})).run();
 const delivered=[];const fetcher=async(_url,init)=>{delivered.push(init.headers['Idempotency-Key']);return Response.json({id:crypto.randomUUID()});};
 await deliverPending(env,{now,fetcher});
 assert.equal(delivered.length,20);
 const waiting=await env.DB.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='pending' AND attempts=0").first();assert.equal(waiting.n,5);
 assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='failed'").first()).n,0);
 assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM email_delivery_windows').first()).n,20);
 await deliverPending(env,{now:now+60000,fetcher});
 assert.equal(delivered.length,25);assert.equal(new Set(delivered).size,25);
 assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='sent'").first()).n,25);
 assert.equal((await env.DB.prepare('SELECT MIN(started_at) AS first FROM email_delivery_windows').first()).first,now);
 env.DB.close();
});

test('a fresh subscriber confirmation is delivered ahead of an older full backlog',async()=>{
 const env=environment(),now=Date.now(),old=now-600000;
 for(let i=0;i<25;i++) await env.DB.prepare('INSERT INTO email_outbox(id,created_at,next_attempt,message) VALUES(?,?,?,?)')
  .bind(`KPV-bulk-${String(i).padStart(2,'0')}`,old,old,JSON.stringify({from:env.EMAIL_FROM,to:['staff@example.com'],subject:'Earlier queued notification',text:'Test'})).run();
 await signup(env);const row=await subscriber(env),confirmation=`subscriber-confirm-${row.id}-${row.pending_version}`;
 const sent=[];await deliverPending({...env,LOCAL_STORAGE:undefined},{now:Date.now(),fetcher:async(_url,init)=>{sent.push(init.headers['Idempotency-Key']);return Response.json({id:crypto.randomUUID()});}});
 assert.equal(sent.length,20);assert.equal(sent[0],`submission/${confirmation}`);
 assert.equal((await env.DB.prepare('SELECT status FROM email_outbox WHERE id=?').bind(confirmation).first()).status,'sent');
 assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='pending' AND attempts=0").first()).n,6);
 env.DB.close();
});

test('confirmation detects unsubscribe between token inspection and the guarded update',async()=>{
 const env=environment();await signup(env);const row=await subscriber(env),token=await subscriptionToken(env,row.id,'confirm',row.pending_version);
 const underlying=env.DB;let interleaved=false;
 env.DB={...underlying,prepare(sql){
  const statement=underlying.prepare(sql);
  if(!sql.startsWith("UPDATE email_subscribers SET status='active'"))return statement;
  return {bind(...args){const bound=statement.bind(...args);return {...bound,async first(){
   interleaved=true;
   await underlying.prepare("UPDATE email_subscribers SET status='unsubscribed',pending_payload=NULL,pending_version=pending_version+1 WHERE id=?").bind(row.id).run();
   return bound.first();
  }};}};
 }};
 const response=await handleRequest(req('/api/subscriptions/confirm',{token}),env);
 assert.equal(interleaved,true);assert.equal(response.status,409);
 const current=await subscriber(env);assert.equal(current.status,'unsubscribed');assert.equal(current.confirmed_at,null);assert.equal(current.pending_payload,null);
 underlying.close();
});
