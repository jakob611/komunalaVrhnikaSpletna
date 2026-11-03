import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import snapshot from '../shared/official-addresses.json' with {type:'json'};
import source from '../shared/official-addresses-source.json' with {type:'json'};
import defaults from '../shared/site-defaults.json' with {type:'json'};
import {createAddressRegistry,officialAddresses,requireOfficialAddress} from './address-registry.js';
import {importMunicipality,physicalAddress,MUNICIPALITIES,SERVICE,COLLECTION} from '../scripts/import-official-addresses.mjs';
import {handleRequest} from './worker.js';
import {requestSubscription,subscriptionToken} from './subscriptions.js';
import {localD1} from './local-d1.mjs';
import {addDays,ljubljanaDate} from './seed.js';
const origin='https://portal.example';
const request=(path,body)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const environment=()=>({DB:localD1(':memory:'),LOCAL_STORAGE:{},SUBSCRIPTION_SIGNING_SECRET:'registry-local-test-secret',EMAIL_FROM:'qa@example.test',EMAIL_TO:'owner@example.test'});

test('official bundled snapshot has complete attributed municipality counts, exact string EIDs and no personal/apartment/coordinate fields',async()=>{
  assert.equal(snapshot.length,source.physicalAddresses);
  assert.equal(new Set(snapshot.map(row=>row.id)).size,snapshot.length);
  assert.deepEqual(source.municipalities.map(row=>[row.id,row.sourceRows,row.physicalAddresses]),[['vrhnika',7687,4543],['borovnica',1847,1114],['log-dragomer',1472,1138]]);
  for(const row of snapshot){assert.match(row.id,/^\d{18}$/);assert.deepEqual(Object.keys(row),source.fieldsRetained);assert.ok(MUNICIPALITIES.some(m=>m.id===row.municipalityId&&m.name===row.municipality));}
  assert.equal(createHash('sha256').update(await readFile(new URL('../shared/official-addresses.json',import.meta.url))).digest('hex'),source.sha256);
  assert.equal(source.license,'CC BY 4.0');assert.ok(Number.isFinite(Date.parse(source.updatedAt)));
});

test('official search is bounded, accent-insensitive, local-only and returns only the public selection contract',async()=>{
  const short=(await handleRequest(request('/api/addresses?q=tr'),{}));assert.equal(short.status,200);assert.deepEqual((await short.json()).addresses,[]);
  const response=await handleRequest(request('/api/addresses?q=trzaska&limit=3'),{});assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.addresses.length,3);assert.equal(result.more,true);assert.equal(result.source.name,source.name);
  for(const row of result.addresses)assert.deepEqual(Object.keys(row),['id','address','municipality','municipalityId']);
  for(const query of ['q=abc&limit=21','q=abc&limit=0','q=abc&limit=1e1','q=a&q=b','q=abc&address=Verd12','q='+encodeURIComponent('x'.repeat(251))])assert.equal((await handleRequest(request('/api/addresses?'+query),{})).status,400,query);
});

test('address search ranks visible municipality matches before hidden postal aliases without dropping postal search',()=>{
  const result=officialAddresses.query(new URLSearchParams({q:'Borovnica'}));
  assert.equal(result.addresses.length,20);
  assert.ok(result.addresses.every(row=>row.municipalityId==='borovnica'));
  assert.equal(result.more,true);
  const postal=officialAddresses.query(new URLSearchParams({q:'Bistra 1 Borovnica'}));
  assert.ok(postal.addresses.some(row=>row.address==='Bistra 1, Vrhnika'));
  assert.equal(requireOfficialAddress('Bistra 1, 1353 Borovnica').address,'Bistra 1, Vrhnika');
  const rows=[
    {...snapshot[0],id:'100400000000000001',address:'A 1, Vrhnika',street:'A',settlement:'A',municipality:'Vrhnika',municipalityId:'vrhnika',number:'1',postTown:'Borovnica'},
    {...snapshot[0],id:'100400000000000002',address:'Z 1, Borovnica',street:'Z',settlement:'Z',municipality:'Borovnica',municipalityId:'borovnica',number:'1',postTown:'Borovnica'},
  ];
  const registry=createAddressRegistry(rows,source);
  assert.deepEqual(registry.query(new URLSearchParams({q:'Borovnica'})).addresses.map(row=>row.id),[rows[1].id,rows[0].id]);
  assert.equal(registry.query(new URLSearchParams({q:'Borovnica',limit:'1'})).addresses[0].id,rows[1].id);
});

