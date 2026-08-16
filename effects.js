(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.CardEffects=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TRIGGERS=['on_play','on_set_start','before_compare','after_compare','on_trick_win','on_trick_loss','after_card_slotted','on_trick_end','before_showdown','on_showdown_advantage','on_showdown_score','after_showdown_result','on_set_end','before_damage','after_damage'];
  const ACTIONS=['damage_enemy','heal_player','gain_chips','gain_shield','apply_enemy_bleed','increase_enemy_forecast','draw_tactic','increase_effective_rank','showdown_power','reserve_next_win_damage'];
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
      const previous=c.lastNamed;
      if(previous&&previous.cardId!==c.card.named.id&&COPYABLE_NUMERIC_ACTIONS.includes(previous.action)&&Number.isFinite(previous.value))c.perform(previous.action,previous.value,{copied:true});
    },
    deplete_battery_in_hand(c,e){if(c.inHand&&c.random()<e.chance)c.exhaust(c.card)}
  };
  function run(trigger,card,context){if(!card?.named?.implemented)return;for(const effect of card.named.effects.filter(x=>x.trigger===trigger)){if(effect.condition&&!conditions[effect.condition]?.(context,effect))continue;if(effect.handler)handlers[effect.handler](context,effect);else context.perform(effect.action,effect.value,effect)}}
  function resolveNextWinReservations(reservations,trick,won,perform){
    const due=reservations.filter(reservation=>reservation.type==='nextWinDamage'&&reservation.eligibleTrick===trick);
    if(won)due.forEach(reservation=>perform('damage_enemy',reservation.value));
    return reservations.filter(reservation=>!due.includes(reservation));
  }
  function newHistory(){return{tacticsUsed:false,tacticUseCount:0,chipsSpent:0,cardsDrawn:0,damageDealt:0,healingDone:0}}
  return{TRIGGERS,ACTIONS,COPYABLE_NUMERIC_ACTIONS,conditions,handlers,run,resolveNextWinReservations,newHistory};
});
