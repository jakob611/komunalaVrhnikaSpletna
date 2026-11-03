import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import houses from '../shared/official-addresses.json' with {type:'json'};
import addressSource from '../shared/official-addresses-source.json' with {type:'json'};
import { officialAddresses } from '../server/address-registry.js';
import { matchCollectionSchedule, COLLECTION_TYPES } from '../shared/collection-utils.js';
import { validateSection } from '../shared/cms-validation.js';
import { ljubljanaDate } from '../server/seed.js';

const kinds=Object.keys(COLLECTION_TYPES);
const emptyFraction=()=>({assigned:0,ambiguous:0,missing:0,assignedWithFutureDates:0,assignedWithoutFutureDates:0});
const emptyMunicipality=()=>({houses:0,anyMatched:0,noMatch:0,anyAmbiguity:0,allFractionsMatched:0,allFractionsWithFutureEvents:0,fractions:Object.fromEntries(kinds.map(type=>[type,emptyFraction()]))});

/** Diagnose the current matching code/configuration, never assert truck coverage. */
export function analyzeAddressCoverage({collection,records=houses,resolve=address=>officialAddresses.resolve(address),date=ljubljanaDate()}) {
  const checked=validateSection('collection',collection),municipalities={},details=[],canonicalFailures=[];
  for(const house of records) {
    const canonical=resolve(house.address);
    if(!canonical||canonical.id!==house.id)canonicalFailures.push({id:house.id,address:house.address,municipalityId:house.municipalityId});
    const matched=matchCollectionSchedule(house.address,checked.routes),row=municipalities[house.municipalityId] ||= emptyMunicipality();
    row.houses++;
    const states={};let any=false,ambiguous=false,all=true,allFuture=true;
    for(const type of kinds) {
      const match=matched.matches[type],count=row.fractions[type];
      if(match?.ambiguous){count.ambiguous++;any=true;ambiguous=true;all=false;allFuture=false;states[type]={state:'ambiguous',routeId:null,futureDates:0};}
      else if(match?.route){
        any=true;count.assigned++;
        const future=match.route.events.filter(event=>event.type===type&&event.date>=date).length;
        if(future)count.assignedWithFutureDates++;else{count.assignedWithoutFutureDates++;allFuture=false;}
        states[type]={state:future?'assigned-with-future-dates':'assigned-without-future-dates',routeId:match.route.id,futureDates:future};
      }else{count.missing++;all=false;allFuture=false;states[type]={state:'missing',routeId:null,futureDates:0};}
    }
    if(any)row.anyMatched++;else row.noMatch++;
    if(ambiguous)row.anyAmbiguity++;
    if(all)row.allFractionsMatched++;
    if(allFuture)row.allFractionsWithFutureEvents++;
    details.push({id:house.id,address:house.address,municipality:house.municipality,municipalityId:house.municipalityId,canonicalRoundtrip:canonical?.id===house.id,completeFutureSchedule:allFuture,fractions:states});
  }
  const totals=Object.values(municipalities).reduce((sum,row)=>{
    for(const key of ['houses','anyMatched','noMatch','anyAmbiguity','allFractionsMatched','allFractionsWithFutureEvents'])sum[key]=(sum[key]||0)+row[key];
    return sum;
  },{});
  return {summary:{diagnosticOnly:true,date,canonicalRoundtrip:{checked:records.length,failures:canonicalFailures.length},configuration:{routes:checked.routes.length,rules:checked.routes.reduce((n,route)=>n+route.addresses.length,0),events:checked.routes.reduce((n,route)=>n+route.events.length,0),futureEvents:checked.routes.reduce((n,route)=>n+route.events.filter(event=>event.date>=date).length,0)},totals,municipalities},details,canonicalFailures};
}

function argumentsFor(argv) {
  const options={};
  for(let index=0;index<argv.length;index++){
    const key=argv[index];
    if(!['--url','--input','--date','--json','--csv'].includes(key)||!argv[index+1]||argv[index+1].startsWith('--')||options[key])throw Error('Usage: node scripts/audit-address-coverage.mjs [--url https://host/api/content | --input public-content.json] [--date YYYY-MM-DD] [--json local-details.json] [--csv local-details.csv]');
    options[key]=argv[++index];
  }
  if(options['--url']&&options['--input'])throw Error('Choose one public configuration source');
  const date=options['--date']||ljubljanaDate();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid diagnostic date');
  return {...options,date};
}
async function fetchPublicContent(url) {
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/api/content'||url.search||url.hash)throw Error('Only a public HTTPS /api/content URL without credentials/query is accepted');
  const response=await fetch(url,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Public configuration HTTP ${response.status}`);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.byteLength;if(size>24*1024*1024)throw Error('Public configuration exceeds response bound');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const csvCell=value=>'"'+String(value).replaceAll('"','""')+'"';
export function coverageCsv(details) {
  const columns=['houseId','address','municipality','canonicalRoundtrip','completeFutureSchedule',...kinds.flatMap(type=>[type+'State',type+'RouteId',type+'FutureDates'])];
  const rows=details.map(row=>['HS:'+row.id,row.address,row.municipality,row.canonicalRoundtrip,row.completeFutureSchedule,...kinds.flatMap(type=>[row.fractions[type].state,row.fractions[type].routeId||'',row.fractions[type].futureDates])]);
  return '\ufeff'+[columns,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
async function output(file,contents) {
  const resolved=path.resolve(file);
  if(!/\.(?:json|csv)$/i.test(resolved))throw Error('Diagnostic output must be a JSON or CSV file');
  if([fileURLToPath(new URL('../shared/official-addresses.json',import.meta.url)),fileURLToPath(new URL('../shared/official-addresses-source.json',import.meta.url))].some(protectedPath=>path.resolve(protectedPath)===resolved))throw Error('Refusing to replace official address source files');
  await mkdir(path.dirname(resolved),{recursive:true});
  await writeFile(resolved,contents,{flag:'wx'});
}
export async function main(argv=process.argv.slice(2)) {
  const options=argumentsFor(argv),source=options['--input']||options['--url']||'https://kpv.jakobtominc.com/api/content';
  const content=options['--input']?JSON.parse(await readFile(options['--input'],'utf8')):await fetchPublicContent(new URL(source));
  if(!content?.sections?.collection)throw Error('Expected a public /api/content snapshot with sections.collection');
  const result=analyzeAddressCoverage({collection:content.sections.collection,date:options.date});
  const evidence={...result.summary,capturedAt:new Date().toISOString(),configurationSource:source,collectionRevision:content.revisions?.collection??null,addressSource:{name:addressSource.name,url:addressSource.url,updatedAt:addressSource.updatedAt,sha256:addressSource.sha256,license:addressSource.license,licenseUrl:addressSource.licenseUrl,attribution:addressSource.attribution},limitations:'Local matcher diagnostic against public rules only. It does not establish authoritative KPV vehicle/operational boundaries, residence, actual service eligibility or delivery correctness.'};
  if(options['--json'])await output(options['--json'],JSON.stringify({...evidence,details:result.details,canonicalFailures:result.canonicalFailures},null,2)+'\n');
  if(options['--csv'])await output(options['--csv'],coverageCsv(result.details));
  console.log(JSON.stringify(evidence,null,2));
  if(result.canonicalFailures.length)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
