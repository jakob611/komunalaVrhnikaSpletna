import test from 'node:test';
import assert from 'node:assert/strict';
import {localD1} from './local-d1.mjs';
import {handleRequest} from './worker.js';
import {requestSubscription,subscriptionToken,createCampaign,processCampaigns,subscriberDeliveryAllowed} from './subscriptions.js';
import {deliverPending} from './email.js';

const districts=['vrhnika','verd','borovnica','retired'].map(id=>({id,name:id,description:'Synthetic audit area',active:true}));
const post=(action,data)=>new Request(`https://kpv.example/api/subscriptions/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://kpv.example'},body:JSON.stringify(data)});
const rows=[
  {address:'Verd 12, Vrhnika',narrow:true,all:true},
  {address:'Verd 12, Vrhnika',districtId:'verd',legacy:true,all:true},
  {address:'Verd 12, Vrhnika',districtId:'borovnica',legacy:true,all:true},
  {address:'Verd 12, Vrhnika',status:'unsubscribed'},
  {address:'Verd 12, Vrhnika',status:'pending'},
  {address:'Verd 12, Vrhnika',status:'suppressed'},
  {address:'Verd 12, Vrhnika',districtId:'retired',legacy:true},
  {address:'Verd 12, Vrhnika',topics:['roads']},
  {address:'Verd 112, Vrhnika'},
  {address:'Verd 12a, Vrhnika'},
  {address:'Verd 12, Ljubljana',reject:422},
  {address:'Verd 12',narrow:true,all:true},
  {address:'Vrhnika',reject:422},
  {address:'abc',reject:422},
  {address:'Verd 12/1, Vrhnika',reject:400},
  {address:'Tržaška cesta 48, Vrhnika',narrow:true,all:true},
  {address:'Trzaska c.48, stanovanje 3, 1360 Vrhnika',narrow:true,all:true},
  {address:'Tržaška cesta 480, Vrhnika',reject:422},
  {address:'Tržaška cesta 48, Ljubljana',reject:422},
  {address:'Tržaška cesta 50-a, Vrhnika',reject:422},
  {address:'Tržaška cesta 50, Vrhnika'},
  {address:'Izmišljena ulica 9999, Vrhnika',reject:422},
  {address:'Verd 12, Vrhnika',districtId:'borovnica',forgedDistrict:true,narrow:true,all:true},
];

test('verified opt-ins and explicitly seeded legacy districts preserve exact-house/topic/status targeting through the outbox',async()=>{
  const env={DB:localD1(':memory:'),LOCAL_STORAGE:{},SUBSCRIPTION_SIGNING_SECRET:'private-local-audit-only',EMAIL_FROM:'KPV <local@example.test>',EMAIL_TO:'owner@example.test',EMAIL_ENABLED:'true',RESEND_API_KEY:'local-not-used'};
  const subscribers=[];
  const currentDistricts=districts.map(d=>({...d,active:d.id!=='retired'}));
  try{
    await env.DB.prepare("INSERT INTO cms_content(section,value,revision,updated_at) VALUES('districts',?,1,?)").bind(JSON.stringify(districts),Date.now()).run();
    // New households use actual verified signup and explicit confirmation.
    // Custom/wrong/retired district fixtures are deliberately labelled legacy
    // and seeded locally; the new signup API never assigns those memberships.
    for(const[index,row]of rows.entries()){
      const email=`address-audit-${index}@example.test`;
      const signup=()=>requestSubscription(env,{name:'Local Audit',email,address:row.address,districtId:row.districtId||'vrhnika',topics:row.topics||['water'],consent:true},districts,`192.0.2.${index+1}`);
      if(row.reject){
        await assert.rejects(signup,error=>error.status===row.reject);
        assert.equal(await env.DB.prepare('SELECT id FROM email_subscribers WHERE email=?').bind(email).first(),null);
        subscribers.push(null);
        continue;
      }
      if(row.legacy){
        const id=crypto.randomUUID(),at=Date.now()-1000;
        await env.DB.prepare("INSERT INTO email_subscribers(id,email,status,name,address,district_id,topics,created_at,updated_at,confirmed_at,generation) VALUES(?,?,'active','Explicit legacy fixture',?,?,?, ?,?,?,1)").bind(id,email,row.address,row.districtId,JSON.stringify(row.topics||['water']),at,at,at).run();
        subscribers.push(await env.DB.prepare('SELECT * FROM email_subscribers WHERE id=?').bind(id).first());
        continue;
      }
      await signup();
      let subscriber=await env.DB.prepare('SELECT * FROM email_subscribers WHERE email=?').bind(email).first();
      assert.equal(subscriber.district_id,'vrhnika','New registered-house signups derive their actual municipality, ignoring a forged district');
      if(row.status!=='pending'){
        const token=await subscriptionToken(env,subscriber.id,'confirm',subscriber.pending_version);
        const result=await handleRequest(post('confirm',{token}),env);
        if(result.status!==200)assert.fail(await result.text());
        subscriber=await env.DB.prepare('SELECT * FROM email_subscribers WHERE id=?').bind(subscriber.id).first();
      }
      if(row.status==='unsubscribed'){
        const token=await subscriptionToken(env,subscriber.id,'unsubscribe');
        assert.equal((await handleRequest(post('unsubscribe',{token}),env)).status,200);
      }
      if(row.status==='suppressed')await env.DB.prepare("UPDATE email_subscribers SET status='suppressed',generation=generation+1 WHERE id=?").bind(subscriber.id).run();
      subscribers.push({...subscriber,email});
    }
    // Management shares signup validation. Unsupported household syntax must not
    // alter a confirmed address/generation or invalidate its still-valid capability.
    const validationToken=await subscriptionToken(env,subscribers[0].id,'manage');
    const before=await env.DB.prepare('SELECT address,generation FROM email_subscribers WHERE id=?').bind(subscribers[0].id).first();
    for(const address of ['Verd 12/1, Vrhnika','Verd 12–14, Vrhnika','Verd 12 do 14, Vrhnika']){
      const rejected=await handleRequest(post('manage',{token:validationToken,address,districtId:'vrhnika',topics:['water']}),env);
      assert.equal(rejected.status,400);
      assert.match((await rejected.json()).error,/stanovanje navedite za vejico/);
      assert.deepEqual(await env.DB.prepare('SELECT address,generation FROM email_subscribers WHERE id=?').bind(subscribers[0].id).first(),before);
    }
    const apartment='Verd 12, stanovanje 2, Vrhnika';
    assert.equal((await handleRequest(post('manage',{token:validationToken,address:apartment,districtId:'vrhnika',topics:['water']}),env)).status,200);
    assert.equal((await env.DB.prepare('SELECT address FROM email_subscribers WHERE id=?').bind(subscribers[0].id).first()).address,'Verd 12, Vrhnika');
    const notice={id:'house-subset',title:'Local house audit',summary:'Synthetic local notice, never delivered externally.',category:'water',area:'Only listed houses',date:'2026-11-02',status:'active',published:true,districtIds:['vrhnika'],addressRules:['Verd 12, Vrhnika','Tržaška cesta 48, Vrhnika','Tržaška cesta 50a, Vrhnika'],latitude:null,longitude:null};
    const all={...notice,id:'house-subset-all',allDistricts:true};
    await env.DB.prepare("INSERT INTO cms_content(section,value,revision,updated_at) VALUES('notices',?,1,?)").bind(JSON.stringify([notice,all]),Date.now()).run();
    await env.DB.prepare("INSERT INTO cms_content(section,value,revision,updated_at) VALUES('districts',?,1,?) ON CONFLICT(section) DO UPDATE SET value=excluded.value").bind(JSON.stringify(currentDistricts),Date.now()).run();
    const actor={email:'local-editor@example.test'};
    const narrowPreview=await createCampaign(env,notice,1,1,actor,currentDistricts,true);
    const allPreview=await createCampaign(env,all,1,1,actor,currentDistricts,true);
    assert.equal(narrowPreview.recipients,5);
    assert.equal(allPreview.recipients,7);
    const narrow=await createCampaign(env,notice,1,1,actor,currentDistricts);
    const every=await createCampaign(env,all,1,1,actor,currentDistricts);
    await processCampaigns(env);
    for(const[campaign,flag]of [[narrow,'narrow'],[every,'all']]){
      const queued=await env.DB.prepare("SELECT s.email,d.outbox_id FROM subscription_deliveries d JOIN email_subscribers s ON s.id=d.subscriber_id WHERE campaign_id=? ORDER BY s.email").bind(campaign.id).all();
      assert.deepEqual(queued.results.map(x=>x.email),rows.flatMap((r,i)=>r[flag]?[subscribers[i].email]:[]).sort());
      for(const row of queued.results)assert.equal(await subscriberDeliveryAllowed(env,row.outbox_id),true);
    }
    // Changing a household or unsubscribing after preparation blocks queued copies.
    const manage=await subscriptionToken(env,subscribers[2].id,'manage');
    assert.equal((await handleRequest(post('manage',{token:manage,address:'Verd 112, Vrhnika',districtId:'borovnica',topics:['water']}),env)).status,200);
    assert.equal((await env.DB.prepare('SELECT district_id FROM email_subscribers WHERE id=?').bind(subscribers[2].id).first()).district_id,'vrhnika');
    const unsubscribe=await subscriptionToken(env,subscribers[1].id,'unsubscribe');
    assert.equal((await handleRequest(post('unsubscribe',{token:unsubscribe}),env)).status,200);
    const queued=await env.DB.prepare("SELECT s.email,d.outbox_id FROM subscription_deliveries d JOIN email_subscribers s ON s.id=d.subscriber_id WHERE campaign_id=?").bind(every.id).all();
    const sent=[];
    for(const row of queued.results){
      const changed=[subscribers[1].email,subscribers[2].email].includes(row.email);
      assert.equal(await subscriberDeliveryAllowed(env,row.outbox_id),!changed);
      await deliverPending({...env,LOCAL_STORAGE:undefined},{id:row.outbox_id,fetcher:async(_url,init)=>{
        sent.push(...JSON.parse(init.body).to);
        return Response.json({id:crypto.randomUUID()});
      }});
    }
    assert.deepEqual(sent.sort(),rows.flatMap((r,i)=>r.all&&![1,2].includes(i)?[subscribers[i].email]:[]).sort());
  }finally{env.DB.close();}
});
