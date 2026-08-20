(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.CardEffects=api;if(typeof document!=='undefined')api.loadLegacyTacticRuntime()})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TRIGGERS=['on_play','on_set_start','before_compare','after_compare','on_trick_win','on_trick_loss','on_trick_draw','after_card_slotted','on_trick_end','before_showdown','on_showdown_advantage','on_showdown_score','after_showdown_result','on_set_end','before_damage','after_damage'];
  const DURATIONS=['trick','set','battle','run'];
  const ACTIONS=['damage_enemy','heal_player','gain_chips','gain_shield','apply_enemy_bleed','increase_enemy_forecast','draw_tactic','increase_effective_rank','showdown_power','reserve_next_win_damage','set_next_trick_suit_to_trump','increase_next_trick_rank','draw_cards','increase_forecast','set_reverse_compare','set_last_showdown_suit_to_trump','increase_last_showdown_rank','discard_selected_card'];
  const COPYABLE_NUMERIC_ACTIONS=Object.freeze(['damage_enemy','heal_player','gain_chips','gain_shield','apply_enemy_bleed','increase_enemy_forecast','draw_tactic']);
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
    return{...context,card,owner,cardId:context.cardId??owner.id,cardInstanceId:context.cardInstanceId??owner.instanceId};
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
  function runEffectList(effects,context){
    if(!Array.isArray(effects))return 0;
    let executed=0;
    for(const effect of effects){
      if(effect.condition){const check=conditions[effect.condition];if(!check||!check(context,effect))continue}
      if(effect.handler){const handler=handlers[effect.handler];if(!handler)throw new TypeError(`Unknown effect handler: ${effect.handler}`);handler(context,effect);executed++;continue}
      if(!effect.action)continue;
      if(!ACTIONS.includes(effect.action))throw new TypeError(`Unknown effect action: ${effect.action}`);
      if(typeof context.perform!=='function')throw new TypeError('Effect context requires perform(action, value, effect)');
      context.perform(effect.action,effect.value,effect);executed++;
    }
    return executed;
  }
  function run(trigger,card,context={}){
    const effects=cardEffectList(card);if(!effects.length)return 0;
    return runEffectList(effects.filter(effect=>effect.trigger===trigger),createEffectContext(card,context));
  }
  function resolveNextWinReservations(reservations,trick,won,perform){
    const turn=typeof trick==='object'?trick:{trick};
    const due=reservations.filter(reservation=>reservation.type==='nextWinDamage'&&reservation.eligibleTrick===turn.trick&&(reservation.eligibleSet===undefined||reservation.eligibleSet===turn.set));
    if(won)due.forEach(reservation=>perform('damage_enemy',reservation.value));
    return reservations.filter(reservation=>!due.includes(reservation));
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
  return{TRIGGERS,DURATIONS,ACTIONS,COPYABLE_NUMERIC_ACTIONS,conditions,handlers,effectOwnerId,effectOwner,cardEffectList,attachEffects,createEffectContext,validateEffectList,runEffectList,run,resolveNextWinReservations,newHistory,loadLegacyTacticRuntime};
});
