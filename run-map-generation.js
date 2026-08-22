(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.RunMapGeneration=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='7-3';
  const PROFILE_VERSION='7-3';
  const ACT_MAP_PROFILES=Object.freeze({
    act1:Object.freeze({
      actId:'act1',
      mutableNodeIds:Object.freeze(['n1','n2','n3','n4']),
      requiredCounts:Object.freeze({battle:2,event:1,camp:1,shop:1,elite:1,boss:1}),
      variants:Object.freeze([
        Object.freeze({id:'event-camp__battle-shop',assignments:Object.freeze({n1:'event',n2:'battle',n3:'camp',n4:'shop'})}),
        Object.freeze({id:'battle-shop__event-camp',assignments:Object.freeze({n1:'battle',n2:'event',n3:'shop',n4:'camp'})}),
        Object.freeze({id:'event-shop__battle-camp',assignments:Object.freeze({n1:'event',n2:'battle',n3:'shop',n4:'camp'})}),
        Object.freeze({id:'battle-camp__event-shop',assignments:Object.freeze({n1:'battle',n2:'event',n3:'camp',n4:'shop'})})
      ])
    })
  });
  let installed=false;

  function runStructure(){
    if(root?.RunStructure)return root.RunStructure;
    if(typeof require==='function')try{return require('./run-structure.js')}catch(_error){}
    return null;
  }
  function runPaths(){
    if(root?.RunPaths)return root.RunPaths;
    if(typeof require==='function')try{return require('./run-paths.js')}catch(_error){}
    return null;
  }
  function toUint32(value){return Number(value)>>>0}
  function hashSeed(value){
    const text=String(value??'');let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return hash>>>0;
  }
  function normalizeSeed(seed){
    if(typeof seed==='number'&&Number.isFinite(seed))return toUint32(seed);
    if(typeof seed==='string'&&seed.length)return hashSeed(seed);
    return null;
  }
  function randomSeed(runtimeRoot=root){
    const cryptoObj=runtimeRoot?.crypto;
    if(cryptoObj?.getRandomValues){const values=new Uint32Array(1);cryptoObj.getRandomValues(values);return values[0]>>>0}
    return Math.floor(Math.random()*0x100000000)>>>0;
  }
  function ensureRunSeed(runState,{seed=null,runtimeRoot=root}={}){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    const existing=normalizeSeed(runState.runSeed);if(existing!==null){runState.runSeed=existing;return existing}
    const requested=normalizeSeed(seed),resolved=requested===null?randomSeed(runtimeRoot):requested;runState.runSeed=resolved;return resolved;
  }
  function deriveActSeed(runSeed,actId){return hashSeed(`${toUint32(runSeed)}:${String(actId||'')}`)}
  function profileForAct(actId,profiles=ACT_MAP_PROFILES){return profiles?.[actId]||null}
  function variantForSeed(profile,actSeed){
    if(!profile?.variants?.length)return null;
    return profile.variants[toUint32(actSeed)%profile.variants.length]||null;
  }
  function typeCounts(map){const counts={};for(const node of map||[])counts[node.type]=(counts[node.type]||0)+1;return counts}
  function validateMapProfile(profile,{registry}={}){
    const errors=[],structure=runStructure(),definition=structure?.actDefinition?.(profile?.actId,registry);
    if(!profile||typeof profile!=='object')return['map profile must be an object'];
    if(!profile.actId)errors.push('missing actId');
    if(!definition)errors.push(`unknown act ${String(profile.actId)}`);
    if(!Array.isArray(profile.mutableNodeIds)||!profile.mutableNodeIds.length)errors.push('mutableNodeIds must not be empty');
    if(!Array.isArray(profile.variants)||profile.variants.length<2)errors.push('variants must contain at least two maps');
    const nodeIds=new Set((definition?.nodes||[]).map(node=>node.id)),mutable=new Set(profile.mutableNodeIds||[]),variantIds=new Set();
    for(const id of mutable)if(!nodeIds.has(id))errors.push(`unknown mutable node ${id}`);
    for(const variant of profile.variants||[]){
      if(!variant?.id){errors.push('variant missing id');continue}
      if(variantIds.has(variant.id))errors.push(`duplicate variant ${variant.id}`);variantIds.add(variant.id);
      const assignments=variant.assignments||{};
      for(const id of mutable)if(!assignments[id])errors.push(`${variant.id}: missing assignment ${id}`);
      for(const [id,type] of Object.entries(assignments)){
        if(!mutable.has(id))errors.push(`${variant.id}: assignment outside mutable nodes ${id}`);
        if(structure?.NODE_TYPES&&!structure.NODE_TYPES.includes(type))errors.push(`${variant.id}: unknown node type ${type}`);
      }
    }
    return errors;
  }
  function validateProfiles(profiles=ACT_MAP_PROFILES,{registry}={}){
    const errors=[];for(const [actId,profile] of Object.entries(profiles||{})){
      if(profile?.actId!==actId)errors.push(`${actId}: actId mismatch`);
      errors.push(...validateMapProfile(profile,{registry}).map(error=>`${actId}: ${error}`));
    }return errors;
  }
  function generatedDefinition(actId,map,{registry}={}){
    const structure=runStructure(),base=structure?.actDefinition?.(actId,registry);if(!base)return null;
    return{id:base.id,index:base.index,name:base.name,entryNodeIds:[...base.entryNodeIds],nextActId:base.nextActId,nodes:(map||[]).map(node=>({id:node.id,type:node.type,lane:node.lane,row:node.row,next:[...(node.next||[])]}))};
  }
  function validateGeneratedMap(actId,map,{registry,profiles=ACT_MAP_PROFILES}={}){
    const errors=[],structure=runStructure(),profile=profileForAct(actId,profiles),definition=generatedDefinition(actId,map,{registry});
    if(!definition)return[`unknown act ${String(actId)}`];
    if(structure?.validateActDefinition)errors.push(...structure.validateActDefinition(definition,actId));
    if(profile?.requiredCounts){const counts=typeCounts(map);for(const [type,count] of Object.entries(profile.requiredCounts))if((counts[type]||0)!==count)errors.push(`${type} count ${(counts[type]||0)} != ${count}`)}
    const base=structure?.actDefinition?.(actId,registry),byId=new Map((map||[]).map(node=>[node.id,node]));
    for(const node of base?.nodes||[]){const generated=byId.get(node.id);if(!generated)continue;if(node.type==='boss'&&generated.type!=='boss')errors.push(`${node.id}: boss type changed`);if(node.type==='elite'&&generated.type!=='elite')errors.push(`${node.id}: elite type changed`)}
    return errors;
  }
  function generateActMap(actId='act1',{runSeed=0,registry,profiles=ACT_MAP_PROFILES}={}){
    const structure=runStructure();if(!structure?.createActMap)throw new TypeError('RunStructure.createActMap is required');
    const profile=profileForAct(actId,profiles),baseMap=structure.createActMap(actId,registry);
    if(!profile)return{actId,runSeed:toUint32(runSeed),actSeed:deriveActSeed(runSeed,actId),variantId:null,map:baseMap,generated:false};
    const profileErrors=validateMapProfile(profile,{registry});if(profileErrors.length)throw new TypeError(`Invalid map profile: ${profileErrors.join('; ')}`);
    const actSeed=deriveActSeed(runSeed,actId),variant=variantForSeed(profile,actSeed),assignments=variant?.assignments||{};
    const map=baseMap.map(node=>assignments[node.id]?{...node,type:assignments[node.id]}:node);
    const errors=validateGeneratedMap(actId,map,{registry,profiles});if(errors.length)throw new TypeError(`Invalid generated map: ${errors.join('; ')}`);
    return{actId,runSeed:toUint32(runSeed),actSeed,variantId:variant.id,map,generated:true};
  }
  function progressStarted(runState){
    const completed=runState?.completed instanceof Set?runState.completed:new Set(Array.isArray(runState?.completed)?runState.completed:[]);
    return completed.size>0||!!runState?.currentNodeId||!!runState?.lastCompletedNodeId;
  }
  function ensureMapHistory(runState){if(!Array.isArray(runState.actMapHistory))runState.actMapHistory=[];return runState.actMapHistory}
  function applyGeneratedActMap(runState,actId=runState?.actId,{seed=null,registry,profiles=ACT_MAP_PROFILES,runtimeRoot=root,force=false}={}){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    if(!actId)throw new TypeError('actId is required');
    const runSeed=ensureRunSeed(runState,{seed,runtimeRoot}),existing=runState.mapGenerationState;
    if(!force&&existing?.version===STAGE&&existing.actId===actId&&existing.runSeed===runSeed&&Array.isArray(runState.map)&&runState.map.length)return existing;
    if(!force&&progressStarted(runState))return existing||null;
    const result=generateActMap(actId,{runSeed,registry,profiles});
    runState.map=result.map.map(node=>({...node,next:[...(node.next||[])]}));
    const structure=runStructure(),definition=structure?.actDefinition?.(actId,registry);runState.available=new Set(definition?.entryNodeIds||[]);runState.completed=new Set();runState.currentNodeId=null;runState.lastCompletedNodeId=null;runState.runComplete=false;
    runState.mapGenerationState={version:STAGE,profileVersion:PROFILE_VERSION,actId,runSeed,actSeed:result.actSeed,variantId:result.variantId,generated:result.generated};
    const history=ensureMapHistory(runState);if(!history.some(entry=>entry.actId===actId))history.push({...runState.mapGenerationState,step:history.length+1});
    if(runPaths()?.ensurePathState){runState.routeState=null;runPaths().ensurePathState(runState)}
    return runState.mapGenerationState;
  }
  function mapGenerationSummary(runState){
    const state=runState?.mapGenerationState;if(!state)return null;return{version:state.version,actId:state.actId,runSeed:state.runSeed,actSeed:state.actSeed,variantId:state.variantId,generated:state.generated===true,historyCount:Array.isArray(runState.actMapHistory)?runState.actMapHistory.length:0};
  }
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function decorateMap(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const summary=mapGenerationSummary(runState);if(!summary)return null;
    const grid=doc.getElementById?.('mapGrid');if(grid?.dataset){grid.dataset.mapVariant=summary.variantId||'static';grid.dataset.runSeed=String(summary.runSeed)}
    const badge=doc.getElementById?.('mapActBadge');if(badge){const suffix=summary.variantId?` · 맵 ${summary.variantId}`:` · 고정 맵`;if(!String(badge.title||'').includes(' · 맵 ')&&!String(badge.title||'').includes(' · 고정 맵'))badge.title=`${badge.title||runState.actName||'액트'}${suffix}`}
    return summary;
  }
  function wrapBeginRun(runtimeRoot=root){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runMapGenerationAdapter)return true;
    const wrapped=function(...args){const result=original.apply(this,args),runState=activeRun(runtimeRoot);if(runState?.actId){applyGeneratedActMap(runState,runState.actId,{runtimeRoot});if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap()}return result};
    wrapped.__runMapGenerationAdapter=true;wrapped.__runMapGenerationOriginal=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapCompleteNode(runtimeRoot=root){
    const original=runtimeRoot?.completeNode;if(typeof original!=='function')return false;if(original.__runMapGenerationAdapter)return true;
    const wrapped=function(node,...args){const before=activeRun(runtimeRoot)?.actId||null,result=original.call(this,node,...args),runState=activeRun(runtimeRoot);if(runState?.actId&&runState.actId!==before){applyGeneratedActMap(runState,runState.actId,{runtimeRoot});if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap()}return result};
    wrapped.__runMapGenerationAdapter=true;wrapped.__runMapGenerationOriginal=original;runtimeRoot.completeNode=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=root){
    const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__runMapGenerationAdapter)return true;
    const wrapped=function(...args){const result=original.apply(this,args);decorateMap(runtimeRoot);return result};wrapped.__runMapGenerationAdapter=true;wrapped.__runMapGenerationOriginal=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(!runtimeRoot?.RunStructure||!runtimeRoot?.RunPaths)return false;
    if(typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.completeNode!=='function'||typeof runtimeRoot.renderMap!=='function')return false;
    if(!runtimeRoot.beginRun.__runPathAdapter||!runtimeRoot.completeNode.__runPathAdapter||!runtimeRoot.renderMap.__runPathAdapter)return false;
    const errors=validateProfiles();if(errors.length){console.error('[run-map-generation] 맵 프로필 오류',errors);return false}
    wrapBeginRun(runtimeRoot);wrapCompleteNode(runtimeRoot);wrapRenderMap(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<60)setTimeout(attempt,25);else console.warn('[run-map-generation] 경로 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,PROFILE_VERSION,ACT_MAP_PROFILES,toUint32,hashSeed,normalizeSeed,randomSeed,ensureRunSeed,deriveActSeed,profileForAct,variantForSeed,typeCounts,validateMapProfile,validateProfiles,generatedDefinition,validateGeneratedMap,generateActMap,progressStarted,ensureMapHistory,applyGeneratedActMap,mapGenerationSummary,activeRun,decorateMap,wrapBeginRun,wrapCompleteNode,wrapRenderMap,installBrowserRuntime,installWhenReady};
});
