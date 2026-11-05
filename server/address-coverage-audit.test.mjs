import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAddressCoverage,coverageCsv} from '../scripts/audit-address-coverage.mjs';

test('coverage diagnostic separates fraction ambiguity, missing rules, expired assignments and exact canonical failure without inventing service coverage',()=>{
  const records=[{id:'100400000000000001',address:'Verd 12, Vrhnika',municipality:'Vrhnika',municipalityId:'vrhnika'},{id:'100400000000000002',address:'Unknown 99, Borovnica',municipality:'Borovnica',municipalityId:'borovnica'}];
  const event=(id,type,date)=>({id,type,date,label:'Synthetic published date'});
  const route=(id,events)=>({id,name:id,addresses:['Verd 12, Vrhnika'],events});
  const collection={routes:[route('bio',[event('bio','bio','2027-01-01')]),route('residual-old',[event('residual','residual','2020-01-01')]),route('large-vehicle',[event('large','packaging','2027-01-01')]),route('small-vehicle',[event('small','packaging','2027-01-02')])]};
  const result=analyzeAddressCoverage({collection,records,date:'2026-11-03',resolve:address=>records.find(row=>row.address===address&&row.municipalityId==='vrhnika')||null});
  assert.deepEqual(result.summary.canonicalRoundtrip,{checked:2,failures:1});
  assert.deepEqual(result.summary.municipalities.vrhnika.fractions.packaging,{assigned:0,ambiguous:1,missing:0,assignedWithFutureDates:0,assignedWithoutFutureDates:0});
  assert.equal(result.summary.municipalities.vrhnika.fractions.bio.assignedWithFutureDates,1);
  assert.equal(result.summary.municipalities.vrhnika.fractions.residual.assignedWithoutFutureDates,1);
  assert.equal(result.summary.municipalities.borovnica.noMatch,1);
  assert.equal(result.summary.totals.allFractionsWithFutureEvents,0);
  assert.equal(result.details[0].fractions.packaging.routeId,null);
  assert.match(coverageCsv(result.details),/HS:100400000000000001/);
  assert.ok(!coverageCsv(result.details).includes('undefined'));
});
