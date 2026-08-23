(function(root,factory){
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const CombatEffects=typeof module!=='undefined'?require('./combat-effects.js'):root.CombatEffects;
  const ChipEconomy=typeof module!=='undefined'?require('./chip-economy.js'):root.ChipEconomy;
  const api=factory(CardEffects,CombatEffects,ChipEconomy,root);
  if(typeof module!=='undefined')module.exports=api;
  root.ChipBuilds9E=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,CombatEffects,ChipEconomy,root){
  const STAGE='9-E';
  const CONDITION_NAMES=Object.freeze(['chips_at_least','chips_spent_at_least','hand_exchange_used_this_trick']);
  const CHIP_BUILD_DEFINITIONS=Object.freeze({
    working_capital:Object.freeze({
      id:'working_capital',name:'운영 자금',
      description:'덱에 칩 연계 카드가 3장 이상이면 세트 시작 시 칩 +1.',
      requirement:Object.freeze({minChipCards:3}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'gain_chips',value:1,duration:'run'})])
    }),
    full_stack_dividend:Object.freeze({
      id:'full_stack_dividend',name:'풀스택 배당',
      description:'덱에 칩 연계 카드가 4장 이상이면 쇼다운 시 칩이 5개일 때 쇼다운 위력 +6.',
      requirement:Object.freeze({minChipCards:4}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_showdown_score',condition:'chips_at_least',conditionValue:5,action:'showdown_power',value:6,duration:'run'})])
    }),
    exchange_receipt:Object.freeze({
      id:'exchange_receipt',name:'교환 영수증',
      description:'덱에 칩 연계 카드가 4장 이상이면 이번 트릭에 2칩 손패 교환을 사용한 뒤 카드를 낼 때 보호막 +3.',
      requirement:Object.freeze({minChipCards:4}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_play',condition:'hand_exchange_used_this_trick',action:'gain_shield',value:3,duration:'run'})])
    }),
    turnover_bonus:Object.freeze({
      id:'turnover_bonus',name:'회전 보너스',
      description:'덱에 칩 연계 카드가 5장 이상이면 이번 전투에서 칩을 4개 이상 소비한 뒤 쇼다운 위력 +8.',
      requirement:Object.freeze({minChipCards:5}),effectOwnerType:'passive',
      effects:Object.freeze([Object.freeze({trigger:'on_showdown_score',condition:'chips_spent_at_least',conditionValue:4,action:'showdown_power',value:8,duration:'run'})])
    })
  });
  let installed=false;

  function effectList(card){
    if(Array.isArray(card?.effects))return card.effects;
    if(Array.isArray(card?.definition?.effects))return card.definition.effects;
    if(Array.isArray(card?.named?.effects))return card.named.effects;
    return [];
  }
  function chipCardRoles(card){
    const effects=effectList(card),generator=effects.some(effect=>effect?.action==='gain_chips');
    const spender=effects.some(effect=>effect?.condition==='chips_spent'||effect?.condition==='chips_spent_at_least'||effect?.condition==='hand_exchange_used_this_trick');
    return Object.freeze({generator,spender,linked:generator||spender});
  }
  function isChipLinkedCard(card){return chipCardRoles(card).linked}
  function chipDeckStats(runState){
    const deck=Array.isArray(runState?.deck)?runState.deck.filter(Boolean):[];
    let generators=0,spenders=0,chipCards=0;
    for(const card of deck){const roles=chipCardRoles(card);if(roles.linked)chipCards++;if(roles.generator)generators++;if(roles.spender)spenders++}
    return Object.freeze({size:deck.length,chipCards,generators,spenders,ratio:deck.length?chipCards/deck.length:0});
  }
  function currentChipBalance(context){
    const state=context?.battle||context?.state||null;
    if(!state)return 0;
    return Math.max(0,Math.floor(Number(state?.chipEconomy?.balance??state?.chip)||0));
  }
  function spentChipCount(context){return Math.max(0,Math.floor(Number(context?.history?.chipsSpent??context?.battle?.history?.chipsSpent)||0))}
  function exchangeUsedThisTrick(context){
    const state=context?.battle||context?.state||null;if(!state?.chipEconomy)return false;
    const key=typeof ChipEconomy?.trickKey==='function'?ChipEconomy.trickKey(state,context):`${context?.setIndex??context?.set??state?.setIndex??1}:${context?.trick??state?.trick??1}`;
    return state.chipEconomy.lastExchangeKey===key;
  }
  function registerChipConditions(){
    if(!CardEffects?.conditions)return false;
    CardEffects.conditions.chips_at_least=(context,effect)=>currentChipBalance(context)>=Math.max(0,Math.floor(Number(effect?.conditionValue)||0));
    CardEffects.conditions.chips_spent_at_least=(context,effect)=>spentChipCount(context)>=Math.max(1,Math.floor(Number(effect?.conditionValue)||1));
    CardEffects.conditions.hand_exchange_used_this_trick=context=>exchangeUsedThisTrick(context);
    return true;
  }
  registerChipConditions();

  function requirementMet(requirement,stats){
    if(!requirement||!stats)return false;
    if(Number.isFinite(requirement.minChipCards)&&stats.chipCards<requirement.minChipCards)return false;
    if(Number.isFinite(requirement.minGenerators)&&stats.generators<requirement.minGenerators)return false;
    if(Number.isFinite(requirement.minSpenders)&&stats.spenders<requirement.minSpenders)return false;
    return true;
  }
  function buildDefinition(id){return CHIP_BUILD_DEFINITIONS[id]||null}
  function validateRequirement(requirement){
    const errors=[];if(!requirement||typeof requirement!=='object')return['missing requirement'];
    for(const key of ['minChipCards','minGenerators','minSpenders'])if(requirement[key]!==undefined&&(!Number.isInteger(requirement[key])||requirement[key]<0))errors.push(`invalid ${key}`);
    if(!(Number(requirement.minChipCards)>0||Number(requirement.minGenerators)>0||Number(requirement.minSpenders)>0))errors.push('chip build requires a positive threshold');
    return errors;
  }
  function validateBuildDefinition(definition,id=definition?.id){
    const errors=[];
    if(!definition||typeof definition!=='object')return['chip build definition must be an object'];
    if(!definition.id)errors.push('missing id');if(id&&definition.id!==id)errors.push(`id mismatch ${definition.id}`);
    if(!definition.name)errors.push('missing name');if(!definition.description)errors.push('missing description');
    if(definition.effectOwnerType!=='passive')errors.push('effectOwnerType must be passive');
    errors.push(...validateRequirement(definition.requirement));
    const effectErrors=CardEffects?.validateEffectList?CardEffects.validateEffectList(definition.effects,{requireTrigger:true,requireDuration:true}):[];errors.push(...effectErrors);
    for(const effect of definition.effects||[])if(effect.duration!=='run')errors.push('chip build effects must use run duration');
    return errors;
  }
  function validateBuildRegistry(registry=CHIP_BUILD_DEFINITIONS){return Object.entries(registry).flatMap(([id,definition])=>validateBuildDefinition(definition,id).map(error=>`${id}: ${error}`))}
  function isBuildActive(definition,runState){return!!definition&&requirementMet(definition.requirement,chipDeckStats(runState))}
  function activeBuildIds(runState){return Object.keys(CHIP_BUILD_DEFINITIONS).filter(id=>isBuildActive(CHIP_BUILD_DEFINITIONS[id],runState))}
  function makeBuildOwner(id){const definition=buildDefinition(id);if(!definition)throw new TypeError(`Unknown 9-E chip build: ${String(id)}`);return{...definition,requirement:{...definition.requirement},effects:definition.effects.map(effect=>({...effect}))}}
  function activeBuildOwners(runState){return activeBuildIds(runState).map(id=>({source:makeBuildOwner(id),ownerType:'passive',ownerId:`chip-build:${id}`}))}
  function installCombatOwnerAdapter(){
    if(!CombatEffects||typeof CombatEffects.activeEffectOwners!=='function')return false;if(CombatEffects.activeEffectOwners.__chipBuild9EAdapter)return true;
    const original=CombatEffects.activeEffectOwners;
    const wrapped=function(state,runState){const owners=original.call(this,state,runState)||[],seen=new Set(owners.map(entry=>`${entry?.ownerType||''}:${entry?.ownerId||''}`));for(const entry of activeBuildOwners(runState)){const key=`${entry.ownerType}:${entry.ownerId}`;if(!seen.has(key)){seen.add(key);owners.push(entry)}}return owners};
    wrapped.__chipBuild9EAdapter=true;wrapped.__legacyActiveEffectOwners=original;CombatEffects.activeEffectOwners=wrapped;return true;
  }
  function requirementText(requirement){return `칩 연계 카드 ${Math.max(0,Number(requirement?.minChipCards)||0)}장 이상`}
  function buildSummary(runState,battleState=null){const stats=chipDeckStats(runState),ids=activeBuildIds(runState);return{stage:STAGE,count:ids.length,total:Object.keys(CHIP_BUILD_DEFINITIONS).length,ids,names:ids.map(id=>CHIP_BUILD_DEFINITIONS[id].name),deck:stats,battle:battleState?{chips:currentChipBalance({battle:battleState}),spent:spentChipCount({battle:battleState})}:null}}
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function activeBattle(runtimeRoot=root){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function showModal(runtimeRoot,html){if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true}
  function showChipBuildCollection(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;const state=activeBattle(runtimeRoot),summary=buildSummary(runState,state),active=new Set(summary.ids);
    const body=Object.values(CHIP_BUILD_DEFINITIONS).map(definition=>{const on=active.has(definition.id);return`<div class="choice"><b class="${on?'green':'small'}">${on?'◆ 활성':'◇ 미완성'} · ${escapeHtml(definition.name)}</b><span>${escapeHtml(definition.description)}<br>조건: ${escapeHtml(requirementText(definition.requirement))}</span></div>`}).join('');
    const battleLine=summary.battle?` · 현재 칩 ${summary.battle.chips}/${ChipEconomy?.CHIP_CAP||5} · 소비 ${summary.battle.spent}`:'';
    const html=`<h2>칩 특화 빌드 · ${summary.count}/${summary.total}</h2><p>현재 덱 ${summary.deck.size}장 중 칩 연계 ${summary.deck.chipCards}장 · 생성 ${summary.deck.generators}장 · 소비 보상 ${summary.deck.spenders}장${battleLine}. 기본 칩 최대 5와 손패 교환 2칩 규칙은 그대로 유지된다.</p><div class="choiceList">${body}<button class="choice" data-close-chip-builds><b>닫기</b></button></div>`;
    if(!showModal(runtimeRoot,html))return false;const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),close=doc?.querySelector?.('[data-close-chip-builds]');if(close)close.onclick=()=>{if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else doc?.getElementById?.('overlay')?.classList.remove('show')};return true;
  }
  function renderMapChipBuildSummary(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const summary=buildSummary(runState),build=doc.getElementById?.('mapBuild'),host=build?.parentElement?.parentElement;let badge=doc.getElementById?.('mapChipBuildBadge');
    if(host&&!badge){badge=doc.createElement('button');badge.id='mapChipBuildBadge';badge.className='badge';badge.type='button';host.appendChild(badge)}if(badge){badge.innerHTML=`칩 카드 <b>${summary.deck.chipCards}</b> · 시너지 <b>${summary.count}</b>`;badge.title=summary.names.join(', ')||'활성 칩 시너지 없음';badge.onclick=()=>showChipBuildCollection(runtimeRoot)}return summary;
  }
  function renderBattleChipBuildButton(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const summary=buildSummary(runState,activeBattle(runtimeRoot)),sub=doc.getElementById?.('battleSub');let button=doc.getElementById?.('activeChipBuildButton');if(!summary.count){button?.remove?.();return summary}if(!sub)return summary;
    if(!button){button=doc.createElement('button');button.id='activeChipBuildButton';button.className='badge';button.type='button';const anchor=doc.getElementById?.('activePureSynergyButton')||doc.getElementById?.('activeSynergyButton')||doc.getElementById?.('activeRelicButton');if(anchor)anchor.insertAdjacentElement('afterend',button);else sub.appendChild(button)}button.textContent=`칩 시너지 ${summary.count}`;button.title=summary.names.join(', ');button.onclick=()=>showChipBuildCollection(runtimeRoot);return summary;
  }
  function wrapRenderMap(runtimeRoot=root){const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__chipBuild9EAdapter)return true;const wrapped=function(...args){const result=original.apply(this,args);renderMapChipBuildSummary(runtimeRoot);return result};wrapped.__chipBuild9EAdapter=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true}
  function wrapRenderBattle(runtimeRoot=root){const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__chipBuild9EAdapter)return true;const wrapped=function(...args){const result=original.apply(this,args);renderBattleChipBuildButton(runtimeRoot);return result};wrapped.__chipBuild9EAdapter=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true}
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;registerChipConditions();const errors=validateBuildRegistry();if(errors.length){runtimeRoot?.console?.error?.('[9-E] 칩 특화 빌드 정의 오류',errors);return false}if(typeof runtimeRoot?.renderMap!=='function'||typeof runtimeRoot?.renderBattle!=='function'||!CombatEffects?.activeEffectOwners||!ChipEconomy?.grantChips)return false;
    installCombatOwnerAdapter();wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[9-E] 칩 특화 빌드 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function resetForTests(){installed=false;registerChipConditions()}
  return{STAGE,CONDITION_NAMES,CHIP_BUILD_DEFINITIONS,effectList,chipCardRoles,isChipLinkedCard,chipDeckStats,currentChipBalance,spentChipCount,exchangeUsedThisTrick,registerChipConditions,requirementMet,requirementText,buildDefinition,validateRequirement,validateBuildDefinition,validateBuildRegistry,isBuildActive,activeBuildIds,makeBuildOwner,activeBuildOwners,installCombatOwnerAdapter,buildSummary,showChipBuildCollection,renderMapChipBuildSummary,renderBattleChipBuildButton,wrapRenderMap,wrapRenderBattle,installBrowserRuntime,installWhenReady,activeRun,activeBattle,resetForTests};
});
