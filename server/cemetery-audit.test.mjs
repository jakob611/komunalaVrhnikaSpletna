import test from 'node:test';
import assert from 'node:assert/strict';
import {addCemeterySector,addCemeteryRow,addCemeteryGraves,positionCemeteryRow} from '../src/data/cemetery.ts';
import {validateSection} from '../shared/cms-validation.js';
function row(){let data={plan:{width:1000,height:1000,imageUrl:null},graves:[]};data=addCemeterySector(data,'Audit');data=addCemeteryRow(data,'Audit',1);return addCemeteryGraves(data,'Audit',1,1,2);}

test('independent cemetery audit: row placement checks actual clamped rectangular footprints',()=>{
 const data=row();
 assert.throws(()=>positionCemeteryRow(data,'Audit',1,{x:-18,y:-16},{x:18,y:-16}),/razmak|premajhen|prekriv|krajišč|načrt/i);
 assert.throws(()=>positionCemeteryRow(data,'Audit',1,{x:0,y:0},{x:26,y:26}),/razmak|premajhen|prekriv/i);
 const placed=positionCemeteryRow(data,'Audit',1,{x:100,y:100},{x:140,y:140});
 assert.deepEqual(placed.graves.map(g=>[g.x,g.y]),[[100,100],[140,140]]);
 assert.doesNotThrow(()=>validateSection('cemetery',placed));
 assert.ok(data.graves.every(g=>g.positioned===false),'failed placement leaves original records intact');
});

test('independent cemetery audit: explicitly confirmed plot footprint must remain inside its plan',()=>{
 const data=row();
 data.graves[0]={...data.graves[0],positioned:true,x:1000,y:1000};
 assert.throws(()=>validateSection('cemetery',data),/položaj|načrt|mej|grob/i);
 data.graves[0]={...data.graves[0],x:964,y:968};
 assert.doesNotThrow(()=>validateSection('cemetery',data));
});
