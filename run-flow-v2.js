(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunFlowV2=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='8-B';
  const COMMON_ACT_ID='common';
  const FINAL_ACT_ID='final';
  const REGION_VISIT_TARGET=2;

  const REGION_PROFILES=Object.freeze({
    region_theater:Object.freeze({
      id:'region_theater',name:'유랑극장',icon:'♬',tone:'변칙과 필드',risk:'변동 큼',
      desc:'공연과 돌발 규칙이 자주 끼어드는 지역. 필드와 변칙 이벤트 쪽으로 빌드를 유도한다.',
      enemyWeights:Object.freeze({standard:0.35,trickster:0.45,pressure:0.20}),
      enemyLabels:Object.freeze({standard:'일반',trickster:'변칙',pressure:'압박'}),
      eventWeights:Object.freeze({general:0.20,performance:0.45,field:0.35}),
      eventLabels:Object.freeze({general:'공용',performance:'공연',field:'필드'}),
      rewardWeights:Object.freeze({neutral:0.65,theme:0.35})
    }),
    region_observatory:Object.freeze({
      id:'region_observatory',name:'안개 관측소',icon:'◉',tone:'정보와 제어',risk:'판단형',
      desc:'정찰과 정보 활용이 강해지는 지역. 적 의도를 읽고 손패를 조절하는 흐름을 밀어준다.',
      enemyWeights:Object.freeze({standard:0.35,observer:0.45,disruptor:0.20}),
      enemyLabels:Object.freeze({standard:'일반',observer:'관측',disruptor:'방해'}),
      eventWeights:Object.freeze({general:0.30,information:0.50,field:0.20}),
      eventLabels:Object.freeze({general:'공용',information:'정보',field:'필드'}),
      rewardWeights:Object.freeze({neutral:0.65,theme:0.35})
    }),
    region_frontier:Object.freeze({
      id:'region_frontier',name:'황야 전선',icon:'⚑',tone:'칩과 트릭 압박',risk:'공세형',
      desc:'트릭 승리와 칩 운용을 강하게 요구하는 지역. 빠른 압박과 보급 선택이 자주 나온다.',
      enemyWeights:Object.freeze({standard:0.35,aggressive:0.45,armored:0.20}),
      enemyLabels:Object.freeze({standard:'일반',aggressive:'공세',armored:'중장'}),
      eventWeights:Object.freeze({general:0.20,supply:0.45,risk:0.35}),
      eventLabels:Object.freeze({general:'공용',supply:'보급',risk:'위험'}),
      rewardWeights:Object.freeze({neutral:0.65,theme:0.35})
    })
  });

  let installed=false;

  function runStructure(runtimeRoot=root){return runtimeRoot?.RunStructure||(typeof require==='function'?require('./run-structure.js'):null)}
  function runPaths(runtimeRoot=root){return runtimeRoot?.RunPaths||(typeof require==='function'?require('./run-paths.js'):null)}
  function runMapGeneration(runtimeRoot=root){return runtimeRoot?.RunMapGeneration||(typeof require==='function'?require('./run-map-generation.js'):null)}
  function activeRun(runtimeRoot=root){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function toSet(value){return value instanceof Set?value:new Set(Array.isArray(value)?value:[])}
  function weightTotal(weights){return Object.values(weights||{}).reduce((sum,value)=>sum+(Number(value)||0),0)}
  function weightedPick(weights,rng=Math.random){
    const entries=Object.entries(weights||{}).filter(([,weight])=>Number(weight)>0);
    if(!entries.length)return null;
    const total=entries.reduce((sum,[,weight])=>sum+Number(weight),0);
    const raw=Number(rng());const safe=Number.isFinite(raw)?Math.max(0,Math.min(.999999999,raw)):0;
    let cursor=safe*total;
    for(const [id,weight] of entries){cursor-=Number(weight);if(cursor<0)return id}
    return entries[entries.length-1][0];
  }
  function hash32(value){const text=String(value??'');let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}return hash>>>0}
  function deterministicRng(runState,salt){let state=hash32(`${Number(runState?.runSeed)||0}:${String(salt||'')}`)||1;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000}}
  function regionProfile(id){return REGION_PROFILES[id]||null}
  function regionIds(){return Object.keys(REGION_PROFILES)}
  function validateRegionProfiles(runtimeRoot=root){
    const errors=[],structure=runStructure(runtimeRoot);
    if(regionIds().length!==3)errors.push('8-B first region offer requires exactly 3 regions');
    for(const profile of Object.values(REGION_PROFILES)){
      if(!profile.id||!profile.name)errors.push('region missing id/name');
      if(!structure?.ACT_DEFINITIONS?.[profile.id])errors.push(`${profile.id}: missing act definition`);
      for(const [kind,weights] of [['enemy',profile.enemyWeights],['event',profile.eventWeights],['reward',profile.rewardWeights]]){
        const total=weightTotal(weights);if(Math.abs(total-1)>.000001)errors.push(`${profile.id}: ${kind} weights must sum to 1`);
      }
      const neutral=Number(profile.rewardWeights?.neutral),theme=Number(profile.rewardWeights?.theme);
      if(neutral<.6||neutral>.7||theme<.3||theme>.4)errors.push(`${profile.id}: reward mix must stay near 60~70 / 30~40`);
    }
    return errors;
  }

  function createFlowState(){
    return{version:STAGE,phase:'common',regionVisitTarget:REGION_VISIT_TARGET,choiceRound:0,pendingRegionOfferIds:[],visitedRegionIds:[],completedRegionIds:[],currentRegionId:null,history:[]};
  }
  function ensureFlowState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    if(!runState.runFlow||runState.runFlow.version!==STAGE)runState.runFlow=createFlowState();
    const flow=runState.runFlow;
    if(!Array.isArray(flow.pendingRegionOfferIds))flow.pendingRegionOfferIds=[];
    if(!Array.isArray(flow.visitedRegionIds))flow.visitedRegionIds=[];
    if(!Array.isArray(flow.completedRegionIds))flow.completedRegionIds=[];
    if(!Array.isArray(flow.history))flow.history=[];
    return flow;
  }
  function clearLegacyRunMapState(runState){
    runState.actHistory=[];runState.routeHistory=[];runState.actMapHistory=[];runState.routeState=null;runState.mapGenerationState=null;runState.runComplete=false;
  }
  function actDisplayIndex(runState,actId){
    if(actId===COMMON_ACT_ID)return 0;
    if(actId===FINAL_ACT_ID)return REGION_VISIT_TARGET+1;
    if(regionProfile(actId))return Math.max(1,ensureFlowState(runState).visitedRegionIds.length);
    return Number(runState?.actIndex)||1;
  }
  function annotateRegionMap(runState,regionId){
    const profile=regionProfile(regionId);if(!profile)return null;
    const visitIndex=Math.max(1,ensureFlowState(runState).visitedRegionIds.length);
    for(const node of runState.map||[]){
      const rng=deterministicRng(runState,`${visitIndex}:${regionId}:${node.id}`);
      const enemyTag=['battle','elite','boss'].includes(node.type)?weightedPick(profile.enemyWeights,rng):null;
      const eventTag=node.type==='event'?weightedPick(profile.eventWeights,rng):null;
      node.regionPlan={regionId,visitIndex,enemyTag,eventTag,rewardWeights:{...profile.rewardWeights}};
    }
    return runState.map;
  }
  function applyFlowAct(runState,actId,{runtimeRoot=root,recordPrevious=true,phase=null}={}){
    const structure=runStructure(runtimeRoot);if(!structure?.applyActToRun)throw new TypeError('RunStructure.applyActToRun is required');
    structure.applyActToRun(runState,actId,{recordPrevious});
    runState.actIndex=actDisplayIndex(runState,actId);
    const mapGeneration=runMapGeneration(runtimeRoot);
    if(mapGeneration?.applyGeneratedActMap)mapGeneration.applyGeneratedActMap(runState,actId,{runtimeRoot,force:true});
    const paths=runPaths(runtimeRoot);if(paths?.ensurePathState){runState.routeState=null;paths.ensurePathState(runState)}
    const flow=ensureFlowState(runState);if(phase)flow.phase=phase;
    if(regionProfile(actId)){flow.currentRegionId=actId;annotateRegionMap(runState,actId)}else flow.currentRegionId=null;
    return runState;
  }
  function initializeRunFlow(runState,{runtimeRoot=root}={}){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    clearLegacyRunMapState(runState);runState.runFlow=createFlowState();
    applyFlowAct(runState,COMMON_ACT_ID,{runtimeRoot,recordPrevious:false,phase:'common'});
    return runState;
  }
  function availableRegionIds(runState){const visited=new Set(ensureFlowState(runState).visitedRegionIds);return regionIds().filter(id=>!visited.has(id))}
  function beginRegionChoice(runState,{reason='common_complete'}={}){
    const flow=ensureFlowState(runState),offers=availableRegionIds(runState);
    flow.choiceRound+=1;flow.phase='region_choice';flow.pendingRegionOfferIds=[...offers];flow.currentRegionId=null;
    flow.history.push({type:'region_offer',round:flow.choiceRound,reason,offerIds:[...offers],fromActId:runState.actId||null,step:flow.history.length+1});
    return[...offers];
  }
  function regionChoiceModel(runState){
    const flow=ensureFlowState(runState);
    return{round:flow.choiceRound,offerIds:[...flow.pendingRegionOfferIds],visitedRegionIds:[...flow.visitedRegionIds],options:flow.pendingRegionOfferIds.map(id=>regionProfile(id)).filter(Boolean)};
  }
  function chooseRegion(runState,regionId,{runtimeRoot=root}={}){
    const flow=ensureFlowState(runState),profile=regionProfile(regionId);
    if(flow.phase!=='region_choice')return{ok:false,reason:'not_choosing'};
    if(!profile||!flow.pendingRegionOfferIds.includes(regionId))return{ok:false,reason:'not_offered'};
    flow.visitedRegionIds.push(regionId);flow.currentRegionId=regionId;flow.phase='region';flow.pendingRegionOfferIds=[];
    flow.history.push({type:'region_selected',round:flow.choiceRound,regionId,regionName:profile.name,step:flow.history.length+1});
    applyFlowAct(runState,regionId,{runtimeRoot,recordPrevious:true,phase:'region'});
    return{ok:true,regionId,regionName:profile.name,visitIndex:flow.visitedRegionIds.length};
  }
  function completeRegionBoss(runState,node,{runtimeRoot=root}={}){
    const flow=ensureFlowState(runState),profile=regionProfile(runState.actId);
    if(!profile||node?.type!=='boss')return{ok:false,reason:'not_region_boss'};
    const completed=toSet(runState.completed),available=toSet(runState.available);
    if(completed.has(node.id))return{ok:false,reason:'already_completed'};
    completed.add(node.id);available.delete(node.id);runState.completed=completed;runState.available=available;runState.lastCompletedNodeId=node.id;runState.currentNodeId=null;runState.runComplete=false;
    if(!flow.completedRegionIds.includes(profile.id))flow.completedRegionIds.push(profile.id);
    flow.history.push({type:'region_complete',regionId:profile.id,regionName:profile.name,step:flow.history.length+1});
    if(flow.completedRegionIds.length<flow.regionVisitTarget){
      const offers=beginRegionChoice(runState,{reason:'region_complete'});return{ok:true,regionComplete:true,next:'region_choice',offers};
    }
    applyFlowAct(runState,FINAL_ACT_ID,{runtimeRoot,recordPrevious:true,phase:'final'});
    flow.history.push({type:'final_enter',step:flow.history.length+1});
    return{ok:true,regionComplete:true,next:'final',actId:FINAL_ACT_ID};
  }
  function nodePlan(runState,nodeOrId){
    const id=typeof nodeOrId==='string'?nodeOrId:nodeOrId?.id;return(runState?.map||[]).find(node=>node.id===id)?.regionPlan||null;
  }
  function runFlowSummary(runState){
    if(!runState?.runFlow)return null;const flow=ensureFlowState(runState),profile=regionProfile(flow.currentRegionId);
    return{version:flow.version,phase:flow.phase,choiceRound:flow.choiceRound,visitedRegionIds:[...flow.visitedRegionIds],completedRegionIds:[...flow.completedRegionIds],currentRegionId:flow.currentRegionId,currentRegionName:profile?.name||null,pendingRegionOfferIds:[...flow.pendingRegionOfferIds],actId:runState.actId||null,actName:runState.actName||''};
  }

  function regionOptionHtml(profile){
    const neutral=Math.round(Number(profile.rewardWeights.neutral)*100),theme=Math.round(Number(profile.rewardWeights.theme)*100);
    return`<button class="choice" onclick="RunFlowV2.chooseRegionFromUi('${profile.id}')"><b>${escapeHtml(profile.icon)} ${escapeHtml(profile.name)}</b><span>${escapeHtml(profile.desc)}<br>성향 · ${escapeHtml(profile.tone)} · ${escapeHtml(profile.risk)}<br>카드 보상 경향 · 공용 ${neutral}% / 지역 ${theme}%</span></button>`;
  }
  function showRegionChoice(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const model=regionChoiceModel(runState);if(!model.options.length)return false;
    const suffix=model.round===1?'공통지역을 통과했다. 현재 덱을 보고 첫 지역을 고른다.':'지역 보스를 쓰러뜨렸다. 다음 경로를 고른다.';
    const html=`<h2 class="cyan">지역 선택</h2><p>${escapeHtml(suffix)}<br>지역은 카드 획득을 제한하지 않고 등장 경향만 바꾼다.</p><div class="choiceList">${model.options.map(regionOptionHtml).join('')}</div>`;
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}
    const doc=runtimeRoot?.document,modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true;
  }
  function showFinalTransition(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const names=ensureFlowState(runState).completedRegionIds.map(id=>regionProfile(id)?.name||id).join(' → ');
    const html=`<h2 class="gold">최종지역 진입</h2><p>${escapeHtml(names)}을 지나 최종지역이 열렸다.</p><div class="choiceList"><button class="choice" onclick="closeOverlay()"><b>최종지역 확인</b><span>마지막 보스까지 이어지는 경로를 확인한다.</span></button></div>`;
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}return false;
  }
  function chooseRegionFromUi(regionId,runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const result=chooseRegion(runState,regionId,{runtimeRoot});if(!result.ok)return false;
    if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();if(typeof runtimeRoot?.showScreen==='function')runtimeRoot.showScreen('mapScreen');if(typeof runtimeRoot?.renderMap==='function')runtimeRoot.renderMap();if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');return true;
  }
  function commonTerminal(runState,node){return runState?.actId===COMMON_ACT_ID&&node&&!(node.next||[]).length}
  function decorateMap(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document;if(!runState?.runFlow||!doc)return null;const flow=ensureFlowState(runState),badge=doc.getElementById?.('mapActBadge');
    let label='공통지역',title='기본 규칙에 적응하고 첫 보상을 확보한 뒤 지역을 선택한다.';
    if(flow.phase==='region'||regionProfile(runState.actId)){const profile=regionProfile(runState.actId);label=`지역 ${Math.max(1,flow.visitedRegionIds.length)} · ${profile?.name||runState.actName}`;title=profile?.desc||''}
    else if(flow.phase==='region_choice'){label='지역 선택';title='현재 덱에 맞는 다음 지역을 선택한다.'}
    else if(runState.actId===FINAL_ACT_ID||flow.phase==='final'){label='최종지역';title='최종 보스로 이어지는 마지막 경로.'}
    if(badge){badge.innerHTML=escapeHtml(label);badge.title=title}
    const grid=doc.getElementById?.('mapGrid');if(grid?.dataset)grid.dataset.runFlowPhase=flow.phase;
    const buttons=[...(doc.querySelectorAll?.('#mapGrid .node')||[])];
    (runState.map||[]).forEach((node,index)=>{const button=buttons[index],plan=node.regionPlan,profile=regionProfile(plan?.regionId);if(!button||!plan||!profile)return;const parts=[];if(plan.enemyTag)parts.push(`적 경향 · ${profile.enemyLabels[plan.enemyTag]||plan.enemyTag}`);if(plan.eventTag)parts.push(`이벤트 경향 · ${profile.eventLabels[plan.eventTag]||plan.eventTag}`);parts.push(`보상 · 공용 ${Math.round(plan.rewardWeights.neutral*100)} / 지역 ${Math.round(plan.rewardWeights.theme*100)}`);button.title=parts.join(' · ')});
    return runFlowSummary(runState);
  }

  function wrapBeginRun(runtimeRoot=root){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runFlowV2)return true;
    function wrapped(){const result=original.apply(this,arguments),runState=activeRun(runtimeRoot);if(runState){initializeRunFlow(runState,{runtimeRoot});if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap()}return result}
    wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapEnterNode(runtimeRoot=root){
    const original=runtimeRoot?.enterNode;if(typeof original!=='function')return false;if(original.__runFlowV2)return true;
    function wrapped(node){const runState=activeRun(runtimeRoot),flow=runState?.runFlow?ensureFlowState(runState):null;if(flow?.phase==='region_choice')return false;if(runState&&regionProfile(runState.actId))runState.activeRegionNode=nodePlan(runState,node);return original.apply(this,arguments)}
    wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.enterNode=wrapped;return true;
  }
  function wrapCompleteNode(runtimeRoot=root){
    const original=runtimeRoot?.completeNode;if(typeof original!=='function')return false;if(original.__runFlowV2)return true;
    function wrapped(node){
      const runState=activeRun(runtimeRoot),resolved=(runState?.map||[]).find(item=>item.id===(typeof node==='string'?node:node?.id))||node;
      if(runState?.runFlow&&regionProfile(runState.actId)&&resolved?.type==='boss'){
        const result=completeRegionBoss(runState,resolved,{runtimeRoot});if(!result.ok)return result;
        if(typeof runtimeRoot.closeOverlay==='function')runtimeRoot.closeOverlay();if(typeof runtimeRoot.showScreen==='function')runtimeRoot.showScreen('mapScreen');if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();
        if(result.next==='region_choice')showRegionChoice(runtimeRoot);else if(result.next==='final')showFinalTransition(runtimeRoot);return result;
      }
      const wasCommon=commonTerminal(runState,resolved),result=original.apply(this,arguments),after=activeRun(runtimeRoot);
      if(wasCommon&&after?.runFlow){beginRegionChoice(after,{reason:'common_complete'});showRegionChoice(runtimeRoot)}
      return result;
    }
    wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.completeNode=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=root){
    const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__runFlowV2)return true;
    function wrapped(){const result=original.apply(this,arguments);decorateMap(runtimeRoot);return result}
    wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function installBrowser(runtimeRoot=root){
    if(installed)return true;
    if(!runtimeRoot?.RunStartV2||!runtimeRoot?.RunStructure||!runtimeRoot?.RunPaths||!runtimeRoot?.RunMapGeneration)return false;
    if(typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.enterNode!=='function'||typeof runtimeRoot.completeNode!=='function'||typeof runtimeRoot.renderMap!=='function')return false;
    const errors=validateRegionProfiles(runtimeRoot);if(errors.length){console.error('[run-flow-v2] 지역 정의 오류',errors);return false}
    wrapBeginRun(runtimeRoot);wrapEnterNode(runtimeRoot);wrapCompleteNode(runtimeRoot);wrapRenderMap(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25);else console.warn('[run-flow-v2] 최신 런 흐름을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  function resetForTests(){installed=false}

  return{STAGE,COMMON_ACT_ID,FINAL_ACT_ID,REGION_VISIT_TARGET,REGION_PROFILES,runStructure,runPaths,runMapGeneration,activeRun,escapeHtml,toSet,weightTotal,weightedPick,hash32,deterministicRng,regionProfile,regionIds,validateRegionProfiles,createFlowState,ensureFlowState,clearLegacyRunMapState,actDisplayIndex,annotateRegionMap,applyFlowAct,initializeRunFlow,availableRegionIds,beginRegionChoice,regionChoiceModel,chooseRegion,completeRegionBoss,nodePlan,runFlowSummary,regionOptionHtml,showRegionChoice,showFinalTransition,chooseRegionFromUi,commonTerminal,decorateMap,wrapBeginRun,wrapEnterNode,wrapCompleteNode,wrapRenderMap,installBrowser,installWhenReady,resetForTests};
});
