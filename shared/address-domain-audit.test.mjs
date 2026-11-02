import test from 'node:test';
import assert from 'node:assert/strict';
import { addressRuleMatches, matchCollectionRoute } from './collection-utils.js';
import { notificationAddressMatches, matchesNotice, validateDeliveryFields } from './notification-rules.js';
import { validateSection } from './cms-validation.js';

test('shared address matrix keeps street, exact house, suffix, locality and apartment boundaries', () => {
  const rows = [
    ['Trzaska c.48, 1360 Vrhnika', 'Tržaška cesta 48, Vrhnika', true],
    ['Tržaška cesta 48-a, Vrhnika', 'Tržaška c.48 a, Vrhnika', true],
    ['Čopova ul. 12 A, Vrhnika', 'Copova ulica 12a, Vrhnika', true],
    ['Čopova ulica 12a, stanovanje 4, Vrhnika', 'Čopova ulica 12a, Vrhnika', true],
    ['Verd 12, stanovanje 2, Vrhnika', 'Verd 12, Vrhnika', true],
    ['Verd 12, stanovanje 2, Vrhnika', 'Verd, Vrhnika', true],
    ['Log 12, občina Log - Dragomer', 'Log', true],
    ['Lukovica pri Brezovici 12, občina Log-Dragomer', 'Lukovica pri Brezovici', true],
    ['Tržaška cesta 480, Vrhnika', 'Tržaška cesta 48, Vrhnika', false],
    ['Tržaška cesta 48a, Vrhnika', 'Tržaška cesta 48, Vrhnika', false],
    ['Tržaška cesta 48, Vrhnika', 'Tržaška cesta 48a, Vrhnika', false],
    ['Tržaška cesta 48, Ljubljana', 'Tržaška cesta 48, Vrhnika', false],
    ['Tržaška ulica 48, Vrhnika', 'Tržaška cesta 48, Vrhnika', false],
    ['Podvrhnika 12', 'Vrhnika', false],
    ['Dragomer 12, Log - Dragomer', 'Log', false],
    ['Logatec 12', 'Log', false],
    ['Lukovica pri Domžalah 12', 'Lukovica pri Brezovici', false],
    ['Janezova vas 12, Vrhnika', 'Vas, Vrhnika', false],
    ['Verd 12/1, Vrhnika', 'Verd 12, Vrhnika', false],
    ['Verd 12/1, Vrhnika', 'Verd, Vrhnika', false],
    ['Verd 12–14, Vrhnika', 'Verd, Vrhnika', false],
    ['Verd 12-14, Vrhnika', 'Verd 12, Vrhnika', false],
    ['Verd 12 do 14, Vrhnika', 'Verd, Vrhnika', false],
    ['Verd 12 a–14, Vrhnika', 'Verd, Vrhnika', false],
    ['Verd 12-a/14, Vrhnika', 'Verd, Vrhnika', false],
    ['Verd 12, Vrhnika', 'Verd 12–14, Vrhnika', false],
  ];
  for (const [address, rule, expected] of rows) {
    assert.equal(addressRuleMatches(address, rule), expected, `collection: ${address} / ${rule}`);
    assert.equal(notificationAddressMatches(address, rule), expected, `notification: ${address} / ${rule}`);
  }
});

test('qualified route aliases cannot bypass the declared locality and exact houses beat a whole street', () => {
  const event = { id:'next',type:'bio',label:'BIO',date:'2026-12-01' };
  const routes = [
    {id:'whole',name:'Whole street',addresses:['Čopova ulica','Čopova ulica, Vrhnika'],events:[event]},
    {id:'house',name:'House',addresses:['Čopova ulica 12a, Vrhnika'],events:[event]},
  ];
  for (const address of ['Čopova ul.12-a, Vrhnika','Copova ulica 12 A, stanovanje 2, 1360 Vrhnika'])
    assert.equal(matchCollectionRoute(address,routes).route?.id,'house',address);
  assert.equal(matchCollectionRoute('Čopova ulica 12, Vrhnika',routes).route?.id,'whole');
  assert.equal(matchCollectionRoute('Čopova ul.12, Ljubljana',routes).route,null);
  assert.equal(matchCollectionRoute('Čopova ul.12',routes).route?.id,'whole');
  assert.equal(matchCollectionRoute('Čopova ul.12/1, Vrhnika',routes).route,null);
});

test('both publication validators reject ambiguous house ranges before changing public routing', () => {
  for (const rule of ['Verd 12/1, Vrhnika','Verd 12–14, Vrhnika','Verd 12 do 14, Vrhnika']) {
    assert.throws(()=>validateDeliveryFields({addressRules:[rule]}),/vsako hišo/);
    assert.throws(()=>validateSection('collection',{routes:[{id:'verd',name:'Verd',addresses:[rule],events:[]}]}),/hišne razpone/);
  }
  assert.doesNotThrow(()=>validateSection('collection',{routes:[{id:'verd',name:'Verd',addresses:['Verd 12-a, Vrhnika'],events:[]}]}));
});

test('address text never substitutes for explicit notification topic and district selection', () => {
  const subscriber={status:'active',districtId:'borovnica',topics:['water'],address:'Verd 12, Vrhnika'};
  const notice={published:true,category:'water',districtIds:['vrhnika'],addressRules:['Verd, Vrhnika']};
  assert.equal(matchesNotice(subscriber,notice),false);
  assert.equal(matchesNotice({...subscriber,districtId:'vrhnika'},notice),true);
  assert.equal(matchesNotice({...subscriber,districtId:'vrhnika',topics:['waste']},notice),false);
  assert.equal(matchesNotice({...subscriber,districtId:'vrhnika',status:'pending'},notice),false);
  assert.equal(matchesNotice(subscriber,{...notice,allDistricts:true}),true);
});
