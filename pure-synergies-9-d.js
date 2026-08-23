(function(root,factory){
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const CombatEffects=typeof module!=='undefined'?require('./combat-effects.js'):root.CombatEffects;
  const api=factory(CardEffects,CombatEffects,root);
  if(typeof module!=='undefined')module.exports=api;
  root.PureSynergy9D=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,CombatEffects,root){
  const STAGE='9-D';
  const CONDITION_NAMES=Object.freeze(['pure_cards_in_showdown_at_least','all_showdown_cards_pure']);
  const PURE_SYNERGY_DEFINITIONS=Object.freeze({
    classic_line:Object.freeze({
      id:'classic_line',name:'정석 편성',
      description:'런 덱의 70% 이상이 순수 카드이고 순수 카드가 8장 이상이면 세트 시작 시 보호막 +2.',
      requirement:Object.freeze({minDeckSize:8,minPure:8,minRatio:.70}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'gain_shield',value:2,duration:'run'})])
    }),
    lean_core:Object.freeze({
      id:'lean_core',name:'정석 압축',
      description:'런 덱이 10장 이하이면서 순수 카드가 7장 이상이고 비율이 70% 이상이면 세트 시작 시 칩 +1.',
      requirement:Object.freeze({minDeckSize:5,maxDeckSize:10,minPure:7,minRatio:.70}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'gain_chips',value:1,duration:'run'})])
    }),
    clean_showdown:Object.freeze({
      id:'clean_showdown',name:'무첨가 승부',
      description:'런 덱의 순수 카드가 9장 이상이고 비율이 70% 이상이면, 쇼다운 5장 중 순수 카드가 3장 이상일 때 위력 +4.',
      requirement:Object.freeze({minDeckSize:9,minPure:9,minRatio:.70}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_showdown_score',condition:'pure_cards_in_showdown_at_least',conditionValue:3,action:'showdown_power',value:4,duration:'run'})])
    }),
    pure_five:Object.freeze({
      id:'pure_five',name:'순수 5장',
      description:'런 덱의 순수 카드가 10장 이상이고 비율이 75% 이상이면, 쇼다운 5장이 전부 순수 카드일 때 위력 +8.',
      requirement:Object.freeze({minDeckSize:10,minPure:10,minRatio:.75}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_showdown_score',condition:'all_showdown_cards_pure',action:'showdown_power',value:8,duration:'run'})])
    })
  });
  let installed=false;

  function zoneCards(context,key){const direct=context?.[key];if(Array.isArray(direct))return direct;const battle=context?.battle?.[key];return Array.isArray(battle)?battle:[]}
  function pureCount(cards){return(Array.isArray(cards)?cards:[]).filter(entry=>CardEffects?.isPureCard?.(entry)).length}
  function registerPureConditions(){
    if(!CardEffects?.conditions)return false;
    CardEffects.conditions.pure_cards_in_showdown_at_least=(context,effect)=>pureCount(zoneCards(context,'slots'))>=Math.max(1,Number(effect?.conditionValue)||1);
    CardEffects.conditions.all_showdown_cards_pure=context=>{const slots=zoneCards(context,'slots');return slots.length===5&&pureCount(slots)===5};
    return true;
  }
  registerPureConditions();

  function pureDeckStats(runState){
    const deck=Array.isArray(runState?.deck)?runState.deck.filter(Boolean):[];
    const pure=pureCount(deck),size=deck.length;
    return Object.freeze({size,pure,effect:size-pure,ratio:size?pure/size:0});
  }
  function requirementMet(requirement,stats){
    if(!requirement||!stats)return false;
    if(Number.isFinite(requirement.minDeckSize)&&stats.size<requirement.minDeckSize)return false;
    if(Number.isFinite(requirement.maxDeckSize)&&stats.size>requirement.maxDeckSize)return false;
    if(Number.isFinite(requirement.minPure)&&stats.pure<requirement.minPure)return false;
    if(Number.isFinite(requirement.minRatio)&&stats.ratio+Number.EPSILON<requirement.minRatio)return false;
    return true;
  }
  function synergyDefinition(id){return PURE_SYNERGY_DEFINITIONS[id]||null}
  function validateRequirement(requirement){
    const errors=[];
    if(!requirement||typeof requirement!=='object')return['missing requirement'];
    for(const key of ['minDeckSize','maxDeckSize','minPure'])if(requirement[key]!==undefined&&(!Number.isInteger(requirement[key])||requirement[key]<0))errors.push(`invalid ${key}`);
    if(requirement.minDeckSize!==undefined&&requirement.maxDeckSize!==undefined&&requirement.minDeckSize>requirement.maxDeckSize)errors.push('minDeckSize exceeds maxDeckSize');
    if(requirement.minRatio!==undefined&&(!Number.isFinite(requirement.minRatio)||requirement.minRatio<0||requirement.minRatio>1))errors.push('invalid minRatio');
    return errors;
  }
  function validateSynergyDefinition(definition,id=definition?.id){
    const errors=[];
    if(!definition||typeof definition!=='object')return['synergy definition must be an object'];
    if(!definition.id)errors.push('missing id');
    if(id&&definition.id!==id)errors.push(`id mismatch ${definition.id}`);
    if(!definition.name)errors.push('missing name');
    if(!definition.description)errors.push('missing description');
    if(definition.effectOwnerType!=='passive')errors.push('effectOwnerType must be passive');
    errors.push(...validateRequirement(definition.requirement));
    const effectErrors=CardEffects?.validateEffectList?CardEffects.validateEffectList(definition.effects,{requireTrigger:true,requireDuration:true}):[];
    errors.push(...effectErrors);
    for(const effect of definition.effects||[])if(effect.duration!=='run')errors.push('pure synergy effects must use run duration');
    return errors;
  }
  function validateSynergyRegistry(registry=PURE_SYNERGY_DEFINITIONS){return Object.entries(registry).flatMap(([id,definition])=>validateSynergyDefinition(definition,id).map(error=>`${id}: ${error}`))}
  function isSynergyActive(definition,runState){return!!definition&&requirementMet(definition.requirement,pureDeckStats(runState))}
  function activeSynergyIds(runState){return Object.keys(PURE_SYNERGY_DEFINITIONS).filter(id=>isSynergyActive(PURE_SYNERGY_DEFINITIONS[id],runState))}
  function makeSynergyOwner(id){
    const definition=synergyDefinition(id);if(!definition)throw new TypeError(`Unknown 9-D pure synergy: ${String(id)}`);
    return{...definition,requirement:{...definition.requirement},effects:definition.effects.map(effect=>({...effect}))};
  }
  function activeSynergyOwners(runState){return activeSynergyIds(runState).map(id=>({source:makeSynergyOwner(id),ownerType:'passive',ownerId:`pure-synergy:${id}`}))}
  function installCombatOwnerAdapter(){
    if(!CombatEffects||typeof CombatEffects.activeEffectOwners!=='function')return false;
    if(CombatEffects.activeEffectOwners.__pureSynergy9DAdapter)return true;
    const original=CombatEffects.activeEffectOwners;
    const wrapped=function(state,runState){
      const owners=original.call(this,state,runState)||[],seen=new Set(owners.map(entry=>`${entry?.ownerType||''}:${entry?.ownerId||''}`));
      for(const entry of activeSynergyOwners(runState)){const key=`${entry.ownerType}:${entry.ownerId}`;if(!seen.has(key)){seen.add(key);owners.push(entry)}}
      return owners;
    };
    wrapped.__pureSynergy9DAdapter=true;wrapped.__legacyActiveEffectOwners=original;CombatEffects.activeEffectOwners=wrapped;return true;
  }
  function requirementText(requirement){
    const parts=[];
    if(Number.isFinite(requirement?.minPure))parts.push(`순수 ${requirement.minPure}장 이상`);
    if(Number.isFinite(requirement?.minRatio))parts.push(`순수 비율 ${Math.round(requirement.minRatio*100)}% 이상`);
    if(Number.isFinite(requirement?.maxDeckSize))parts.push(`덱 ${requirement.maxDeckSize}장 이하`);
    if(Number.isFinite(requirement?.minDeckSize)&&requirement.minDeckSize>5)parts.push(`덱 ${requirement.minDeckSize}장 이상`);
    return parts.join(' · ');
  }
  function synergySummary(runState){
    const stats=pureDeckStats(runState),ids=activeSynergyIds(runState);
    return{stage:STAGE,count:ids.length,total:Object.keys(PURE_SYNERGY_DEFINITIONS).length,ids,names:ids.map(id=>PURE_SYNERGY_DEFINITIONS[id].name),deck:stats};
  }
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function showModal(runtimeRoot,html){
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true;
  }
  function showPureSynergyCollection(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const summary=synergySummary(runState),active=new Set(summary.ids),ratio=Math.round(summary.deck.ratio*100);
    const body=Object.values(PURE_SYNERGY_DEFINITIONS).map(definition=>{const on=active.has(definition.id);return`<div class="choice"><b class="${on?'green':'small'}">${on?'◆ 활성':'◇ 미완성'} · ${escapeHtml(definition.name)}</b><span>${escapeHtml(definition.description)}<br>조건: ${escapeHtml(requirementText(definition.requirement))}</span></div>`}).join('');
    const html=`<h2>순수 카드 시너지 · ${summary.count}/${summary.total}</h2><p>현재 덱: ${summary.deck.size}장 · 순수 ${summary.deck.pure}장 (${ratio}%). 순수 카드는 고유 효과가 없는 표준 카드이며 강화해도 고유 효과가 생기지 않으면 순수로 유지된다.</p><div class="choiceList">${body}<button class="choice" data-close-pure-synergies><b>닫기</b></button></div>`;
    if(!showModal(runtimeRoot,html))return false;const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),close=doc?.querySelector?.('[data-close-pure-synergies]');if(close)close.onclick=()=>{if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else doc?.getElementById?.('overlay')?.classList.remove('show')};return true;
  }
  function renderMapPureSynergySummary(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const summary=synergySummary(runState),build=doc.getElementById?.('mapBuild'),host=build?.parentElement?.parentElement;let badge=doc.getElementById?.('mapPureSynergyBadge');
    if(host&&!badge){badge=doc.createElement('button');badge.id='mapPureSynergyBadge';badge.className='badge';badge.type='button';host.appendChild(badge)}
    if(badge){badge.innerHTML=`순수 <b>${summary.deck.pure}/${summary.deck.size}</b> · 시너지 <b>${summary.count}</b>`;badge.title=summary.names.join(', ')||'활성 순수 시너지 없음';badge.onclick=()=>showPureSynergyCollection(runtimeRoot)}return summary;
  }
  function renderBattlePureSynergyButton(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const summary=synergySummary(runState),sub=doc.getElementById?.('battleSub');let button=doc.getElementById?.('activePureSynergyButton');
    if(!summary.count){button?.remove?.();return summary}if(!sub)return summary;
    if(!button){button=doc.createElement('button');button.id='activePureSynergyButton';button.className='badge';button.type='button';const anchor=doc.getElementById?.('activeSynergyButton')||doc.getElementById?.('activeClauseButton')||doc.getElementById?.('activeRelicButton');if(anchor)anchor.insertAdjacentElement('afterend',button);else sub.appendChild(button)}
    button.textContent=`순수 시너지 ${summary.count}`;button.title=summary.names.join(', ');button.onclick=()=>showPureSynergyCollection(runtimeRoot);return summary;
  }
  function wrapRenderMap(runtimeRoot=root){const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__pureSynergy9DAdapter)return true;const wrapped=function(...args){const result=original.apply(this,args);renderMapPureSynergySummary(runtimeRoot);return result};wrapped.__pureSynergy9DAdapter=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true}
  function wrapRenderBattle(runtimeRoot=root){const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__pureSynergy9DAdapter)return true;const wrapped=function(...args){const result=original.apply(this,args);renderBattlePureSynergyButton(runtimeRoot);return result};wrapped.__pureSynergy9DAdapter=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true}
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;registerPureConditions();const errors=validateSynergyRegistry();if(errors.length){runtimeRoot?.console?.error?.('[9-D] 순수 카드 시너지 정의 오류',errors);return false}
    if(typeof runtimeRoot?.renderMap!=='function'||typeof runtimeRoot?.renderBattle!=='function'||!CombatEffects?.activeEffectOwners)return false;
    installCombatOwnerAdapter();wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[9-D] 순수 카드 시너지 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,CONDITION_NAMES,PURE_SYNERGY_DEFINITIONS,registerPureConditions,pureCount,pureDeckStats,requirementMet,requirementText,synergyDefinition,validateRequirement,validateSynergyDefinition,validateSynergyRegistry,isSynergyActive,activeSynergyIds,makeSynergyOwner,activeSynergyOwners,installCombatOwnerAdapter,synergySummary,showPureSynergyCollection,renderMapPureSynergySummary,renderBattlePureSynergyButton,wrapRenderMap,wrapRenderBattle,installBrowserRuntime,installWhenReady,activeRun};
});