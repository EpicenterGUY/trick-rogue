(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunFlowV2=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='RUN-V3';
  const COMMON_ACT_ID='common';
  const GATEWAY_ACT_ID='gateway';
  const FINAL_ACT_ID='final';
  const REGION_VISIT_TARGET=2;
  const MAX_RUN_STAGE=8;

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
  function runEvents(runtimeRoot=root){return runtimeRoot?.RunEvents||(typeof require==='function'?(()=>{try{return require('./run-events.js')}catch(_error){return null}})():null)}
  function activeRun(runtimeRoot=root){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]))}
  function toSet(value){return value instanceof Set?value:new Set(Array.isArray(value)?value:[])}
  function weightTotal(weights){return Object.values(weights||{}).reduce((sum,value)=>sum+(Number(value)||0),0)}
  function weightedPick(weights,rng=Math.random){
    const entries=Object.entries(weights||{}).filter(([,weight])=>Number(weight)>0);if(!entries.length)return null;
    const total=entries.reduce((sum,[,weight])=>sum+Number(weight),0),raw=Number(rng()),safe=Number.isFinite(raw)?Math.max(0,Math.min(.999999999,raw)):0;let cursor=safe*total;
    for(const [id,weight] of entries){cursor-=Number(weight);if(cursor<0)return id}return entries[entries.length-1][0];
  }
  function hash32(value){const text=String(value??'');let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}return hash>>>0}
  function deterministicRng(runState,salt){let state=hash32(`${Number(runState?.runSeed)||0}:${String(salt||'')}`)||1;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000}}
  function regionProfile(id){return REGION_PROFILES[id]||null}
  function regionIds(){return Object.keys(REGION_PROFILES)}
  function regionBranches(regionId,runtimeRoot=root){return(runStructure(runtimeRoot)?.REGION_BRANCHES?.[regionId]||[]).map(branch=>({...branch,tags:[...(branch.tags||[])]}))}
  function validateRegionProfiles(runtimeRoot=root){
    const errors=[],structure=runStructure(runtimeRoot);if(regionIds().length!==3)errors.push('first region offer requires exactly 3 regions');
    for(const profile of Object.values(REGION_PROFILES)){
      if(!profile.id||!profile.name)errors.push('region missing id/name');if(!structure?.ACT_DEFINITIONS?.[profile.id])errors.push(`${profile.id}: missing act definition`);
      if((structure?.REGION_BRANCHES?.[profile.id]||[]).length<2)errors.push(`${profile.id}: at least two region branches are required`);
      for(const [kind,weights] of [['enemy',profile.enemyWeights],['event',profile.eventWeights],['reward',profile.rewardWeights]]){const total=weightTotal(weights);if(Math.abs(total-1)>.000001)errors.push(`${profile.id}: ${kind} weights must sum to 1`)}
      const neutral=Number(profile.rewardWeights?.neutral),theme=Number(profile.rewardWeights?.theme);if(neutral<.6||neutral>.7||theme<.3||theme>.4)errors.push(`${profile.id}: reward mix must stay near 60~70 / 30~40`);
    }
    if(!structure?.ACT_DEFINITIONS?.[GATEWAY_ACT_ID])errors.push('missing final gateway act');return errors;
  }

  function createFlowState(){return{version:STAGE,phase:'common',regionVisitTarget:REGION_VISIT_TARGET,choiceRound:0,pendingRegionOfferIds:[],visitedRegionIds:[],completedRegionIds:[],visitedRegionBranches:[],journeyHistory:[],currentRegionId:null,hookHistory:[],history:[]}}
  function inferRunStage(runState,flow){
    if(runState?.actId===FINAL_ACT_ID)return 8;if(runState?.actId===GATEWAY_ACT_ID)return 7;
    const visits=(flow?.visitedRegionIds||[]).length,branches=(flow?.visitedRegionBranches||[]).length;
    if(runState?.actId===COMMON_ACT_ID||visits===0)return 1;
    if(visits===1){if(runState?.currentNodeId&&(runState?.map||[]).find(node=>node.id===runState.currentNodeId)?.type==='boss')return 4;return branches>=1?3:2}
    return branches>=2?6:5;
  }
  function setRunStage(runState,stage,{reason='flow'}={}){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');const next=Math.max(1,Math.min(MAX_RUN_STAGE,Math.trunc(Number(stage)||1))),previous=Math.max(1,Math.min(MAX_RUN_STAGE,Math.trunc(Number(runState.runStage)||next)));
    runState.runStage=next;if(!runState.runProgress||typeof runState.runProgress!=='object')runState.runProgress={};runState.runProgress.stage=next;runState.runProgress.maxStage=MAX_RUN_STAGE;
    if(runState.runFlow&&previous!==next){const history=Array.isArray(runState.runFlow.history)?runState.runFlow.history:(runState.runFlow.history=[]);history.push({type:'stage_enter',stage:next,previous,reason,step:history.length+1})}
    return next;
  }
  function ensureFlowState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');const previous=runState.runFlow&&typeof runState.runFlow==='object'?runState.runFlow:{},defaults=createFlowState();
    const flow=runState.runFlow=Object.assign(previous,{...defaults,...previous,version:STAGE});
    for(const key of ['pendingRegionOfferIds','visitedRegionIds','completedRegionIds','visitedRegionBranches','journeyHistory','hookHistory','history'])if(!Array.isArray(flow[key]))flow[key]=[];
    flow.pendingRegionOfferIds=[...new Set(flow.pendingRegionOfferIds.filter(regionProfile))];flow.visitedRegionIds=[...new Set(flow.visitedRegionIds.filter(regionProfile))];flow.completedRegionIds=[...new Set(flow.completedRegionIds.filter(regionProfile))];
    if(!Number.isInteger(Number(runState.runStage)))setRunStage(runState,inferRunStage(runState,flow),{reason:'migration'});else setRunStage(runState,runState.runStage,{reason:'restore'});return flow;
  }
  function clearLegacyRunMapState(runState){runState.actHistory=[];runState.routeHistory=[];runState.actMapHistory=[];runState.routeState=null;runState.mapGenerationState=null;runState.runComplete=false}
  function actDisplayIndex(runState,actId){if(actId===COMMON_ACT_ID)return 0;if(actId===GATEWAY_ACT_ID)return 3;if(actId===FINAL_ACT_ID)return 4;if(regionProfile(actId))return Math.max(1,ensureFlowState(runState).visitedRegionIds.length);return Number(runState?.actIndex)||1}
  function annotateRegionMap(runState,regionId){
    const profile=regionProfile(regionId);if(!profile)return null;const visitIndex=Math.max(1,ensureFlowState(runState).visitedRegionIds.length);
    for(const node of runState.map||[]){const rng=deterministicRng(runState,`${visitIndex}:${regionId}:${node.id}`),enemyTag=['battle','elite','boss'].includes(node.type)?weightedPick(profile.enemyWeights,rng):null,eventTag=node.type==='event'?weightedPick(profile.eventWeights,rng):null;node.regionPlan={regionId,regionIds:[regionId],sourceRegionIds:[regionId],visitIndex,branchId:node.branchId||null,branchTags:[...(node.branchTags||[])],enemyTag,eventTag,eventTags:eventTag?[eventTag]:[],rewardWeights:{...profile.rewardWeights}}}
    return runState.map;
  }
  function annotateGatewayMap(runState){
    const flow=ensureFlowState(runState),sourceRegionIds=flow.visitedRegionIds.slice(-2),profiles=sourceRegionIds.map(regionProfile).filter(Boolean);
    for(const node of runState.map||[]){
      const enemyTags=[],eventTags=[];profiles.forEach((profile,index)=>{const rng=deterministicRng(runState,`gateway:${node.id}:${profile.id}:${index}`);if(['battle','elite','boss'].includes(node.type))enemyTags.push(weightedPick(profile.enemyWeights,rng));if(node.type==='event')eventTags.push(weightedPick(profile.eventWeights,rng))});
      const chooser=deterministicRng(runState,`gateway:primary:${node.id}`),enemyTag=enemyTags.length?enemyTags[Math.floor(chooser()*enemyTags.length)]:null,eventTag=eventTags.length?eventTags[Math.floor(chooser()*eventTags.length)]:null;
      node.regionPlan={regionId:'final_gateway',regionIds:[...sourceRegionIds],sourceRegionIds:[...sourceRegionIds],visitIndex:3,enemyTag,enemyTags,eventTag,eventTags,rewardWeights:{neutral:.65,theme:.35}};
    }
    return runState.map;
  }
  function emitRunHook(runState,hook,context={},runtimeRoot=root){
    const flow=ensureFlowState(runState),entry={type:'run_hook',hook,context:{...context},stage:runState.runStage,step:flow.hookHistory.length+1};flow.hookHistory.push(entry);
    const events=runEvents(runtimeRoot);const results=typeof events?.handleRunHook==='function'?events.handleRunHook(runState,hook,context,runtimeRoot):[];return{entry,results};
  }
  function applyFlowAct(runState,actId,{runtimeRoot=root,recordPrevious=true,phase=null}={}){
    const structure=runStructure(runtimeRoot);if(!structure?.applyActToRun)throw new TypeError('RunStructure.applyActToRun is required');structure.applyActToRun(runState,actId,{recordPrevious});runState.actIndex=actDisplayIndex(runState,actId);
    const mapGeneration=runMapGeneration(runtimeRoot);if(mapGeneration?.applyGeneratedActMap)mapGeneration.applyGeneratedActMap(runState,actId,{runtimeRoot,force:true});
    const paths=runPaths(runtimeRoot);if(paths?.ensurePathState){runState.routeState=null;paths.ensurePathState(runState)}
    const flow=ensureFlowState(runState);if(phase)flow.phase=phase;if(regionProfile(actId)){flow.currentRegionId=actId;annotateRegionMap(runState,actId)}else{flow.currentRegionId=null;if(actId===GATEWAY_ACT_ID)annotateGatewayMap(runState)}return runState;
  }
  function initializeRunFlow(runState,{runtimeRoot=root}={}){if(!runState||typeof runState!=='object')throw new TypeError('runState is required');clearLegacyRunMapState(runState);runState.runFlow=createFlowState();setRunStage(runState,1,{reason:'new_run'});applyFlowAct(runState,COMMON_ACT_ID,{runtimeRoot,recordPrevious:false,phase:'common'});emitRunHook(runState,'on_stage_enter',{stage:1},runtimeRoot);return runState}
  function availableRegionIds(runState){const visited=new Set(ensureFlowState(runState).visitedRegionIds);return regionIds().filter(id=>!visited.has(id))}
  function beginRegionChoice(runState,{reason='common_complete'}={}){const flow=ensureFlowState(runState),offers=availableRegionIds(runState);flow.choiceRound+=1;flow.phase='region_choice';flow.pendingRegionOfferIds=[...offers];flow.currentRegionId=null;flow.history.push({type:'region_offer',round:flow.choiceRound,reason,offerIds:[...offers],fromActId:runState.actId||null,step:flow.history.length+1});return[...offers]}
  function regionChoiceModel(runState){const flow=ensureFlowState(runState);return{round:flow.choiceRound,offerIds:[...flow.pendingRegionOfferIds],visitedRegionIds:[...flow.visitedRegionIds],options:flow.pendingRegionOfferIds.map(id=>regionProfile(id)).filter(Boolean)}}
  function chooseRegion(runState,regionId,{runtimeRoot=root}={}){
    const flow=ensureFlowState(runState),profile=regionProfile(regionId);if(flow.phase!=='region_choice')return{ok:false,reason:'not_choosing'};if(!profile||!flow.pendingRegionOfferIds.includes(regionId))return{ok:false,reason:'not_offered'};
    flow.visitedRegionIds.push(regionId);flow.currentRegionId=regionId;flow.phase='region';flow.pendingRegionOfferIds=[];const visitIndex=flow.visitedRegionIds.length,stage=visitIndex===1?2:5;setRunStage(runState,stage,{reason:'region_enter'});
    flow.history.push({type:'region_selected',round:flow.choiceRound,regionId,regionName:profile.name,visitIndex,step:flow.history.length+1});applyFlowAct(runState,regionId,{runtimeRoot,recordPrevious:true,phase:'region'});
    emitRunHook(runState,'on_region_enter',{regionId,visitIndex},runtimeRoot);emitRunHook(runState,'on_stage_enter',{stage,regionId},runtimeRoot);return{ok:true,regionId,regionName:profile.name,visitIndex,stage};
  }
  function branchRecord(runState,regionId){return ensureFlowState(runState).visitedRegionBranches.find(entry=>entry.regionId===regionId)||null}
  function recordBranchSelection(runState,node,{runtimeRoot=root}={}){
    const flow=ensureFlowState(runState),regionId=flow.currentRegionId||runState.actId;if(!regionProfile(regionId)||!node?.branchId)return{ok:false,reason:'not_branch'};const existing=branchRecord(runState,regionId);if(existing)return{ok:true,duplicate:true,record:existing};
    const definition=regionBranches(regionId,runtimeRoot).find(branch=>branch.id===node.branchId),record={regionId,branchId:node.branchId,branchLabel:node.branchLabel||definition?.label||node.branchId,tags:[...(node.branchTags||definition?.tags||[])],visitIndex:flow.visitedRegionIds.indexOf(regionId)+1};
    flow.visitedRegionBranches.push(record);flow.journeyHistory.push({...record});flow.history.push({type:'region_branch_selected',...record,step:flow.history.length+1});const stage=record.visitIndex===1?3:6;setRunStage(runState,stage,{reason:'region_branch_selected'});emitRunHook(runState,'on_region_branch_selected',record,runtimeRoot);emitRunHook(runState,'on_stage_enter',{stage,...record},runtimeRoot);return{ok:true,duplicate:false,record,stage};
  }
  function transitionAfterRegionBoss(runState,profile,{runtimeRoot=root,reason='region_complete',recovered=false}={}){
    const flow=ensureFlowState(runState),alreadyRecorded=flow.completedRegionIds.includes(profile.id);runState.runComplete=false;runState.currentNodeId=null;
    if(!alreadyRecorded){flow.completedRegionIds.push(profile.id);flow.history.push({type:'region_complete',regionId:profile.id,regionName:profile.name,recovered:!!recovered,step:flow.history.length+1});emitRunHook(runState,'on_region_leave',{regionId:profile.id,visitIndex:flow.completedRegionIds.length,recovered:!!recovered},runtimeRoot)}
    if(flow.completedRegionIds.length<flow.regionVisitTarget){if(flow.phase==='region_choice'&&flow.pendingRegionOfferIds.length)return{ok:true,regionComplete:true,next:'region_choice',offers:[...flow.pendingRegionOfferIds],recovered:!!recovered};const offers=beginRegionChoice(runState,{reason});return{ok:true,regionComplete:true,next:'region_choice',offers,recovered:!!recovered}}
    if(runState.actId===GATEWAY_ACT_ID||flow.phase==='gateway')return{ok:true,regionComplete:true,next:'gateway',actId:GATEWAY_ACT_ID,stage:7,recovered:!!recovered};
    applyFlowAct(runState,GATEWAY_ACT_ID,{runtimeRoot,recordPrevious:true,phase:'gateway'});setRunStage(runState,7,{reason:'final_gateway'});flow.history.push({type:'gateway_enter',sourceRegionIds:[...flow.visitedRegionIds],recovered:!!recovered,step:flow.history.length+1});emitRunHook(runState,'on_stage_enter',{stage:7,sourceRegionIds:[...flow.visitedRegionIds],recovered:!!recovered},runtimeRoot);return{ok:true,regionComplete:true,next:'gateway',actId:GATEWAY_ACT_ID,stage:7,recovered:!!recovered};
  }
  function completeRegionBoss(runState,node,{runtimeRoot=root}={}){
    const flow=ensureFlowState(runState),profile=regionProfile(runState.actId);if(!profile||node?.type!=='boss')return{ok:false,reason:'not_region_boss'};const completed=toSet(runState.completed),available=toSet(runState.available);
    if(completed.has(node.id)){if(flow.phase==='region')return transitionAfterRegionBoss(runState,profile,{runtimeRoot,reason:'region_terminal_recovery',recovered:true});return{ok:false,reason:'already_completed'}}
    completed.add(node.id);available.delete(node.id);runState.completed=completed;runState.available=available;runState.lastCompletedNodeId=node.id;runState.currentNodeId=null;runState.runComplete=false;return transitionAfterRegionBoss(runState,profile,{runtimeRoot});
  }
  function completeGateway(runState,{runtimeRoot=root}={}){const flow=ensureFlowState(runState);if(runState.actId!==GATEWAY_ACT_ID)return{ok:false,reason:'not_gateway'};applyFlowAct(runState,FINAL_ACT_ID,{runtimeRoot,recordPrevious:true,phase:'final'});setRunStage(runState,8,{reason:'final_area'});flow.history.push({type:'final_enter',sourceRegionIds:[...flow.visitedRegionIds],journeyHistory:flow.journeyHistory.map(entry=>({...entry})),step:flow.history.length+1});emitRunHook(runState,'on_stage_enter',{stage:8,sourceRegionIds:[...flow.visitedRegionIds]},runtimeRoot);return{ok:true,next:'final',actId:FINAL_ACT_ID,stage:8}}
  function nodePlan(runState,nodeOrId){const id=typeof nodeOrId==='string'?nodeOrId:nodeOrId?.id;return(runState?.map||[]).find(node=>node.id===id)?.regionPlan||null}
  function gatewayPlan(runState){if(runState?.actId!==GATEWAY_ACT_ID)return null;return{sourceRegionIds:[...ensureFlowState(runState).visitedRegionIds],journeyHistory:ensureFlowState(runState).journeyHistory.map(entry=>({...entry})),nodePlans:(runState.map||[]).map(node=>({id:node.id,regionPlan:node.regionPlan?{...node.regionPlan}:null}))}}
  function runFlowSummary(runState){if(!runState?.runFlow)return null;const flow=ensureFlowState(runState),profile=regionProfile(flow.currentRegionId);return{version:flow.version,stage:runState.runStage,maxStage:MAX_RUN_STAGE,phase:flow.phase,choiceRound:flow.choiceRound,visitedRegionIds:[...flow.visitedRegionIds],completedRegionIds:[...flow.completedRegionIds],visitedRegionBranches:flow.visitedRegionBranches.map(entry=>({...entry})),journeyHistory:flow.journeyHistory.map(entry=>({...entry})),currentRegionId:flow.currentRegionId,currentRegionName:profile?.name||null,pendingRegionOfferIds:[...flow.pendingRegionOfferIds],actId:runState.actId||null,actName:runState.actName||''}}

  function regionOptionHtml(profile){const neutral=Math.round(Number(profile.rewardWeights.neutral)*100),theme=Math.round(Number(profile.rewardWeights.theme)*100);return`<button class="choice" onclick="RunFlowV2.chooseRegionFromUi('${profile.id}')"><b>${escapeHtml(profile.icon)} ${escapeHtml(profile.name)}</b><span>${escapeHtml(profile.desc)}<br>성향 · ${escapeHtml(profile.tone)} · ${escapeHtml(profile.risk)}<br>카드 보상 경향 · 공용 ${neutral}% / 지역 ${theme}%</span></button>`}
  function showRegionChoice(runtimeRoot=root){const runState=activeRun(runtimeRoot);if(!runState)return false;const model=regionChoiceModel(runState);if(!model.options.length)return false;const suffix=model.round===1?'공통지역을 통과했다. 현재 덱을 보고 첫 지역을 고른다.':'지역 보스를 쓰러뜨렸다. 첫 방문 지역을 제외하고 다음 지역을 고른다.',html=`<h2 class="cyan">지역 선택</h2><p>${escapeHtml(suffix)}<br>지역은 카드 획득을 제한하지 않고 등장 경향만 바꾼다.</p><div class="choiceList">${model.options.map(regionOptionHtml).join('')}</div>`;if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}const doc=runtimeRoot?.document,modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true}
  function showGatewayTransition(runtimeRoot=root){const runState=activeRun(runtimeRoot);if(!runState)return false;const names=ensureFlowState(runState).completedRegionIds.map(id=>regionProfile(id)?.name||id).join(' + '),html=`<h2 class="gold">STAGE 7 / 8 · 최종 관문</h2><p>${escapeHtml(names)}의 흔적이 섞인 결산 구간이 열렸다.</p><div class="choiceList"><button class="choice" onclick="closeOverlay()"><b>최종 관문 확인</b><span>두 지역의 적·이벤트 태그가 함께 사용된다.</span></button></div>`;if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}return false}
  function showFinalTransition(runtimeRoot=root){const runState=activeRun(runtimeRoot);if(!runState)return false;const html='<h2 class="gold">STAGE 8 / 8 · 최종지역</h2><p>마지막 구간과 최종 보스가 열렸다.</p><div class="choiceList"><button class="choice" onclick="closeOverlay()"><b>최종지역 확인</b><span>최종 보스까지 진행한다.</span></button></div>';if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}return false}
  function chooseRegionFromUi(regionId,runtimeRoot=root){const runState=activeRun(runtimeRoot);if(!runState)return false;const result=chooseRegion(runState,regionId,{runtimeRoot});if(!result.ok)return false;if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();if(typeof runtimeRoot?.showScreen==='function')runtimeRoot.showScreen('mapScreen');if(typeof runtimeRoot?.renderMap==='function')runtimeRoot.renderMap();if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');return true}
  function commonTerminal(runState,node){return runState?.actId===COMMON_ACT_ID&&node&&!(node.next||[]).length}
  function gatewayTerminal(runState,node){return runState?.actId===GATEWAY_ACT_ID&&node&&!(node.next||[]).length}
  function terminalRewardClaimed(runState,nodeId){return!!runState?.economyState?.rewardClaims?.[nodeId]}
  function recoverTerminalNodeState(runState,terminal){
    if(!runState||!terminal)return null;const completed=toSet(runState.completed),available=toSet(runState.available),rewardDone=terminalRewardClaimed(runState,terminal.id);
    if(!completed.has(terminal.id)&&!rewardDone)return null;
    if(!completed.has(terminal.id)){completed.add(terminal.id);runState.lastCompletedNodeId=terminal.id}
    available.delete(terminal.id);runState.completed=completed;runState.available=available;if(available.size>0)return null;runState.currentNodeId=null;runState.runComplete=false;return{terminalId:terminal.id,rewardRecovered:rewardDone};
  }
  function recoverCommonTerminalChoice(runState){
    if(!runState?.runFlow||runState.actId!==COMMON_ACT_ID)return{recovered:false,reason:'not_common'};
    const flow=ensureFlowState(runState);if(flow.phase!=='common')return{recovered:false,reason:'phase'};
    const terminal=(runState.map||[]).find(node=>!(node.next||[]).length),state=recoverTerminalNodeState(runState,terminal);if(!state)return{recovered:false,reason:'not_terminal'};
    const offers=beginRegionChoice(runState,{reason:'common_terminal_recovery'});return{recovered:true,next:'region_choice',...state,offers};
  }
  function recoverRegionTerminalTransition(runState,{runtimeRoot=root}={}){
    if(!runState?.runFlow)return{recovered:false,reason:'no_flow'};const profile=regionProfile(runState.actId);if(!profile)return{recovered:false,reason:'not_region'};const flow=ensureFlowState(runState);if(flow.phase!=='region')return{recovered:false,reason:'phase'};
    const terminal=(runState.map||[]).find(node=>node.type==='boss'&&!(node.next||[]).length),state=recoverTerminalNodeState(runState,terminal);if(!state)return{recovered:false,reason:'not_terminal'};
    const transition=transitionAfterRegionBoss(runState,profile,{runtimeRoot,reason:'region_terminal_recovery',recovered:true});return{...transition,recovered:true,...state};
  }
  function ensureStageBadge(runtimeRoot,runState){const doc=runtimeRoot?.document,build=doc?.getElementById?.('mapBuild'),host=build?.parentElement?.parentElement;if(!doc||!host)return null;let badge=doc.getElementById?.('mapStageBadge');if(!badge){badge=doc.createElement('span');badge.id='mapStageBadge';badge.className='badge';host.insertBefore(badge,host.firstChild||null)}badge.innerHTML=`STAGE <b>${runState.runStage}</b> / ${MAX_RUN_STAGE}`;badge.title='현재 런 진행 단계';return badge}
  function decorateMap(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document;if(!runState?.runFlow||!doc)return null;const flow=ensureFlowState(runState),badge=doc.getElementById?.('mapActBadge');ensureStageBadge(runtimeRoot,runState);
    let label='공통지역',title='기본 규칙에 적응하고 첫 보상을 확보한 뒤 지역을 선택한다.',headerName='공통지역';
    if(flow.phase==='region'||regionProfile(runState.actId)){const profile=regionProfile(runState.actId);label=`지역 ${Math.max(1,flow.visitedRegionIds.length)} · ${profile?.name||runState.actName}`;title=profile?.desc||'';headerName=profile?.name||runState.actName||'일반지역'}
    else if(flow.phase==='region_choice'){label='지역 선택';title='현재 덱에 맞는 다음 지역을 선택한다.';headerName='지역 선택'}
    else if(runState.actId===GATEWAY_ACT_ID||flow.phase==='gateway'){label='최종 관문';title='방문한 두 지역의 성향이 함께 섞인다.';headerName='최종 관문'}
    else if(runState.actId===FINAL_ACT_ID||flow.phase==='final'){label='최종지역';title='최종 보스로 이어지는 마지막 경로.';headerName='최종지역'}
    if(badge){badge.innerHTML=escapeHtml(label);badge.title=title}const logo=doc.querySelector?.('#mapScreen .topbar .logo');if(logo)logo.innerHTML=`액트 1 · <b>${escapeHtml(headerName)}</b>`;const grid=doc.getElementById?.('mapGrid');if(grid?.dataset){grid.dataset.runFlowPhase=flow.phase;grid.dataset.runStage=String(runState.runStage)}
    const buttons=[...(doc.querySelectorAll?.('#mapGrid .node')||[])];(runState.map||[]).forEach((node,index)=>{const button=buttons[index],plan=node.regionPlan;if(!button)return;const parts=[];if(node.branchEntry&&node.branchLabel){const name=button.querySelector?.('.nm');if(name)name.textContent=node.branchLabel;parts.push(`내부 경로 · ${node.branchLabel}`)}if(plan?.enemyTag)parts.push(`적 경향 · ${plan.enemyTag}`);if(plan?.eventTag)parts.push(`이벤트 경향 · ${plan.eventTag}`);if(plan?.sourceRegionIds?.length>1)parts.push(`혼합 지역 · ${plan.sourceRegionIds.map(id=>regionProfile(id)?.name||id).join(' + ')}`);if(plan?.rewardWeights)parts.push(`보상 · 공용 ${Math.round(plan.rewardWeights.neutral*100)} / 지역 ${Math.round(plan.rewardWeights.theme*100)}`);if(parts.length)button.title=parts.join(' · ')});return runFlowSummary(runState);
  }

  function wrapBeginRun(runtimeRoot=root){const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runFlowV3)return true;function wrapped(){const result=original.apply(this,arguments),runState=activeRun(runtimeRoot);if(runState){initializeRunFlow(runState,{runtimeRoot});if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap()}return result}wrapped.__runFlowV3=true;wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.beginRun=wrapped;return true}
  function wrapEnterNode(runtimeRoot=root){
    const original=runtimeRoot?.enterNode;if(typeof original!=='function')return false;if(original.__runFlowV3)return true;
    function wrapped(node){const runState=activeRun(runtimeRoot),flow=runState?.runFlow?ensureFlowState(runState):null;if(flow?.phase==='region_choice')return false;const resolved=(runState?.map||[]).find(item=>item.id===(typeof node==='string'?node:node?.id))||node;if(runState&&regionProfile(runState.actId)){runState.activeRegionNode=nodePlan(runState,resolved);if(resolved?.type==='boss'&&flow.visitedRegionIds.length===1){setRunStage(runState,4,{reason:'first_region_boss'});emitRunHook(runState,'on_stage_enter',{stage:4,regionId:runState.actId},runtimeRoot)}}const result=original.apply(this,arguments);if(result!==false&&runState&&resolved?.branchId&&resolved?.branchEntry)recordBranchSelection(runState,resolved,{runtimeRoot});return result}
    wrapped.__runFlowV3=true;wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.enterNode=wrapped;return true;
  }
  function wrapCompleteNode(runtimeRoot=root){
    const original=runtimeRoot?.completeNode;if(typeof original!=='function')return false;if(original.__runFlowV3)return true;
    function wrapped(node){
      const runState=activeRun(runtimeRoot),resolved=(runState?.map||[]).find(item=>item.id===(typeof node==='string'?node:node?.id))||node;
      if(runState?.runFlow&&regionProfile(runState.actId)&&resolved?.type==='boss'){
        const result=completeRegionBoss(runState,resolved,{runtimeRoot});if(!result.ok)return result;if(typeof runtimeRoot.closeOverlay==='function')runtimeRoot.closeOverlay();if(typeof runtimeRoot.showScreen==='function')runtimeRoot.showScreen('mapScreen');if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();if(result.next==='region_choice')showRegionChoice(runtimeRoot);else if(result.next==='gateway')showGatewayTransition(runtimeRoot);return result;
      }
      const wasCommon=commonTerminal(runState,resolved),wasGateway=gatewayTerminal(runState,resolved),result=original.apply(this,arguments),after=activeRun(runtimeRoot);
      if(wasCommon&&after?.runFlow){beginRegionChoice(after,{reason:'common_complete'});showRegionChoice(runtimeRoot)}
      if(wasGateway&&after?.runFlow){const transition=completeGateway(after,{runtimeRoot});if(transition.ok){if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();showFinalTransition(runtimeRoot);return transition}}
      return result;
    }
    wrapped.__runFlowV3=true;wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.completeNode=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=root){
    const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__runFlowV3)return true;
    function wrapped(){
      const runState=activeRun(runtimeRoot),commonRecovery=recoverCommonTerminalChoice(runState),regionRecovery=commonRecovery.recovered?{recovered:false}:recoverRegionTerminalTransition(runState,{runtimeRoot}),result=original.apply(this,arguments);decorateMap(runtimeRoot);if(commonRecovery.recovered)showRegionChoice(runtimeRoot);else if(regionRecovery.recovered){if(regionRecovery.next==='region_choice')showRegionChoice(runtimeRoot);else if(regionRecovery.next==='gateway')showGatewayTransition(runtimeRoot)}return result;
    }
    wrapped.__runFlowV3=true;wrapped.__runFlowV2=true;wrapped.__original=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function installBrowser(runtimeRoot=root){if(installed)return true;if(!runtimeRoot?.RunStartV2||!runtimeRoot?.RunStructure||!runtimeRoot?.RunPaths||!runtimeRoot?.RunMapGeneration)return false;if(typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.enterNode!=='function'||typeof runtimeRoot.completeNode!=='function'||typeof runtimeRoot.renderMap!=='function')return false;const errors=validateRegionProfiles(runtimeRoot);if(errors.length){console.error('[run-flow-v3] 지역 정의 오류',errors);return false}wrapBeginRun(runtimeRoot);wrapEnterNode(runtimeRoot);wrapCompleteNode(runtimeRoot);wrapRenderMap(runtimeRoot);installed=true;return true}
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25);else console.warn('[run-flow-v3] 최신 런 흐름을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function forceStage(runState,stage,{runtimeRoot=root}={}){const value=setRunStage(runState,stage,{reason:'dev_force'});emitRunHook(runState,'on_stage_enter',{stage:value,dev:true},runtimeRoot);return value}
  function forceRegionBranch(runState,regionId,branchId,{runtimeRoot=root}={}){const branch=regionBranches(regionId,runtimeRoot).find(item=>item.id===branchId);if(!branch)return{ok:false,reason:'unknown_branch'};const flow=ensureFlowState(runState);if(!flow.visitedRegionIds.includes(regionId))flow.visitedRegionIds.push(regionId);flow.currentRegionId=regionId;return recordBranchSelection(runState,{branchId,branchLabel:branch.label,branchTags:branch.tags,branchEntry:true},{runtimeRoot})}
  function resetForTests(){installed=false}

  return{STAGE,COMMON_ACT_ID,GATEWAY_ACT_ID,FINAL_ACT_ID,REGION_VISIT_TARGET,MAX_RUN_STAGE,REGION_PROFILES,runStructure,runPaths,runMapGeneration,runEvents,activeRun,escapeHtml,toSet,weightTotal,weightedPick,hash32,deterministicRng,regionProfile,regionIds,regionBranches,validateRegionProfiles,createFlowState,inferRunStage,setRunStage,ensureFlowState,clearLegacyRunMapState,actDisplayIndex,annotateRegionMap,annotateGatewayMap,emitRunHook,applyFlowAct,initializeRunFlow,availableRegionIds,beginRegionChoice,regionChoiceModel,chooseRegion,branchRecord,recordBranchSelection,transitionAfterRegionBoss,completeRegionBoss,completeGateway,nodePlan,gatewayPlan,runFlowSummary,regionOptionHtml,showRegionChoice,showGatewayTransition,showFinalTransition,chooseRegionFromUi,commonTerminal,gatewayTerminal,terminalRewardClaimed,recoverTerminalNodeState,recoverCommonTerminalChoice,recoverRegionTerminalTransition,ensureStageBadge,decorateMap,wrapBeginRun,wrapEnterNode,wrapCompleteNode,wrapRenderMap,installBrowser,installWhenReady,forceStage,forceRegionBranch,resetForTests};
});
