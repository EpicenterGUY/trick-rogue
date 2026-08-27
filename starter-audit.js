const RunStart=require('./run-start-v2.js');
const Cards=require('./cards.js');
const CardSystemTags=require('./card-system-tags.js');

const VERSION='M7-1';
const M7_BASELINE_REGION_IDS=Object.freeze(['region_theater','region_observatory','region_frontier']);
const ROLE_TAGS=Object.freeze({
  trickControl:Object.freeze(['적용값 증가','적용값 감소','우세 개입']),
  handInformation:Object.freeze(['손패','예측']),
  resourceSurvival:Object.freeze(['칩','회복','보호막','상태'])
});
const ROLE_LABELS=Object.freeze({trickControl:'트릭 조작',handInformation:'손패·정보',resourceSurvival:'자원·생존'});
const REGION_LABELS=Object.freeze({region_theater:'유랑극장',region_observatory:'안개 관측소',region_frontier:'황야 전선'});
const STARTER_IDENTITY_TAGS=Object.freeze({
  common:Object.freeze(['손패','예측','족보']),
  gambler:Object.freeze(['칩','적용값 감소']),
  trickster:Object.freeze(['적용값 감소','쇼다운 개입','족보']),
  survivor:Object.freeze(['보호막','손패','회복','상태'])
});

