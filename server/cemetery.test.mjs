import test from 'node:test';
import assert from 'node:assert/strict';
import { findGraves, cemeterySectors, addCemeterySector, addCemeteryRow, addCemeteryGraves, positionCemeteryGrave, positionCemeteryRow } from '../src/data/cemetery.ts';
import { validateSection } from '../shared/cms-validation.js';
const empty=()=>({plan:{width:1000,height:1020,imageUrl:null},graves:[]});
const fixtures=[
 {id:'A-01-01',section:'A',row:1,number:1,x:100,y:100,people:[{name:'Ana Testna',born:'1900-01-01',died:'2000-01-01'},{name:'Franc Kovač',born:'',died:'2001-01-01'}]},
 {id:'B-02-01',section:'B',row:2,number:1,x:200,y:200,people:[{name:'Jože Testni',born:'',died:''}]},
];
test('cemetery search has no generated production fallback and finds second occupants without diacritics',()=>{
 assert.deepEqual(findGraves(''),[]);
 assert.deepEqual(findGraves('kovac','all',fixtures),[fixtures[0]]);
 assert.deepEqual(findGraves('KOVAČ Franc','all',fixtures),[fixtures[0]]);
 assert.deepEqual(findGraves('A-01-01','all',fixtures),[fixtures[0]]);
 assert.deepEqual(findGraves('','B',fixtures),[fixtures[1]]);
 assert.deepEqual(findGraves('Ana Kovač','all',fixtures),[]);
});
test('sector and row onboarding retain empty structure through a CMS save without inventing people or positions',()=>{
 let data=addCemeterySector(empty(),'A');data=addCemeteryRow(data,'A',1);data=addCemeteryRow(data,'A',2);data=addCemeterySector(data,'B');
 data=addCemeteryGraves(data,'A',1,1,3);
 const saved=validateSection('cemetery',data);
 assert.deepEqual(saved.sectors,[{name:'A',rows:[1,2]},{name:'B',rows:[]}]);
 assert.equal(saved.graves.length,3);
 assert.ok(saved.graves.every(grave=>grave.people.length===0&&grave.positioned===false));
 assert.throws(()=>addCemeterySector(data,'a'),/že obstaja/);
 assert.throws(()=>addCemeteryRow(data,'A',1),/že obstaja/);
 assert.throws(()=>addCemeteryGraves(data,'A',1,2,3),/že obstaja/);
 assert.equal(data.graves.length,3,'failed batch leaves original data intact');
 assert.throws(()=>addCemeteryGraves(data,'B',1,1,1),/izberite/);
});
test('legacy records infer structure; multiple people and unknown dates survive validation',()=>{
 const data={...empty(),graves:fixtures};
 assert.deepEqual(cemeterySectors(data),[{name:'A',rows:[1]},{name:'B',rows:[2]}]);
 assert.equal(validateSection('cemetery',data).graves[0].people.length,2);
 assert.equal(validateSection('cemetery',data).graves[1].people[0].born,'');
 assert.throws(()=>validateSection('cemetery',{...data,sectors:[{name:'A',rows:[1]}]}),/obstoječi vrsti/);
 assert.throws(()=>validateSection('cemetery',{...data,graves:[{...fixtures[0],people:[{name:'Test',born:'2001-01-01',died:'2000-01-01'}]}]}),/rojstvo/);
 assert.doesNotThrow(()=>validateSection('cemetery',{...data,graves:[{...fixtures[0],people:[{name:'Test',born:'2000-01-01',died:'2000-01-01'}]}]}));
});
test('operator-chosen single and row positions stay inside plan bounds and never move other rows',()=>{
 let data=addCemeteryRow(addCemeterySector(empty(),'A'),'A',1);data=addCemeteryGraves(data,'A',1,1,3);
 data=positionCemeteryGrave(data,data.graves[0].id,{x:9999,y:-100});
 assert.equal(data.graves[0].x,964);assert.equal(data.graves[0].y,0);assert.equal(data.graves[0].positioned,true);
 assert.equal(data.graves[1].positioned,false);
 data=positionCemeteryRow(data,'A',1,{x:100,y:100},{x:300,y:200});
 assert.deepEqual(data.graves.map(grave=>[grave.x,grave.y]),[[100,100],[200,150],[300,200]]);
 assert.ok(data.graves.every(grave=>grave.positioned));
 assert.throws(()=>positionCemeteryRow(data,'A',1,{x:100,y:100},{x:102,y:100}),/Razmak/);
 assert.throws(()=>positionCemeteryGrave(data,data.graves[0].id,{x:NaN,y:10}),/položaj/);
 assert.doesNotThrow(()=>validateSection('cemetery',data));
});
