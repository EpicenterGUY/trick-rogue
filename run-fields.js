(function(root,factory){
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const api=factory(EncounterRules,root);
  if(typeof module!=='undefined')module.exports=api;
  root.RunFields=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(EncounterRules,root){
  const RUN_FIELD_STATE_VERSION='7.5-F';
  const EVENT_FIELD_ID='inversion_zone';
  const SHOP_FIELD_ID='resonance_floor';
  const SHOP_FIELD_COST=45;
  let installed=false;

  function fieldRegistry(){return EncounterRules?.FIELD_DEFINITIONS||{}}
  function fieldDefinition(id){return EncounterRules?.fieldDefinition?EncounterRules.fieldDefinition(id):fieldRegistry()[id]||null}
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function activeBattle(runtimeRoot=root){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function sourceMeta(source='unknown'){
    const text=String(source||'unknown'),prefix=text.split(':')[0];
    const type=['event','shop','card','boss','elite','relic','contract'].includes(prefix)?prefix:'scripted';
    return{type,id:text,label:null,consume:'battle'};
  }
  function ensureRunFieldState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('run field state requires a run');
    const current=runState.fieldLoadout&&typeof runState.fieldLoadout==='object'?runState.fieldLoadout:{};
    const known=new Set(Object.keys(fieldRegistry()));
    const owned=[...new Set((Array.isArray(current.owned)?current.owned:[]).filter(id=>known.has(id)))];
    const migrating=current.version!==RUN_FIELD_STATE_VERSION;
    const legacyActive=migrating&&owned.includes(current.activeFieldId)?current.activeFieldId:null;
    const queuedFieldId=owned.includes(current.queuedFieldId)?current.queuedFieldId:legacyActive;
    current.version=RUN_FIELD_STATE_VERSION;
    current.owned=owned;
    current.queuedFieldId=queuedFieldId||null;
    current.queuedSource=current.queuedFieldId?(current.queuedSource||sourceMeta('scripted:legacy-field-loadout')):null;
    current.activeFieldId=null;
    current.history=Array.isArray(current.history)?current.history:[];
    runState.fieldLoadout=current;
    return current;
  }
  function fieldHistoryEntry(state,{action,source,from,to}){
    const entry={step:state.history.length+1,action,source:source||'unknown',from:from||null,to:to||null};state.history.push(entry);return entry;
  }
  function queueField(runState,id,{source='manual'}={}){
    const definition=fieldDefinition(id);if(!definition)throw new TypeError(`Unknown run field: ${String(id)}`);
    const state=ensureRunFieldState(runState);
    if(!state.owned.includes(id))throw new TypeError(`Run does not own field: ${String(id)}`);
    const previous=state.queuedFieldId;
    if(previous===id)return{changed:false,previousId:previous,currentId:id,definition};
    state.queuedFieldId=id;state.queuedSource=sourceMeta(source);
    const history=fieldHistoryEntry(state,{action:'queue',source,from:previous,to:id});
    return{changed:true,previousId:previous,currentId:id,replaced:!!previous,definition,history};
  }
  function acquireField(runState,id,{activate=true,source='unknown'}={}){
    const definition=fieldDefinition(id);if(!definition)throw new TypeError(`Unknown run field: ${String(id)}`);
    const state=ensureRunFieldState(runState),alreadyOwned=state.owned.includes(id),previous=state.queuedFieldId;
    if(!alreadyOwned)state.owned.push(id);
    let queued=false;
    if(activate){state.queuedFieldId=id;state.queuedSource=sourceMeta(source);queued=true}
    const changed=!alreadyOwned||(activate&&previous!==id);
    const history=changed?fieldHistoryEntry(state,{action:alreadyOwned?'queue':'acquire',source,from:previous,to:activate?id:previous}):null;
    return{definition,alreadyOwned,activated:false,queued,replaced:activate&&!!previous&&previous!==id,previousId:previous,currentId:state.queuedFieldId,history};
  }
  function activateField(runState,id,{source='manual'}={}){
    const state=ensureRunFieldState(runState),previous=state.queuedFieldId;
    if(id===null||id===undefined){
      if(previous===null)return{changed:false,previousId:null,currentId:null};
      state.queuedFieldId=null;state.queuedSource=null;
      const history=fieldHistoryEntry(state,{action:'unqueue',source,from:previous,to:null});
      return{changed:true,previousId:previous,currentId:null,history};
    }
    return queueField(runState,id,{source});
  }
  function queuedField(runState){const state=ensureRunFieldState(runState);return state.queuedFieldId?fieldDefinition(state.queuedFieldId):null}
  function activeField(runState){return queuedField(runState)}
  function consumeQueuedFieldForBattle(runState,battleState){
    if(!runState||!battleState)return{applied:false,reason:'missing_state'};
    if(battleState.runFieldApplied)return{applied:true,unchanged:true,current:battleState.field,definition:fieldDefinition(battleState.runFieldApplied.id)};
    const state=ensureRunFieldState(runState),definition=state.queuedFieldId?fieldDefinition(state.queuedFieldId):null;
    if(!definition)return{applied:false,reason:'no_queued_field'};
    if(EncounterRules?.initializeBattle&&!battleState.encounterRulesInitialized)EncounterRules.initializeBattle(battleState);
    const previous=battleState.field||null,source=state.queuedSource||sourceMeta('scripted:run-field');
    const transition=EncounterRules?.setFieldFromSource
      ?EncounterRules.setFieldFromSource(battleState,definition.id,source)
      :EncounterRules.setField(battleState,definition.id);
    battleState.runFieldApplied={id:definition.id,label:definition.label||definition.name,source,previousFieldId:previous?.id||null,consumed:true};
    battleState.encounter={...(battleState.encounter||{}),runFieldId:definition.id,runFieldSource:source};
    state.queuedFieldId=null;state.queuedSource=null;
    fieldHistoryEntry(state,{action:'consume',source:source.id||source.type,from:definition.id,to:null});
    return{applied:true,definition,previous,current:battleState.field,replaced:!!previous&&previous.id!==definition.id,transition,source,consumed:true};
  }
  function applyRunFieldToBattle(runState,battleState){return consumeQueuedFieldForBattle(runState,battleState)}
  function applyActiveRunField(runtimeRoot=root){return consumeQueuedFieldForBattle(activeRun(runtimeRoot),activeBattle(runtimeRoot))}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function runFieldSummary(runState){
    if(!runState)return null;const state=ensureRunFieldState(runState),definition=state.queuedFieldId?fieldDefinition(state.queuedFieldId):null;if(!definition)return null;
    return{id:definition.id,label:definition.label||definition.name,description:definition.description||'',ownedCount:state.owned.length,queued:true,source:state.queuedSource};
  }
  function eventFieldPick(runtimeRoot=root,nodeId,fieldId=EVENT_FIELD_ID){
    const runState=activeRun(runtimeRoot);if(!runState)return null;
    const result=acquireField(runState,fieldId,{activate:true,source:`event:${nodeId}`});
    if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('reward');
    const node=Array.isArray(runState.map)?runState.map.find(entry=>entry.id===nodeId):null;
    if(node&&typeof runtimeRoot?.completeNode==='function')runtimeRoot.completeNode(node);
    return result;
  }
  function shopFieldPick(runtimeRoot=root,nodeId,fieldId=SHOP_FIELD_ID,cost=SHOP_FIELD_COST){
    const runState=activeRun(runtimeRoot);if(!runState)return{ok:false,reason:'no_run'};
    const state=ensureRunFieldState(runState),owned=state.owned.includes(fieldId);
    if(!owned&&runState.gold<cost){if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('lose');return{ok:false,reason:'gold'}}
    if(!owned)runState.gold-=cost;
    const result=owned?queueField(runState,fieldId,{source:`shop:${nodeId}`}):acquireField(runState,fieldId,{activate:true,source:`shop:${nodeId}`});
    const node=Array.isArray(runState.map)?runState.map.find(entry=>entry.id===nodeId):null;
    if(node&&typeof runtimeRoot?.showShop==='function')runtimeRoot.showShop(node);
    return{ok:true,paid:owned?0:cost,...result};
  }
  function ruleInfoEntries(state){
    if(!state)return[];const entries=[];
    if(state.field){
      const source=state.fieldSource||state.runFieldApplied?.source||null;
      const sourceLabel=source?.type?` · 출처 ${source.type}${source.id?`(${source.id})`:''}`:'';
      entries.push({id:`field:${state.field.id}`,kind:'field',label:`필드 · ${state.field.label||state.field.id}`,description:`${state.field.description||''}${sourceLabel}`});
    }
    const profile=EncounterRules?.profileFor?.(state.encounterProfileId||state.type),phase=profile?.bossPhases?.find(item=>item.id===state.bossPhase?.id);
    if(state.bossPhase){const rule=phase?.rule;entries.push({id:`phase:${state.bossPhase.id}`,kind:'phase',label:`${state.bossPhase.label}${rule?.label?` · ${rule.label}`:''}`,description:rule?.description||'현재 보스 페이즈의 기본 규칙을 사용한다.'})}
    for(const rule of state.encounterRules||[]){if(!rule||rule.encounterRuleKind==='boss_phase')continue;entries.push({id:`rule:${rule.id}`,kind:'rule',label:`고유 규칙 · ${rule.label||rule.id}`,description:rule.description||''})}
    return entries;
  }
  function phaseTransitionModel(previousId,currentId,state){
    if(!state||!currentId||previousId===currentId)return null;
    const profile=EncounterRules?.profileFor?.(state.encounterProfileId||state.type),phase=profile?.bossPhases?.find(item=>item.id===currentId);if(!phase)return null;
    return{previousId:previousId||null,currentId,phaseLabel:phase.label||currentId,ruleLabel:phase.rule?.label||'',description:phase.rule?.description||'보스의 전투 규칙이 바뀌었다.'};
  }
  function injectStyles(doc){
    if(!doc||doc.querySelector?.('style[data-run-fields-ui]'))return;
    const style=doc.createElement('style');style.dataset.runFieldsUi='true';style.textContent=`
#encounterRuleInfoButton{margin-top:4px;max-width:100%;white-space:normal;text-align:left;font-size:10px;padding:5px 7px}
.phaseShiftBanner{position:absolute;z-index:19;left:8px;right:8px;top:78px;padding:10px;border:2px solid #000;background:#171e2df2;box-shadow:0 0 0 2px #9e89f2 inset,4px 4px 0 #0008;pointer-events:none;animation:phaseShiftIn .22s cubic-bezier(.2,.8,.2,1),phaseShiftOut .28s ease 1.55s forwards}
.phaseShiftBanner .kicker{font-size:9px;color:#c9bcff}.phaseShiftBanner b{display:block;margin-top:2px;font-size:14px}.phaseShiftBanner span{display:block;margin-top:4px;font-size:10px;line-height:1.35;color:#d3d9e7}
@keyframes phaseShiftIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@keyframes phaseShiftOut{to{opacity:0;transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){.phaseShiftBanner{animation:none}}
`;
    doc.head.appendChild(style);
  }
  function presentPhaseTransition(state,runtimeRoot=root,previousId){
    const model=phaseTransitionModel(previousId,state?.bossPhase?.id,state);if(!model)return null;state.lastPhaseTransition=model;
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc)return model;injectStyles(doc);
    const arena=doc.getElementById?.('arena');if(!arena)return model;arena.querySelector?.('.phaseShiftBanner')?.remove?.();
    const banner=doc.createElement('div');banner.className='phaseShiftBanner';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
    banner.innerHTML=`<div class="kicker">보스 규칙 전환</div><b>${escapeHtml(model.phaseLabel)}${model.ruleLabel?` · ${escapeHtml(model.ruleLabel)}`:''}</b><span>${escapeHtml(model.description)}</span>`;
    arena.appendChild(banner);setTimeout(()=>banner.remove(),1900);return model;
  }
  function showRuleInfo(runtimeRoot=root,state=activeBattle(runtimeRoot)){
    const entries=ruleInfoEntries(state);if(!entries.length)return false;
    const html=`<h2>현재 전투 규칙</h2><p>필드는 특정 출처가 만든 경우에만 존재하며, 적 고유 규칙과 별도로 표시된다.</p><div class="choiceList">${entries.map(entry=>`<div class="choice"><b>${escapeHtml(entry.label)}</b><span>${escapeHtml(entry.description||'추가 설명 없음')}</span></div>`).join('')}<button class="choice" data-close-rule-info><b>닫기</b></button></div>`;
    if(typeof runtimeRoot?.showModal==='function')runtimeRoot.showModal(html);else{const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show')}
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),close=doc?.querySelector?.('[data-close-rule-info]');if(close)close.onclick=()=>{if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else doc?.getElementById?.('overlay')?.classList.remove('show')};return true;
  }
  function renderRuleInfoButton(runtimeRoot=root,state=activeBattle(runtimeRoot)){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!doc)return[];injectStyles(doc);
    const entries=ruleInfoEntries(state),sub=doc.getElementById?.('battleSub');let button=doc.getElementById?.('encounterRuleInfoButton');if(!entries.length){button?.remove?.();return entries}if(!sub)return entries;
    if(!button){button=doc.createElement('button');button.id='encounterRuleInfoButton';button.className='badge';sub.insertAdjacentElement('afterend',button)}
    button.textContent=`규칙 보기 · ${entries.map(entry=>entry.label.replace(/^필드 · /,'')).join(' · ')}`;button.onclick=()=>showRuleInfo(runtimeRoot,state);return entries;
  }
  function renderMapFieldSummary(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return null;const summary=runFieldSummary(runState);if(!summary)return null;
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),build=doc?.getElementById?.('mapBuild');if(build){build.textContent=`${build.textContent} · 다음 전투 필드 ${summary.label}`;build.title=`다음 전투에만 적용 · ${summary.description}`};return summary;
  }
  function appendEventFieldOffer(runtimeRoot=root,node){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),list=modal?.querySelector?.('.choiceList');if(!list||list.querySelector('[data-run-field-event]'))return false;
    const definition=fieldDefinition(EVENT_FIELD_ID),runState=activeRun(runtimeRoot);if(!definition||!runState)return false;const owned=ensureRunFieldState(runState).owned.includes(definition.id);
    const button=doc.createElement('button');button.className='choice';button.dataset.runFieldEvent='true';button.innerHTML=`<b>${owned?'다음 전투에 재지정':'특수 필드 획득'} · ${escapeHtml(definition.label)}</b><span>${escapeHtml(definition.description)} · 다음 전투 한 번에만 생성된다.</span>`;button.onclick=()=>eventFieldPick(runtimeRoot,node.id,definition.id);list.appendChild(button);return true;
  }
  function appendShopFieldOffer(runtimeRoot=root,node){
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),list=modal?.querySelector?.('.choiceList');if(!list||list.querySelector('[data-run-field-shop]'))return false;
    const definition=fieldDefinition(SHOP_FIELD_ID),runState=activeRun(runtimeRoot);if(!definition||!runState)return false;const state=ensureRunFieldState(runState),owned=state.owned.includes(definition.id),queued=state.queuedFieldId===definition.id;
    const button=doc.createElement('button');button.className='choice';button.dataset.runFieldShop='true';button.disabled=queued;button.innerHTML=`<b>${queued?'다음 전투 예약됨':owned?'다음 전투에 지정':`필드 설계 · ${SHOP_FIELD_COST}G`} · ${escapeHtml(definition.label)}</b><span>${escapeHtml(definition.description)}${owned?' · 설계 보유 중':''} · 전투 1회 적용</span>`;button.onclick=()=>shopFieldPick(runtimeRoot,node.id,definition.id,SHOP_FIELD_COST);
    const exit=list.lastElementChild;exit?list.insertBefore(button,exit):list.appendChild(button);return true;
  }
  function wrapBeginRun(runtimeRoot=root){
    if(typeof runtimeRoot?.beginRun!=='function')return false;if(runtimeRoot.beginRun.__runFieldsAdapter)return true;const original=runtimeRoot.beginRun;
    const wrapped=function(...args){const result=original.apply(this,args),runState=activeRun(runtimeRoot);if(runState)ensureRunFieldState(runState);if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();return result};wrapped.__runFieldsAdapter=true;wrapped.__legacyBeginRun=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapStartBattle(runtimeRoot=root){
    if(typeof runtimeRoot?.startBattle!=='function')return false;if(runtimeRoot.startBattle.__runFieldsAdapter)return true;const original=runtimeRoot.startBattle;
    const wrapped=function(...args){
      const previousRun=runtimeRoot.runCardEffects,previousNext=runtimeRoot.nextEnemy,apply=()=>applyActiveRunField(runtimeRoot);
      if(typeof previousRun==='function')runtimeRoot.runCardEffects=function(...effectArgs){apply();return previousRun.apply(this,effectArgs)};
      if(typeof previousNext==='function')runtimeRoot.nextEnemy=function(...enemyArgs){apply();return previousNext.apply(this,enemyArgs)};
      try{const result=original.apply(this,args);apply();return result}finally{if(typeof previousRun==='function')runtimeRoot.runCardEffects=previousRun;if(typeof previousNext==='function')runtimeRoot.nextEnemy=previousNext}
    };wrapped.__runFieldsAdapter=true;wrapped.__legacyStartBattle=original;runtimeRoot.startBattle=wrapped;return true;
  }
  function wrapDamageEnemy(runtimeRoot=root){
    if(typeof runtimeRoot?.damageEnemy!=='function')return false;if(runtimeRoot.damageEnemy.__runFieldsAdapter)return true;const original=runtimeRoot.damageEnemy;
    const wrapped=function(...args){const before=activeBattle(runtimeRoot),previousId=before?.bossPhase?.id||null,result=original.apply(this,args),state=activeBattle(runtimeRoot);if(state?.type==='boss'&&previousId!==(state.bossPhase?.id||null))presentPhaseTransition(state,runtimeRoot,previousId);return result};wrapped.__runFieldsAdapter=true;wrapped.__legacyDamageEnemy=original;runtimeRoot.damageEnemy=wrapped;return true;
  }
  function wrapRenderBattle(runtimeRoot=root){if(typeof runtimeRoot?.renderBattle!=='function')return false;if(runtimeRoot.renderBattle.__runFieldsAdapter)return true;const original=runtimeRoot.renderBattle;const wrapped=function(...args){const result=original.apply(this,args);renderRuleInfoButton(runtimeRoot,activeBattle(runtimeRoot));return result};wrapped.__runFieldsAdapter=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true}
  function wrapRenderMap(runtimeRoot=root){if(typeof runtimeRoot?.renderMap!=='function')return false;if(runtimeRoot.renderMap.__runFieldsAdapter)return true;const original=runtimeRoot.renderMap;const wrapped=function(...args){const result=original.apply(this,args);renderMapFieldSummary(runtimeRoot);return result};wrapped.__runFieldsAdapter=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true}
  function wrapShowEvent(runtimeRoot=root){if(typeof runtimeRoot?.showEvent!=='function')return false;if(runtimeRoot.showEvent.__runFieldsAdapter)return true;const original=runtimeRoot.showEvent;const wrapped=function(node,...args){const result=original.call(this,node,...args);appendEventFieldOffer(runtimeRoot,node);return result};wrapped.__runFieldsAdapter=true;wrapped.__legacyShowEvent=original;runtimeRoot.showEvent=wrapped;return true}
  function wrapShowShop(runtimeRoot=root){if(typeof runtimeRoot?.showShop!=='function')return false;if(runtimeRoot.showShop.__runFieldsAdapter)return true;const original=runtimeRoot.showShop;const wrapped=function(node,...args){const result=original.call(this,node,...args);appendShopFieldOffer(runtimeRoot,node);return result};wrapped.__runFieldsAdapter=true;wrapped.__legacyShowShop=original;runtimeRoot.showShop=wrapped;return true}
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(EncounterRules?.installBrowserRuntime)EncounterRules.installBrowserRuntime(runtimeRoot);
    if(typeof runtimeRoot?.beginRun!=='function'||typeof runtimeRoot?.startBattle!=='function'||typeof runtimeRoot?.damageEnemy!=='function'||typeof runtimeRoot?.renderBattle!=='function')return false;
    injectStyles(runtimeRoot.document||(typeof document!=='undefined'?document:null));wrapBeginRun(runtimeRoot);wrapStartBattle(runtimeRoot);wrapDamageEnemy(runtimeRoot);wrapRenderBattle(runtimeRoot);wrapRenderMap(runtimeRoot);wrapShowEvent(runtimeRoot);wrapShowShop(runtimeRoot);
    runtimeRoot.pickEventField=(nodeId,fieldId=EVENT_FIELD_ID)=>eventFieldPick(runtimeRoot,nodeId,fieldId);runtimeRoot.pickShopField=(nodeId,fieldId=SHOP_FIELD_ID,cost=SHOP_FIELD_COST)=>shopFieldPick(runtimeRoot,nodeId,fieldId,cost);runtimeRoot.showEncounterRules=()=>showRuleInfo(runtimeRoot,activeBattle(runtimeRoot));installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;attempts++;if(attempts<60)setTimeout(attempt,25);else console.warn('[run-fields] 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true}
  return{
    RUN_FIELD_STATE_VERSION,EVENT_FIELD_ID,SHOP_FIELD_ID,SHOP_FIELD_COST,fieldRegistry,fieldDefinition,activeRun,activeBattle,sourceMeta,ensureRunFieldState,acquireField,queueField,activateField,queuedField,activeField,
    consumeQueuedFieldForBattle,applyRunFieldToBattle,applyActiveRunField,runFieldSummary,eventFieldPick,shopFieldPick,ruleInfoEntries,phaseTransitionModel,presentPhaseTransition,showRuleInfo,renderRuleInfoButton,renderMapFieldSummary,
    appendEventFieldOffer,appendShopFieldOffer,wrapBeginRun,wrapStartBattle,wrapDamageEnemy,wrapRenderBattle,wrapRenderMap,wrapShowEvent,wrapShowShop,installBrowserRuntime,installWhenReady
  };
});