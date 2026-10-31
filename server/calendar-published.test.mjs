import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from './worker.js';
import {addDays,ljubljanaDate} from './seed.js';

test('calendar series uses current published admin dates, excludes other fractions and detects changed selected dates',async()=>{
  const today=ljubljanaDate(),dates=[2,16,31,44].map(offset=>addDays(today,offset));
  let configured={routes:[{id:'route',name:'Pot',addresses:['Verd, Vrhnika'],events:[
    ...dates.map((date,index)=>({id:`bio-${index}`,type:'bio',label:'Biološki odpadki',date})),
    {id:'packaging',type:'packaging',label:'Embalaža',date:addDays(today,3)},
  ]}]};
  const env={DB:{prepare:()=>({bind(){return this;},first:async()=>({value:JSON.stringify(configured)})})}};
  const request=(params={})=>handleRequest(new Request('https://kpv.example/api/calendar?'+new URLSearchParams({address:'Verd 12, Vrhnika',eventId:'route-bio-0',repeat:'published',...params})),env);
  const response=await request();assert.equal(response.status,200);
  const text=(await response.text()).replace(/\r\n /g,'');
  assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,1);
  assert.match(text,/RRULE:FREQ=WEEKLY;/);
  assert.ok(!text.includes('SUMMARY:Embalaža'));
  assert.ok(text.includes('UNTIL='+dates.at(-1).replaceAll('-','')));
  assert.ok(text.includes('EXDATE;VALUE=DATE:'));
  assert.ok(!text.includes('Ponavljanje ste izbrali sami'));
  const once=await request({repeat:'once'});const single=await once.text();
  assert.ok(!single.includes('RRULE')&&!single.includes('EXDATE'));
  const next=addDays(dates[0],1);
  configured.routes[0].events[0].date=next;
  const refreshed=await request();assert.equal(refreshed.status,200);
  assert.ok((await refreshed.text()).includes('DTSTART;VALUE=DATE:'+next.replaceAll('-','')));
  assert.equal((await request({date:dates[0]})).status,409);
  assert.equal((await request({eventId:'deleted'})).status,404);
  assert.equal((await request({repeat:'weekly',interval:'1',count:'4'})).status,400);
});
