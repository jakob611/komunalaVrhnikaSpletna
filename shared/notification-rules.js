import { addressRuleMatches, addressTokens } from './collection-utils.js';

export const NOTIFICATION_TOPICS = Object.freeze({water:'Voda in kanalizacija',roads:'Ceste in javne površine',waste:'Odpadki',general:'Splošno'});

const roadKinds = new Set(['cesta','ulica','pot','trg']);
const houseRange = /\b\d+[a-z]?\s*[-–—/]\s*\d+[a-z]?\b/i;
function notificationAddress(value) {
  return String(value).replace(/\b(c|ul)\.(?=\s|$)/gi,(_,kind)=>kind.toLowerCase()==='c'?'cesta':'ulica').replace(/\b(\d+)\s*-\s*([a-z])\b/gi,'$1$2');
}
function primaryRoadKinds(value) {
  return addressTokens(value.split(',')[0]).filter(token=>roadKinds.has(token));
}
function withoutRoadKind(value) {
  const [primary,...rest]=value.split(',');
  return [addressTokens(primary).filter(token=>!roadKinds.has(token)).join(' '),...rest].join(',');
}
function fullAddressTokens(value) {
  return value.split(',').flatMap(part=> {
    const tokens=addressTokens(part).filter(token=>token!=='obcina');
    // A postcode precedes a locality, either in its own component or after a house.
    return tokens.filter((token,index)=>!(/^\d{4}$/.test(token)&&index<tokens.length-1&&(index===0||tokens.slice(0,index).some(t=>/^\d+[a-z]?$/.test(t)))));
  });
}
export function notificationAddressMatches(address,rule) {
  if(houseRange.test(address)||houseRange.test(rule))return false;
  let full=notificationAddress(address),pattern=notificationAddress(rule);
  const fullKinds=primaryRoadKinds(full),patternKinds=primaryRoadKinds(pattern);
  // A missing street type is common shorthand, but two explicitly different types
  // can identify different streets and must never be treated as equivalent.
  if(fullKinds.length&&patternKinds.length&&!fullKinds.some(kind=>patternKinds.includes(kind)))return false;
  if(!fullKinds.length||!patternKinds.length) {
    full=withoutRoadKind(full);pattern=withoutRoadKind(pattern);
  }
  if(addressRuleMatches(full,pattern))return true;
  // Commas are optional for a complete address. Compare every token so house
  // suffixes, compound settlements and different towns retain their boundaries.
  const a=fullAddressTokens(full),b=fullAddressTokens(pattern);
  return a.length>0&&a.length===b.length&&a.every((token,index)=>token===b[index]);
}

export function validateDistricts(value) {
  if (!Array.isArray(value) || value.length > 100) throw Object.assign(Error('Dovoljenih je največ 100 območij obveščanja.'),{status:400});
  const ids = new Set();
  return value.map(d => {
    if (!d || Object.keys(d).some(k => !['id','name','description','active'].includes(k)) ||
      !/^[a-z0-9][a-z0-9-]{0,79}$/.test(d.id) || ids.has(d.id) ||
      typeof d.name !== 'string' || !d.name.trim() || d.name.length > 160 || /[<>]/.test(d.name) ||
      typeof d.description !== 'string' || d.description.length > 600 || /[<>]/.test(d.description) || typeof d.active !== 'boolean')
      throw Object.assign(Error('Preverite naziv, opis in enolično oznako območja.'),{status:400});
    ids.add(d.id);
    return {id:d.id,name:d.name.trim(),description:d.description.trim(),active:d.active};
  });
}

export function validateDeliveryFields(item) {
  const result = {};
  if (item.allDistricts !== undefined) {
    if (typeof item.allDistricts !== 'boolean') throw Object.assign(Error('Izbor vseh območij mora biti vključen ali izključen.'),{status:400});
    result.allDistricts = item.allDistricts;
  }
  for (const key of ['districtIds','addressRules']) if (item[key] !== undefined) {
    if (!Array.isArray(item[key]) || item[key].length > (key === 'districtIds' ? 100 : 200) || item[key].some(s => typeof s !== 'string' || !s.trim() || s.length > 250 || /[<>\r\n]/.test(s))) throw Object.assign(Error('Preverite območja in naslovna pravila obvestila.'),{status:400});
    result[key] = [...new Set(item[key].map(s => s.trim()))];
    if(key==='addressRules'&&result[key].some(s=>houseRange.test(s)))throw Object.assign(Error('Hišnih razponov ne razbiramo. Vnesite vsako hišo v svojo vrstico ali samo ulico oziroma naselje za vse hiše.'),{status:400});
  }
  return result;
}

export function matchesNotice(subscriber, notice) {
  if (subscriber.status !== 'active' || notice.published === false || !subscriber.topics.includes(notice.category)) return false;
  if (!notice.allDistricts && !(notice.districtIds || []).includes(subscriber.districtId)) return false;
  return !(notice.addressRules || []).length || notice.addressRules.some(rule => notificationAddressMatches(subscriber.address, rule));
}

export function validatePreferences(value, districts) {
  if (!value || typeof value.name !== 'string' || value.name.trim().length < 2 || value.name.length > 120 ||
    typeof value.address !== 'string' || value.address.trim().length < 3 || value.address.length > 250 || /[<>\r\n]/.test(value.address) ||
    !districts.some(d => d.id === value.districtId && d.active) || !Array.isArray(value.topics) || !value.topics.length || value.topics.length > 4 || value.topics.some(t => !['water','roads','waste','general'].includes(t)))
    throw Object.assign(Error('Izberite območje, naslov in vsaj eno temo obveščanja.'),{status:400});
  return { name:value.name.trim(),address:value.address.trim(),districtId:value.districtId,topics:[...new Set(value.topics)] };
}
