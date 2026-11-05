import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SERVICE = 'https://ipi.eprostor.gov.si/wfs-si-gurs-rn/ogc/features';
export const COLLECTION = 'SI.GURS.RN:REGISTER_NASLOVOV';
export const MUNICIPALITIES = [
  { name: 'Vrhnika', code: 140, id: 'vrhnika' },
  { name: 'Borovnica', code: 5, id: 'borovnica' },
  { name: 'Log-Dragomer', code: 208, id: 'log-dragomer' },
];
const items = `${SERVICE}/collections/${COLLECTION}/items`;
const sourceUrl = 'https://podatki.gov.si/dataset/register-naslovov/resource/85e6e060-9c44-4a03-85af-b89c27d11a38';
const requiredString = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 180 || /[<>\r\n\u0000-\u001f]/.test(value)) throw Error(`Invalid official ${label}`);
  return value.trim();
};
export function physicalAddress(properties, municipality) {
  const p = properties;
  if (!p || p.OBCINA_NAZIV !== municipality.name || p.OBCINA_SIFRA !== municipality.code) throw Error('Official municipality filter mismatch');
  // These EIDs exceed Number.MAX_SAFE_INTEGER. Never use numeric FEATUREID.
  if (typeof p.EID_NASLOV !== 'string' || !/^\d{16,20}$/.test(p.EID_NASLOV) || typeof p.EID_HISNA_STEVILKA !== 'string' || !/^\d{16,20}$/.test(p.EID_HISNA_STEVILKA)) throw Error('Official EID must be an exact decimal string');
  if (!Number.isSafeInteger(p.HS_STEVILKA) || p.HS_STEVILKA < 1 || p.HS_STEVILKA > 99999) throw Error('Invalid official house number');
  const suffix = p.HS_DODATEK == null ? '' : requiredString(p.HS_DODATEK, 'house suffix').toLowerCase();
  if (suffix && !/^[a-zčšž]$/i.test(suffix)) throw Error('Unsupported official house suffix');
  const settlement = requiredString(p.NASELJE_NAZIV, 'settlement');
  const street = p.ULICA_NAZIV == null ? '' : requiredString(p.ULICA_NAZIV, 'street');
  const number = String(p.HS_STEVILKA) + suffix;
  const primary = `${street || settlement} ${number}`;
  const locality = street && street !== settlement && settlement !== municipality.name ? `${settlement}, ${municipality.name}` : municipality.name;
  const postcode = p.POSTNI_OKOLIS_SIFRA;
  if (!Number.isSafeInteger(postcode) || postcode < 1000 || postcode > 9999) throw Error('Invalid official postcode');
  const postTown = requiredString(p.POSTNI_OKOLIS_NAZIV, 'post town');
  return { id:p.EID_HISNA_STEVILKA, address:`${primary}, ${locality}`, municipality:municipality.name, municipalityId:municipality.id, settlement, street, number, postcode:String(postcode), postTown };
}

async function readJson(response) {
  if (!response.ok) throw Error(`Official source HTTP ${response.status}`);
  const chunks=[];let size=0;
  for await (const chunk of response.body) { size+=chunk.byteLength;if(size>8*1024*1024)throw Error('Official page exceeds bounded response size');chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function importMunicipality(municipality, {fetcher=fetch,pageSize=1000,maxPages=50}={}) {
  const houses=new Map(), addressIds=new Set(),visited=new Set();let expected=null,total=0,pages=0;
  let url=new URL(items);
  url.search=new URLSearchParams({f:'json',limit:String(pageSize),filter:`OBCINA_NAZIV='${municipality.name}'`,'filter-lang':'cql-text',sortby:'EID_NASLOV'});
  while(url) {
    if(++pages>maxPages||visited.has(url.href))throw Error('Official pagination exceeded bounds or repeated a page');
    visited.add(url.href);
    const page=await readJson(await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)}));
    if(!Number.isSafeInteger(page.numberMatched)||page.numberMatched<1||page.numberMatched>50000||!Array.isArray(page.features)||page.features.length>pageSize||page.features.length===0||page.numberReturned!==page.features.length)throw Error('Official page has incomplete counts');
    if(expected===null)expected=page.numberMatched;
    if(page.numberMatched!==expected)throw Error('Official source changed during import; retry complete import');
    for(const feature of page.features) {
      const p=feature.properties,house=physicalAddress(p,municipality);
      if(addressIds.has(p.EID_NASLOV))throw Error('Official pagination duplicated an address EID');
      addressIds.add(p.EID_NASLOV);
      const previous=houses.get(house.id);
      if(previous&&JSON.stringify(previous)!==JSON.stringify(house))throw Error('Official house EID has conflicting address records');
      houses.set(house.id,house);
    }
    total+=page.features.length;
    const next=(page.links||[]).filter(link=>link.rel==='next');
    if(next.length>1||total>expected||(total<expected)!==(next.length===1))throw Error('Official result is truncated or pagination counts disagree');
    if(!next.length){url=null;continue;}
    const candidate=new URL(next[0].href);
    if(candidate.origin!==new URL(SERVICE).origin||decodeURIComponent(candidate.pathname)!==new URL(items).pathname||candidate.searchParams.get('filter')!==`OBCINA_NAZIV='${municipality.name}'`||candidate.searchParams.get('filter-lang')!=='cql-text'||candidate.searchParams.get('f')!=='json'||Number(candidate.searchParams.get('limit'))!==pageSize||Number(candidate.searchParams.get('startIndex'))!==total)throw Error('Unexpected official pagination URL');
    url=candidate;
  }
  if(addressIds.size!==expected)throw Error('Official import incomplete');
  return {addresses:[...houses.values()],sourceRows:total,pages};
}
export async function main() {
  const output=new URL('../shared/',import.meta.url),addresses=[],counts=[];
  for(const municipality of MUNICIPALITIES){const result=await importMunicipality(municipality);addresses.push(...result.addresses);counts.push({...municipality,sourceRows:result.sourceRows,physicalAddresses:result.addresses.length,pages:result.pages});console.log(JSON.stringify(counts.at(-1)));}
  addresses.sort((a,b)=>a.id.localeCompare(b.id,'en'));
  if(new Set(addresses.map(row=>row.id)).size!==addresses.length)throw Error('House EID appears in several municipalities');
  const content=JSON.stringify(addresses)+'\n';
  const metadata={name:'GURS – Register naslovov',url:sourceUrl,service:SERVICE,collection:COLLECTION,license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:'Vir: Geodetska uprava Republike Slovenije, Register naslovov (CC BY 4.0). Podatki so omejeni na tri občine; stanovanja so združena po hišni številki.',updatedAt:new Date().toISOString(),sha256:createHash('sha256').update(content).digest('hex'),physicalAddresses:addresses.length,municipalities:counts,fieldsRetained:['id','address','municipality','municipalityId','settlement','street','number','postcode','postTown'],excluded:'Apartment numbers, owners, people, coordinates and all other feature properties are not retained.'};
  // Write only after every municipality/count/schema check has succeeded.
  await writeFile(new URL('official-addresses.json',output),content);
  await writeFile(new URL('official-addresses-source.json',output),JSON.stringify(metadata,null,2)+'\n');
  console.log(JSON.stringify({complete:true,physicalAddresses:addresses.length,bytes:Buffer.byteLength(content),sourceRows:counts.reduce((sum,row)=>sum+row.sourceRows,0)}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
