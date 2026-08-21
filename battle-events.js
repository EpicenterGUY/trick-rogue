(function(root,factory){
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const NodeCombatEffects=typeof module!=='undefined'?require('./combat-effects.js'):null;
  const api=factory(CardEffects,NodeCombatEffects,root);
  if(typeof module!=='undefined')module.exports=api;
  root.BattleEvents=api;
  if(typeof document!=='undefined')api.installWhenReady();
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,NodeCombatEffects,root){
  const SHOWDOWN_TRIGGERS=Object.freeze(['before_showdown','on_showdown_advantage','on_showdown_score','after_showdown_result']);
  const SET_TRIGGERS=Object.freeze(['on_set_start','on_set_end',...SHOWDOWN_TRIGGERS]);
  const RESULT_TRIGGERS=Object.freeze(['on_trick_win','on_trick_loss','on_trick_draw']);
  const LIFECYCLE_ORDER=Object.freeze([
    'on_set_start','on_trick_start','on_play','before_compare','after_compare',
    'on_trick_win/on_trick_loss/on_trick_draw','after_card_slotted','on_trick_end',
    'before_showdown','on_showdown_advantage','on_showdown_score','after_showdown_result','on_set_end'
  ]);
  const stateTrackers=new WeakMap();
  let installed=false;
  let originalRunCardEffects=null;
  let originalNextEnemy=null;
  let originalShowdown=null;
  let originalWinBattle=null;
  let originalLoseRun=null;

  function combatEffects(){return NodeCombatEffects||root.CombatEffects||null}
  function runtimeBattle(){
    try{return typeof battle!=='undefined'?battle:root.battle}catch(_error){return root.battle||null}
  }
  function runtimeRun(){
    try{return typeof run!=='undefined'?run:root.run}catch(_error){return root.run||null}
  }
  function trackerFor(state){
    if(!state||typeof state!=='object')return null;
    let tracker=stateTrackers.get(state);
    if(!tracker){tracker={globalSeen:new Set(),chains:new Map(),lastSetStarted:null,lastTrickStarted:null,lastTrickExpired:null,battleExpired:false};stateTrackers.set(state,tracker)}
    return tracker;
  }
  function resetBattleEventState(state){if(state&&typeof state==='object')stateTrackers.delete(state)}
  function resultName(trigger,extra={}){
    if(trigger==='on_trick_win')return'player';
    if(trigger==='on_trick_loss')return'enemy';
    if(trigger==='on_trick_draw')return'draw';
    return extra.resultSide??extra.resultName??extra.result;
  }
  function eventScopeToken(trigger,state,extra={}){
    const setIndex=extra.setIndex??extra.set??state?.setIndex??0;
    const trick=extra.trick??state?.trick??0;
    if(extra.eventToken)return String(extra.eventToken);
    if(SET_TRIGGERS.includes(trigger))return`set:${setIndex}:${trigger}`;
    return`set:${setIndex}:trick:${trick}:${trigger}`;
  }
  function eventChain(trigger,state,extra={}){
    const tracker=trackerFor(state);if(!tracker)return extra.effectChain||CardEffects.createEffectChain();
    const token=eventScopeToken(trigger,state,extra);
    if(extra.effectChain){tracker.chains.set(token,extra.effectChain);return extra.effectChain}
    if(!tracker.chains.has(token))tracker.chains.set(token,CardEffects.createEffectChain({id:`battle-event:${token}`}));
    return tracker.chains.get(token);
  }
  function createBattleEventContext(trigger,state,runState,extra={}){
    const hasEnemyCard=Object.prototype.hasOwnProperty.call(extra,'enemyCard');
    const enemyCard=hasEnemyCard?extra.enemyCard:state?.enemyCard??null;
    return{
      battle:state,runState,setIndex:extra.setIndex??state?.setIndex??1,set:extra.set??extra.setIndex??state?.setIndex??1,
      trick:extra.trick??state?.trick??1,phase:extra.phase??state?.phase??'trick',trigger,
      trump:extra.trump??state?.trump??null,currentTrump:extra.currentTrump??extra.trump??state?.trump??null,
      enemyCard,enemyRevealed:extra.enemyRevealed??enemyCard!==null,
      history:extra.history??state?.history??null,setHistory:extra.setHistory??state?.setHistory??null,
      statuses:extra.statuses??state?.statuses??null,reservations:extra.reservations??state?.reservations??null,
      advantage:extra.advantage??state?.advantage??null,result:resultName(trigger,extra),...extra
    };
  }
  function nonCardOwners(state,runState){
    const Combat=combatEffects();if(!Combat?.activeEffectOwners)return[];
    return Combat.activeEffectOwners(state,runState).filter(owner=>owner.ownerType!=='card');
  }
  function updateHistory(state,key,amount){if(state?.history&&Number.isFinite(state.history[key]))state.history[key]+=amount}
  function runtimePerform(state,runState,context,fallbackPerform){
    const Combat=combatEffects();
    return function perform(action,value,effect={}){
      if(typeof fallbackPerform==='function'){
        const handled=fallbackPerform(action,value,effect,context);
        if(handled===true)return;
      }
      if(action==='damage_enemy'){
        const dealt=typeof root.damageEnemy==='function'?root.damageEnemy(Number(value)||0):0;updateHistory(state,'damageDealt',Number(dealt)||0);return;
      }
      if(action==='heal_player'){
        const healed=typeof root.heal==='function'?root.heal(Number(value)||0):0;updateHistory(state,'healingDone',Number(healed)||0);return;
      }
      if(action==='gain_chips'){
        if(state)state.chip=Math.min(9,(Number(state.chip)||0)+(Number(value)||0));return;
      }
      if(action==='gain_shield'){
        if(Combat?.addStatus&&state?.statuses){Combat.addStatus(state.statuses,'player','shield',Number(value)||0);return}
      }
      if(action==='apply_enemy_bleed'){
        if(Combat?.addStatus&&state?.statuses){Combat.addStatus(state.statuses,'enemy','bleed',Number(value)||0);return}
      }
      if(action==='increase_enemy_forecast'){
        if(state)state.enemyForecast=Math.min(3,(Number(state.enemyForecast)||0)+(Number(value)||0));return;
      }
      if(action==='increase_forecast'){
        if(state)state.myForecast=Math.min(3,(Number(state.myForecast)||0)+(Number(value)||0));return;
      }
      if(action==='draw_tactic'){
        if(typeof root.drawT==='function')root.drawT(Number(value)||0);return;
      }
      if(action==='draw_cards'){
        if(typeof root.drawP==='function')root.drawP(Number(value)||0);return;
      }
      if(action==='showdown_power'){
        if(context.score&&Number.isFinite(context.score.value)){context.score.value+=Number(value)||0;return}
      }
      if(action==='reserve_next_win_damage'){
        if(Array.isArray(state?.reservations)){
          const setIndex=state.setIndex||1,trick=state.trick||1;
          state.reservations.push(CardEffects.createReservation({type:'nextWinDamage',value:Number(value)||0,eligibleSet:trick===5?setIndex+1:setIndex,eligibleTrick:trick===5?1:trick+1,ownerType:context.owner?.type,ownerId:context.owner?.id,label:`다음 승리 피해 ${Number(value)||0}`}));return;
        }
      }
      if(action==='set_next_trick_suit_to_trump'){if(state?.mods){state.mods.paint=true;return}}
      if(action==='increase_next_trick_rank'){if(state?.mods){state.mods.plus=(Number(state.mods.plus)||0)+(Number(value)||0);return}}
      if(action==='set_reverse_compare'){if(state?.mods){state.mods.reverse=true;return}}
      if(action==='increase_effective_rank'&&context.card){context.card.effectiveRankBonus=(context.card.effectiveRankBonus||0)+(Number(value)||0);return}
      throw new TypeError(`Battle event owner cannot perform action without a runtime handler: ${action}`);
    };
  }
  function dispatchNonCardOwnersOnce(trigger,{state,runState,extra={},perform,fallbackPerform}={}){
    if(!state)return 0;
    const tracker=trackerFor(state),token=eventScopeToken(trigger,state,extra);
    if(tracker.globalSeen.has(token))return 0;
    tracker.globalSeen.add(token);
    const owners=nonCardOwners(state,runState);if(!owners.length)return 0;
    const chain=eventChain(trigger,state,extra),context=createBattleEventContext(trigger,state,runState,{...extra,effectChain:chain});
    context.perform=perform||runtimePerform(state,runState,context,fallbackPerform);
    return CardEffects.dispatchOwners(trigger,owners,context);
  }
  function dispatchBattleEvent(trigger,{state,runState,primaryCard,extra={},primaryRunner,perform,fallbackPerform}={}){
    if(!CardEffects.TRIGGERS.includes(trigger))throw new TypeError(`Unknown battle trigger: ${trigger}`);
    const chain=eventChain(trigger,state,extra),context=createBattleEventContext(trigger,state,runState,{...extra,effectChain:chain});
    let primaryExecuted=0;
    if(primaryCard){
      if(typeof primaryRunner==='function'){primaryRunner(trigger,primaryCard,{...extra,effectChain:chain});primaryExecuted=1}
      else{context.card=primaryCard;context.perform=perform||runtimePerform(state,runState,context,fallbackPerform);primaryExecuted=CardEffects.runOwner(trigger,primaryCard,context)}
    }
    const globalExecuted=dispatchNonCardOwnersOnce(trigger,{state,runState,extra:{...extra,effectChain:chain},perform,fallbackPerform});
    return{token:eventScopeToken(trigger,state,extra),chain,primaryExecuted,globalExecuted};
  }
  function dispatchTrickStart({state,runState,primaryRunner,perform,fallbackPerform}={}){
    if(!state)return{cards:0,global:0};
    const trigger='on_trick_start',extra={enemyCard:null,enemyRevealed:false,setIndex:state.setIndex,trick:state.trick};
    const chain=eventChain(trigger,state,extra);let cards=0;
    for(const card of state.hand||[]){
      if(typeof primaryRunner==='function'){primaryRunner(trigger,card,{...extra,effectChain:chain});cards++}
      else{
        const context=createBattleEventContext(trigger,state,runState,{...extra,effectChain:chain,card});
        context.perform=perform||runtimePerform(state,runState,context,fallbackPerform);
        cards+=CardEffects.runOwner(trigger,card,context)>0?1:0;
      }
    }
    const global=dispatchNonCardOwnersOnce(trigger,{state,runState,extra:{...extra,effectChain:chain},perform,fallbackPerform});
    return{cards,global,chain};
  }
  function expireDuration(state,duration){const Combat=combatEffects();if(Combat?.expireCombatDuration)Combat.expireCombatDuration({state,duration})}
  function beginSetLifecycle(state){
    const tracker=trackerFor(state);if(!tracker)return;
    const current=state.setIndex??1;
    if(tracker.lastSetStarted!==null&&tracker.lastSetStarted!==current)expireDuration(state,'set');
    tracker.lastSetStarted=current;
  }
  function beginTrickLifecycle(state){
    const tracker=trackerFor(state);if(!tracker)return;
    const key=`${state.setIndex??1}:${state.trick??1}`;
    if(tracker.lastTrickStarted!==null&&tracker.lastTrickStarted!==key&&tracker.lastTrickExpired!==tracker.lastTrickStarted){expireDuration(state,'trick');tracker.lastTrickExpired=tracker.lastTrickStarted}
    tracker.lastTrickStarted=key;
  }
  function endLastTrickLifecycle(state){
    const tracker=trackerFor(state);if(!tracker||tracker.lastTrickStarted===null||tracker.lastTrickExpired===tracker.lastTrickStarted)return;
    expireDuration(state,'trick');tracker.lastTrickExpired=tracker.lastTrickStarted;
  }
  function expireBattleLifecycle(state){
    const tracker=trackerFor(state);if(!tracker||tracker.battleExpired)return;
    ['trick','set','battle'].forEach(duration=>expireDuration(state,duration));tracker.battleExpired=true;
  }
  function wrapRunCardEffects(){
    if(typeof root.runCardEffects!=='function')return false;if(root.runCardEffects.__battleEventAdapter)return true;
    originalRunCardEffects=root.runCardEffects;
    const wrapped=function(trigger,card,extra={}){
      const state=runtimeBattle(),runState=runtimeRun();
      if(!state)return originalRunCardEffects.call(this,trigger,card,extra);
      if(trigger==='on_set_start')beginSetLifecycle(state);
      const result=dispatchBattleEvent(trigger,{state,runState,primaryCard:card,extra,primaryRunner:(nextTrigger,nextCard,nextExtra)=>originalRunCardEffects.call(this,nextTrigger,nextCard,nextExtra)});
      return result.primaryExecuted;
    };
    wrapped.__battleEventAdapter=true;wrapped.__legacyRunCardEffects=originalRunCardEffects;root.runCardEffects=wrapped;return true;
  }
  function wrapNextEnemy(){
    if(typeof root.nextEnemy!=='function')return false;if(root.nextEnemy.__battleEventAdapter)return true;
    originalNextEnemy=root.nextEnemy;
    const wrapped=function(...args){
      const state=runtimeBattle(),runState=runtimeRun();
      if(state){beginTrickLifecycle(state);dispatchTrickStart({state,runState,primaryRunner:(trigger,card,extra)=>originalRunCardEffects?originalRunCardEffects(trigger,card,extra):CardEffects.runOwner(trigger,card,extra)})}
      return originalNextEnemy.apply(this,args);
    };
    wrapped.__battleEventAdapter=true;wrapped.__legacyNextEnemy=originalNextEnemy;root.nextEnemy=wrapped;return true;
  }
  function wrapShowdown(){
    if(typeof root.showdown!=='function')return false;if(root.showdown.__battleEventAdapter)return true;
    originalShowdown=root.showdown;
    const wrapped=function(...args){const state=runtimeBattle();if(state)endLastTrickLifecycle(state);return originalShowdown.apply(this,args)};
    wrapped.__battleEventAdapter=true;wrapped.__legacyShowdown=originalShowdown;root.showdown=wrapped;return true;
  }
  function wrapBattleEnd(name){
    const original=root[name];if(typeof original!=='function')return false;if(original.__battleEventAdapter)return true;
    const wrapped=function(...args){
      const state=runtimeBattle(),result=original.apply(this,args);
      if(result&&typeof result.finally==='function')return result.finally(()=>{if(state)expireBattleLifecycle(state)});
      if(state)expireBattleLifecycle(state);return result;
    };
    wrapped.__battleEventAdapter=true;wrapped.__legacyBattleEnd=original;root[name]=wrapped;
    if(name==='winBattle')originalWinBattle=original;else originalLoseRun=original;
    return true;
  }
  function installBrowserAdapter(){
    if(installed)return true;
    if(typeof root.runCardEffects!=='function'||typeof root.nextEnemy!=='function'||typeof root.showdown!=='function')return false;
    wrapRunCardEffects();wrapNextEnemy();wrapShowdown();wrapBattleEnd('winBattle');wrapBattleEnd('loseRun');installed=true;return true;
  }
  function installWhenReady(){
    if(typeof document==='undefined')return false;
    const attempt=()=>{if(installBrowserAdapter())return;setTimeout(()=>{if(!installBrowserAdapter())console.warn('[battle-events] 전투 런타임을 찾지 못했습니다.')},0)};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    return true;
  }
  return{SHOWDOWN_TRIGGERS,SET_TRIGGERS,RESULT_TRIGGERS,LIFECYCLE_ORDER,eventScopeToken,eventChain,createBattleEventContext,nonCardOwners,runtimePerform,dispatchNonCardOwnersOnce,dispatchBattleEvent,dispatchTrickStart,beginSetLifecycle,beginTrickLifecycle,endLastTrickLifecycle,expireBattleLifecycle,resetBattleEventState,wrapRunCardEffects,wrapNextEnemy,wrapShowdown,wrapBattleEnd,installBrowserAdapter,installWhenReady};
});
