(function(root,factory){
  const CardSystemTags=typeof module!=='undefined'?require('./card-system-tags.js'):root.CardSystemTags;
  const api=factory(root,CardSystemTags);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunBuildAudit=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot,CardSystemTags){
  const STAGE='M10-1';
  const VERSION='M10-1';
  let browserInstalled=false;

  function activeRun(runtimeRoot=defaultRoot){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function cardId(card){return card?.cardId||card?.definitionId||card?.definition?.id||card?.named?.id||null}
  function cardDefinition(card,runtimeRoot=defaultRoot){
    if(card?.definition&&typeof card.definition==='object')return card.definition;
    if(card?.named&&typeof card.named==='object')return card.named;
    const id=cardId(card);return id?runtimeRoot?.CARD_DEFINITION_BY_ID?.[id]||null:null;
  }
  function cardEffects(card,runtimeRoot=defaultRoot){const definition=cardDefinition(card,runtimeRoot);return definition?.effects||card?.effects||[]}
  function isEffectCard(card,runtimeRoot=defaultRoot){return!!cardId(card)||(Array.isArray(cardEffects(card,runtimeRoot))&&cardEffects(card,runtimeRoot).length>0)}
  function tagsForCard(card,runtimeRoot=defaultRoot){
    if(!isEffectCard(card,runtimeRoot))return[];
    const definition=cardDefinition(card,runtimeRoot)||card;
    if(Array.isArray(definition?.systemTags)&&definition.systemTags.length)return[...definition.systemTags];
    return typeof CardSystemTags?.tagsForDefinition==='function'?CardSystemTags.tagsForDefinition(definition):[];
  }
  function deckSummary(runState,runtimeRoot=defaultRoot){
    const deck=Array.isArray(runState?.deck)?runState.deck:[],systemTagCounts={},cardCounts={};let pure=0,effect=0,untaggedEffect=0;
    for(const card of deck){
      const id=cardId(card)||`${card?.suit||'?'}${card?.rank||'?'}`;cardCounts[id]=(cardCounts[id]||0)+1;
      if(!isEffectCard(card,runtimeRoot)){pure+=1;continue}
      effect+=1;const tags=tagsForCard(card,runtimeRoot);if(!tags.length)untaggedEffect+=1;for(const tag of tags)systemTagCounts[tag]=(systemTagCounts[tag]||0)+1;
    }
    const topSystemTags=Object.entries(systemTagCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([tag,count])=>({tag,count}));
    return{total:deck.length,pure,effect,untaggedEffect,systemTagCounts,topSystemTags,cardCounts};
  }
  function regionSummary(runState,runtimeRoot=defaultRoot){
    const flow=runState?.runFlow||{},profiles=runtimeRoot?.RunFlowV2?.REGION_PROFILES||{};
    const visitedRegionIds=Array.isArray(flow.visitedRegionIds)?[...flow.visitedRegionIds]:[],completedRegionIds=Array.isArray(flow.completedRegionIds)?[...flow.completedRegionIds]:[];
    const visitedRegionBranches=Array.isArray(flow.visitedRegionBranches)?flow.visitedRegionBranches.map(entry=>({...entry,tags:[...(entry?.tags||[])]})):[];
    const regionNames=visitedRegionIds.map(id=>profiles?.[id]?.name||id),pairKey=visitedRegionIds.length>=2?[...visitedRegionIds.slice(0,2)].sort().join('+'):null;
    return{visitedRegionIds,completedRegionIds,visitedRegionBranches,regionNames,pairKey};
  }
  function fieldSummary(runState){
    const state=runState?.fieldLoadout&&typeof runState.fieldLoadout==='object'?runState.fieldLoadout:{},history=Array.isArray(state.history)?state.history:[];
    const usedFieldIds=[];for(const entry of history){if(entry?.action==='consume'&&entry?.from&&!usedFieldIds.includes(entry.from))usedFieldIds.push(entry.from)}
    return{ownedFieldIds:Array.isArray(state.owned)?[...state.owned]:[],queuedFieldId:state.queuedFieldId||null,usedFieldIds};
  }
  function identitySummary(runState){return{starterId:runState?.starterId||runState?.identity?.starterId||null,starterName:runState?.starter?.name||runState?.char?.name||null,traitId:runState?.traitId||runState?.identity?.traitId||null,traitName:runState?.trait?.name||null}}
  function buildRunAudit(runState,runtimeRoot=defaultRoot){return{version:VERSION,identity:identitySummary(runState),fields:fieldSummary(runState),regions:regionSummary(runState,runtimeRoot),deck:deckSummary(runState,runtimeRoot)}}
  function auditRows(summary){
    const identity=summary?.identity||{},fields=summary?.fields||{},regions=summary?.regions||{},deck=summary?.deck||{},top=(deck.topSystemTags||[]).slice(0,5).map(entry=>`${entry.tag} ${entry.count}`).join(' · ')||'없음';
    const branches=(regions.visitedRegionBranches||[]).map(entry=>entry.branchLabel||entry.branchId).join(' → ')||'미선택',usedFields=(fields.usedFieldIds||[]).join(', ')||'없음';
    return[
      `M10 정체성 · ${identity.starterName||identity.starterId||'미상'} / ${identity.traitName||identity.traitId||'미상'} · 사용 필드 ${usedFields}`,
      `M10 지역 · ${(regions.regionNames||regions.visitedRegionIds||[]).join(' → ')||'미방문'} · 분기 ${branches}`,
      `M10 덱 · ${deck.total||0}장 · 순수 ${deck.pure||0} / 효과 ${deck.effect||0} · 주요 태그 ${top}`
    ];
  }
  function enrichResult(runState,result,runtimeRoot=defaultRoot){
    const summary=buildRunAudit(runState,runtimeRoot);if(result&&typeof result==='object')result.buildAudit=summary;if(runState?.runResult&&typeof runState.runResult==='object')runState.runResult.buildAudit=summary;return summary;
  }
  function renderAuditRows(runtimeRoot=defaultRoot,summary){
    const doc=runtimeRoot?.document;if(!doc?.querySelector)return false;const list=doc.querySelector('#modal .choiceList');if(!list)return false;
    list.querySelectorAll?.('[data-m10-build-audit]')?.forEach?.(node=>node.remove?.());const buttons=list.querySelectorAll?[...list.querySelectorAll('button')]:[],before=buttons.find(button=>(button.textContent||'').includes('새 런'))||null;
    for(const text of auditRows(summary)){const row=doc.createElement('div');row.className='choice';row.setAttribute('data-m10-build-audit','true');const bold=doc.createElement('b');bold.textContent=text;row.appendChild(bold);list.insertBefore(row,before)}return true;
  }
  function finalizeRunResult(runtimeRoot,result){const runState=activeRun(runtimeRoot);if(!runState)return result;const summary=enrichResult(runState,result,runtimeRoot);renderAuditRows(runtimeRoot,summary);runtimeRoot?.console?.info?.('[M10 build audit]',summary);return result}
  function wrapFinishRun(runtimeRoot=defaultRoot){const original=runtimeRoot?.finishRun;if(typeof original!=='function'||original.__m10BuildAudit)return false;function wrapped(){const result=original.apply(this,arguments);if(result&&typeof result.then==='function')return result.then(value=>finalizeRunResult(runtimeRoot,value));return finalizeRunResult(runtimeRoot,result)}wrapped.__m10BuildAudit=true;wrapped.__original=original;runtimeRoot.finishRun=wrapped;return true}
  function wrapLoseRun(runtimeRoot=defaultRoot){const original=runtimeRoot?.loseRun;if(typeof original!=='function'||original.__m10BuildAudit)return false;function wrapped(){const result=original.apply(this,arguments);if(result&&typeof result.then==='function')return result.then(value=>finalizeRunResult(runtimeRoot,value));return finalizeRunResult(runtimeRoot,result)}wrapped.__m10BuildAudit=true;wrapped.__original=original;runtimeRoot.loseRun=wrapped;return true}
  function installBrowser(runtimeRoot=defaultRoot){if(browserInstalled)return true;if(!runtimeRoot?.RunFlowV2||!runtimeRoot?.RunBalanceTelemetry||!runtimeRoot?.CardSystemTags)return false;if(typeof runtimeRoot.finishRun!=='function'||typeof runtimeRoot.loseRun!=='function')return false;wrapFinishRun(runtimeRoot);wrapLoseRun(runtimeRoot);browserInstalled=true;return true}
  function installWhenReady(runtimeRoot=defaultRoot){let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<120)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[m10] 빌드 감사 설치 실패')};if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true}
  function resetBrowserInstallForTests(){browserInstalled=false}

  return{STAGE,VERSION,activeRun,cardId,cardDefinition,cardEffects,isEffectCard,tagsForCard,deckSummary,regionSummary,fieldSummary,identitySummary,buildRunAudit,auditRows,enrichResult,renderAuditRows,finalizeRunResult,wrapFinishRun,wrapLoseRun,installBrowser,installWhenReady,resetBrowserInstallForTests};
});
