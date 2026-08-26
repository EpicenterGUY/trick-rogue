(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.CardBuildTags=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ARCHETYPES=Object.freeze([
    Object.freeze({id:'trick_control',label:'승부 조작',desc:'트릭 숫자·무늬·비교 방향을 바꾼다.'}),
    Object.freeze({id:'showdown_control',label:'쇼다운 조작',desc:'쇼다운 숫자·무늬·슬롯·최종 위력을 바꾼다.'}),
    Object.freeze({id:'loss_value',label:'패배 활용',desc:'트릭 패배를 자원이나 다음 기회로 바꾼다.'}),
    Object.freeze({id:'chip_economy',label:'칩 경제',desc:'칩을 벌고 쓰고 비우는 흐름을 만든다.'}),
    Object.freeze({id:'hand_control',label:'손패 조작',desc:'드로우·버림·손패 한도를 조작한다.'}),
    Object.freeze({id:'chain',label:'예약·연쇄',desc:'미래 트릭 예약이나 다른 효과와의 연쇄를 만든다.'})
  ]);
  const LABELS=new Set(ARCHETYPES.map(row=>row.label));
  const TRICK_ACTIONS=new Set(['increase_effective_rank','set_next_trick_suit_to_trump','increase_next_trick_rank','set_reverse_compare','randomize_trick_rank','russian_roulette_rank','match_enemy_printed_rank','set_trick_rank_midpoint_enemy']);
  const SHOWDOWN_ACTIONS=new Set(['showdown_power','set_last_showdown_suit_to_trump','increase_last_showdown_rank','copy_previous_showdown_rank','copy_previous_showdown_suit','copy_previous_showdown_card','swap_showdown_with_previous','set_showdown_rank_from_slot','set_showdown_rank_from_result','copy_first_showdown_card','showdown_power_from_adjacent_effect_cards','showdown_power_from_adjacent_pure','showdown_power_per_distinct_suit','showdown_power_from_memory_multiplier','showdown_power_from_memory_tiers']);
  const CHIP_ACTIONS=new Set(['gain_chips','spend_chips','spend_all_chips','spend_all_chips_to_shield']);
  const HAND_ACTIONS=new Set(['draw_cards','discard_selected_card','discard_secondary_target','grant_next_trick_hand_capacity']);
  const CHAIN_ACTIONS=new Set(['reserve_next_win_damage','reserve_next_trick_comparison_reward','reserve_delayed_damage','add_reservation']);
  function effectsOf(def){return Array.isArray(def?.effects)?def.effects:[]}
  function tagsForDefinition(def){
    const explicit=Array.isArray(def?.buildTags)?def.buildTags.filter(tag=>LABELS.has(tag)):[];
    if(explicit.length)return[...new Set(explicit)];
    const tags=[];const effects=effectsOf(def);
    if(effects.some(effect=>TRICK_ACTIONS.has(effect.action)))tags.push('승부 조작');
    if(effects.some(effect=>SHOWDOWN_ACTIONS.has(effect.action)||String(effect.trigger||'').includes('showdown')))tags.push('쇼다운 조작');
    if(effects.some(effect=>effect.trigger==='on_trick_loss'))tags.push('패배 활용');
    if(effects.some(effect=>CHIP_ACTIONS.has(effect.action)))tags.push('칩 경제');
    if(effects.some(effect=>HAND_ACTIONS.has(effect.action)))tags.push('손패 조작');
    if(effects.some(effect=>CHAIN_ACTIONS.has(effect.action)||effect.handler==='repeat_last_named_numeric'))tags.push('예약·연쇄');
    return[...new Set(tags)];
  }
  function primaryTag(def){return tagsForDefinition(def)[0]||'기타'}
  function tagSummary(def){const tags=tagsForDefinition(def);return tags.length?tags.join(' · '):'기타'}
  function countByTag(definitions=[]){
    const counts=Object.fromEntries(ARCHETYPES.map(row=>[row.label,0]));
    for(const def of definitions)for(const tag of tagsForDefinition(def))counts[tag]=(counts[tag]||0)+1;
    return counts;
  }
  return{ARCHETYPES,tagsForDefinition,primaryTag,tagSummary,countByTag};
});
