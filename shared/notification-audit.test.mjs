import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesNotice,validateDeliveryFields} from './notification-rules.js';

const notice={published:true,category:'water',districtIds:['vrhnika']};
const subscriber={status:'active',districtId:'vrhnika',topics:['water']};
function matches(address,rule,preferences={}) {
  return matchesNotice({...subscriber,address,...preferences},{...notice,addressRules:[rule]});
}

test('independent address audit: municipality, topic, confirmation and whole-house boundaries',()=>{
  const rows=[
    ['Tržaška cesta 48, Vrhnika','Tržaška cesta 48, Vrhnika',true],
    ['Trzaska cesta 48, 1360 Vrhnika','Tržaška cesta 48, Vrhnika',true],
    ['Tržaška cesta 48 a, Vrhnika','Tržaška cesta 48a, Vrhnika',true],
    ['Tržaška cesta 480, Vrhnika','Tržaška cesta 48, Vrhnika',false],
    ['Tržaška cesta 48a, Vrhnika','Tržaška cesta 48, Vrhnika',false],
    ['Partizanska ulica 12, Borovnica','Partizanska ulica, Vrhnika',false],
    ['Verd 12, 1360 Vrhnika','Verd, Vrhnika',true],
    ['Dragomer 12, Log - Dragomer','Log',false],
    ['Log 12, občina Log - Dragomer','Log',true],
  ];
  for(const [address,rule,expected] of rows)assert.equal(matches(address,rule),expected,`${address} / ${rule}`);
  assert.equal(matches('Verd 12, Vrhnika','Verd, Vrhnika',{districtId:'borovnica'}),false);
  assert.equal(matches('Verd 12, Vrhnika','Verd, Vrhnika',{topics:['roads']}),false);
  assert.equal(matches('Verd 12, Vrhnika','Verd, Vrhnika',{status:'pending'}),false);
});

test('independent address audit: punctuation must not drop an otherwise identical full address',()=>{
  assert.equal(matches('Tržaška cesta 48 Vrhnika','Tržaška cesta 48, Vrhnika'),true);
  assert.equal(matches('Tržaška cesta 48, Vrhnika','Tržaška cesta 48 Vrhnika'),true);
});

test('notification address variants preserve exact houses and distinct streets',()=>{
  const rows=[
    ['Tržaška c. 48 Vrhnika','Tržaška cesta 48, Vrhnika',true],
    ['Tržaška cesta 48, Vrhnika','Tržaška c. 48 Vrhnika',true],
    ['Cerkova ul. 1, Borovnica','Cerkova 1 Borovnica',true],
    ['Cerkova 1 Borovnica','Cerkova ulica 1, Borovnica',true],
    ['Tržaška cesta 48 1360 Vrhnika','Tržaška 48, Vrhnika',true],
    ['Tržaška cesta 48, 1360 Vrhnika','Tržaška 48 Vrhnika',true],
    ['Tržaška cesta 48-a Vrhnika','Tržaška cesta 48 a, Vrhnika',true],
    ['Cesta 6. maja 1, Vrhnika','Cesta 6 maja 1 Vrhnika',true],
    ['Cesta 6. maja 1, Vrhnika','Cesta 6. maja, Vrhnika',true],
    ['Cerkova cesta 1, Borovnica','Cerkova ulica 1, Borovnica',false],
    ['Cerkova ulica 1a, Borovnica','Cerkova 1 Borovnica',false],
    ['Tržaška cesta 48 Vrhnika','Tržaška cesta 48, Borovnica',false],
    ['Tržaška cesta 48, Vrhnika','Tržaška cesta 48a Vrhnika',false],
    ['Tržaška cesta 48-a, Vrhnika','Tržaška cesta 48 Vrhnika',false],
    ['Log 12, Log - Dragomer','Dragomer 12',false],
    ['Cerkova ulica 1/2, Borovnica','Cerkova 1, Borovnica',false],
  ];
  for(const [address,rule,expected] of rows)assert.equal(matches(address,rule),expected,`${address} / ${rule}`);
  assert.throws(()=>validateDeliveryFields({addressRules:['Cerkova ulica 1–15, Borovnica']}),/vsako hišo/);
});
