(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./effects.js'):root.CardEffects,
    typeof module!=='undefined'?require('./chip-economy.js'):root.ChipEconomy,
    root
  );
  if(typeof module!=='undefined')module.exports=api;
  root.CardPersonalityRuntime=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,NodeChipEconomy,defaultRoot){
  const MEMORY_KEY='cardEffectMemory';
  const COMPARISON_RESERVATION_TYPE='printed_rank_comparison_reward';
  let installed=false;

  function activeBattle(runtimeRoot=defaultRoot,context={}){
    if(context?.battle)return context.battle;
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function activeRun(runtimeRoot=defaultRoot,context={}){
    if(context?.runState)return context.runState;
    if(context?.run)return context.run;
    try{if(typeof run!=='undefined'&&run)return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function unwrapCard(entry){return entry?.card||entry||null}
  function printedRank(card){const target=unwrapCard(card);return Number(target?.printedRank??target?.rank)}
  function printedSuit(card){const target=unwrapCard(card);return target?.printedSuit??target?.suit??null}
  function showdownRank(card){const target=unwrapCard(card);return Number(target?.showdownRank??target?.printedRank??target?.rank)}
  function currentTrump(context={}){return context.currentTrump??context.trump??context.battle?.trump??null}
  function currentTrick(context={}){return Number(context.trick??context.trickIndex??context.battle?.trick??context.battle?.trickIndex)}
  function currentSet(context={}){return Number(context.setIndex??context.set??context.battle?.setIndex??context.battle?.set??1)}
  function statusValue(raw){
    if(raw&&typeof raw==='object'&&Number.isFinite(raw.value))return Math.max(0,raw.value);
    return Math.max(0,Number(raw)||0);
  }
  function memoryFor(card){
    if(!card||typeof card!=='object')return null;
    if(!card[MEMORY_KEY]||typeof card[MEMORY_KEY]!=='object')card[MEMORY_KEY]={};
    return card[MEMORY_KEY];
  }
  function setCardMemory(card,key,value,context={}){
    if(!key)return null;
    const memory=memoryFor(card);if(!memory)return null;
    memory[key]={value:Number(value)||0,setIndex:currentSet(context)};
    return memory[key];
  }
  function getCardMemory(card,key,context={}){
    const entry=card?.[MEMORY_KEY]?.[key];if(!entry)return null;
    if(entry.setIndex!==undefined&&Number.isFinite(currentSet(context))&&entry.setIndex!==currentSet(context))return null;
    return entry;
  }
  function chipBalance(state){
    if(!state)return 0;
    if(Number.isFinite(state.chipEconomy?.balance))return state.chipEconomy.balance;
    return Math.max(0,Number(state.chip)||0);
  }
  function chipEconomy(runtimeRoot=defaultRoot){return NodeChipEconomy||runtimeRoot?.ChipEconomy||null}
  function spendChips(context,amount,runtimeRoot=defaultRoot){
    const state=activeBattle(runtimeRoot,context),cost=Math.max(0,Math.floor(Number(amount)||0));
    if(!state||cost<1)return{ok:false,cost,spent:0};
    const economy=chipEconomy(runtimeRoot);
    if(economy?.spendChips)return economy.spendChips(state,cost,{recordHistory:true});
    if(chipBalance(state)<cost)return{ok:false,cost,spent:0};
    const before=chipBalance(state);state.chip=before-cost;
    if(state.chipEconomy)state.chipEconomy.balance=state.chip;
    if(!state.history||typeof state.history!=='object')state.history={};
    state.history.chipsSpent=(Number(state.history.chipsSpent)||0)+cost;
    return{ok:true,cost,before,after:state.chip,spent:cost};
  }
  function previousSlot(context={}){
    const index=Number(context.slotIndex);if(!Number.isInteger(index)||index<1)return null;
    const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots;
    return Array.isArray(slots)?slots[index-1]||null:null;
  }
  function conditionDescriptor(api,context,spec,parent){
    if(!spec||typeof spec!=='object'||!spec.condition)return false;
    const fn=api.conditions[spec.condition];if(typeof fn!=='function'||spec.condition==='all')return false;
    return!!fn(context,{...parent,...spec});
  }
  function comparisonEligible(raw,turn){return raw.eligibleSet===turn.set&&raw.eligibleTrick===turn.trick}
  function nextTurn(context={}){
    const set=currentSet(context),trick=currentTrick(context);
    return trick===5?{set:set+1,trick:1}:{set,trick:trick+1};
  }
  function resolveComparisonReservations(reservations,turn,won,perform,{playerCard,enemyCard}={}){
    const normalized=typeof turn==='object'?{set:Number(turn.set??turn.setIndex??1),trick:Number(turn.trick??1)}:{set:1,trick:Number(turn)||1};
    const remaining=[];let triggered=0;
    for(const raw of reservations||[]){
      if(raw?.type!==COMPARISON_RESERVATION_TYPE){remaining.push(raw);continue}
      if(!comparisonEligible(raw,normalized)){remaining.push(raw);continue}
      const left=printedRank(playerCard),right=printedRank(enemyCard),qualified=won===true&&Number.isFinite(left)&&Number.isFinite(right)&&left<right;
      if(qualified&&raw.action){perform(raw.action,raw.value,raw);triggered++}
    }
    return{remaining,triggered};
  }
  function installReservationResolver(api,runtimeRoot=defaultRoot){
    const original=api.resolveNextWinReservations;
    if(typeof original!=='function')return false;
    if(original.__cardPersonalityRuntime)return true;
    const wrapped=function(reservations,turn,won,perform){
      const state=activeBattle(runtimeRoot),playerCard=state?.slots?.[state.slots.length-1]?.card||state?.playerStage||null,enemyCard=state?.enemyCard||null;
      const custom=resolveComparisonReservations(reservations,turn,won,perform,{playerCard,enemyCard});
      return original(custom.remaining,turn,won,perform);
    };
    wrapped.__cardPersonalityRuntime=true;wrapped.__original=original;api.resolveNextWinReservations=wrapped;return true;
  }
  function ensureAction(api,name,handler){
    if(!api.ACTIONS.includes(name))api.ACTIONS.push(name);
    api.registerActionHandler(name,handler);
  }
  function installEffects(api=CardEffects,runtimeRoot=defaultRoot){
    if(!api?.conditions||!api?.registerActionHandler)return false;
    api.conditions.printed_suit_is_trump=context=>printedSuit(context.card)===currentTrump(context);
    api.conditions.printed_suit_is_not_trump=context=>printedSuit(context.card)!==currentTrump(context);
    api.conditions.previous_showdown_slot_exists=context=>!!previousSlot(context);
    api.conditions.previous_showdown_slot_is_pure=context=>{const entry=previousSlot(context);return!!entry&&api.isPureCard(entry)};
    api.conditions.chips_at_least=(context,effect)=>chipBalance(activeBattle(runtimeRoot,context))>=(Number(effect.conditionValue)||1);
    api.conditions.card_memory_at_least=(context,effect)=>(getCardMemory(context.card,effect.memoryKey,context)?.value??-Infinity)>=(Number(effect.conditionValue)||1);
    api.conditions.player_hp_ratio_at_most=(context,effect)=>{
      const runState=activeRun(runtimeRoot,context),hp=Number(context.playerHp??runState?.hp),maxHp=Number(context.playerMaxHp??runState?.maxHp);
      return Number.isFinite(hp)&&Number.isFinite(maxHp)&&maxHp>0&&hp/maxHp<=Number(effect.conditionValue);
    };
    api.conditions.enemy_has_status=(context,effect)=>statusValue((context.statuses||context.battle?.statuses)?.enemy?.[effect.statusId||effect.status])>=(Number(effect.conditionValue)||1);
    api.conditions.trick_is=(context,effect)=>currentTrick(context)===Number(effect.conditionValue);
    api.conditions.player_shield_at_least=(context,effect)=>statusValue((context.statuses||context.battle?.statuses)?.player?.shield)>=(Number(effect.conditionValue)||1);
    api.conditions.river_miss_with_candidates=context=>{
      const hit=context.riverHit||context.battle?.riverHit,snapshot=context.riverSnapshot||context.battle?.riverSnapshot;
      return hit?.active!==true&&hit?.reason==='candidate_miss'&&Number(hit?.candidateCount??snapshot?.candidateCount??0)>0;
    };
    api.conditions.all=(context,effect)=>Array.isArray(effect.conditions)&&effect.conditions.every(spec=>conditionDescriptor(api,context,spec,effect));

    ensureAction(api,'spend_chips',(context,value,effect)=>{
      const payment=spendChips(context,value,runtimeRoot);
      if(payment.ok&&effect.memoryKey)setCardMemory(context.card,effect.memoryKey,payment.spent,context);
      return payment;
    });
    ensureAction(api,'copy_previous_showdown_rank',(context)=>{
      const previous=previousSlot(context);if(!previous)return null;
      const rank=showdownRank(previous);if(!Number.isFinite(rank))return null;
      context.card.showdownRank=rank;return rank;
    });
    ensureAction(api,'snapshot_set_wins',(context,_value,effect)=>setCardMemory(context.card,effect.memoryKey||'set_wins_before_play',Number(context.setHistory?.wins??context.battle?.setHistory?.wins)||0,context));
    ensureAction(api,'showdown_power_from_memory_tiers',(context,_value,effect)=>{
      const value=getCardMemory(context.card,effect.memoryKey||'set_wins_before_play',context)?.value??0;
      const tiers=[...(effect.tiers||[])].sort((a,b)=>Number(b.atLeast)-Number(a.atLeast));
      const tier=tiers.find(entry=>value>=Number(entry.atLeast));const bonus=Number(tier?.value)||0;
      if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);
      return bonus;
    });
    ensureAction(api,'reserve_next_trick_comparison_reward',(context,value,effect)=>{
      const state=activeBattle(runtimeRoot,context);if(!Array.isArray(state?.reservations))throw new TypeError('reserve_next_trick_comparison_reward requires reservations');
      const target=nextTurn({...context,battle:state});
      const reservation={type:COMPARISON_RESERVATION_TYPE,timing:'on_trick_result',duration:'battle',consume:'when_due',eligibleSet:target.set,eligibleTrick:target.trick,action:effect.rewardAction||'gain_chips',value:Number(value)||0,label:effect.label||'다음 트릭 인쇄 숫자 역전 보상'};
      state.reservations.push(reservation);return reservation;
    });
    installReservationResolver(api,runtimeRoot);
    installed=true;return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    if(typeof document==='undefined')return installEffects(CardEffects,runtimeRoot);
    let attempts=0;const attempt=()=>{if(installEffects(runtimeRoot?.CardEffects||CardEffects,runtimeRoot))return;attempts++;if(attempts<80)setTimeout(attempt,25);else console.warn('[card-personality-runtime] 효과 엔진을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    return true;
  }
  if(CardEffects)installEffects(CardEffects,defaultRoot);
  return{MEMORY_KEY,COMPARISON_RESERVATION_TYPE,activeBattle,activeRun,printedRank,printedSuit,showdownRank,memoryFor,setCardMemory,getCardMemory,chipBalance,spendChips,previousSlot,nextTurn,resolveComparisonReservations,installReservationResolver,installEffects,installWhenReady,get installed(){return installed}};
});
