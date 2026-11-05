import test from 'node:test';
import assert from 'node:assert/strict';
import { addressRuleMatches, matchCollectionRoute, matchCollectionSchedule } from './collection-utils.js';
import { notificationAddressMatches, matchesNotice, validateDeliveryFields, validatePreferences } from './notification-rules.js';

const base = {status:'active',districtId:'vrhnika',topics:['water']};
const houseNotice = {published:true,category:'water',districtIds:['vrhnika'],addressRules:['Tržaška cesta 48, Vrhnika','Tržaška cesta 50a, Vrhnika']};
const districts = [{id:'vrhnika',active:true},{id:'verd',active:true},{id:'borovnica',active:true},{id:'retired',active:false}];
const event = type=>({id:type,type,label:type,date:'2099-12-01'});

test('final house-subset matrix targets the OR-list without widening suffixes, towns or apartments',()=>{
  const rows = [
    ['Tržaška cesta 48, Vrhnika',true],
    ['Trzaska c.48, 1360 Vrhnika',true],
    ['Tržaška cesta 48 Vrhnika',true],
    ['Tržaška cesta 48, stanovanje 2, Vrhnika',true],
    ['Tržaška cesta 50-a, Vrhnika',true],
    ['Tržaška cesta 50 A, Vrhnika',true],
    ['Tržaška cesta 480, Vrhnika',false],
    ['Tržaška cesta 48a, Vrhnika',false],
    ['Tržaška cesta 50, Vrhnika',false],
    ['Tržaška cesta 50b, Vrhnika',false],
    ['Tržaška cesta 48, Ljubljana',false],
    ['Tržaška ulica 48, Vrhnika',false],
    ['Tržaška cesta 48',false],
    ['Tržaška cesta',false],
    ['Vrhnika',false],
    ['abc',false],
    ['Tržaška cesta 48/2, Vrhnika',false],
    ['Tržaška cesta 48–50, Vrhnika',false],
  ];
  for(const[address,expected]of rows)assert.equal(matchesNotice({...base,address},houseNotice),expected,address);
  assert.equal(notificationAddressMatches('Tržaška cesta 48, stanovanje 2, Vrhnika','Tržaška cesta 48, stanovanje 3, Vrhnika'),false);
  assert.equal(notificationAddressMatches('Tržaška cesta 48, stanovanje 2, Vrhnika','Tržaška cesta 48, stanovanje 2, Vrhnika'),true);
});

test('flat districts do not infer municipality ancestry and all-districts never removes the house/topic/status gate',()=>{
  const address='Verd 12, Vrhnika';
  const targeted={...houseNotice,addressRules:['Verd 12, Vrhnika']};
  for(const districtId of ['verd','borovnica']){
    assert.equal(matchesNotice({...base,address,districtId},targeted),false);
    assert.equal(matchesNotice({...base,address,districtId},{...targeted,allDistricts:true}),true);
  }
  for(const status of ['pending','unsubscribed','suppressed'])
    assert.equal(matchesNotice({...base,address,status},{...targeted,allDistricts:true}),false,status);
  assert.equal(matchesNotice({...base,address,topics:['roads']},{...targeted,allDistricts:true}),false);
  assert.equal(matchesNotice({...base,address:'Verd 112, Vrhnika'},{...targeted,allDistricts:true}),false);
});

test('street-wide and locality-wide rules are textual scopes, while missing locality deliberately has no registry protection',()=>{
  for(const house of ['48','48a','480'])assert.equal(notificationAddressMatches(`Tržaška cesta ${house}, Vrhnika`,'Tržaška cesta, Vrhnika'),true);
  assert.equal(notificationAddressMatches('Tržaška cesta 48, Ljubljana','Tržaška cesta, Vrhnika'),false);
  assert.equal(notificationAddressMatches('Verd 12, Vrhnika','Vrhnika'),true);
  assert.equal(notificationAddressMatches('Vrhnika','Vrhnika'),true);
  assert.equal(notificationAddressMatches('Podvrhnika 12','Vrhnika'),false);
  assert.equal(notificationAddressMatches('Janezova vas 12, Vrhnika','Vas, Vrhnika'),false);
  assert.equal(notificationAddressMatches('Lukovica pri Domžalah 12','Lukovica pri Brezovici'),false);
  // This existing limitation is evidence for requiring a town in operator input,
  // not an endorsement that an unqualified street is geographically verified.
  assert.equal(notificationAddressMatches('Tržaška cesta 48, Ljubljana','Tržaška cesta'),true);
  assert.equal(notificationAddressMatches('Tržaška cesta 48, Vrhnika','Tržaška cesta'),true);
});

