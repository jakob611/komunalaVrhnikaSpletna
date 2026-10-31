// Independent integration audit: exercise the real CMS routes, not editor internals.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import {localD1} from './local-d1.mjs';
import {handleAdmin} from './admin.js';
import {createTestSession} from './admin-auth-test-helpers.mjs';
import defaults from '../shared/site-defaults.json' with {type:'json'};
import officialTariffs from '../shared/official-tariffs-2026.json' with {type:'json'};
import {validateSection} from '../shared/cms-validation.js';
const base='http://127.0.0.1:5173',password='test-only-admin-passphrase';
function environment(){const salt=Buffer.alloc(16,23);return {DB:localD1(':memory:'),LOCAL_STORAGE:{},ADMIN_OWNER_EMAIL:'owner@example.com',ADMIN_PASSWORD_HASH:`v1:100000:${salt.toString('hex')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}`,EMAIL_FROM:'KPV <auth@example.com>'};}
function request(path,{session,method='GET',body,csrf=true,origin=base}={}){return new Request(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session.cookie,...(csrf?{'X-CSRF-Token':session.csrfToken}:{})}:{})},body:body===undefined?undefined:JSON.stringify(body)});}

test('audit: new section defaults and legacy rates migration align with the CMS schema',()=>{
 assert.deepEqual(defaults.tariffs,officialTariffs);
 assert.deepEqual(validateSection('rates',{...defaults.rates,wasteBase:6.5,wastePerson:1.8,bio:4.2,waterBase:5,waterPerM3:.95,drainagePerM3:1.25}),defaults.rates);
 for(const [section,value] of Object.entries(defaults))assert.deepEqual(validateSection(section,value),value,section);
});

test('audit: tariff CMS edits enforce auth, CSRF and revision; history restore republishes a validated version',async()=>{
 const env=environment();
 assert.equal((await handleAdmin(request('/api/admin/content/tariffs',{method:'PUT',body:{value:defaults.tariffs,revision:0}}),env)).status,401);
 const session=await createTestSession(env,{password});
 const value=structuredClone(defaults.tariffs);value.municipalities[0].waterM3=2.1234;
 const path='/api/admin/content/tariffs',body={value,revision:0};
 assert.equal((await handleAdmin(request(path,{session,method:'PUT',body,csrf:false}),env)).status,403);
 assert.equal((await handleAdmin(request(path,{session,method:'PUT',body,origin:'https://other.example'}),env)).status,403);
 const saved=await handleAdmin(request(path,{session,method:'PUT',body}),env);assert.equal(saved.status,200,await saved.clone().text());assert.equal((await saved.json()).revision,1);
 assert.equal((await handleAdmin(request(path,{session,method:'PUT',body}),env)).status,409);
 const publicData=await (await handleAdmin(request('/api/content'),env)).json();assert.equal(publicData.sections.tariffs.municipalities[0].waterM3,2.1234);
 const history=await (await handleAdmin(request('/api/admin/history/tariffs',{session}),env)).json();assert.ok(history.items.some(row=>row.revision===0));
 const restored=await handleAdmin(request('/api/admin/restore/tariffs',{session,method:'POST',body:{revision:0,currentRevision:1}}),env);assert.equal(restored.status,200,await restored.clone().text());
 assert.deepEqual((await restored.json()).value,defaults.tariffs);
 assert.equal((await (await handleAdmin(request('/api/content'),env)).json()).revisions.tariffs,2);
 const invalid=structuredClone(value);invalid.municipalities[0].sourceUrl='javascript:alert(1)';
 assert.equal((await handleAdmin(request(path,{session,method:'PUT',body:{value:invalid,revision:2}}),env)).status,400);
 env.DB.close();
});

test('audit: structured cemetery records publish and restore without exposing private operational records',async()=>{
 const env=environment(),session=await createTestSession(env,{password});
 await env.DB.prepare("INSERT INTO submissions(id,kind,created_at,status,payload) VALUES('private-case','requests',?,'demo-saved',?)").bind(new Date().toISOString(),JSON.stringify({email:'private-person@example.com',message:'private audit sentinel'})).run();
 const value={...structuredClone(defaults.cemetery),sectors:[{name:'Audit-sector',rows:[1]}],graves:[{id:'audit-grave-1',section:'Audit-sector',row:1,number:1,x:0,y:0,positioned:false,people:[{name:'Testna oseba',born:'',died:''}]}]};
 const path='/api/admin/content/cemetery';
 const saved=await handleAdmin(request(path,{session,method:'PUT',body:{value,revision:0}}),env);assert.equal(saved.status,200,await saved.clone().text());
 const response=await handleAdmin(request('/api/content'),env),text=await response.text();assert.equal(text.includes('private audit sentinel'),false);assert.equal(text.includes('private-person@example.com'),false);
 assert.deepEqual(JSON.parse(text).sections.cemetery,value);
 const stale=await handleAdmin(request('/api/admin/restore/cemetery',{session,method:'POST',body:{revision:0,currentRevision:0}}),env);assert.equal(stale.status,409);
 const restored=await handleAdmin(request('/api/admin/restore/cemetery',{session,method:'POST',body:{revision:0,currentRevision:1}}),env);assert.equal(restored.status,200,await restored.clone().text());assert.deepEqual((await restored.json()).value,defaults.cemetery);
 env.DB.close();
});
