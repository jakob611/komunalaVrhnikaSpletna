import { addressRuleMatches } from './collection-utils.js';

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
  }
  return result;
}

export function matchesNotice(subscriber, notice) {
  if (subscriber.status !== 'active' || notice.published === false || !subscriber.topics.includes(notice.category)) return false;
  if (!notice.allDistricts && !(notice.districtIds || []).includes(subscriber.districtId)) return false;
  return !(notice.addressRules || []).length || notice.addressRules.some(rule => addressRuleMatches(subscriber.address, rule));
}

export function validatePreferences(value, districts) {
  if (!value || typeof value.name !== 'string' || value.name.trim().length < 2 || value.name.length > 120 ||
    typeof value.address !== 'string' || value.address.trim().length < 3 || value.address.length > 250 || /[<>\r\n]/.test(value.address) ||
    !districts.some(d => d.id === value.districtId && d.active) || !Array.isArray(value.topics) || !value.topics.length || value.topics.length > 4 || value.topics.some(t => !['water','roads','waste','general'].includes(t)))
    throw Object.assign(Error('Izberite območje, naslov in vsaj eno temo obveščanja.'),{status:400});
  return { name:value.name.trim(),address:value.address.trim(),districtId:value.districtId,topics:[...new Set(value.topics)] };
}
