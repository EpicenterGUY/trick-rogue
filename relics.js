(function(root,factory){
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const api=factory(CardEffects,root);
  if(typeof module!=='undefined')module.exports=api;
  root.RelicSystem=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,root){
  const STAGE='6-2B';
  const RELIC_REWARD_TYPES=Object.freeze(['elite','boss']);
  const RELIC_DEFINITIONS=Object.freeze({
    reinforced_buckle:Object.freeze({
      id:'reinforced_buckle',name:'보강 버클',rarity:'common',description:'세트 시작 시 보호막 +4.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'gain_shield',value:4,duration:'run'})])
    }),
    victory_bandage:Object.freeze({
      id:'victory_bandage',name:'승리 붕대',rarity:'common',description:'트릭 승리 시 체력 +1.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_trick_win',action:'heal_player',value:1,duration:'run'})])
    }),
    losers_token:Object.freeze({
      id:'losers_token',name:'패자의 토큰',rarity:'common',description:'트릭 패배 시 칩 +1.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_trick_loss',action:'gain_chips',value:1,duration:'run'})])
    }),
    draw_coin:Object.freeze({
      id:'draw_coin',name:'무승부 동전',rarity:'common',description:'트릭 무승부 시 칩 +1.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_trick_draw',action:'gain_chips',value:1,duration:'run'})])
    }),
    cracked_abacus:Object.freeze({
      id:'cracked_abacus',name:'금 간 주판',rarity:'uncommon',description:'쇼다운 위력 +3.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_showdown_score',action:'showdown_power',value:3,duration:'run'})])
    }),
    rusty_needle:Object.freeze({
      id:'rusty_needle',name:'녹슨 바늘',rarity:'uncommon',description:'세트 시작 시 적에게 출혈 1.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'apply_enemy_bleed',value:1,duration:'run'})])
    }),
    sprout_brooch:Object.freeze({
      id:'sprout_brooch',name:'새싹 브로치',rarity:'uncommon',description:'세트 시작 시 재생 2를 얻는다.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'player',statusId:'regen',amount:2}),duration:'run'})])
    }),
    cracked_target:Object.freeze({
      id:'cracked_target',name:'금 간 표적',rarity:'uncommon',description:'세트 시작 시 적에게 취약 2를 부여한다.',effectOwnerType:'relic',
      effects:Object.freeze([Object.freeze({trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'vulnerable',amount:2}),duration:'run'})])
    })
  });
  let originalShowReward=null;

  function relicDefinition(id){return RELIC_DEFINITIONS[id]||null}
  function validateRelicDefinition(definition,id=definition?.id){
    const errors=[];
    if(!definition||typeof definition!=='object')return['relic definition must be an object'];
    if(!definition.id)errors.push('missing id');
    if(id&&definition.id!==id)errors.push(`id mismatch ${definition.id}`);
    if(!definition.name)errors.push('missing name');
    if(!definition.description)errors.push('missing description');
    if(!['common','uncommon','rare'].includes(definition.rarity))errors.push(`unknown rarity ${definition.rarity}`);
    if(definition.effectOwnerType!=='relic')errors.push('effectOwnerType must be relic');
    const effectErrors=CardEffects?.validateEffectList?CardEffects.validateEffectList(definition.effects,{requireTrigger:true,requireDuration:true}):[];
    errors.push(...effectErrors);
    for(const effect of definition.effects||[])if(effect.duration!=='run')errors.push('relic effects must use run duration');
    return errors;
  }
  function validateRelicRegistry(registry=RELIC_DEFINITIONS){
    return Object.entries(registry).flatMap(([id,definition])=>validateRelicDefinition(definition,id).map(error=>`${id}: ${error}`));
  }
  function makeRelic(id){
    const definition=relicDefinition(id);if(!definition)throw new TypeError(`Unknown relic: ${String(id)}`);
    return{...definition,effects:definition.effects.map(effect=>({...effect}))};
  }
  function relicId(value){return typeof value==='string'?value:value?.id||null}
  function ensureRelicState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('relic state requires a run');
    const seen=new Set(),relics=[];
    for(const raw of Array.isArray(runState.relics)?runState.relics:[]){
      const id=relicId(raw);if(!relicDefinition(id)||seen.has(id))continue;seen.add(id);
      relics.push(raw&&typeof raw==='object'&&Array.isArray(raw.effects)?raw:makeRelic(id));
    }
    runState.relics=relics;
    const current=runState.relicState&&typeof runState.relicState==='object'?runState.relicState:{};
    runState.relicState={...current,version:STAGE,history:Array.isArray(current.history)?current.history:[],rewardedNodes:[...new Set(Array.isArray(current.rewardedNodes)?current.rewardedNodes:[])]};
    return runState.relicState;
  }
  function ownedRelicIds(runState){ensureRelicState(runState);return runState.relics.map(relic=>relic.id)}
  function acquireRelic(runState,id,{source='unknown'}={}){
    const definition=relicDefinition(id);if(!definition)throw new TypeError(`Unknown relic: ${String(id)}`);
    const state=ensureRelicState(runState),existing=runState.relics.find(relic=>relic.id===id);
    if(existing)return{relic:existing,alreadyOwned:true,added:false};
    const relic=makeRelic(id);runState.relics.push(relic);
    const history={step:state.history.length+1,action:'acquire',source,id};state.history.push(history);
    return{relic,alreadyOwned:false,added:true,history};
  }
  function rewardPool(runState){
    const owned=new Set(ownedRelicIds(runState));return Object.keys(RELIC_DEFINITIONS).filter(id=>!owned.has(id));
  }
  function shuffleCopy(items,random=Math.random){
    const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result;
  }
  function rewardOptions(runState,count=3,random=Math.random){return shuffleCopy(rewardPool(runState),random).slice(0,Math.max(0,count|0))}
  function rewardType(node){return node?.type||null}
  function isRelicRewardNode(node){return RELIC_REWARD_TYPES.includes(rewardType(node))}
  function rewardClaimed(runState,nodeId){return ensureRelicState(runState).rewardedNodes.includes(nodeId)}
  function markRewardClaimed(runState,nodeId){
    const state=ensureRelicState(runState);if(!state.rewardedNodes.includes(nodeId))state.rewardedNodes.push(nodeId);return state;
  }
  function activeRun(runtimeRoot=root){
    try{if(typeof run!=='undefined'&&run)return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function activeBattle(runtimeRoot=root){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function rarityLabel(rarity){return rarity==='uncommon'?'고급':rarity==='rare'?'희귀':'일반'}
  function relicSummary(runState){
    if(!runState)return{count:0,names:[]};ensureRelicState(runState);return{count:runState.relics.length,names:runState.relics.map(relic=>relic.name)};
  }
  function showModal(runtimeRoot,html){
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');
    if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true;
  }
  function showRelicCollection(runtimeRoot=root){
    const runState=activeRun(runtimeRoot);if(!runState)return false;ensureRelicState(runState);
    const body=runState.relics.length?runState.relics.map(relic=>`<div class="choice"><b>◆ ${escapeHtml(relic.name)}</b><span>${escapeHtml(relic.description)} · ${rarityLabel(relic.rarity)} 유물</span></div>`).join(''):'<div class="choice"><b>보유 유물 없음</b><span>엘리트와 보스 보상에서 유물을 얻을 수 있다.</span></div>';
    const html=`<h2>유물 · ${runState.relics.length}개</h2><p>유물은 획득한 런 동안 유지되며 카드와 별개의 효과 소유자로 발동한다.</p><div class="choiceList">${body}<button class="choice" data-close-relic-list><b>닫기</b></button></div>`;
    if(!showModal(runtimeRoot,html))return false;
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),close=doc?.querySelector?.('[data-close-relic-list]');
    if(close)close.onclick=()=>{if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();else doc?.getElementById?.('overlay')?.classList.remove('show')};
    return true;
  }
  function continueCardReward(runtimeRoot,node){return typeof originalShowReward==='function'?originalShowReward.call(runtimeRoot,node):false}
  function showRelicReward(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot);if(!runState||!isRelicRewardNode(node)||rewardClaimed(runState,node.id))return false;
    const random=typeof runtimeRoot?.random==='function'?runtimeRoot.random:Math.random,options=rewardOptions(runState,3,random);
    if(!options.length){markRewardClaimed(runState,node.id);return continueCardReward(runtimeRoot,node)}
    const boxes=options.map(id=>{const relic=relicDefinition(id);return `<button class="choice" data-relic-reward="${escapeHtml(id)}"><b>◆ ${escapeHtml(relic.name)}</b><span>${escapeHtml(relic.description)} · ${rarityLabel(relic.rarity)} 유물</span></button>`}).join('');
    const html=`<h2>유물 보상 · ${node.type==='boss'?'보스':'엘리트'}</h2><p>하나를 선택한다. 획득한 유물은 이번 런 동안 계속 발동하며, 선택 뒤 기존 카드 보상도 이어진다.</p><div class="choiceList">${boxes}</div>`;
    if(!showModal(runtimeRoot,html))return false;
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);
    doc?.querySelectorAll?.('[data-relic-reward]')?.forEach(button=>{button.onclick=()=>takeRelicReward(runtimeRoot,button.dataset.relicReward,node.id)});
    return options;
  }
  function takeRelicReward(runtimeRoot=root,id,nodeId){
    const runState=activeRun(runtimeRoot);if(!runState)return{ok:false,reason:'no_run'};
    const node=Array.isArray(runState.map)?runState.map.find(entry=>entry.id===nodeId):null;
    if(!node||!isRelicRewardNode(node))return{ok:false,reason:'invalid_node'};
    if(rewardClaimed(runState,nodeId))return{ok:false,reason:'claimed'};
    const result=acquireRelic(runState,id,{source:`reward:${nodeId}`});markRewardClaimed(runState,nodeId);
    if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('reward');
    continueCardReward(runtimeRoot,node);return{ok:true,...result};
  }
  function renderMapRelicSummary(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;
    const summary=relicSummary(runState),build=doc.getElementById?.('mapBuild'),host=build?.parentElement?.parentElement;let badge=doc.getElementById?.('mapRelicsBadge');
    if(host&&!badge){badge=doc.createElement('button');badge.id='mapRelicsBadge';badge.className='badge';badge.type='button';host.appendChild(badge)}
    if(badge){badge.innerHTML=`유물 <b>${summary.count}</b>`;badge.title=summary.names.join(', ')||'보유 유물 없음';badge.onclick=()=>showRelicCollection(runtimeRoot)}
    return summary;
  }
  function renderBattleRelicButton(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;
    const summary=relicSummary(runState),sub=doc.getElementById?.('battleSub');let button=doc.getElementById?.('activeRelicButton');
    if(!summary.count){button?.remove?.();return summary}
    if(!sub)return summary;
    if(!button){button=doc.createElement('button');button.id='activeRelicButton';button.className='badge';button.type='button';const rule=doc.getElementById?.('encounterRuleInfoButton');(rule||sub).insertAdjacentElement('afterend',button)}
    button.textContent=`유물 보기 · ${summary.count}`;button.title=summary.names.join(', ');button.onclick=()=>showRelicCollection(runtimeRoot);return summary;
  }
  function wrapBeginRun(runtimeRoot=root){
    if(typeof runtimeRoot?.beginRun!=='function')return false;if(runtimeRoot.beginRun.__relicSystemAdapter)return true;const original=runtimeRoot.beginRun;
    const wrapped=function(...args){const result=original.apply(this,args),runState=activeRun(runtimeRoot);if(runState)ensureRelicState(runState);if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();return result};
    wrapped.__relicSystemAdapter=true;wrapped.__legacyBeginRun=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapShowReward(runtimeRoot=root){
    if(typeof runtimeRoot?.showReward!=='function')return false;if(runtimeRoot.showReward.__relicSystemAdapter)return true;originalShowReward=runtimeRoot.showReward;
    const wrapped=function(node,...args){const runState=activeRun(runtimeRoot);if(runState&&isRelicRewardNode(node)&&!rewardClaimed(runState,node.id)){const shown=showRelicReward(runtimeRoot,node);if(shown)return shown}return originalShowReward.call(this,node,...args)};
    wrapped.__relicSystemAdapter=true;wrapped.__legacyShowReward=originalShowReward;runtimeRoot.showReward=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=root){
    if(typeof runtimeRoot?.renderMap!=='function')return false;if(runtimeRoot.renderMap.__relicSystemAdapter)return true;const original=runtimeRoot.renderMap;
    const wrapped=function(...args){const result=original.apply(this,args);renderMapRelicSummary(runtimeRoot);return result};
    wrapped.__relicSystemAdapter=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function wrapRenderBattle(runtimeRoot=root){
    if(typeof runtimeRoot?.renderBattle!=='function')return false;if(runtimeRoot.renderBattle.__relicSystemAdapter)return true;const original=runtimeRoot.renderBattle;
    const wrapped=function(...args){const result=original.apply(this,args);renderBattleRelicButton(runtimeRoot);return result};
    wrapped.__relicSystemAdapter=true;wrapped.__legacyRenderBattle=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(typeof runtimeRoot?.beginRun!=='function'||typeof runtimeRoot?.showReward!=='function'||typeof runtimeRoot?.renderMap!=='function'||typeof runtimeRoot?.renderBattle!=='function')return false;
    wrapBeginRun(runtimeRoot);wrapShowReward(runtimeRoot);wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;
    const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else console.warn('[relics] 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,RELIC_REWARD_TYPES,RELIC_DEFINITIONS,relicDefinition,validateRelicDefinition,validateRelicRegistry,makeRelic,ensureRelicState,ownedRelicIds,acquireRelic,rewardPool,rewardOptions,isRelicRewardNode,rewardClaimed,markRewardClaimed,relicSummary,showRelicCollection,showRelicReward,takeRelicReward,renderMapRelicSummary,renderBattleRelicButton,wrapBeginRun,wrapShowReward,wrapRenderMap,wrapRenderBattle,installBrowserRuntime,installWhenReady,activeRun,activeBattle};
});