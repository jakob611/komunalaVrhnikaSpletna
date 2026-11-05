import test from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import published from '../shared/official-collection-2026.json' with {type:'json'};
import {handleRequest,calendar} from './worker.js';

const origin='https://kpv.example';
const env={DB:{prepare(){return {bind(){return this;},first:async()=>({value:JSON.stringify({routes:published.routes})})};}}};
const feed=(route,type,method='GET')=>handleRequest(new Request(origin+'/api/calendar/feed?'+new URLSearchParams({route,type,from:'2026-11-03'}),{method}),env);
const parse=text=>new ICAL.Component(ICAL.parse(text));

test('independent calendar client parses every published route/fraction with exactly its dated events',async()=>{
  let checked=0;
  for(const route of published.routes)for(const type of ['packaging','bio','residual']){
    const response=await feed(route.id,type);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/^text\/calendar/);
    const text=await response.text(),component=parse(text);
    const expected=route.events.filter(e=>e.type===type&&e.date>='2026-11-03').sort((a,b)=>a.date.localeCompare(b.date));
    const events=component.getAllSubcomponents('vevent').map(c=>new ICAL.Event(c));
    assert.deepEqual(events.map(e=>e.startDate.toString()),expected.map(e=>e.date),route.id+'/'+type);
    assert.equal(new Set(events.map(e=>e.uid)).size,events.length);
    for(let i=0;i<events.length;i++){
      assert.equal(events[i].startDate.isDate,true);
      assert.equal(events[i].endDate.isDate,true);
      assert.equal(events[i].endDate.toJSDate()-events[i].startDate.toJSDate(),86400000);
      assert.equal(events[i].summary,expected[i].label);
      assert.equal(events[i].location,route.name);
      assert.equal(events[i].isRecurring(),false);
    }
    for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75,'RFC5545 octet folding');
    checked++;
  }
  assert.equal(checked,96);
});

test('calendar clients can probe feeds with HEAD and get the GET metadata without a body',async()=>{
  const get=await feed('official-bio-b','bio'),head=await feed('official-bio-b','bio','HEAD');
  assert.equal(head.status,get.status);
  for(const key of ['content-type','content-disposition','cache-control'])assert.equal(head.headers.get(key),get.headers.get(key));
  assert.equal(await head.text(),'');
  const invalid=await feed('official-bio-b','unknown','HEAD');
  assert.equal(invalid.status,400);
  assert.equal(await invalid.text(),'');
});

test('subscription event descriptions distinguish a refreshing feed from a downloaded snapshot',async()=>{
  const text=await (await feed('official-bio-b','bio')).text();
  const subscribed=new ICAL.Event(parse(text).getFirstSubcomponent('vevent'));
  assert.doesNotMatch(subscribed.description,/se ne posodablja samodejno/);
  assert.match(subscribed.description,/naročnin/i);
  const snapshot=calendar({address:'Čolnarska cesta 1, Verd, Vrhnika',events:[{id:'escaped',date:'2026-12-01',label:'Č, š; \\\nŽ',type:'bio'}]});
  const imported=new ICAL.Event(parse(snapshot).getFirstSubcomponent('vevent'));
  assert.equal(imported.summary,'Č, š; \\\nŽ');
  assert.equal(imported.location,'Čolnarska cesta 1, Verd, Vrhnika');
  assert.match(imported.description,/se ne posodablja samodejno/);
});
