(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunEvents=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='RUN-V3';
  const EVENT_TYPES=Object.freeze(['choice','minigame','special']);
  const GENERAL_REGION='general';
  const EVENT_DAMAGE_MIN_HP=1;
  let installed=false;

  function flowApi(runtimeRoot=root){return runtimeRoot?.RunFlowV2||(typeof require==='function'?require('./run-flow-v2.js'):null)}
  function minigameApi(runtimeRoot=root){return runtimeRoot?.RunMinigames||(typeof require==='function'?require('./run-minigames.js'):null)}
  function economyApi(runtimeRoot=root){return runtimeRoot?.RunEconomyV2||(typeof require==='function'?require('./run-economy-v2.js'):null)}
  function relicApi(runtimeRoot=root){return runtimeRoot?.RelicSystem||(typeof require==='function'?require('./relics.js'):null)}
  function activeRun(runtimeRoot=root){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function array(value){return Array.isArray(value)?value:[]}
  function cardName(card){
    const rank=Number(card?.rank)===14?'A':Number(card?.rank)===13?'K':Number(card?.rank)===12?'Q':Number(card?.rank)===11?'J':String(card?.rank??'?');
    const suit=card?.suit==='S'?'♠':card?.suit==='H'?'♥':card?.suit==='D'?'♦':card?.suit==='C'?'♣':String(card?.suit||'?');
    return `${card?.definition?.name||card?.named?.name||card?.name||''}${card?.definition||card?.named||card?.name?' · ':''}${suit}${rank}`;
  }
  function always(){return true}
  function hasDeck(runState){return Array.isArray(runState?.deck)&&runState.deck.length>1}
  function hasMap(runState){return Array.isArray(runState?.map)&&runState.map.length>0}
  function regionVisitTarget(runState){return Math.max(0,Math.trunc(finite(runState?.runFlow?.regionVisitTarget,2)))}
  function remainingRegionVisits(runState){return Math.max(0,regionVisitTarget(runState)-array(runState?.runFlow?.visitedRegionIds).length)}
  function canUseLostAndFound(runState){return hasDeck(runState)&&remainingRegionVisits(runState)>0}

  const EVENT_DEFINITIONS=Object.freeze({
    lost_and_found:Object.freeze({id:'lost_and_found',name:'분실물 보관소',description:'카드 한 장을 맡긴다. 다음 일반 지역에 들어갈 때 강화되어 돌아온다.',tags:Object.freeze(['general','deck']),regionTags:Object.freeze([]),weight:1.0,eligibility:canUseLostAndFound,type:'special',oneShot:true}),
    old_map:Object.freeze({id:'old_map',name:'낡은 지도',description:'앞쪽 경로의 정보를 하나 골라 미리 확인한다.',tags:Object.freeze(['general','information']),regionTags:Object.freeze([]),weight:1.0,eligibility:hasMap,type:'choice',oneShot:false,choices:Object.freeze([
      Object.freeze({id:'next_node',label:'다음 노드 종류 확인'}),Object.freeze({id:'next_event',label:'다음 이벤트 성향 확인'})
    ])}),
    river_table:Object.freeze({id:'river_table',name:'리버 테이블',description:'임시 4장에 붙일 5번째 후보를 골라 포커 족보를 완성한다.',tags:Object.freeze(['general','river','showdown']),regionTags:Object.freeze([]),weight:1.0,eligibility:always,type:'minigame',minigameId:'river_table',oneShot:false}),
    broken_observatory:Object.freeze({id:'broken_observatory',name:'끊어진 관측소',description:'기존 이벤트를 데이터 레지스트리로 옮긴 공용 선택 이벤트.',tags:Object.freeze(['general']),regionTags:Object.freeze([]),weight:.45,eligibility:always,type:'choice',oneShot:false,choices:Object.freeze([
      Object.freeze({id:'gold',label:'흩어진 칩을 챙긴다',actions:Object.freeze([Object.freeze({type:'gain_gold',amount:30})])}),
      Object.freeze({id:'card',label:'남은 카드를 가져간다',actions:Object.freeze([Object.freeze({type:'add_card',mode:'generated'})])}),
      Object.freeze({id:'heal',label:'잠시 정비한다',actions:Object.freeze([Object.freeze({type:'heal',amount:10})])})
    ])}),
    stage_layout:Object.freeze({id:'stage_layout',name:'무대 배치',description:'카드 다섯 장을 슬롯에 배치해 공연 조건을 맞춘다.',tags:Object.freeze(['performance','field','slot']),regionTags:Object.freeze(['region_theater']),weight:1.3,eligibility:always,type:'minigame',minigameId:'stage_layout',oneShot:false}),
    magic_box:Object.freeze({id:'magic_box',name:'마술 상자',description:'공개된 카드 힌트를 읽고 안전·숫자·무늬 상자 중 하나를 고른다.',tags:Object.freeze(['performance','risk']),regionTags:Object.freeze(['region_theater']),weight:1.1,eligibility:always,type:'special',oneShot:false}),
    observation_exam:Object.freeze({id:'observation_exam',name:'관측 시험',description:'세 카드의 숫자를 비교해 가장 높은 카드를 찾는다.',tags:Object.freeze(['information']),regionTags:Object.freeze(['region_observatory']),weight:1.3,eligibility:always,type:'minigame',minigameId:'observation_test',oneShot:false}),
    signal_scan:Object.freeze({id:'signal_scan',name:'전파 탐색',description:'안전·위험·미확인 신호의 부분 정보를 보고 하나를 선택한다.',tags:Object.freeze(['information','risk']),regionTags:Object.freeze(['region_observatory']),weight:1.1,eligibility:always,type:'special',oneShot:false}),
    supply_heist:Object.freeze({id:'supply_heist',name:'보급품 탈취',description:'보상을 누적하며 계속할지 철수할지 판단한다.',tags:Object.freeze(['supply','risk']),regionTags:Object.freeze(['region_frontier']),weight:1.3,eligibility:always,type:'minigame',minigameId:'supply_heist',oneShot:false}),
    shooting_range:Object.freeze({id:'shooting_range',name:'사격장',description:'표적 이상이면서 가장 작은 숫자의 카드를 고른다.',tags:Object.freeze(['risk','supply','number']),regionTags:Object.freeze(['region_frontier']),weight:1.1,eligibility:always,type:'minigame',minigameId:'shooting_range',oneShot:false})
  });

  function validateEventDefinition(definition,id=definition?.id){
    const errors=[];if(!definition||typeof definition!=='object')return['definition must be an object'];
    if(!definition.id)errors.push('missing id');if(id&&definition.id!==id)errors.push('id mismatch');if(!definition.name)errors.push('missing name');if(!definition.description)errors.push('missing description');
    if(!EVENT_TYPES.includes(definition.type))errors.push(`unknown type ${definition.type}`);if(!Array.isArray(definition.tags))errors.push('tags must be an array');if(!Array.isArray(definition.regionTags))errors.push('regionTags must be an array');if(!(Number(definition.weight)>0))errors.push('weight must be positive');
    if(typeof definition.eligibility!=='function')errors.push('eligibility must be a function');if(definition.type==='minigame'&&!definition.minigameId)errors.push('minigameId is required');
    if(definition.type==='choice'&&!Array.isArray(definition.choices))errors.push('choices are required');return errors;
  }
  function validateEventRegistry(registry=EVENT_DEFINITIONS){return Object.entries(registry).flatMap(([id,definition])=>validateEventDefinition(definition,id).map(error=>`${id}: ${error}`))}
  function eventDefinition(id){return EVENT_DEFINITIONS[id]||null}
  function ensureEventState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');const current=runState.eventState&&typeof runState.eventState==='object'?runState.eventState:{};
    runState.eventState=Object.assign(current,{...current,version:STAGE,history:array(current.history),oneShotSeen:[...new Set(array(current.oneShotSeen))],storedCards:array(current.storedCards),routeReveals:array(current.routeReveals),pendingEffects:array(current.pendingEffects),activeEvent:current.activeEvent&&typeof current.activeEvent==='object'?current.activeEvent:null});
    return runState.eventState;
  }
  function contextRegionIds(runState,node){
    const flow=runState?.runFlow||{},plan=node?.regionPlan||{};const ids=[];
    for(const id of [plan.regionId,flow.currentRegionId,...array(plan.regionIds),...array(plan.sourceRegionIds),...array(flow.visitedRegionIds)])if(id&&id!=='final_gateway'&&!ids.includes(id))ids.push(id);
    if(plan.regionId&&plan.regionId!=='final_gateway')return[plan.regionId];
    if(array(plan.sourceRegionIds).length)return array(plan.sourceRegionIds);
    if(flow.currentRegionId)return[flow.currentRegionId];return ids.slice(-2);
  }
  function currentEventTags(runState,node){const plan=node?.regionPlan||{};return[plan.eventTag,...array(plan.eventTags)].filter(Boolean)}
  function eventEligible(definition,runState,node,{ignoreOneShot=false}={}){
    const state=ensureEventState(runState);if(!ignoreOneShot&&definition.oneShot&&state.oneShotSeen.includes(definition.id))return false;
    try{return definition.eligibility(runState,node)!==false}catch(_error){return false}
  }
  function eventWeight(definition,runState,node){
    const regionIds=contextRegionIds(runState,node),eventTags=currentEventTags(runState,node),regions=array(definition.regionTags),isGeneral=!regions.length;
    if(!isGeneral&&!regions.some(id=>regionIds.includes(id)))return 0;
    let weight=finite(definition.weight,1);if(isGeneral)weight*=1;
    if(eventTags.some(tag=>array(definition.tags).includes(tag)))weight*=3;
    if(!isGeneral&&regions.some(id=>regionIds.includes(id)))weight*=1.5;
    return weight;
  }
  function eventCandidates(runState,node,options={}){
    return Object.values(EVENT_DEFINITIONS).filter(definition=>eventEligible(definition,runState,node,options)).map(definition=>({definition,weight:eventWeight(definition,runState,node)})).filter(candidate=>candidate.weight>0);
  }
  function deterministicRng(runState,salt,runtimeRoot=root){
    const flow=flowApi(runtimeRoot);if(typeof flow?.deterministicRng==='function')return flow.deterministicRng(runState,salt);
    let state=2166136261;for(const ch of `${finite(runState?.runSeed)}:${salt}`){state^=ch.charCodeAt(0);state=Math.imul(state,16777619)}state>>>=0;if(!state)state=1;
    return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000};
  }
  function weightedEventPick(candidates,rng){
    const total=candidates.reduce((sum,item)=>sum+item.weight,0);if(!(total>0))return null;let cursor=Math.max(0,Math.min(.999999999,Number(rng())||0))*total;
    for(const candidate of candidates){cursor-=candidate.weight;if(cursor<0)return candidate.definition}return candidates.at(-1)?.definition||null;
  }
  function eventSalt(runState,node){const state=ensureEventState(runState),flow=runState?.runFlow||{};return`run-v3:event:${runState.runStage||1}:${runState.actId||'act'}:${node?.id||'event'}:${flow.choiceRound||0}:${state.history.length}`}
  function selectEvent(runState,node,{runtimeRoot=root,eventId=null}={}){
    if(eventId){const forced=eventDefinition(eventId);if(!forced)return null;return eventEligible(forced,runState,node,{ignoreOneShot:true})?forced:null}
    return weightedEventPick(eventCandidates(runState,node),deterministicRng(runState,eventSalt(runState,node),runtimeRoot));
  }
  function record(runState,entry){const state=ensureEventState(runState),item={step:state.history.length+1,...entry};state.history.push(item);return item}
  function generatedCard(runState,salt,runtimeRoot=root){
    const rng=deterministicRng(runState,`card:${salt}`,runtimeRoot),suits=['S','H','D','C'],suit=suits[Math.floor(rng()*suits.length)],rank=2+Math.floor(rng()*13);
    if(typeof runtimeRoot?.makeCard==='function')return runtimeRoot.makeCard(suit,rank,`${suit}${rank}`);
    return{suit,rank,printedSuit:suit,printedRank:rank,uid:`event-${runState.runSeed||0}-${salt}-${suit}${rank}`};
  }
  function addGeneratedCard(runState,action,{runtimeRoot=root,salt='event'}={}){
    if(!Array.isArray(runState.deck))runState.deck=[];
    if(action.card&&typeof action.card==='object'){const card=clone(action.card);runState.deck.push(card);return card}
    const card=generatedCard(runState,salt,runtimeRoot);runState.deck.push(card);return card;
  }
  function upgradeCard(card,runtimeRoot=root){
    const economy=economyApi(runtimeRoot);if(typeof economy?.upgradeCard==='function'){const result=economy.upgradeCard(card);if(result?.ok)return result.card}
    card.upgradeLevel=Math.max(1,finite(card.upgradeLevel)+1);card.effectiveRankBonus=finite(card.effectiveRankBonus)+1;card.trickRankModifier=finite(card.trickRankModifier)+1;card.upgrade={stage:STAGE,level:card.upgradeLevel,trickBonus:1};return card;
  }
  function acquireRelic(runState,action,{runtimeRoot=root,salt='event'}={}){
    const relics=relicApi(runtimeRoot);if(!relics)return null;let id=action.relicId||null;
    if(!id&&typeof relics.rewardPool==='function'){const pool=relics.rewardPool(runState);if(pool.length){const rng=deterministicRng(runState,`relic:${salt}`,runtimeRoot);id=pool[Math.floor(rng()*pool.length)]}}
    if(!id)return null;if(typeof relics.acquireRelic==='function')return relics.acquireRelic(runState,id,{source:`event:${salt}`});return null;
  }
  function applyAction(runState,action,{runtimeRoot=root,node=null,salt='event'}={}){
    if(!action||typeof action!=='object')return{ok:false,reason:'invalid_action'};const type=action.type;
    if(type==='gain_gold'){const before=finite(runState.gold);runState.gold=Math.max(0,before+finite(action.amount));return{ok:true,type,before,after:runState.gold}}
    if(type==='heal'){const before=finite(runState.hp),maxHp=Math.max(before,finite(runState.maxHp,before));runState.hp=Math.min(maxHp,before+Math.max(0,finite(action.amount)));return{ok:true,type,before,after:runState.hp}}
    if(type==='damage_player'){const before=finite(runState.hp);runState.hp=Math.max(EVENT_DAMAGE_MIN_HP,before-Math.max(0,finite(action.amount)));return{ok:true,type,before,after:runState.hp,nonLethal:true,minHp:EVENT_DAMAGE_MIN_HP}}
    if(type==='add_card'){const card=addGeneratedCard(runState,action,{runtimeRoot,salt});return{ok:true,type,card}}
    if(type==='remove_card'){const deck=array(runState.deck),index=Number.isInteger(action.index)?action.index:deck.findIndex(card=>card?.uid===action.uid||card?.cardId===action.cardId);if(index<0||index>=deck.length)return{ok:false,reason:'card_not_found'};return{ok:true,type,card:deck.splice(index,1)[0]}}
    if(type==='upgrade_card'){const deck=array(runState.deck),card=action.card||deck[Number(action.index)];if(!card)return{ok:false,reason:'card_not_found'};return{ok:true,type,card:upgradeCard(card,runtimeRoot)}}
    if(type==='gain_relic'){const result=acquireRelic(runState,action,{runtimeRoot,salt});return{ok:!!result,type,result}}
    if(type==='reveal_route'){const state=ensureEventState(runState),reveal={nodeId:node?.id||null,kind:action.kind||'next_node',data:clone(action.data),stage:runState.runStage||1};state.routeReveals.push(reveal);return{ok:true,type,reveal}}
    if(type==='modify_next_battle'){const state=ensureEventState(runState),effect={hook:'on_battle_enter',...clone(action.effect||{}),source:action.source||'event'};state.pendingEffects.push(effect);return{ok:true,type,effect}}
    return{ok:false,reason:'unknown_action',type};
  }
  function applyActions(runState,actions,options={}){return array(actions).map((action,index)=>applyAction(runState,action,{...options,salt:`${options.salt||'event'}:${index}`}))}
  function storeCard(runState,index,{sourceEventId='lost_and_found'}={}){
    if(!canUseLostAndFound(runState))return{ok:false,reason:'no_future_region'};
    const state=ensureEventState(runState),deck=array(runState.deck),safeIndex=Number(index);if(!Number.isInteger(safeIndex)||safeIndex<0||safeIndex>=deck.length)return{ok:false,reason:'card_not_found'};
    const card=deck.splice(safeIndex,1)[0],visitCount=array(runState.runFlow?.visitedRegionIds).length,entry={id:`stored:${state.storedCards.length+1}`,sourceEventId,card,returnAtVisitCount:visitCount+1,storedAtStage:runState.runStage||1};state.storedCards.push(entry);return{ok:true,entry};
  }
  function returnStoredCards(runState,{runtimeRoot=root,recoverOrphaned=false}={}){
    const state=ensureEventState(runState),visitCount=array(runState.runFlow?.visitedRegionIds).length,remaining=[],results=[];
    for(const entry of state.storedCards){
      const due=visitCount>=finite(entry.returnAtVisitCount,Infinity)||recoverOrphaned;
      if(due){const card=upgradeCard(entry.card,runtimeRoot);if(!Array.isArray(runState.deck))runState.deck=[];runState.deck.push(card);results.push({type:'stored_card_returned',id:entry.id,card,recovered:recoverOrphaned&&visitCount<finite(entry.returnAtVisitCount,Infinity)})}
      else remaining.push(entry);
    }
    state.storedCards=remaining;return results;
  }
  function handleRunHook(runState,hook,context={},runtimeRoot=root){
    const state=ensureEventState(runState),results=[];record(runState,{type:'hook',hook,context:clone(context)});
    if(hook==='on_region_enter')results.push(...returnStoredCards(runState,{runtimeRoot}));
    else if(hook==='on_stage_enter'&&remainingRegionVisits(runState)===0&&finite(runState.runStage)>=7)results.push(...returnStoredCards(runState,{runtimeRoot,recoverOrphaned:true}));
    return results;
  }
  function eventContext(runState,node,runtimeRoot=root){return{runState,node,regionIds:contextRegionIds(runState,node),eventTags:currentEventTags(runState,node),random:deterministicRng(runState,`minigame:${eventSalt(runState,node)}`,runtimeRoot)}}
  function startEvent(runState,node,{runtimeRoot=root,eventId=null,minigameId=null}={}){
    const state=ensureEventState(runState);if(state.activeEvent)return state.activeEvent;let definition=selectEvent(runState,node,{runtimeRoot,eventId});
    if(minigameId){definition=Object.values(EVENT_DEFINITIONS).find(item=>item.minigameId===minigameId)||definition}
    if(!definition)return null;
    const active={eventId:definition.id,nodeId:node?.id||null,type:definition.type,startedAtStage:runState.runStage||1,minigameState:null,context:{regionIds:contextRegionIds(runState,node),eventTags:currentEventTags(runState,node)}};
    if(definition.type==='minigame')active.minigameState=minigameApi(runtimeRoot)?.createState?.(definition.minigameId,eventContext(runState,node,runtimeRoot))||null;
    if(definition.id==='magic_box')active.dynamic=magicBoxModel(runState,runtimeRoot);
    if(definition.id==='signal_scan')active.dynamic=signalScanModel(runState,runtimeRoot);
    state.activeEvent=active;record(runState,{type:'event_started',eventId:definition.id,nodeId:active.nodeId,stage:active.startedAtStage});return active;
  }
  function revealRoute(runState,node,kind){
    const map=array(runState.map),index=map.findIndex(item=>item.id===node?.id),future=map.filter((item,i)=>i>index&&!runState.completed?.has?.(item.id));let data=null;
    if(kind==='next_node'){const nextIds=array(node?.next),targets=nextIds.map(id=>map.find(item=>item.id===id)).filter(Boolean);data=targets.map(item=>({id:item.id,type:item.type,branchLabel:item.branchLabel||null}))}
    else{const nextEvent=future.find(item=>item.type==='event');data=nextEvent?{id:nextEvent.id,eventTag:nextEvent.regionPlan?.eventTag||null,branchLabel:nextEvent.branchLabel||null}:null}
    return applyAction(runState,{type:'reveal_route',kind,data},{node,salt:`route:${kind}`});
  }
  function magicBoxModel(runState,runtimeRoot=root){
    const deck=array(runState.deck),state=ensureEventState(runState),rng=deterministicRng(runState,`magic-hint:${runState.runStage||1}:${runState.actId||'act'}:${state.history.length}`,runtimeRoot),card=deck.length?deck[Math.floor(rng()*deck.length)]:generatedCard(runState,'magic-hint',runtimeRoot),rank=finite(card.rank),red=card.suit==='H'||card.suit==='D';
    return{hintCard:clone(card),rank,red};
  }
  function signalScanModel(runState){const intel=finite(runState.enemyForecast||runState.enemyInformation?.forecastLevel||0);return{intel,extraHint:intel>0}}
  function specialChoice(runState,node,definition,choiceId,{runtimeRoot=root}={}){
    if(definition.id==='lost_and_found'){
      if(!canUseLostAndFound(runState))return{ok:true,actions:[],skipped:true,message:'앞으로 방문할 일반 지역이 없어 카드를 맡기지 않았다.'};
      const result=storeCard(runState,Number(choiceId),{sourceEventId:definition.id});return result.ok?{ok:true,actions:[],message:`${cardName(result.entry.card)} 보관 완료`}:result;
    }
    if(definition.id==='magic_box'){
      const model=ensureEventState(runState).activeEvent?.dynamic||magicBoxModel(runState,runtimeRoot);let actions,message;
      if(choiceId==='safe'){actions=[{type:'gain_gold',amount:12}];message='안전 상자'}
      else if(choiceId==='number'){actions=model.rank>=9?[{type:'gain_gold',amount:35}]:[{type:'gain_gold',amount:10}];message=model.rank>=9?'숫자 조건 적중':'숫자 조건 빗나감'}
      else if(choiceId==='suit'){actions=model.red?[{type:'gain_gold',amount:15},{type:'add_card',mode:'generated'}]:[{type:'gain_gold',amount:8}];message=model.red?'붉은 무늬 적중':'검은 무늬'}
      else return{ok:false,reason:'invalid_choice'};return{ok:true,actions,message,results:applyActions(runState,actions,{runtimeRoot,node,salt:`magic:${choiceId}`})};
    }
    if(definition.id==='signal_scan'){
      let actions,message;if(choiceId==='safe'){actions=[{type:'gain_gold',amount:12}];message='안전 신호 확보'}
      else if(choiceId==='risk'){actions=[{type:'gain_gold',amount:28},{type:'damage_player',amount:2}];message='위험 신호 돌파'}
      else if(choiceId==='unknown'){const model=ensureEventState(runState).activeEvent?.dynamic||signalScanModel(runState);actions=model.extraHint?[{type:'gain_gold',amount:24},{type:'add_card',mode:'generated'}]:[{type:'gain_gold',amount:18}];message=model.extraHint?'정찰 정보로 미확인 신호 해독':'미확인 신호 회수'}
      else return{ok:false,reason:'invalid_choice'};return{ok:true,actions,message,results:applyActions(runState,actions,{runtimeRoot,node,salt:`signal:${choiceId}`})};
    }
    return{ok:false,reason:'unsupported_special'};
  }
  function finishEvent(runState,node,definition,{runtimeRoot=root,result=null}={}){
    const state=ensureEventState(runState);if(definition.oneShot&&!state.oneShotSeen.includes(definition.id))state.oneShotSeen.push(definition.id);
    record(runState,{type:'event_completed',eventId:definition.id,nodeId:node?.id||state.activeEvent?.nodeId||null,result:clone(result)});state.activeEvent=null;
    if(node&&typeof runtimeRoot?.completeNode==='function')runtimeRoot.completeNode(node);return{ok:true,eventId:definition.id,result};
  }
  function chooseEvent(runState,node,choiceId,{runtimeRoot=root}={}){
    const state=ensureEventState(runState),active=state.activeEvent||startEvent(runState,node,{runtimeRoot});if(!active)return{ok:false,reason:'no_event'};const definition=eventDefinition(active.eventId);if(!definition)return{ok:false,reason:'unknown_event'};
    let result;
    if(definition.type==='choice'){
      const choice=array(definition.choices).find(item=>item.id===choiceId);if(!choice)return{ok:false,reason:'invalid_choice'};
      if(definition.id==='old_map'){const reveal=revealRoute(runState,node,choiceId);result={ok:true,reveal,message:choiceId==='next_node'?'다음 노드 정보를 확인했다.':'다음 이벤트 성향을 확인했다.'}}
      else{const results=applyActions(runState,choice.actions,{runtimeRoot,node,salt:`${definition.id}:${choiceId}`});result={ok:true,results,message:choice.label}}
    }else if(definition.type==='special')result=specialChoice(runState,node,definition,choiceId,{runtimeRoot});else return{ok:false,reason:'not_choice_event'};
    if(result?.ok)finishEvent(runState,node,definition,{runtimeRoot,result});return result;
  }
  function chooseMinigame(runState,node,choice,{runtimeRoot=root}={}){
    const state=ensureEventState(runState),active=state.activeEvent||startEvent(runState,node,{runtimeRoot});if(!active?.minigameState)return{ok:false,reason:'no_minigame'};
    const result=minigameApi(runtimeRoot)?.choose?.(active.minigameState,choice);if(!result?.ok)return result;
    const rewardActions=result.reward?.actions||active.minigameState.result?.reward?.actions||[];
    if(active.minigameState.phase==='resolved'){
      const applied=applyActions(runState,rewardActions,{runtimeRoot,node,salt:`minigame:${active.eventId}`});const finalResult={...result,applied};finishEvent(runState,node,eventDefinition(active.eventId),{runtimeRoot,result:finalResult});return finalResult;
    }
    return result;
  }

  function choiceHtml(definition,runState,node){
    if(definition.id==='lost_and_found')return array(runState.deck).map((card,index)=>`<button class="choice" data-event-choice="${index}"><b>${escapeHtml(cardName(card))}</b><span>다음 일반 지역 진입 시 +1 강화되어 돌아온다.</span></button>`).join('');
    if(definition.id==='magic_box'){
      const model=ensureEventState(runState).activeEvent?.dynamic;return`<div class="choice"><b>힌트 카드 · ${escapeHtml(cardName(model?.hintCard))}</b><span>숫자 상자는 9 이상, 무늬 상자는 ♥/♦일 때 보상이 커진다.</span></div><button class="choice" data-event-choice="safe"><b>안전 상자</b><span>확정 소량 보상</span></button><button class="choice" data-event-choice="number"><b>숫자 상자</b><span>힌트 숫자가 9 이상이면 대박</span></button><button class="choice" data-event-choice="suit"><b>무늬 상자</b><span>힌트가 붉은 무늬면 카드까지 획득</span></button>`;
    }
    if(definition.id==='signal_scan'){
      const extra=ensureEventState(runState).activeEvent?.dynamic?.extraHint;return`${extra?'<div class="choice"><b>정찰 보정 활성</b><span>미확인 신호의 보상이 더 선명하게 보인다.</span></div>':''}<button class="choice" data-event-choice="safe"><b>안전 신호</b><span>확정 소량 보상</span></button><button class="choice" data-event-choice="risk"><b>위험 신호</b><span>큰 보상 · 체력 2 소모 (비치명 · 최소 HP ${EVENT_DAMAGE_MIN_HP})</span></button><button class="choice" data-event-choice="unknown"><b>미확인 신호</b><span>${extra?'정찰 정보로 추가 카드까지 기대 가능':'중간 보상'}</span></button>`;
    }
    return array(definition.choices).map(choice=>`<button class="choice" data-event-choice="${escapeHtml(choice.id)}"><b>${escapeHtml(choice.label)}</b></button>`).join('');
  }
  function cardButtons(cards,attribute){return array(cards).map((card,index)=>`<button class="choice" ${attribute}="${index}"><b>${escapeHtml(cardName(card))}</b></button>`).join('')}
  function minigameHtml(active,runtimeRoot=root){
    const state=active.minigameState,def=minigameApi(runtimeRoot)?.definition?.(state?.id);if(!state||!def)return'<p>미니게임 상태를 불러오지 못했다.</p>';
    if(state.id==='river_table')return`<p>현재 4장 · ${state.baseCards.map(cardName).map(escapeHtml).join(' · ')}</p><p>5번째 카드를 고른다.</p>${cardButtons(state.candidateCards,'data-minigame-index')}`;
    if(state.id==='shooting_range')return`<p>표적 숫자 <b>${state.target}</b> 이상이면서 가장 작은 숫자를 고른다.</p>${cardButtons(state.cards,'data-minigame-index')}`;
    if(state.id==='observation_test')return`<p>${escapeHtml(state.question)}</p>${cardButtons(state.cards,'data-minigame-index')}`;
    if(state.id==='supply_heist')return`<p>현재 ${state.step} / ${state.maxStep}단계 · 다음 단계로 갈수록 위험 증가</p><button class="choice" data-minigame-action="continue"><b>계속</b><span>보상을 늘리고 위험을 감수한다.</span></button><button class="choice" data-minigame-action="withdraw"><b>철수</b><span>현재 확보분을 가지고 끝낸다.</span></button>`;
    if(state.id==='stage_layout'){
      const slots=state.slots.map((cardIndex,index)=>`<button class="choice" data-stage-slot="${index}"><b>${index+1}번 슬롯</b><span>${cardIndex==null?'비어 있음':escapeHtml(cardName(state.cards[cardIndex]))}</span></button>`).join('');
      const cards=state.cards.map((card,index)=>`<button class="choice" data-stage-card="${index}"><b>${escapeHtml(cardName(card))}</b><span>${state.slots.includes(index)?'배치됨':'카드 선택'}</span></button>`).join('');return`<p>조건: 가장 높은 숫자를 3번 슬롯 · 같은 무늬 인접 조건</p><div class="choiceList">${cards}</div><hr><div class="choiceList">${slots}</div>`;
    }
    return`<p>${escapeHtml(def.instructions)}</p>`;
  }
  function showModal(runtimeRoot,html){if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}const doc=runtimeRoot?.document,modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true}
  function renderActiveEvent(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const state=ensureEventState(runState),active=state.activeEvent;if(!active)return false;const definition=eventDefinition(active.eventId),node=array(runState.map).find(item=>item.id===active.nodeId)||null;if(!definition)return false;
    const body=definition.type==='minigame'?minigameHtml(active,runtimeRoot):choiceHtml(definition,runState,node),html=`<h2>이벤트 · ${escapeHtml(definition.name)}</h2><p>${escapeHtml(definition.description)}</p><div class="choiceList" data-run-event="${escapeHtml(definition.id)}">${body}</div>`;
    if(!showModal(runtimeRoot,html))return false;bindEventUi(runtimeRoot,node);return true;
  }
  function bindEventUi(runtimeRoot=root,node=null){
    const doc=runtimeRoot?.document;if(!doc)return false;let selectedStageCard=null;
    doc.querySelectorAll?.('[data-event-choice]')?.forEach(button=>button.onclick=()=>{const runState=activeRun(runtimeRoot);chooseEvent(runState,node,button.dataset.eventChoice,{runtimeRoot})});
    doc.querySelectorAll?.('[data-minigame-index]')?.forEach(button=>button.onclick=()=>{const runState=activeRun(runtimeRoot),result=chooseMinigame(runState,node,{index:Number(button.dataset.minigameIndex)},{runtimeRoot});if(result?.ok&&ensureEventState(runState).activeEvent)renderActiveEvent(runtimeRoot)});
    doc.querySelectorAll?.('[data-minigame-action]')?.forEach(button=>button.onclick=()=>{const runState=activeRun(runtimeRoot),result=chooseMinigame(runState,node,button.dataset.minigameAction,{runtimeRoot});if(result?.ok&&ensureEventState(runState).activeEvent)renderActiveEvent(runtimeRoot)});
    doc.querySelectorAll?.('[data-stage-card]')?.forEach(button=>button.onclick=()=>{selectedStageCard=Number(button.dataset.stageCard);doc.querySelectorAll?.('[data-stage-card]')?.forEach(item=>item.style.outline='');button.style.outline='2px solid currentColor'});
    doc.querySelectorAll?.('[data-stage-slot]')?.forEach(button=>button.onclick=()=>{if(selectedStageCard==null)return;const runState=activeRun(runtimeRoot),result=chooseMinigame(runState,node,{cardIndex:selectedStageCard,slotIndex:Number(button.dataset.stageSlot)},{runtimeRoot});if(result?.ok&&ensureEventState(runState).activeEvent)renderActiveEvent(runtimeRoot)});return true;
  }
  function showEventNode(node,runtimeRoot=root){const runState=activeRun(runtimeRoot);if(!runState)return false;ensureEventState(runState);if(!runState.eventState.activeEvent)startEvent(runState,node,{runtimeRoot});return renderActiveEvent(runtimeRoot)}
  function forceEvent(runState,eventId,node,{runtimeRoot=root}={}){const state=ensureEventState(runState);state.activeEvent=null;const active=startEvent(runState,node||array(runState.map).find(item=>item.type==='event')||{id:'dev-event',type:'event'},{runtimeRoot,eventId});return active}
  function forceMinigame(runState,minigameId,node,{runtimeRoot=root}={}){const state=ensureEventState(runState);state.activeEvent=null;return startEvent(runState,node||array(runState.map).find(item=>item.type==='event')||{id:'dev-minigame',type:'event'},{runtimeRoot,minigameId})}
  function installBrowser(runtimeRoot=root){
    if(installed)return true;if(!runtimeRoot?.RunMinigames||typeof runtimeRoot?.showEvent!=='function')return false;
    const errors=validateEventRegistry();if(errors.length){console.error('[run-events] 이벤트 정의 오류',errors);return false}
    const legacy=runtimeRoot.showEvent;runtimeRoot.showEvent=function(node){return showEventNode(node,runtimeRoot)};runtimeRoot.showEvent.__runEvents=true;runtimeRoot.showEvent.__legacy=legacy;
    runtimeRoot.eventPick=function(nodeId,choiceId){const runState=activeRun(runtimeRoot),node=array(runState?.map).find(item=>item.id===nodeId);return chooseEvent(runState,node,choiceId,{runtimeRoot})};
    installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<100)setTimeout(attempt,25);else console.warn('[run-events] 이벤트 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function resetForTests(){installed=false}

  return{STAGE,EVENT_TYPES,EVENT_DEFINITIONS,GENERAL_REGION,EVENT_DAMAGE_MIN_HP,flowApi,minigameApi,economyApi,relicApi,activeRun,clone,escapeHtml,finite,array,cardName,regionVisitTarget,remainingRegionVisits,canUseLostAndFound,validateEventDefinition,validateEventRegistry,eventDefinition,ensureEventState,contextRegionIds,currentEventTags,eventEligible,eventWeight,eventCandidates,deterministicRng,weightedEventPick,eventSalt,selectEvent,record,generatedCard,addGeneratedCard,upgradeCard,acquireRelic,applyAction,applyActions,storeCard,returnStoredCards,handleRunHook,eventContext,startEvent,revealRoute,magicBoxModel,signalScanModel,specialChoice,finishEvent,chooseEvent,chooseMinigame,choiceHtml,minigameHtml,showModal,renderActiveEvent,bindEventUi,showEventNode,forceEvent,forceMinigame,installBrowser,installWhenReady,resetForTests};
});