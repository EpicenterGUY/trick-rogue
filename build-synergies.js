(function(root,factory){
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const CombatEffects=typeof module!=='undefined'?require('./combat-effects.js'):root.CombatEffects;
  const RelicSystem=typeof module!=='undefined'?require('./relics.js'):root.RelicSystem;
  const ContractSystem=typeof module!=='undefined'?require('./contracts.js'):root.ContractSystem;
  const api=factory(CardEffects,CombatEffects,RelicSystem,ContractSystem,root);
  if(typeof module!=='undefined')module.exports=api;
  root.BuildSynergySystem=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,CombatEffects,RelicSystem,ContractSystem,root){
  const STAGE='6-4';
  const SYNERGY_DEFINITIONS=Object.freeze({
    marked_target:Object.freeze({
      id:'marked_target',name:'피 묻은 표적',description:'녹슨 바늘과 금 간 표적을 함께 보유하면 세트 시작 시 적에게 출혈 1을 추가로 부여한다.',
      requires:Object.freeze({relics:Object.freeze(['rusty_needle','cracked_target'])}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'bleed',amount:1}),duration:'run'})])
    }),
    edge_accounting:Object.freeze({
      id:'edge_accounting',name:'우세 장부',description:'금 간 주판과 우세 계약을 함께 보유하면 이번 쇼다운에 명시적 우세가 있을 때 위력 +2.',
      requires:Object.freeze({relics:Object.freeze(['cracked_abacus']),contracts:Object.freeze(['edge_clause'])}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_showdown_score',action:'showdown_power',value:2,condition:'player_has_advantage',duration:'run'})])
    }),
    loss_insurance:Object.freeze({
      id:'loss_insurance',name:'패배 보험',description:'패자의 토큰과 연패 금기를 함께 보유하면 트릭 패배 시 칩 +1을 추가로 얻는다.',
      requires:Object.freeze({relics:Object.freeze(['losers_token']),taboos:Object.freeze(['three_losses'])}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_trick_loss',action:'gain_chips',value:1,duration:'run'})])
    }),
    draw_refund:Object.freeze({
      id:'draw_refund',name:'동점 환급',description:'무승부 동전과 무승부 금기를 함께 보유하면 트릭 무승부 시 칩 +1을 추가로 얻는다.',
      requires:Object.freeze({relics:Object.freeze(['draw_coin']),taboos:Object.freeze(['any_draw'])}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_trick_draw',action:'gain_chips',value:1,duration:'run'})])
    })
  });
  let installed=false;

  function synergyDefinition(id){return SYNERGY_DEFINITIONS[id]||null}
  function knownRequirement(kind,id){
    if(kind==='relics')return !!RelicSystem?.RELIC_DEFINITIONS?.[id];
    if(kind==='contracts')return !!ContractSystem?.CONTRACT_DEFINITIONS?.[id];
    if(kind==='taboos')return !!ContractSystem?.TABOO_DEFINITIONS?.[id];
    return false;
  }
  function validateSynergyDefinition(definition,id=definition?.id){
    const errors=[];
    if(!definition||typeof definition!=='object')return['synergy definition must be an object'];
    if(!definition.id)errors.push('missing id');
    if(id&&definition.id!==id)errors.push(`id mismatch ${definition.id}`);
    if(!definition.name)errors.push('missing name');
    if(!definition.description)errors.push('missing description');
    if(definition.effectOwnerType!=='passive')errors.push('effectOwnerType must be passive');
    const requirements=definition.requires||{};
    let count=0;
    for(const kind of ['relics','contracts','taboos'])for(const requirementId of requirements[kind]||[]){count++;if(!knownRequirement(kind,requirementId))errors.push(`unknown ${kind} requirement ${requirementId}`)}
    if(count<2)errors.push('synergy requires at least two build components');
    const effectErrors=CardEffects?.validateEffectList?CardEffects.validateEffectList(definition.effects,{requireTrigger:true,requireDuration:true}):[];
    errors.push(...effectErrors);
    for(const effect of definition.effects||[])if(effect.duration!=='run')errors.push('synergy effects must use run duration');
    return errors;
  }
  function validateSynergyRegistry(registry=SYNERGY_DEFINITIONS){return Object.entries(registry).flatMap(([id,definition])=>validateSynergyDefinition(definition,id).map(error=>`${id}: ${error}`))}
  function relicIds(runState){return new Set((Array.isArray(runState?.relics)?runState.relics:[]).map(value=>typeof value==='string'?value:value?.id).filter(Boolean))}
  function clauseIds(runState,key){return new Set((Array.isArray(runState?.[key])?runState[key]:[]).map(value=>typeof value==='string'?value:value?.id).filter(Boolean))}
  function requirementState(runState){return{relics:relicIds(runState),contracts:clauseIds(runState,'contracts'),taboos:clauseIds(runState,'taboos')}}
  function isSynergyActive(definition,runState){
    if(!definition||!runState)return false;const owned=requirementState(runState),requirements=definition.requires||{};
    return ['relics','contracts','taboos'].every(kind=>(requirements[kind]||[]).every(id=>owned[kind].has(id)));
  }
  function activeSynergyIds(runState){return Object.keys(SYNERGY_DEFINITIONS).filter(id=>isSynergyActive(SYNERGY_DEFINITIONS[id],runState))}
  function makeSynergyOwner(id){
    const definition=synergyDefinition(id);if(!definition)throw new TypeError(`Unknown synergy: ${String(id)}`);
    return{...definition,effects:definition.effects.map(effect=>({...effect,value:effect.value&&typeof effect.value==='object'?{...effect.value}:effect.value}))};
  }
  function activeSynergyOwners(runState){return activeSynergyIds(runState).map(id=>({source:makeSynergyOwner(id),ownerType:'passive',ownerId:`synergy:${id}`}))}
  function installCombatOwnerAdapter(){
    if(!CombatEffects||typeof CombatEffects.activeEffectOwners!=='function')return false;
    if(CombatEffects.activeEffectOwners.__buildSynergyAdapter)return true;
    const original=CombatEffects.activeEffectOwners;
    const wrapped=function(state,runState){
      const owners=original.call(this,state,runState),seen=new Set((owners||[]).map(entry=>`${entry?.ownerType||''}:${entry?.ownerId||''}`));
      for(const entry of activeSynergyOwners(runState)){const key=`${entry.ownerType}:${entry.ownerId}`;if(!seen.has(key)){seen.add(key);owners.push(entry)}}
      return owners;
    };
    wrapped.__buildSynergyAdapter=true;wrapped.__legacyActiveEffectOwners=original;CombatEffects.activeEffectOwners=wrapped;return true;
  }
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function componentName(kind,id){
    if(kind==='relics')return RelicSystem?.relicDefinition?.(id)?.name||id;
    if(kind==='contracts')return ContractSystem?.contractDefinition?.(id)?.name||id;
    if(kind==='taboos')return ContractSystem?.tabooDefinition?.(id)?.name||id;
    return id;
  }
  function requirementLabels(definition){
    const labels=[];for(const kind of ['relics','contracts','taboos'])for(const id of definition?.requires?.[kind]||[])labels.push(componentName(kind,id));return labels;
  }
  function synergySummary(runState){
    const ids=activeSynergyIds(runState);return{count:ids.length,ids,names:ids.map(id=>SYNERGY_DEFINITIONS[id].name),total:Object.keys(SYNERGY_DEFINITIONS).length};
  }
  function showModal(runtimeRoot,html){
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true;
  }
  function showSynergyCollection(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const active=new Set(activeSynergyIds(runState));
    const body=Object.values(SYNERGY_DEFINITIONS).map(definition=>{const on=active.has(definition.id),requirements=requirementLabels(definition).join(' + ');return`<div class="choice"><b class="${on?'green':'small'}">${on?'◆ 활성':'◇ 미완성'} · ${escapeHtml(definition.name)}</b><span>${escapeHtml(definition.description)}<br>조건: ${escapeHtml(requirements)}</span></div>`}).join('');
    const html=`<h2>빌드 시너지 · ${active.size}/${Object.keys(SYNERGY_DEFINITIONS).length}</h2><p>유물과 계약·금기 조합이 완성되면 별도의 패시브 효과가 자동으로 활성화된다.</p><div class="choiceList">${body}<button class="choice" data-close-synergies><b>닫기</b></button></div>`;
    if(!showModal(runtimeRoot,html))return false;const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),close=doc?.querySelector?.('[data-close-synergies]');if(close)close.onclick=()=>{if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else doc?.getElementById?.('overlay')?.classList.remove('show')};return true;
  }
  function renderMapSynergySummary(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const summary=synergySummary(runState),build=doc.getElementById?.('mapBuild'),host=build?.parentElement?.parentElement;let badge=doc.getElementById?.('mapSynergiesBadge');
    if(host&&!badge){badge=doc.createElement('button');badge.id='mapSynergiesBadge';badge.className='badge';badge.type='button';host.appendChild(badge)}
    if(badge){badge.innerHTML=`시너지 <b>${summary.count}</b>`;badge.title=summary.names.join(', ')||'활성 시너지 없음';badge.onclick=()=>showSynergyCollection(runtimeRoot)}return summary;
  }
  function renderBattleSynergyButton(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const summary=synergySummary(runState),sub=doc.getElementById?.('battleSub');let button=doc.getElementById?.('activeSynergyButton');
    if(!summary.count){button?.remove?.();return summary}if(!sub)return summary;
    if(!button){button=doc.createElement('button');button.id='activeSynergyButton';button.className='badge';button.type='button';const anchor=doc.getElementById?.('activeClauseButton')||doc.getElementById?.('activeRelicButton')||doc.getElementById?.('encounterRuleInfoButton');if(anchor)anchor.insertAdjacentElement('afterend',button);else sub.appendChild(button)}
    button.textContent=`시너지 ${summary.count}`;button.title=summary.names.join(', ');button.onclick=()=>showSynergyCollection(runtimeRoot);return summary;
  }
  function wrapRenderMap(runtimeRoot=root){const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__buildSynergyAdapter)return true;const wrapped=function(...args){const result=original.apply(this,args);renderMapSynergySummary(runtimeRoot);return result};wrapped.__buildSynergyAdapter=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true}
  function wrapRenderBattle(runtimeRoot=root){const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__buildSynergyAdapter)return true;const wrapped=function(...args){const result=original.apply(this,args);renderBattleSynergyButton(runtimeRoot);return result};wrapped.__buildSynergyAdapter=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true}
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(typeof runtimeRoot?.renderMap!=='function'||typeof runtimeRoot?.renderBattle!=='function'||!CombatEffects?.activeEffectOwners)return false;
    const errors=validateSynergyRegistry();if(errors.length){console.error('[build-synergies] 시너지 정의 오류',errors);return false}
    installCombatOwnerAdapter();wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else console.warn('[build-synergies] 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,SYNERGY_DEFINITIONS,synergyDefinition,validateSynergyDefinition,validateSynergyRegistry,requirementState,isSynergyActive,activeSynergyIds,makeSynergyOwner,activeSynergyOwners,installCombatOwnerAdapter,requirementLabels,synergySummary,showSynergyCollection,renderMapSynergySummary,renderBattleSynergyButton,wrapRenderMap,wrapRenderBattle,installBrowserRuntime,installWhenReady,activeRun};
});
