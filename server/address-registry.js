import snapshot from '../shared/official-addresses.json' with { type:'json' };
import metadata from '../shared/official-addresses-source.json' with { type:'json' };
import { hasAmbiguousHouseNumbers } from '../shared/collection-utils.js';

const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };
export const normalizeOfficialAddress = value => value
  .replace(/\b(c|ul)\.(?=\s|\d|$)/gi,(_,kind)=>kind.toLowerCase()==='c'?'cesta ':'ulica ')
  .replace(/\b(\d+)\s*-\s*([a-z])\b/gi,'$1$2')
  .replace(/,\s*(?:stanovanje|stan\.)\s*\d+[a-z]?\s*(?=,|$)/gi,'')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\b(\d+)\s+([a-z])\b/g,'$1$2');
const publicAddress = ({id,address,municipality,municipalityId}) => ({id,address,municipality,municipalityId});

/** Pure bundled public data only: no request state, network dependency or PII. */
export function createAddressRegistry(rows,source) {
  const byId=new Map(),exact=new Map();
  const collator=new Intl.Collator('sl',{numeric:true});
  const add=(value,id)=>{const key=normalizeOfficialAddress(value),ids=exact.get(key)||new Set();ids.add(id);exact.set(key,ids);};
  const indexed=rows.map(row=>{
    if(byId.has(row.id)||typeof row.id!=='string'||!/^\d{16,20}$/.test(row.id))throw Error('Invalid bundled official address identity');
    byId.set(row.id,row);
    const primary=`${row.street||row.settlement} ${row.number}`;
    const shortStreet = row.street.replace(/\b(?:cesta|ulica)\b/gi,'').trim();
    const shortPrimary = shortStreet ? `${shortStreet} ${row.number}` : primary;
    for(const prefix of new Set([primary,shortPrimary]))for(const alias of [prefix,row.address,`${prefix}, ${row.settlement}`,`${prefix}, ${row.municipality}`,`${prefix}, ${row.postcode} ${row.settlement}`,`${prefix}, ${row.postcode} ${row.municipality}`,`${prefix}, ${row.postcode} ${row.postTown}`])add(alias,row.id);
    return{row,canonicalKey:normalizeOfficialAddress(row.address),key:normalizeOfficialAddress(`${row.address} ${row.postcode} ${row.postTown}`)};
  });
  indexed.sort((a,b)=>collator.compare(a.row.address,b.row.address)||a.row.id.localeCompare(b.row.id));
  const checked = value => {
    if(typeof value!=='string'||value.length>250||/[<>\u0000-\u001f\u007f\\]/.test(value))fail(400,'Vnesite naslov in ga izberite na seznamu uradnih naslovov.');
    if(hasAmbiguousHouseNumbers(value))fail(400,'Vnesite eno hišno številko. Zapis s poševnico ali razponom je dvoumen; stanovanje navedite za vejico, npr. »Verd 12, stanovanje 1, Vrhnika«.');
    if(value.includes('/'))fail(400,'Vnesite naslov in ga izberite na seznamu uradnih naslovov.');
    return normalizeOfficialAddress(value);
  };
  const matching = value => [...(exact.get(checked(value))||[])];
  const sourceInfo = () => ({name:source.name,url:source.url,updatedAt:source.updatedAt});
  return {
    resolve(value) {
      const ids=matching(value);
      return ids.length===1?publicAddress(byId.get(ids[0])):null;
    },
    require(value,id) {
      const ids=matching(value);
      if(id!==undefined && (typeof id!=='string'||!/^\d{16,20}$/.test(id)||!ids.includes(id)))fail(422,'Izbrani naslov se ne ujema z vnosom. Znova ga izberite na seznamu uradnih naslovov.');
      const resolved=id===undefined?(ids.length===1?byId.get(ids[0]):null):byId.get(id);
      if(!resolved)fail(422,'Naslova ni mogoče enolično potrditi v registru. Izberite hišno številko na seznamu uradnih naslovov.');
      return publicAddress(resolved);
    },
    query(params) {
      for(const key of ['q','address','limit'])if(params.getAll(key).length>1)fail(400,'Iskanje naslova ni veljavno.');
      if(params.has('q')===params.has('address'))fail(400,'Vnesite iskalni niz ali celoten naslov.');
      const limitText=params.get('limit')||'20';
      if(!/^\d{1,2}$/.test(limitText)||Number(limitText)<1||Number(limitText)>20)fail(400,'Dovoljenih je največ 20 zadetkov.');
      if(params.has('address')) {
        const address=this.resolve(params.get('address'));
        return{addresses:address?[address]:[],source:sourceInfo(),more:false};
      }
      const raw=params.get('q'),key=checked(raw);
      if(key.length<3)return{addresses:[],source:sourceInfo(),more:false};
      const tokens=key.split(' ');
      const matches=indexed.filter(item=>tokens.every(token=>item.key.includes(token)));
      // Postal localities can cross municipality boundaries. Prefer the text
      // shown in the picker before matches found only through a postal alias.
      const visible=matches.filter(item=>tokens.every(token=>item.canonicalKey.includes(token)));
      const postal=matches.filter(item=>!tokens.every(token=>item.canonicalKey.includes(token)));
      const ranked=[...visible.filter(item=>item.canonicalKey.startsWith(key)),...visible.filter(item=>!item.canonicalKey.startsWith(key)),...postal];
      return{addresses:ranked.slice(0,Number(limitText)).map(item=>publicAddress(item.row)),source:sourceInfo(),more:ranked.length>Number(limitText)};
    },
  };
}
export const officialAddresses=createAddressRegistry(snapshot,metadata);
export const requireOfficialAddress=(address,addressId)=>officialAddresses.require(address,addressId);
export const queryOfficialAddresses=params=>officialAddresses.query(params);