test('exact official resolution canonicalizes known spelling/postal/apartment forms and never guesses house suffixes or contradictory places',()=>{
  const verd=requireOfficialAddress('Verd 12, Vrhnika');
  assert.equal(verd.id,'100400000155780921');
  for(const value of ['verd 12 vrhnika','Verd 12, stanovanje 3, 1360 Vrhnika','Verd 12'])assert.equal(requireOfficialAddress(value).id,verd.id);
  for(const value of ['Trzaska cesta 48 Vrhnika','Tržaška c.48, 1360 Vrhnika','Tržaška 48 Vrhnika'])assert.equal(requireOfficialAddress(value).address,'Tržaška cesta 48, Vrhnika');
  assert.equal(requireOfficialAddress('Bevke 69, 1358 Log pri Brezovici').municipalityId,'vrhnika');
  assert.notEqual(requireOfficialAddress('Verd 12 A, Vrhnika').id,verd.id);
  for(const value of ['Verd 99999, Vrhnika','Verd 12, Ljubljana','Verd 12, Vrhnika, Borovnica','Izmišljena ulica 1, Vrhnika','Vrhnika'])assert.equal(officialAddresses.resolve(value),null,value);
  assert.throws(()=>requireOfficialAddress('Verd 12, Vrhnika','100400000155780848'),error=>error.status===422);
  assert.throws(()=>requireOfficialAddress('Verd 12/1, Vrhnika'),error=>error.status===400);
  const other={...snapshot[0],id:'100400000000000001',address:'Enaka ulica 1, Drugo naselje, Borovnica',municipality:'Borovnica',municipalityId:'borovnica',street:'Enaka ulica',settlement:'Drugo naselje',number:'1'};
  const first={...other,id:'100400000000000002',address:'Enaka ulica 1, Prvo naselje, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika',settlement:'Prvo naselje'};
  const registry=createAddressRegistry([first,other],source);assert.equal(registry.resolve('Enaka ulica 1'),null);assert.throws(()=>registry.require('Enaka ulica 1'),error=>error.status===422);assert.equal(registry.require(first.address,first.id).municipalityId,'vrhnika');
});

test('new subscriptions derive the official municipality, enforce active districts/topics and reject forged ID-address pairs',async()=>{
  const env=environment(),address=requireOfficialAddress('Cerkova 1, Borovnica');
  const data={name:'Registry Citizen',email:'citizen@example.test',address:address.address,addressId:address.id,districtId:'vrhnika',topics:['water'],consent:true};
  try{
    await requestSubscription(env,data,defaults.districts);
    const row=await env.DB.prepare('SELECT * FROM email_subscribers WHERE email=?').bind(data.email).first();assert.equal(row.district_id,'borovnica');assert.equal(row.address,address.address);
    for(const change of [{address:'Imaginary street 99999, Vrhnika'},{addressId:requireOfficialAddress('Verd 12, Vrhnika').id}])await assert.rejects(requestSubscription(env,{...data,...change},defaults.districts),error=>error.status===422);
    await assert.rejects(requestSubscription(env,{...data,topics:[]},defaults.districts),error=>error.status===400);
    await assert.rejects(requestSubscription(env,data,defaults.districts.map(d=>({...d,active:d.id!=='borovnica'}))),error=>error.status===400);
  }finally{env.DB.close();}
});

test('verified collection and calendar requests still require published KPV route boundaries and never invent dates',async()=>{
  const env=environment();try{
    const unknown=await handleRequest(request('/api/collection?address=Imaginary%2099999%2C%20Vrhnika'),env);assert.equal(unknown.status,422);
    const canonical=requireOfficialAddress('Verd 12, Vrhnika');
    await env.DB.prepare("INSERT INTO cms_content(section,value,revision,updated_at) VALUES('collection','{\"routes\":[]}',1,1)").run();
    for(const route of ['collection','calendar']){
      const missing=await handleRequest(request('/api/'+route+'?'+new URLSearchParams({address:canonical.address,addressId:canonical.id})),env);
      assert.equal(missing.status,422);
      const error=(await missing.json()).error;
      assert.match(error,/preverjen naslov/);
      assert.match(error,/objavljenih odvoznih območij/);
      assert.doesNotMatch(error,/Vnesite ulico/);
    }
    const collection={routes:[{id:'registered-test',name:'QA registered route',addresses:['Verd 12, Vrhnika'],events:[{id:'one',date:addDays(ljubljanaDate(),1),type:'packaging',label:'Synthetic published pickup',bin:''}]}]};
    await env.DB.prepare("UPDATE cms_content SET value=? WHERE section='collection'").bind(JSON.stringify(collection)).run();
    const result=await handleRequest(request('/api/collection?'+new URLSearchParams({address:'Verd 12',addressId:canonical.id})),env);assert.equal(result.status,200);const schedule=await result.json();assert.equal(schedule.address,canonical.address);assert.equal(schedule.events.length,1);
    const calendar=await handleRequest(request('/api/calendar?'+new URLSearchParams({address:canonical.address})),env);assert.equal(calendar.status,200);assert.match(calendar.headers.get('Content-Type'),/text\/calendar/);
    assert.equal((await handleRequest(request('/api/collection?'+new URLSearchParams({address:canonical.address,addressId:requireOfficialAddress('Verd 12a, Vrhnika').id})),env)).status,422);
  }finally{env.DB.close();}
});

