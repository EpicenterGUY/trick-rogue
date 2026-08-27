(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CardSystemTags=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='M6-1';
  const TAGS=Object.freeze([
    '직접 피해','회복','보호막','칩','예측','적용값 증가','적용값 감소',
    '우세 개입','쇼다운 개입','예약','계약','상태','손패','족보'
  ]);
  const TAG_SET=new Set(TAGS);
  const REGION_REWARD_TAGS=Object.freeze({
    region_theater:Object.freeze(['적용값 증가','적용값 감소','우세 개입','쇼다운 개입','계약']),
    region_observatory:Object.freeze(['예측','손패','예약','족보']),
    region_frontier:Object.freeze(['직접 피해','회복','보호막','칩','상태']),
    region_casino:Object.freeze(['칩','적용값 감소','적용값 증가','우세 개입','예약']),
    region_red_ward:Object.freeze(['회복','보호막','상태','직접 피해','예약'])
  });

  const ACTION_TAGS=Object.freeze({
    damage_enemy:['직접 피해'],
    heal_player:['회복'],
    gain_shield:['보호막'],
    spend_all_chips_to_shield:['칩','보호막'],
    gain_chips:['칩'],spend_chips:['칩'],spend_all_chips:['칩'],
    increase_enemy_forecast:['예측'],reveal_next_enemy_card:['예측'],
    increase_effective_rank:['적용값 증가'],increase_next_trick_rank:['적용값 증가'],
    set_next_trick_suit_to_trump:['적용값 증가'],
    randomize_trick_rank:['적용값 증가','적용값 감소'],
    russian_roulette_rank:['적용값 증가','적용값 감소'],
    match_enemy_printed_rank:['적용값 증가','적용값 감소'],
    set_trick_rank_midpoint_enemy:['적용값 증가','적용값 감소'],
    set_reverse_compare:['적용값 감소'],
    showdown_power:['쇼다운 개입'],
    showdown_power_from_memory_multiplier:['쇼다운 개입'],
    showdown_power_from_memory_tiers:['쇼다운 개입'],
    showdown_power_if_memory:['쇼다운 개입'],
    showdown_power_from_adjacent_effect_cards:['쇼다운 개입'],
    showdown_power_from_adjacent_pure:['쇼다운 개입','족보'],
    showdown_power_per_distinct_suit:['쇼다운 개입','족보'],
    set_last_showdown_suit_to_trump:['쇼다운 개입','족보'],
    increase_last_showdown_rank:['쇼다운 개입','족보'],
    copy_previous_showdown_rank:['쇼다운 개입','족보'],
    copy_previous_showdown_suit:['쇼다운 개입','족보'],
    copy_previous_showdown_card:['쇼다운 개입','족보'],
    swap_showdown_with_previous:['쇼다운 개입','족보'],
    set_showdown_rank_from_slot:['쇼다운 개입','족보'],
    set_showdown_rank_from_result:['쇼다운 개입'],
    copy_first_showdown_card:['쇼다운 개입','족보'],
    reserve_next_win_damage:['예약','직접 피해'],
    reserve_next_trick_comparison_reward:['예약'],
    reserve_delayed_damage:['예약','직접 피해'],
    add_reservation:['예약'],
    grant_next_trick_hand_capacity:['손패'],discard_secondary_target:['손패'],discard_selected_card:['손패'],draw_cards:['손패'],
    apply_enemy_bleed:['상태'],apply_status:['상태'],remove_status:['상태']
  });
  const CONDITION_TAGS=Object.freeze({
    chips_spent:['칩'],chips_at_least:['칩'],chips_empty:['칩'],
    player_has_advantage:['우세 개입'],enemy_has_advantage:['우세 개입'],
    pure_card_in_hand:['족보'],pure_card_in_showdown:['족보'],pure_cards_at_least:['족보'],
    previous_showdown_slot_is_pure:['족보'],showdown_distinct_suits_at_least:['족보'],showdown_high_card:['족보'],
    player_shield_at_least:['보호막'],enemy_has_status:['상태']
  });
  const HANDLER_TAGS=Object.freeze({
    repeat_last_named_numeric:['직접 피해','회복','칩'],
    deplete_battery_in_hand:['쇼다운 개입']
  });

  function push(tags,value){for(const tag of value||[])if(TAG_SET.has(tag)&&!tags.includes(tag))tags.push(tag)}
  function tagAction(tags,action){push(tags,ACTION_TAGS[action]);const text=String(action||'');if(text.includes('contract'))push(tags,['계약']);if(text.includes('advantage'))push(tags,['우세 개입']);if(text.includes('showdown'))push(tags,['쇼다운 개입']);if(text.includes('reservation')||text.includes('reserve'))push(tags,['예약'])}
  function tagCondition(tags,condition){push(tags,CONDITION_TAGS[condition]);const text=String(condition||'');if(text.includes('contract'))push(tags,['계약']);if(text.includes('advantage'))push(tags,['우세 개입'])}
  function tagTrigger(tags,trigger){const text=String(trigger||'');if(text.includes('contract'))push(tags,['계약']);if(text.includes('showdown'))push(tags,['쇼다운 개입']);if(text.includes('advantage'))push(tags,['우세 개입'])}
  function tagTerms(tags,terms=[]){
    const text=(terms||[]).join(' ');
    if(text.includes('피해'))push(tags,['직접 피해']);
    if(text.includes('회복'))push(tags,['회복']);
    if(text.includes('보호막'))push(tags,['보호막']);
    if(text.includes('칩'))push(tags,['칩']);
    if(text.includes('예측')||text.includes('정보'))push(tags,['예측']);
    if(text.includes('우세'))push(tags,['우세 개입']);
    if(text.includes('쇼다운'))push(tags,['쇼다운 개입']);
    if(text.includes('예약'))push(tags,['예약']);
    if(text.includes('계약'))push(tags,['계약']);
    if(text.includes('출혈')||text.includes('상태'))push(tags,['상태']);
    if(text.includes('손패')||text.includes('드로우')||text.includes('버림')||text.includes('교환'))push(tags,['손패']);
    if(text.includes('족보')||text.includes('순수 카드')||text.includes('무늬'))push(tags,['족보']);
  }
  function normalize(tags,{limit=3}={}){return[...new Set((tags||[]).filter(tag=>TAG_SET.has(tag)))].slice(0,Math.max(1,limit))}
  function tagsForDefinition(definition,{limit=3}={}){
    if(!definition||typeof definition!=='object')return[];
    const explicit=normalize(definition.systemTags,{limit});if(explicit.length)return explicit;
    const tags=[];
    for(const effect of definition.effects||[]){
      tagTrigger(tags,effect?.trigger);tagAction(tags,effect?.action);tagCondition(tags,effect?.condition);
      for(const nested of effect?.conditions||[])tagCondition(tags,nested?.condition);
      tagAction(tags,effect?.rewardAction);push(tags,HANDLER_TAGS[effect?.handler]);
    }
    if(definition.targeting?.zone==='hand')push(tags,['손패']);
    tagTerms(tags,definition.terms||[]);
    if(!tags.length)push(tags,['쇼다운 개입']);
    return normalize(tags,{limit});
  }
  function decorateDefinition(definition){
    if(!definition||typeof definition!=='object')return definition;
    const systemTags=Object.freeze(tagsForDefinition(definition));
    return{...definition,systemTags};
  }
  function decorateDefinitions(definitions=[]){return Object.freeze((definitions||[]).map(decorateDefinition))}
  function validateDefinition(definition){
    const tags=definition?.systemTags;
    if(!Array.isArray(tags))return['systemTags missing'];
    const errors=[];
    if(tags.length<1||tags.length>3)errors.push(`systemTags count ${tags.length}`);
    for(const tag of tags)if(!TAG_SET.has(tag))errors.push(`unknown systemTag: ${tag}`);
    if(new Set(tags).size!==tags.length)errors.push('duplicate systemTags');
    return errors;
  }
  function regionTags(regionId){return REGION_REWARD_TAGS[regionId]||Object.freeze([])}
  function affinity(tags,regionId){const preferred=new Set(regionTags(regionId));return(tags||[]).reduce((score,tag)=>score+(preferred.has(tag)?1:0),0)}

  return{VERSION,TAGS,TAG_SET,REGION_REWARD_TAGS,ACTION_TAGS,CONDITION_TAGS,HANDLER_TAGS,normalize,tagsForDefinition,decorateDefinition,decorateDefinitions,validateDefinition,regionTags,affinity};
});
