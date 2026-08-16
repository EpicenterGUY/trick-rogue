(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.CardEffects=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TRIGGERS=['on_play','on_set_start','before_compare','after_compare','on_trick_win','on_trick_loss','after_card_slotted','on_trick_end','before_showdown','on_showdown_advantage','on_showdown_score','after_showdown_result','on_set_end','before_damage','after_damage'];
  const ACTIONS=['damage_enemy','heal_player','gain_chips','gain_shield','apply_enemy_bleed','increase_enemy_forecast','draw_tactic','increase_effective_rank','showdown_power','reserve_next_win_damage'];
  const conditions={
    tactic_or_chip_used:c=>c.history.tacticsUsed||c.history.chipsSpent>0,
    effective_rank_at_most:(c,e)=>c.effectiveRank<=e.conditionValue,
    slot_is:(c,e)=>c.slotIndex+1===e.conditionValue,
    slot_at_least:(c,e)=>c.slotIndex+1>=e.conditionValue,
    same_suit:c=>c.card.suit===c.enemyCard.suit,
    no_tactic_modifier:c=>!c.mods.paint&&!c.mods.plus&&!c.mods.reverse&&!c.mods.double
  };
  const handlers={
    repeat_last_named(c){if(c.lastNamed)c.perform(c.lastNamed.type,c.lastNamed.value)}
  };
  function run(trigger,card,context){if(!card?.named?.implemented)return;for(const effect of card.named.effects.filter(x=>x.trigger===trigger)){if(effect.condition&&!conditions[effect.condition]?.(context,effect))continue;if(effect.handler)handlers[effect.handler](context,effect);else context.perform(effect.action,effect.value,effect)}}
  function newHistory(){return{tacticsUsed:false,tacticUseCount:0,chipsSpent:0,cardsDrawn:0,damageDealt:0,healingDone:0}}
  return{TRIGGERS,ACTIONS,conditions,handlers,run,newHistory};
});
