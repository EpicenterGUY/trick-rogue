(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.ContractSystem=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='6-3';
  const SHOWDOWN_RULE_ORDER=Object.freeze(['poker','advantage','showdown_effects','contract_taboo','status_reservations','final_power','damage']);
  const CONTRACT_DEFINITIONS=Object.freeze({
    edge_clause:Object.freeze({
      id:'edge_clause',type:'contract',name:'우세 계약',value:5,condition:'player_advantage_at_least',conditionValue:1,
      description:'쇼다운에서 내 우세 무늬가 1개 이상이면 위력 +5.'
    }),
    three_wins:Object.freeze({
      id:'three_wins',type:'contract',name:'삼승 계약',value:6,condition:'player_wins_at_least',conditionValue:3,
      description:'이번 세트에서 트릭을 3번 이상 이겼다면 쇼다운 위력 +6.'
    }),
    clean_ledger:Object.freeze({
      id:'clean_ledger',type:'contract',name:'무결점 계약',value:4,condition:'no_draws',
      description:'이번 세트에 무승부가 없었다면 쇼다운 위력 +4.'
    })
  });
  const TABOO_DEFINITIONS=Object.freeze({
    enemy_edge:Object.freeze({
      id:'enemy_edge',type:'taboo',name:'열세 금기',value:-3,condition:'enemy_advantage_at_least',conditionValue:1,
      description:'쇼다운에서 적 우세 무늬가 1개 이상이면 위력 -3.'
    }),
    three_losses:Object.freeze({
      id:'three_losses',type:'taboo',name:'연패 금기',value:-4,condition:'player_losses_at_least',conditionValue:3,
      description:'이번 세트에서 트릭을 3번 이상 졌다면 쇼다운 위력 -4.'
    }),
    any_draw:Object.freeze({
      id:'any_draw',type:'taboo',name:'무승부 금기',value:-2,condition:'has_draws',
      description:'이번 세트에 무승부가 한 번이라도 있었다면 쇼다운 위력 -2.'
    })
  });
  const OFFERINGS=Object.freeze({
    sharp_oath:Object.freeze({
      id:'sharp_oath',name:'날 선 서약',contractId:'edge_clause',tabooId:'enemy_edge',
      description:'우세를 만들면 크게 밀어붙이지만, 적 우세도 그대로 대가가 된다.'
    }),
    third_signature:Object.freeze({
      id:'third_signature',name:'세 번째 서명',contractId:'three_wins',tabooId:'three_losses',
      description:'한 세트의 승패를 극단적으로 보상하고 처벌하는 계약이다.'
    }),
    clean_account:Object.freeze({
      id:'clean_account',name:'깨끗한 장부',contractId:'clean_ledger',tabooId:'any_draw',
      description:'무승부가 없는 세트를 보상하지만 한 번의 동점도 금기로 기록한다.'
    })
  });
  let installed=false;

  function contractDefinition(id){return CONTRACT_DEFINITIONS[id]||null}
  function tabooDefinition(id){return TABOO_DEFINITIONS[id]||null}
  function offeringDefinition(id){return OFFERINGS[id]||null}
  function validateRuleDefinition(definition,id=definition?.id,type=definition?.type){
    const errors=[];
    if(!definition||typeof definition!=='object')return['rule definition must be an object'];
    if(!definition.id)errors.push('missing id');
    if(id&&definition.id!==id)errors.push(`id mismatch ${definition.id}`);
    if(!['contract','taboo'].includes(type))errors.push(`unknown type ${String(type)}`);
    if(!definition.name)errors.push('missing name');
    if(!definition.description)errors.push('missing description');
    if(!Number.isFinite(definition.value)||definition.value===0)errors.push('value must be a non-zero number');
    if(type==='contract'&&definition.value<0)errors.push('contract value must be positive');
    if(type==='taboo'&&definition.value>0)errors.push('taboo value must be negative');
    if(!['player_advantage_at_least','enemy_advantage_at_least','player_wins_at_least','player_losses_at_least','no_draws','has_draws'].includes(definition.condition))errors.push(`unknown condition ${definition.condition}`);
    return errors;
  }
  function validateRegistry(){
    const errors=[];
    for(const [id,definition] of Object.entries(CONTRACT_DEFINITIONS))errors.push(...validateRuleDefinition(definition,id,'contract').map(error=>`contract ${id}: ${error}`));
    for(const [id,definition] of Object.entries(TABOO_DEFINITIONS))errors.push(...validateRuleDefinition(definition,id,'taboo').map(error=>`taboo ${id}: ${error}`));
    for(const [id,offering] of Object.entries(OFFERINGS)){
      if(!offering?.name)errors.push(`offering ${id}: missing name`);
      if(!contractDefinition(offering?.contractId))errors.push(`offering ${id}: unknown contract ${offering?.contractId}`);
      if(!tabooDefinition(offering?.tabooId))errors.push(`offering ${id}: unknown taboo ${offering?.tabooId}`);
    }
    return errors;
  }
  function normalizeIds(values,registry){
    const seen=new Set(),result=[];
    for(const raw of Array.isArray(values)?values:[]){const id=typeof raw==='string'?raw:raw?.id;if(!registry[id]||seen.has(id))continue;seen.add(id);result.push(id)}
    return result;
  }
  function ensureClauseState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('contract/taboo state requires a run');
    runState.contracts=normalizeIds(runState.contracts,CONTRACT_DEFINITIONS);
    runState.taboos=normalizeIds(runState.taboos,TABOO_DEFINITIONS);
    const current=runState.clauseState&&typeof runState.clauseState==='object'?runState.clauseState:{};
    const acquiredOfferings=[...new Set(Array.isArray(current.acquiredOfferings)?current.acquiredOfferings.filter(id=>OFFERINGS[id]):[])];
    runState.clauseState={...current,version:STAGE,history:Array.isArray(current.history)?current.history:[],acquiredOfferings};
    return runState.clauseState;
  }
  function ownedContractIds(runState){ensureClauseState(runState);return[...runState.contracts]}
  function ownedTabooIds(runState){ensureClauseState(runState);return[...runState.taboos]}
  function availableOfferingIds(runState){
    const state=ensureClauseState(runState),owned=new Set(state.acquiredOfferings);
    return Object.keys(OFFERINGS).filter(id=>!owned.has(id));
  }
  function acquireOffering(runState,id,{source='unknown'}={}){
    const offering=offeringDefinition(id);if(!offering)throw new TypeError(`Unknown offering: ${String(id)}`);
    const state=ensureClauseState(runState);
    if(state.acquiredOfferings.includes(id))return{added:false,alreadyOwned:true,offering};
    if(!runState.contracts.includes(offering.contractId))runState.contracts.push(offering.contractId);
    if(!runState.taboos.includes(offering.tabooId))runState.taboos.push(offering.tabooId);
    state.acquiredOfferings.push(id);
    const history={step:state.history.length+1,action:'acquire_offering',source,id,contractId:offering.contractId,tabooId:offering.tabooId};state.history.push(history);
    return{added:true,alreadyOwned:false,offering,contract:contractDefinition(offering.contractId),taboo:tabooDefinition(offering.tabooId),history};
  }
  function advantageCount(context,side){
    const advantage=context?.advantage||context?.battle?.advantage||{};
    const direct=advantage?.[`${side}AdvantageCount`];if(Number.isFinite(direct))return direct;
    const list=advantage?.[`${side}Advantages`];return Array.isArray(list)?list.length:0;
  }
  function setHistory(context){return context?.setHistory||context?.battle?.setHistory||{}}
  function conditionMet(definition,context={}){
    const history=setHistory(context),threshold=Number(definition.conditionValue)||1;
    if(definition.condition==='player_advantage_at_least')return advantageCount(context,'player')>=threshold;
    if(definition.condition==='enemy_advantage_at_least')return advantageCount(context,'enemy')>=threshold;
    if(definition.condition==='player_wins_at_least')return (Number(history.wins)||0)>=threshold;
    if(definition.condition==='player_losses_at_least')return (Number(history.losses)||0)>=threshold;
    if(definition.condition==='no_draws')return (Number(history.draws)||0)===0;
    if(definition.condition==='has_draws')return (Number(history.draws)||0)>0;
    return false;
  }
  function resolveRules(ids,registry,context){
    return ids.map(id=>registry[id]).filter(Boolean).map(definition=>{
      const triggered=conditionMet(definition,context),delta=triggered?definition.value:0;
      return{id:definition.id,type:definition.type,name:definition.name,triggered,delta,description:definition.description};
    });
  }
  function signed(value){return value>0?`+${value}`:String(value)}
  function resolutionSummary(entries){return entries.length?entries.map(entry=>`${entry.name} ${entry.triggered?signed(entry.delta):'미발동'}`).join(' · '):'활성 조항 없음'}
  function resolveShowdown(runState,context={}){
    ensureClauseState(runState);
    const score=context.score,basePower=Number.isFinite(score?.value)?score.value:Number(context.playerPower)||0;
    const contractEntries=resolveRules(runState.contracts,CONTRACT_DEFINITIONS,context),tabooEntries=resolveRules(runState.taboos,TABOO_DEFINITIONS,context),entries=[...contractEntries,...tabooEntries];
    const contractDelta=contractEntries.reduce((sum,entry)=>sum+entry.delta,0),tabooDelta=tabooEntries.reduce((sum,entry)=>sum+entry.delta,0),delta=contractDelta+tabooDelta;
    if(Number.isFinite(score?.value))score.value=Math.max(0,score.value+delta);
    const finalPower=Number.isFinite(score?.value)?score.value:Math.max(0,basePower+delta);
    const resolution={stage:STAGE,setIndex:context?.battle?.setIndex??context?.setIndex??1,basePower,finalPower,delta,contractDelta,tabooDelta,entries,activeCount:entries.length,triggeredCount:entries.filter(entry=>entry.triggered).length,summary:resolutionSummary(entries)};
    if(context?.battle)context.battle.contractTabooLastResolution=resolution;
    return resolution;
  }
  function activeRun(runtimeRoot=root){
    try{if(typeof run!=='undefined'&&run)return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function activeBattle(runtimeRoot=root){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]))}
  function showModal(runtimeRoot,html){
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');
    if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true;
  }
  function clauseSummary(runState){
    if(!runState)return{contracts:0,taboos:0,contractNames:[],tabooNames:[]};ensureClauseState(runState);
    return{contracts:runState.contracts.length,taboos:runState.taboos.length,contractNames:runState.contracts.map(id=>contractDefinition(id)?.name).filter(Boolean),tabooNames:runState.taboos.map(id=>tabooDefinition(id)?.name).filter(Boolean)};
  }
  function showClauseCollection(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;ensureClauseState(runState);
    const contracts=runState.contracts.length?runState.contracts.map(id=>{const rule=contractDefinition(id);return`<div class="choice"><b class="cyan">계약 · ${escapeHtml(rule.name)}</b><span>${escapeHtml(rule.description)}</span></div>`}).join(''):'<div class="choice"><b>계약 없음</b><span>이벤트에서 계약과 금기를 함께 받을 수 있다.</span></div>';
    const taboos=runState.taboos.length?runState.taboos.map(id=>{const rule=tabooDefinition(id);return`<div class="choice"><b class="red">금기 · ${escapeHtml(rule.name)}</b><span>${escapeHtml(rule.description)}</span></div>`}).join(''):'<div class="choice"><b>금기 없음</b><span>계약을 받을 때 대응하는 금기도 함께 생긴다.</span></div>';
    const html=`<h2>계약 / 금기</h2><p>계약과 금기는 쇼다운 카드 효과 뒤, 최종 위력 확정 전에 한 번 판정된다.</p><div class="choiceList">${contracts}${taboos}<button class="choice" data-close-clauses><b>닫기</b></button></div>`;
    if(!showModal(runtimeRoot,html))return false;
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),close=doc?.querySelector?.('[data-close-clauses]');
    if(close)close.onclick=()=>{if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else doc?.getElementById?.('overlay')?.classList.remove('show')};
    return true;
  }
  function offeringHtml(offering){
    const contract=contractDefinition(offering.contractId),taboo=tabooDefinition(offering.tabooId);
    return`<button class="choice" data-clause-offering="${escapeHtml(offering.id)}"><b>${escapeHtml(offering.name)}</b><span><span class="cyan">계약</span> ${escapeHtml(contract.description)}<br><span class="red">금기</span> ${escapeHtml(taboo.description)}</span></button>`;
  }
  function showEventOfferings(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const ids=availableOfferingIds(runState);if(!ids.length)return false;
    const html=`<h2>계약서 · 대가가 있는 선택</h2><p>하나를 선택하면 계약 1개와 대응 금기 1개를 함께 얻고 이벤트를 끝낸다.</p><div class="choiceList">${ids.map(id=>offeringHtml(OFFERINGS[id])).join('')}<button class="choice" data-back-to-event><b>돌아가기</b></button></div>`;
    if(!showModal(runtimeRoot,html))return false;
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    doc?.querySelectorAll?.('[data-clause-offering]')?.forEach(button=>{button.onclick=()=>takeOfferingFromEvent(runtimeRoot,button.dataset.clauseOffering,node?.id)});
    const back=doc?.querySelector?.('[data-back-to-event]');if(back)back.onclick=()=>runtimeRoot.showEvent?.(node);
    return ids;
  }
  function takeOfferingFromEvent(runtimeRoot=root,id,nodeId){
    const runState=activeRun(runtimeRoot);if(!runState)return{ok:false,reason:'no_run'};
    const node=Array.isArray(runState.map)?runState.map.find(entry=>entry.id===nodeId):null;if(!node||node.type!=='event')return{ok:false,reason:'invalid_node'};
    const result=acquireOffering(runState,id,{source:`event:${nodeId}`});if(!result.added)return{ok:false,reason:'owned'};
    if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('reward');
    if(typeof runtimeRoot?.completeNode==='function')runtimeRoot.completeNode(node);
    return{ok:true,...result};
  }
  function decorateEvent(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc||!availableOfferingIds(runState).length)return false;
    const list=doc.getElementById?.('modal')?.querySelector?.('.choiceList');if(!list||list.querySelector?.('[data-open-contracts]'))return false;
    const button=doc.createElement('button');button.className='choice';button.type='button';button.dataset.openContracts='true';button.innerHTML='<b>계약서 열람</b><span>계약 1개 + 대응 금기 1개를 함께 받는다.</span>';button.onclick=()=>showEventOfferings(runtimeRoot,node);list.appendChild(button);return true;
  }
  function patchShowdownTrace(state,resolution){
    if(!state||!resolution?.activeCount||!Array.isArray(state.showdownTrace)||state.showdownTrace.some(line=>String(line).startsWith('계약/금기:')))return false;
    const cardIndex=state.showdownTrace.findIndex(line=>String(line).startsWith('카드 효과:'));
    if(cardIndex>=0){const raw=String(state.showdownTrace[cardIndex]).split(':').slice(1).join(':').trim(),total=Number(raw);if(Number.isFinite(total)){const cardDelta=total-resolution.delta;state.showdownTrace[cardIndex]=`카드 효과: ${signed(cardDelta)}`}}
    const finalIndex=state.showdownTrace.findIndex(line=>String(line).startsWith('최종 위력:')),insertAt=finalIndex>=0?finalIndex:state.showdownTrace.length;
    state.showdownTrace.splice(insertAt,0,`계약/금기: ${resolution.summary}`);return true;
  }
  function wrapRunCardEffects(runtimeRoot=root){
    const original=runtimeRoot?.runCardEffects;if(typeof original!=='function')return false;if(original.__contractSystemAdapter)return true;
    const wrapped=function(trigger,card,extra={}){
      const result=original.call(this,trigger,card,extra);
      if(trigger==='on_showdown_score'){
        const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot),slotIndex=extra?.slotIndex,lastIndex=Math.max(0,(state?.slots?.length||1)-1),token=state?.setIndex??1;
        if(state&&runState&&Number.isFinite(extra?.score?.value)&&slotIndex===lastIndex&&state.contractTabooResolvedSet!==token){state.contractTabooResolvedSet=token;resolveShowdown(runState,{battle:state,score:extra.score,advantage:extra.advantage||state.advantage,setHistory:state.setHistory})}
      }
      return result;
    };
    wrapped.__contractSystemAdapter=true;wrapped.__legacyRunCardEffects=original;runtimeRoot.runCardEffects=wrapped;return true;
  }
  function wrapShowShowdownStep(runtimeRoot=root){
    const original=runtimeRoot?.showShowdownStep;if(typeof original!=='function')return false;if(original.__contractSystemAdapter)return true;
    const wrapped=function(label,text,stage){
      const state=activeBattle(runtimeRoot),resolution=state?.contractTabooLastResolution;
      if(label==='최종 위력'&&resolution?.activeCount&&resolution.setIndex===(state?.setIndex??resolution.setIndex)){
        patchShowdownTrace(state,resolution);original.call(this,'계약/금기',resolution.summary,'contractTaboo');
        const timer=runtimeRoot?.setTimeout||((typeof setTimeout==='function')?setTimeout:null);if(timer){timer(()=>original.call(this,label,text,stage),90);return}
      }
      return original.call(this,label,text,stage);
    };
    wrapped.__contractSystemAdapter=true;wrapped.__legacyShowShowdownStep=original;runtimeRoot.showShowdownStep=wrapped;return true;
  }
  function renderMapClauseSummary(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;
    const summary=clauseSummary(runState),build=doc.getElementById?.('mapBuild'),host=build?.parentElement?.parentElement;let badge=doc.getElementById?.('mapClausesBadge');
    if(host&&!badge){badge=doc.createElement('button');badge.id='mapClausesBadge';badge.className='badge';badge.type='button';host.appendChild(badge)}
    if(badge){badge.innerHTML=`계약 <b>${summary.contracts}</b> · 금기 <b>${summary.taboos}</b>`;badge.title=[...summary.contractNames,...summary.tabooNames].join(', ')||'활성 계약/금기 없음';badge.onclick=()=>showClauseCollection(runtimeRoot)}
    return summary;
  }
  function renderBattleClauseButton(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;
    const summary=clauseSummary(runState),sub=doc.getElementById?.('battleSub');let button=doc.getElementById?.('activeClauseButton');
    if(!summary.contracts&&!summary.taboos){button?.remove?.();return summary}
    if(!sub)return summary;
    if(!button){button=doc.createElement('button');button.id='activeClauseButton';button.className='badge';button.type='button';const anchor=doc.getElementById?.('activeRelicButton')||doc.getElementById?.('encounterRuleInfoButton');if(anchor)anchor.insertAdjacentElement('afterend',button);else sub.appendChild(button)}
    button.textContent=`계약 ${summary.contracts} · 금기 ${summary.taboos}`;button.title=[...summary.contractNames,...summary.tabooNames].join(', ');button.onclick=()=>showClauseCollection(runtimeRoot);return summary;
  }
  function wrapBeginRun(runtimeRoot=root){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__contractSystemAdapter)return true;
    const wrapped=function(...args){const result=original.apply(this,args),runState=activeRun(runtimeRoot);if(runState)ensureClauseState(runState);if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();return result};
    wrapped.__contractSystemAdapter=true;wrapped.__legacyBeginRun=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapShowEvent(runtimeRoot=root){
    const original=runtimeRoot?.showEvent;if(typeof original!=='function')return false;if(original.__contractSystemAdapter)return true;
    const wrapped=function(node,...args){const result=original.call(this,node,...args);decorateEvent(runtimeRoot,node);return result};
    wrapped.__contractSystemAdapter=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=root){
    const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__contractSystemAdapter)return true;
    const wrapped=function(...args){const result=original.apply(this,args);renderMapClauseSummary(runtimeRoot);return result};
    wrapped.__contractSystemAdapter=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function wrapRenderBattle(runtimeRoot=root){
    const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__contractSystemAdapter)return true;
    const wrapped=function(...args){const result=original.apply(this,args);renderBattleClauseButton(runtimeRoot);return result};
    wrapped.__contractSystemAdapter=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;
    if(typeof runtimeRoot?.beginRun!=='function'||typeof runtimeRoot?.runCardEffects!=='function'||typeof runtimeRoot?.showEvent!=='function'||typeof runtimeRoot?.renderMap!=='function'||typeof runtimeRoot?.renderBattle!=='function')return false;
    const errors=validateRegistry();if(errors.length){console.error('[contracts] 계약/금기 정의 오류',errors);return false}
    wrapBeginRun(runtimeRoot);wrapRunCardEffects(runtimeRoot);wrapShowShowdownStep(runtimeRoot);wrapShowEvent(runtimeRoot);wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;
    const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else console.warn('[contracts] 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,SHOWDOWN_RULE_ORDER,CONTRACT_DEFINITIONS,TABOO_DEFINITIONS,OFFERINGS,contractDefinition,tabooDefinition,offeringDefinition,validateRuleDefinition,validateRegistry,ensureClauseState,ownedContractIds,ownedTabooIds,availableOfferingIds,acquireOffering,advantageCount,setHistory,conditionMet,resolveRules,resolutionSummary,resolveShowdown,clauseSummary,showClauseCollection,showEventOfferings,takeOfferingFromEvent,decorateEvent,patchShowdownTrace,wrapRunCardEffects,wrapShowShowdownStep,renderMapClauseSummary,renderBattleClauseButton,wrapBeginRun,wrapShowEvent,wrapRenderMap,wrapRenderBattle,installBrowserRuntime,installWhenReady,activeRun,activeBattle};
});