test('older pending confirmations and unsubscribe remain usable while new management changes require a registered address',async()=>{
  const env=environment(),id=crypto.randomUUID(),legacy={name:'Legacy Citizen',address:'Previously stored address',districtId:'vrhnika',topics:['water']};
  try{
    await env.DB.prepare("INSERT INTO email_subscribers(id,email,status,name,address,district_id,topics,created_at,updated_at,pending_payload,pending_version,confirm_until) VALUES(?,'legacy@example.test','pending',?,?,?,'[\"water\"]',1,1,?,1,?)").bind(id,legacy.name,legacy.address,legacy.districtId,JSON.stringify(legacy),Date.now()+60000).run();
    const token=await subscriptionToken(env,id,'confirm',1),confirmed=await handleRequest(request('/api/subscriptions/confirm',{token}),env);assert.equal(confirmed.status,200);
    const manage=(await confirmed.json()).manageToken;
    assert.equal((await handleRequest(request('/api/subscriptions/manage',{token:manage,action:'inspect'}),env)).status,200);
    assert.equal((await handleRequest(request('/api/subscriptions/manage',{token:manage,address:legacy.address,districtId:'vrhnika',topics:['water']}),env)).status,422);
    const official=requireOfficialAddress('Cerkova 1, Borovnica');
    assert.equal((await handleRequest(request('/api/subscriptions/manage',{token:manage,address:official.address,addressId:official.id,districtId:'vrhnika',topics:['roads']}),env)).status,200);
    assert.equal((await env.DB.prepare('SELECT district_id FROM email_subscribers WHERE id=?').bind(id).first()).district_id,'borovnica');
    const off=await subscriptionToken(env,id,'unsubscribe');assert.equal((await handleRequest(request('/api/subscriptions/unsubscribe',{token:off}),env)).status,200);
  }finally{env.DB.close();}
});

const feature=(id,house='100400000000000001')=>({properties:{OBCINA_NAZIV:'Vrhnika',OBCINA_SIFRA:140,EID_NASLOV:id,EID_HISNA_STEVILKA:house,NASELJE_NAZIV:'Verd',ULICA_NAZIV:'Verd',HS_STEVILKA:12,HS_DODATEK:null,POSTNI_OKOLIS_SIFRA:1360,POSTNI_OKOLIS_NAZIV:'Vrhnika'}});
test('official importer deduplicates apartments but fails closed on truncation, repeated pages, conflicting identities and numeric EIDs',async()=>{
  const m=MUNICIPALITIES[0],next=new URL(`${SERVICE}/collections/${COLLECTION}/items`);next.search=new URLSearchParams({f:'json',limit:'1',filter:"OBCINA_NAZIV='Vrhnika'",'filter-lang':'cql-text',startIndex:'1'});
  const pages=[{numberMatched:2,numberReturned:1,features:[feature('101400000000000001')],links:[{rel:'next',href:next.href}]},{numberMatched:2,numberReturned:1,features:[feature('101400000000000002')],links:[]}];
  let at=0;const complete=await importMunicipality(m,{pageSize:1,fetcher:async()=>Response.json(pages[at++])});assert.equal(complete.sourceRows,2);assert.equal(complete.addresses.length,1);
  for(const bad of [ {...pages[0],links:[]}, {...pages[0],numberReturned:2}, {...pages[0],features:[{properties:{...feature('101400000000000001').properties,EID_NASLOV:101400000000000001}}]}])await assert.rejects(importMunicipality(m,{pageSize:1,fetcher:async()=>Response.json(bad)}));
  at=0;await assert.rejects(importMunicipality(m,{pageSize:1,fetcher:async()=>Response.json(at++===0?pages[0]:{...pages[1],features:pages[0].features})}),/duplicated/);
  assert.throws(()=>physicalAddress({...feature('101400000000000001').properties,OBCINA_SIFRA:5},m),/mismatch/);
});
