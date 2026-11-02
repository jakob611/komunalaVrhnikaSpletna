import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { localD1 } from './local-d1.mjs';
import { handleRequest } from './worker.js';
import { createTestSession } from './admin-auth-test-helpers.mjs';
import defaults from '../shared/site-defaults.json' with { type:'json' };

const base='http://127.0.0.1:5173';
test('AE22/23 authenticated settings and nested hours drafts remain private, publish, survive fresh requests and reject stale draft overwrite',async()=>{
  const salt=Buffer.alloc(16,31),password='test-only-admin-passphrase';
  const env={DB:localD1(':memory:'),LOCAL_STORAGE:{},ADMIN_OWNER_EMAIL:'owner@example.test',EMAIL_FROM:'KPV <auth@example.test>',ADMIN_PASSWORD_HASH:`v1:100000:${salt.toString('hex')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}`};
  try{
    const session=await createTestSession(env,{base,password});
    const call=(path,method='GET',value)=>handleRequest(new Request(base+path,{method,headers:{Origin:base,Cookie:session.cookie,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})}),env);
    const settings={...defaults.settings,siteName:'Komunala – objavljeni popravek',emergencyPhone:'041 123 456',footerText:'Potrjena objavljena vsebina.'};
    const hours=structuredClone(defaults.hours);
    const office=hours.shift();office.phone='01 123 45 67';office.rows=[['Sobota','10.00–12.00'],['Sreda','8.00–10.00']];hours.splice(1,0,office);
    for(const[section,value]of Object.entries({settings,hours})){
      const draft=await call(`/api/admin/drafts/${section}`,'PUT',{value,baseRevisions:{[section]:0},revision:0});
      assert.equal(draft.status,200,await draft.clone().text());
      assert.deepEqual((await(await call('/api/content')).json()).sections[section],defaults[section]);
      const recovered=(await(await call(`/api/admin/drafts/${section}`)).json()).draft;
      assert.deepEqual(recovered.value,value);
      assert.deepEqual(recovered.baseRevisions,{[section]:0});
      const published=await call(`/api/admin/content/${section}`,'PUT',{value:recovered.value,revision:recovered.baseRevisions[section]});
      assert.equal(published.status,200,await published.clone().text());
      assert.equal((await published.json()).revision,1);
      // A fresh request uses durable published content, rather than the editor's memory.
      assert.deepEqual((await(await call('/api/content')).json()).sections[section],value);
      assert.deepEqual((await(await call('/api/admin/content')).json()).sections[section],value);
      const stale=await call(`/api/admin/content/${section}`,'PUT',{value:defaults[section],revision:0});
      assert.equal(stale.status,409);
      assert.deepEqual((await(await call('/api/content')).json()).sections[section],value);
    }
    const history=await(await call('/api/admin/history/hours')).json();
    assert.equal(history.items[0].revision,1);
    assert.deepEqual(history.items[0].value,hours);
  }finally{env.DB.close();}
});