test('preference validation proves only format, an active chosen district and topic, not a real complete household address',()=>{
  for(const address of ['abc','Vrhnika','Tržaška cesta','Tržaška cesta 48','Verd 12, stanovanje 1, Vrhnika']){
    assert.equal(validatePreferences({name:'Ana Novak',address,districtId:'vrhnika',topics:['water']},districts).address,address);
  }
  for(const districtId of ['missing','retired'])assert.throws(()=>validatePreferences({name:'Ana Novak',address:'Verd 12, Vrhnika',districtId,topics:['water']},districts));
  for(const address of ['Verd 12/1, Vrhnika','Verd 12–14, Vrhnika','Verd 12 do 14, Vrhnika'])assert.throws(()=>validatePreferences({name:'Ana Novak',address,districtId:'vrhnika',topics:['water']},districts),error=>error.status===400&&/stanovanje navedite za vejico/.test(error.message));
  for(const addressRules of [['Verd 12/1, Vrhnika'],['Verd 12–14, Vrhnika'],['Verd 12 do 14, Vrhnika']])assert.throws(()=>validateDeliveryFields({addressRules}));
  assert.deepEqual(validateDeliveryFields({addressRules:['Verd 12, Vrhnika','Verd 14, Vrhnika']}),{addressRules:['Verd 12, Vrhnika','Verd 14, Vrhnika']});
});

test('collection chooses an exact house, rejects conflicting towns and equal best routes, and keeps fractions independent',()=>{
  const route=(id,addresses,type)=>({id,name:id,addresses,events:[event(type)]});
  const routes=[route('bio-street',['Tržaška cesta, Vrhnika'],'bio'),route('bio-house',['Tržaška cesta 48, Vrhnika'],'bio'),route('packaging',['Tržaška cesta, Vrhnika'],'packaging'),route('residual',['Tržaška cesta 48, Vrhnika'],'residual')];
  assert.equal(matchCollectionRoute('Tržaška cesta 48, Vrhnika',routes.filter(r=>r.id.startsWith('bio'))).route?.id,'bio-house');
  const exact=matchCollectionSchedule('Tržaška cesta 48, Vrhnika',routes);
  assert.deepEqual(Object.values(exact.matches).map(m=>m.route?.id),['packaging','bio-house','residual']);
  const otherHouse=matchCollectionSchedule('Tržaška cesta 48a, Vrhnika',routes);
  assert.deepEqual(otherHouse.incompleteTypes,['residual']);
  const ambiguous=matchCollectionSchedule('Tržaška cesta 48, Vrhnika',[...routes,route('residual-second',['Tržaška cesta 48, Vrhnika'],'residual')]);
  assert.deepEqual(ambiguous.ambiguousTypes,['residual']);
  assert.equal(ambiguous.matches.bio.route?.id,'bio-house');
  for(const address of ['Tržaška cesta 48, Ljubljana','Tržaška cesta 48/2, Vrhnika'])assert.equal(matchCollectionRoute(address,routes).route,null,address);
  assert.equal(addressRuleMatches('Verd 12, stanovanje 2, Vrhnika','Verd 12, Vrhnika'),true);
});

test('domain-specific spelling support is not falsely described as identical: notifications additionally accept omitted street kind',()=>{
  assert.equal(notificationAddressMatches('Tržaška 48, Vrhnika','Tržaška cesta 48, Vrhnika'),true);
  assert.equal(addressRuleMatches('Tržaška 48, Vrhnika','Tržaška cesta 48, Vrhnika'),false);
  // The documented apartment format is a separate comma-delimited component.
  assert.equal(notificationAddressMatches('Tržaška cesta 48 stanovanje 2 Vrhnika','Tržaška cesta 48, Vrhnika'),false);
});