function definitionFor(id,cardsApi=Cards){return cardsApi?.CARD_DEFINITION_BY_ID?.[id]||null}
function systemTagsForDefinition(definition){
  if(!definition)return[];
  return Array.isArray(definition.systemTags)&&definition.systemTags.length
    ?[...definition.systemTags]
    :CardSystemTags.tagsForDefinition(definition);
}
function effectRows(starter,cardsApi=Cards){
  return(starter?.effectCardIds||[]).map(id=>{
    const definition=definitionFor(id,cardsApi),systemTags=systemTagsForDefinition(definition);
    return{id,name:definition?.name||id,definition,systemTags};
  });
}
function matchesAny(tags,preferred){const set=new Set(preferred||[]);return(tags||[]).some(tag=>set.has(tag))}
function roleCoverage(starter,cardsApi=Cards){
  const rows=effectRows(starter,cardsApi),coverage={};
  for(const[role,tags]of Object.entries(ROLE_TAGS)){
    const cards=rows.filter(row=>matchesAny(row.systemTags,tags)).map(row=>row.id);
    coverage[role]={label:ROLE_LABELS[role],count:cards.length,cards};
  }
  return coverage;
}
function identityCoverage(starter,cardsApi=Cards){
  const preferred=STARTER_IDENTITY_TAGS[starter?.id]||[],rows=effectRows(starter,cardsApi);
  const matchedTags=[...new Set(rows.flatMap(row=>row.systemTags.filter(tag=>preferred.includes(tag))))];
  return{preferred:[...preferred],matchedTags,cards:rows.filter(row=>matchesAny(row.systemTags,preferred)).map(row=>row.id)};
}
function regionCoverage(starter,cardsApi=Cards,regionIds=M7_BASELINE_REGION_IDS){
  const rows=effectRows(starter,cardsApi),regions={};
  for(const regionId of regionIds){
    const tags=CardSystemTags.REGION_REWARD_TAGS[regionId]||[];
    const cards=rows.filter(row=>matchesAny(row.systemTags,tags)).map(row=>row.id);
    const tagMatches=rows.reduce((total,row)=>total+CardSystemTags.affinity(row.systemTags,regionId),0);
    regions[regionId]={label:REGION_LABELS[regionId]||regionId,cards,count:cards.length,tagMatches};
  }
  return regions;
}
function auditStarter(starter,cardsApi=Cards){
  const errors=[],rows=effectRows(starter,cardsApi),roles=roleCoverage(starter,cardsApi),identity=identityCoverage(starter,cardsApi),regions=regionCoverage(starter,cardsApi);
  if((starter?.pureSlots?.length||0)!==8)errors.push(`${starter?.id||'starter'}: pure cards must be exactly 8 for M7`);
  if((starter?.effectCardIds?.length||0)!==4)errors.push(`${starter?.id||'starter'}: effect cards must be exactly 4 for M7`);
  if(new Set(starter?.effectCardIds||[]).size!==(starter?.effectCardIds?.length||0))errors.push(`${starter?.id||'starter'}: duplicate starter effect card`);
  for(const row of rows){
    if(!row.definition)errors.push(`${starter.id}: unknown effect card ${row.id}`);
    else if(row.definition.category!=='general'||row.definition.rarity!=='common')errors.push(`${starter.id}: ${row.id} must remain general/common`);
    if(row.systemTags.length<1||row.systemTags.length>3)errors.push(`${starter.id}: ${row.id} must expose 1~3 M6 system tags`);
  }
  for(const[role,result]of Object.entries(roles))if(result.count<1)errors.push(`${starter.id}: missing ${ROLE_LABELS[role]} role`);
  if(identity.matchedTags.length<1)errors.push(`${starter.id}: no starter identity signal in effect cards`);
  for(const[regionId,result]of Object.entries(regions)){
    if(result.count<1)errors.push(`${starter.id}: no bridge card for ${REGION_LABELS[regionId]||regionId}`);
    if(result.count>=4)errors.push(`${starter.id}: all four effect cards lean into ${REGION_LABELS[regionId]||regionId}`);
  }
  return{id:starter.id,name:starter.name,pureCount:starter.pureSlots.length,effectCount:starter.effectCardIds.length,effects:rows.map(({id,name,systemTags})=>({id,name,systemTags})),roles,identity,regions,errors};
}
function pairwiseEffectOverlap(starters=RunStart.STARTERS){
  const results=[];
  for(let i=0;i<starters.length;i++)for(let j=i+1;j<starters.length;j++){
    const left=starters[i],right=starters[j],rightIds=new Set(right.effectCardIds||[]),shared=(left.effectCardIds||[]).filter(id=>rightIds.has(id));
    results.push({left:left.id,right:right.id,shared,count:shared.length});
  }
  return results;
}
function auditOpeningPool(cardsApi=Cards,regionIds=M7_BASELINE_REGION_IDS){
  const ids=RunStart.commonCardPoolIds(cardsApi),rows=ids.map(id=>({id,definition:definitionFor(id,cardsApi)})).map(row=>({...row,systemTags:systemTagsForDefinition(row.definition)}));
  const roles={};
  for(const[role,tags]of Object.entries(ROLE_TAGS))roles[role]=rows.filter(row=>matchesAny(row.systemTags,tags)).map(row=>row.id);
  const regions={};
  for(const regionId of regionIds)regions[regionId]=rows.filter(row=>CardSystemTags.affinity(row.systemTags,regionId)>0).map(row=>row.id);
  const errors=[];
  for(const[role,cards]of Object.entries(roles))if(!cards.length)errors.push(`common opening pool: missing ${ROLE_LABELS[role]}`);
  for(const[regionId,cards]of Object.entries(regions))if(!cards.length)errors.push(`common opening pool: no bridge to ${REGION_LABELS[regionId]||regionId}`);
  return{ids,effects:rows.map(({id,systemTags})=>({id,systemTags})),roles,regions,errors};
}
function auditRegistry(cardsApi=Cards,starters=RunStart.STARTERS){
  const starterReports=starters.map(starter=>auditStarter(starter,cardsApi)),openingPool=auditOpeningPool(cardsApi),overlap=pairwiseEffectOverlap(starters),errors=[];
  if(starters.length!==4)errors.push(`M7 expects 4 exposed starters, got ${starters.length}`);
  errors.push(...starterReports.flatMap(report=>report.errors),...openingPool.errors);
  for(const pair of overlap)if(pair.count>2)errors.push(`${pair.left}/${pair.right}: starter effect overlap ${pair.count} > 2`);
  return{version:VERSION,baselineRegionIds:[...M7_BASELINE_REGION_IDS],starterReports,openingPool,overlap,errors};
}

module.exports={VERSION,M7_BASELINE_REGION_IDS,ROLE_TAGS,ROLE_LABELS,REGION_LABELS,STARTER_IDENTITY_TAGS,definitionFor,systemTagsForDefinition,effectRows,matchesAny,roleCoverage,identityCoverage,regionCoverage,auditStarter,pairwiseEffectOverlap,auditOpeningPool,auditRegistry};
