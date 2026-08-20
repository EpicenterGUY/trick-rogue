(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.CardEffects=api;if(typeof document!=='undefined'){api.loadLegacyTacticRuntime();api.loadTextCardRuntime();api.loadCombatEffectsRuntime()}})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TRIGGERS=['on_play','on_set_start','before_compare','after_compare','on_trick_win','on_trick_loss','on_trick_draw','after_card_slotted','on_trick_end','before_showdown','on_showdown_advantage','on_showdown_score','after_showdown_result','on_set_end','before_damage','after_damage'];
  const DURATIONS=['trick','set','battle','run'];
  const ACTIONS=['damage_enemy','heal_player','gain_chips','gain_shield','apply_enemy_bleed','increase_enemy_forecast','draw_tactic','increase_effective_rank','showdown_power','reserve_next_win_damage','set_next_trick_suit_to_trump','increase_next_trick_rank','draw_cards','increase_forecast','set_reverse_compare','set_last_showdown_suit_to_trump','increase_last_showdown_rank','discard_selected_card'];
  const COPYABLE_NUMERIC_ACTIONS=Object.freeze(['damage_enemy','heal_player','gain_chips','gain_shield','apply_enemy_bleed','increase_enemy_forecast','draw_tactic']);
  const RESERVATION_EVENTS=Object.freeze(['on_trick_start','on_next_card_play','on_trick_result','on_next_trick_win','on_next_trick_loss','on_trick_end','before_showdown','after_showdown_score']);
  const MAX_EFFECT_EXECUTIONS=128;
  let activeEffectChain=null;
  let chainCounter=0;
  const objectIds=new WeakMap();
  let objectCounter=0;
  const conditions={
    chips_spent:c=>c.history.chipsSpent>0,
    effective_rank_at_most:(c,e)=>c.effectiveRank<=e.conditionValue,
    slot_is:(c,e)=>c.slotIndex+1===e.conditionValue,
    slot_at_least:(c,e)=>c.slotIndex+1>=e.conditionValue,
    same_suit:c=>c.card.suit===c.enemyCard.suit,
    no_tactic_modifier:c=>!c.mods.paint&&!c.mods.plus&&!c.mods.reverse&&!c.mods.double
  };
  const handlers={
    repeat_last_named_numeric(c){
      const previous=c.lastNamed,currentId=effectOwnerId(c.card,c);
      if(previous&&previous.cardId!==currentId&&COPYABLE_NUMERIC_ACTIONS.includes(previous.action)&&Number.isFinite(previous.value))c.perform(previous.action,previous.value,{copied:true});
    },
    deplete_battery_in_hand(c,e){if(c.inHand&&c.random()<e.chance)c.exhaust(c.card)}
  };
  function effectOwnerId(card,context={}){
    return context.ownerId??context.cardId??card?.cardId??card?.definition?.id??card?.named?.id??null;
  }
  function effectOwner(card,context={}){
    return Object.freeze({
      type:context.ownerType||'card',
      id:effectOwnerId(card,context),
      instanceId:context.ownerInstanceId??context.cardInstanceId??card?.uid??null
    });
  }
  function runtimeObjectId(value){
    if(!value||typeof value!=='object')return'none';
    if(!objectIds.has(value))objectIds.set(value,`obj-${++objectCounter}`);
    return objectIds.get(value);
  }
  function createEffectChain({id,maxExecutions=MAX_EFFECT_EXECUTIONS}={}){
    if(!Number.isInteger(maxExecutions)||maxExecutions<1)throw new TypeError('maxExecutions must be a positive integer');
    return{id:id||`chain-${++chainCounter}`,seen:new Set(),executions:0,maxExecutions};
  }
  function currentEffectChain(){return activeEffectChain}
  function withEffectChain(chain,callback){
    if(!chain||!(chain.seen instanceof Set))throw new TypeError('A valid effect chain is required');
    const previous=activeEffectChain;activeEffectChain=chain;
    try{return callback()}finally{activeEffectChain=previous}
  }
  function effectExecutionKey(effect,index,context={}){
    const owner=context.owner||effectOwner(context.card,context);
    const ownerKey=owner.instanceId||owner.id||runtimeObjectId(context.card)||context.ownerType||'anonymous';
    const trigger=effect.trigger||context.trigger||'direct';
    const effectKey=effect.id||`${effect.action||effect.handler||'effect'}:${index}`;
    return`${owner.type||'effect'}:${ownerKey}:${trigger}:${effectKey}`;
  }
  function cardEffectList(card){
    if(Array.isArray(card?.effects))return card.effects;
    if(Array.isArray(card?.definition?.effects))return card.definition.effects;
    if(Array.isArray(card?.named?.effects))return card.named.effects;
    return [];
  }
  function attachEffects(card,effects,{cardId}={}){
    if(!card||typeof card!=='object')throw new TypeError('attachEffects requires a card object');
    if(!Array.isArray(effects))throw new TypeError('attachEffects requires an effect list');
    const next={...card,effects:effects.map(effect=>({...effect}))};
    if(cardId!==undefined)next.cardId=cardId;
    return next;
  }
  function createEffectContext(card,context={}){
    const owner=effectOwner(card,context);
    const chain=context.effectChain||currentEffectChain()||null;
    return{...context,card,owner,cardId:context.cardId??owner.id,cardInstanceId:context.cardInstanceId??owner.instanceId,effectChain:chain};
  }
  function validateEffectList(effects,{requireTrigger=false,requireDuration=false}={}){
    if(!Array.isArray(effects))return['effects must be an array'];
    const errors=[];
    effects.forEach((effect,index)=>{
      const prefix=`effect[${index}]`;
      if(!effect||typeof effect!=='object'){errors.push(`${prefix}: invalid effect`);return}
      if(requireTrigger&&!effect.trigger)errors.push(`${prefix}: missing trigger`);
      if(effect.trigger&&!TRIGGERS.includes(effect.trigger))errors.push(`${prefix}: unknown trigger ${effect.trigger}`);
      if(requireDuration&&!effect.duration)errors.push(`${prefix}: missing duration`);
      if(effect.duration&&!DURATIONS.includes(effect.duration))errors.push(`${prefix}: unknown duration ${effect.duration}`);
      if(effect.condition&&!conditions[effect.condition])errors.push(`${prefix}: unknown condition ${effect.condition}`);
      if(effect.handler&&!handlers[effect.handler])errors.push(`${prefix}: unknown handler ${effect.handler}`);
      if(effect.action&&!ACTIONS.includes(effect.action))errors.push(`${prefix}: unknown action ${effect.action}`);
      if(!effect.action&&!effect.handler)errors.push(`${prefix}: missing action or handler`);
    });
    return errors;
  }
  function executeEffectList(effects,context,chain){
    let executed=0;
    for(let index=0;index<effects.length;index++){
      const effect=effects[index];
      if(effect.condition){const check=conditions[effect.condition];if(!check||!check(context,effect))continue}
      const key=effectExecutionKey(effect,index,context);
      if(effect.allowRepeat!==true&&chain.seen.has(key))continue;
      if(chain.executions>=chain.maxExecutions)throw new RangeError(`Effect chain exceeded ${chain.maxExecutions} executions`);
      if(effect.allowRepeat!==true)chain.seen.add(key);
      chain.executions++;
      if(effect.handler){const handler=handlers[effect.handler];if(!handler)throw new TypeError(`Unknown effect handler: ${effect.handler}`);handler(context,effect);executed++;continue}
      if(!effect.action)continue;
      if(!ACTIONS.includes(effect.action))throw new TypeError(`Unknown effect action: ${effect.action}`);
      if(typeof context.perform!=='function')throw new TypeError('Effect context requires perform(action, value, effect)');
      context.perform(effect.action,effect.value,effect);executed++;
    }
    return executed;
  }
  function runEffectList(effects,context={}){
    if(!Array.isArray(effects))return 0;
    const chain=context.effectChain||currentEffectChain()||createEffectChain();
    const nextContext={...context,effectChain:chain};
    return withEffectChain(chain,()=>executeEffectList(effects,nextContext,chain));
  }
  function run(trigger,card,context={}){
    const effects=cardEffectList(card);if(!effects.length)return 0;
    const chain=context.effectChain||currentEffectChain()||createEffectChain();
    const nextContext=createEffectContext(card,{...context,trigger,effectChain:chain});
    return withEffectChain(chain,()=>executeEffectList(effects.filter(effect=>effect.trigger===trigger),nextContext,chain));
  }
  function createReservation({id,type,timing,duration,consume='when_due',action,value,eligibleSet,eligibleTrick,condition,label,metadata={}}={}){
    const resolvedTiming=timing||(type==='nextWinDamage'?'on_trick_result':null);
    const resolvedDuration=duration||(type==='nextWinDamage'?'battle':'set');
    if(!resolvedTiming||!RESERVATION_EVENTS.includes(resolvedTiming))throw new TypeError(`Unknown reservation timing: ${resolvedTiming}`);
    if(!DURATIONS.includes(resolvedDuration))throw new TypeError(`Unknown reservation duration: ${resolvedDuration}`);
    if(consume!=='when_due'&&consume!=='when_triggered')throw new TypeError(`Unknown reservation consume policy: ${consume}`);
    return{...metadata,id:id||null,type:type||null,timing:resolvedTiming,duration:resolvedDuration,consume,action:action||(type==='nextWinDamage'?'damage_enemy':null),value,eligibleSet,eligibleTrick,condition:condition||(type==='nextWinDamage'?'player_win':null),label:label||null};
  }
  function normalizeReservation(reservation){
    if(!reservation||typeof reservation!=='object')throw new TypeError('Reservation must be an object');
    if(reservation.timing)return createReservation(reservation);
    if(reservation.type==='nextWinDamage')return createReservation({...reservation,timing:'on_trick_result',duration:reservation.duration||'battle',consume:'when_due',action:'damage_enemy',condition:'player_win'});
    throw new TypeError(`Reservation is missing timing: ${reservation.type||'unknown'}`);
  }
  function reservationMatches(reservation,event,context={}){
    if(reservation.timing!==event)return false;
    if(reservation.eligibleSet!==undefined&&reservation.eligibleSet!==context.set)return false;
    if(reservation.eligibleTrick!==undefined&&reservation.eligibleTrick!==context.trick)return false;
    return true;
  }
  function reservationConditionMet(reservation,context={}){
    if(!reservation.condition)return true;
    if(reservation.condition==='player_win')return context.result==='player'||context.won===true;
    if(reservation.condition==='player_loss')return context.result==='enemy'||context.lost===true;
    if(reservation.condition==='draw')return context.result==='draw';
    if(typeof reservation.condition==='function')return!!reservation.condition(context,reservation);
    return false;
  }
  function resolveReservations(reservations,event,context={},perform=()=>{}){
    if(!Array.isArray(reservations))throw new TypeError('Reservations must be an array');
    if(!RESERVATION_EVENTS.includes(event))throw new TypeError(`Unknown reservation event: ${event}`);
    const remaining=[];
    for(const raw of reservations){
      const reservation=normalizeReservation(raw);
      if(!reservationMatches(reservation,event,context)){remaining.push(raw);continue}
      const conditionMet=reservationConditionMet(reservation,context);
      if(conditionMet&&reservation.action)perform(reservation.action,reservation.value,reservation);
      const consumed=reservation.consume==='when_due'||(reservation.consume==='when_triggered'&&conditionMet);
      if(!consumed)remaining.push(raw);
    }
    return remaining;
  }
  function resolveNextWinReservations(reservations,trick,won,perform){
    const turn=typeof trick==='object'?trick:{trick};
    return resolveReservations(reservations,'on_trick_result',{set:turn.set,trick:turn.trick,result:won?'player':'other',won},(action,value)=>perform(action,value));
  }
  function newHistory(){return{effectsUsed:false,effectUseCount:0,tacticsUsed:false,tacticUseCount:0,chipsSpent:0,cardsDrawn:0,damageDealt:0,healingDone:0}}
  function loadLegacyTacticRuntime(){
    if(typeof document==='undefined'||document.querySelector('script[data-trick-tactic-runtime]'))return;
    const script=document.createElement('script');
    script.src='tactic-effects.js';
    script.async=false;
    script.dataset.trickTacticRuntime='true';
    document.head.appendChild(script);
  }
  function loadTextCardRuntime(){
    if(typeof document==='undefined'||document.querySelector('script[data-trick-text-card-runtime]'))return;
    const script=document.createElement('script');
    script.src='card-text-mode.js';
    script.async=false;
    script.dataset.trickTextCardRuntime='true';
    document.head.appendChild(script);
  }
  function loadCombatEffectsRuntime(){
    if(typeof document==='undefined'||document.querySelector('script[data-trick-combat-effects-runtime]'))return;
    const script=document.createElement('script');
    script.src='combat-effects.js';
    script.async=false;
    script.dataset.trickCombatEffectsRuntime='true';
    document.head.appendChild(script);
  }
  return{TRIGGERS,DURATIONS,ACTIONS,COPYABLE_NUMERIC_ACTIONS,RESERVATION_EVENTS,MAX_EFFECT_EXECUTIONS,conditions,handlers,effectOwnerId,effectOwner,cardEffectList,attachEffects,createEffectContext,validateEffectList,createEffectChain,currentEffectChain,withEffectChain,effectExecutionKey,runEffectList,run,createReservation,normalizeReservation,reservationMatches,reservationConditionMet,resolveReservations,resolveNextWinReservations,newHistory,loadLegacyTacticRuntime,loadTextCardRuntime,loadCombatEffectsRuntime};
});
