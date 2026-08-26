(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CardSystemTags=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TAG_DEFINITIONS=Object.freeze({
    damage:Object.freeze({id:'damage',label:'피해',family:'combat'}),
    sustain:Object.freeze({id:'sustain',label:'회복·유지',family:'combat'}),
    chip:Object.freeze({id:'chip',label:'칩',family:'resource'}),
    defense:Object.freeze({id:'defense',label:'방어',family:'combat'}),
    status:Object.freeze({id:'status',label:'상태',family:'combat'}),
    information:Object.freeze({id:'information',label:'정보',family:'control'}),
    rank_control:Object.freeze({id:'rank_control',label:'숫자 조작',family:'card_value'}),
    showdown:Object.freeze({id:'showdown',label:'쇼다운',family:'showdown'}),
    reservation:Object.freeze({id:'reservation',label:'예약',family:'temporal'}),
    trump:Object.freeze({id:'trump',label:'트럼프',family:'suit'}),
    trick_rule:Object.freeze({id:'trick_rule',label:'트릭 규칙',family:'trick'}),
    suit_control:Object.freeze({id:'suit_control',label:'무늬 조작',family:'suit'}),
    variant:Object.freeze({id:'variant',label:'변칙',family:'rule'}),
    showdown_value:Object.freeze({id:'showdown_value',label:'쇼다운값 조작',family:'showdown'}),
    hand_control:Object.freeze({id:'hand_control',label:'손패 조작',family:'hand'}),
    draw:Object.freeze({id:'draw',label:'드로우',family:'hand'}),
    field:Object.freeze({id:'field',label:'필드',family:'rule'}),
    slot:Object.freeze({id:'slot',label:'슬롯',family:'showdown'}),
    low_rank:Object.freeze({id:'low_rank',label:'저랭크',family:'trick'}),
    river:Object.freeze({id:'river',label:'리버',family:'showdown'}),
    advantage:Object.freeze({id:'advantage',label:'우세',family:'showdown'}),
    trick_win:Object.freeze({id:'trick_win',label:'트릭 승리',family:'trick'}),
    trick_loss:Object.freeze({id:'trick_loss',label:'트릭 패배',family:'trick'}),
    trick_draw:Object.freeze({id:'trick_draw',label:'트릭 무승부',family:'trick'}),
    pure:Object.freeze({id:'pure',label:'순수 카드',family:'card_identity'}),
    original_value:Object.freeze({id:'original_value',label:'인쇄·원본값',family:'card_value'}),
    copy:Object.freeze({id:'copy',label:'복사',family:'temporal'}),
    risk:Object.freeze({id:'risk',label:'위험',family:'rule'}),

    // 장기 확장용 표준 이름. 현재 카드에는 명시하지 않는 한 자동 부여하지 않는다.
    rng:Object.freeze({id:'rng',label:'확률·RNG',family:'rule',reserved:true}),
    debt:Object.freeze({id:'debt',label:'부채',family:'resource',reserved:true}),
    generation:Object.freeze({id:'generation',label:'카드 생성',family:'deck',reserved:true}),
    transform:Object.freeze({id:'transform',label:'카드 변환',family:'deck',reserved:true}),
    memory:Object.freeze({id:'memory',label:'효과 기억',family:'temporal',reserved:true}),
    hp_cost:Object.freeze({id:'hp_cost',label:'HP 비용',family:'resource',reserved:true})
  });

  const ACTION_TAGS=Object.freeze({
    damage_enemy:Object.freeze(['damage']),
    heal_player:Object.freeze(['sustain']),
    gain_chips:Object.freeze(['chip']),
    gain_shield:Object.freeze(['defense','status']),
    apply_enemy_bleed:Object.freeze(['damage','status']),
    increase_enemy_forecast:Object.freeze(['information']),
    reveal_next_enemy_card:Object.freeze(['information']),
    increase_effective_rank:Object.freeze(['rank_control']),
    increase_next_trick_rank:Object.freeze(['rank_control']),
    showdown_power:Object.freeze(['showdown']),
    reserve_next_win_damage:Object.freeze(['reservation','damage']),
    set_next_trick_suit_to_trump:Object.freeze(['trump','trick_rule','suit_control']),
    set_reverse_compare:Object.freeze(['variant','trick_rule']),
    set_last_showdown_suit_to_trump:Object.freeze(['trump','showdown_value','suit_control']),
    increase_last_showdown_rank:Object.freeze(['showdown_value','rank_control']),
    grant_next_trick_hand_capacity:Object.freeze(['hand_control','draw']),
    discard_secondary_target:Object.freeze(['hand_control']),
    draw_cards:Object.freeze(['hand_control','draw'])
  });
  const CONDITION_TAGS=Object.freeze({
    chips_spent:Object.freeze(['chip','hand_control']),
    effective_rank_at_most:Object.freeze(['low_rank']),
    effective_suit_is_trump:Object.freeze(['trump']),
    river_hit:Object.freeze(['river']),
    slot_is:Object.freeze(['slot']),
    slot_at_least:Object.freeze(['slot']),
    player_has_advantage:Object.freeze(['advantage']),
    enemy_has_advantage:Object.freeze(['advantage']),
    set_wins_at_least:Object.freeze(['trick_win']),
    pure_card_in_hand:Object.freeze(['pure']),
    pure_card_in_showdown:Object.freeze(['pure']),
    printed_equals_trick:Object.freeze(['original_value']),
    unmodified_trick_value:Object.freeze(['original_value'])
  });
  const TRIGGER_TAGS=Object.freeze({
    on_trick_win:Object.freeze(['trick_win']),
    on_trick_loss:Object.freeze(['trick_loss']),
    on_trick_draw:Object.freeze(['trick_draw']),
    after_card_slotted:Object.freeze(['slot']),
    before_showdown:Object.freeze(['showdown']),
    on_showdown_score:Object.freeze(['showdown']),
    after_showdown_result:Object.freeze(['showdown']),
    before_damage:Object.freeze(['defense']),
    after_damage:Object.freeze(['defense'])
  });
  const HANDLER_TAGS=Object.freeze({
    repeat_last_named_numeric:Object.freeze(['copy','variant']),
    deplete_battery_in_hand:Object.freeze(['risk'])
  });

  function tagDefinition(id){return TAG_DEFINITIONS[id]||null}
  function tagIds(){return Object.keys(TAG_DEFINITIONS)}
  function isKnownTag(id){return!!tagDefinition(id)}
  function addKnownTag(tags,id){if(tags?.add&&isKnownTag(id))tags.add(id);return tags}
  function addKnownTags(tags,ids){for(const id of ids||[])addKnownTag(tags,id);return tags}

  function addActionTags(tags,action){
    addKnownTags(tags,ACTION_TAGS[action]);
    const text=String(action||'');
    if(text.includes('field'))addKnownTag(tags,'field');
    if(text.includes('slot'))addKnownTag(tags,'slot');
    if(text.includes('forecast')||text.includes('reveal'))addKnownTag(tags,'information');
    return tags;
  }
  function addConditionTags(tags,condition){addKnownTags(tags,CONDITION_TAGS[condition]);return tags}
  function addTriggerTags(tags,trigger){addKnownTags(tags,TRIGGER_TAGS[trigger]);return tags}
  function addHandlerTags(tags,handler){
    addKnownTags(tags,HANDLER_TAGS[handler]);
    const text=String(handler||'');
    if(text.includes('field'))addKnownTag(tags,'field');
    if(text.includes('slot'))addKnownTag(tags,'slot');
    return tags;
  }
  function addTermTags(tags,term){
    const text=String(term||'');
    if(text.includes('필드'))addKnownTag(tags,'field');
    if(text.includes('트럼프'))addKnownTag(tags,'trump');
    if(text.includes('예측')||text.includes('정보'))addKnownTag(tags,'information');
    if(text.includes('예약'))addKnownTag(tags,'reservation');
    if(text.includes('손패')||text.includes('드로우')||text.includes('버림')||text.includes('교환'))addKnownTag(tags,'hand_control');
    if(text.includes('드로우'))addKnownTag(tags,'draw');
    if(text.includes('칩'))addKnownTag(tags,'chip');
    if(text.includes('출혈')||text.includes('상태'))addKnownTag(tags,'status');
    if(text.includes('보호막'))addKnownTag(tags,'defense');
    if(text.includes('쇼다운 슬롯'))addKnownTag(tags,'slot');
    if(text.includes('쇼다운값'))addKnownTag(tags,'showdown_value');
    if(text.includes('우세'))addKnownTag(tags,'advantage');
    if(text.includes('리버'))addKnownTag(tags,'river');
    if(text.includes('순수'))addKnownTag(tags,'pure');
    if(text.includes('피해'))addKnownTag(tags,'damage');
    if(text.includes('회복'))addKnownTag(tags,'sustain');
    return tags;
  }

  function explicitSystemTags(definition){return Array.isArray(definition?.systemTags)?definition.systemTags:[]}
  function unknownExplicitTags(definition){return explicitSystemTags(definition).filter(id=>!isKnownTag(id))}
  function inferDefinitionTags(definition){
    if(!definition||typeof definition!=='object')return[];
    const tags=new Set();
    addKnownTags(tags,explicitSystemTags(definition));
    const effects=Array.isArray(definition.effects)?definition.effects:[];
    for(const effect of effects){
      addTriggerTags(tags,effect?.trigger);
      addActionTags(tags,effect?.action);
      addConditionTags(tags,effect?.condition);
      addHandlerTags(tags,effect?.handler);
    }
    for(const term of definition.terms||[])addTermTags(tags,term);
    if(definition.targeting?.zone==='hand')addKnownTag(tags,'hand_control');
    return[...tags].sort();
  }
  function validateDefinition(definition){
    if(!definition||typeof definition!=='object')return['definition must be an object'];
    return unknownExplicitTags(definition).map(id=>`${definition.id||'unknown'}: unknown system tag ${id}`);
  }
  function validateDefinitions(definitions){return(definitions||[]).flatMap(validateDefinition)}

  return{TAG_DEFINITIONS,ACTION_TAGS,CONDITION_TAGS,TRIGGER_TAGS,HANDLER_TAGS,tagDefinition,tagIds,isKnownTag,addKnownTag,addKnownTags,addActionTags,addConditionTags,addTriggerTags,addHandlerTags,addTermTags,explicitSystemTags,unknownExplicitTags,inferDefinitionTags,validateDefinition,validateDefinitions};
});
