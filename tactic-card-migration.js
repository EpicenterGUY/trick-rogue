(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.TacticCardMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUITS=Object.freeze(['S','H','D','C']);
  const RANKS=Object.freeze([2,3,4,5,6,7,8,9,10,11,12,13,14]);
  const MIGRATION_STAGE='3-0';
  const SUPPORT_STAGE='3-2A';
  const ACTIVATION_STAGE='3-2B';
  const RUNTIME_ACTIVE=true;
  const SUPPORTED_REQUIREMENTS=Object.freeze([
    'temporary_hand_capacity','post_refill_draw','secondary_hand_target','next_enemy_preview_ui',
    'unmodified_trick_value_condition','printed_equals_trick_condition'
  ]);

  const PLAN=Object.freeze([
    Object.freeze({
      legacyId:'paint',name:'페인트',printedSuit:'D',printedRank:4,status:'direct',activationStage:'3-1',
      cardText:'이 카드의 트릭 무늬를 현재 트럼프로 바꾼다. 인쇄값과 쇼다운값은 변하지 않는다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_next_trick_suit_to_trump',duration:'trick'}]),
      note:'기존 전술 액션이 on_play에서 현재 카드의 트릭값에 적용되도록 이관했다.'
    }),
    Object.freeze({
      legacyId:'plus2',name:'숫자 +2',printedSuit:'S',printedRank:3,status:'direct',activationStage:'3-1',
      cardText:'이 카드의 트릭 숫자 +2.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_next_trick_rank',value:2,duration:'trick'}]),
      note:'낮은 인쇄 숫자에 즉시 트릭 보정을 붙이는 일반 효과 카드로 이관했다.'
    }),
    Object.freeze({
      legacyId:'draw',name:'드로우',printedSuit:'C',printedRank:6,status:'engine_support',activationStage:ACTIVATION_STAGE,
      cardText:'이 카드를 낸 뒤 다음 트릭의 손패가 1장 많아지도록 추가 드로우한다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}]),
      requires:Object.freeze(['temporary_hand_capacity','post_refill_draw']),
      note:'최대 손패 3 규칙은 유지하고 다음 트릭 한정으로 손패 한도와 보충 드로우를 각각 +1 한다.'
    }),
    Object.freeze({
      legacyId:'scout',name:'정찰',printedSuit:'D',printedRank:9,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'다음 트릭의 적 카드를 현재 트릭 종료 전에 미리 공개한다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'}]),
      requires:Object.freeze(['next_enemy_preview_ui']),
      note:'현재 적 카드는 기본 완전 공개이므로 다음 트릭의 적 카드를 정확히 선공개하는 효과로 재설계했다.'
    }),
    Object.freeze({
      legacyId:'double',name:'더블다운',printedSuit:'H',printedRank:2,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'이 카드가 5번 쇼다운 슬롯에 있으면 쇼다운 위력 +6.',
      proposedEffects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:6,condition:'slot_is',conditionValue:5,duration:'set'}]),
      note:'상시 우세 무늬 시스템 제거에 맞춰 마지막 슬롯에 저랭크 카드를 커밋하는 쇼다운 보상 카드로 재설계했다.'
    }),
    Object.freeze({
      legacyId:'barrier',name:'임시 장벽',printedSuit:'S',printedRank:6,status:'direct',activationStage:'3-1',
      cardText:'사용 시 보호막 3을 얻는다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'gain_shield',value:3,duration:'battle'}]),
      note:'기존 공통 상태/피해 엔진에 그대로 연결해 이관했다.'
    }),
    Object.freeze({
      legacyId:'burn',name:'번',printedSuit:'C',printedRank:2,status:'engine_support',activationStage:ACTIVATION_STAGE,
      cardText:'사용 시 손패에서 이 카드 외 1장을 선택해 버리고 칩 +1, 카드 1장을 뽑는다.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'discard_secondary_target',duration:'trick'},
        {trigger:'on_play',action:'gain_chips',value:1,duration:'trick'},
        {trigger:'on_play',action:'draw_cards',value:1,duration:'trick'}
      ]),
      requires:Object.freeze(['secondary_hand_target']),
      targeting:Object.freeze({zone:'hand',count:1,excludeSelf:true}),
      note:'일반 카드 사용 전에 이 카드 외 손패 1장을 2차 대상으로 지정하고, 사용 시 버림→칩→드로우 순서로 처리한다.'
    }),
    Object.freeze({
      legacyId:'reverse',name:'리버스',printedSuit:'H',printedRank:3,status:'direct',activationStage:'3-1',
      cardText:'이번 트릭은 낮은 트릭 숫자가 승리한다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_reverse_compare',duration:'trick'}]),
      note:'낮은 인쇄 숫자와 효과가 자연스럽게 맞물리는 트릭 특화 카드로 이관했다.'
    }),
    Object.freeze({
      legacyId:'pureboost',name:'기본에 충실',printedSuit:'D',printedRank:5,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'이 카드에 다른 트릭 보정이 없다면 트릭 숫자 +2.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_next_trick_rank',value:2,condition:'unmodified_trick_value',duration:'trick'}]),
      requires:Object.freeze(['unmodified_trick_value_condition']),
      note:'순수 카드 타입 대신 효과 적용 직전 인쇄값과 트릭값이 같은지를 검사해 보정한다.'
    }),
    Object.freeze({
      legacyId:'clean',name:'무첨가',printedSuit:'S',printedRank:4,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'이 카드의 트릭값이 인쇄값과 같은 상태로 승리하면 칩 +2.',
      proposedEffects:Object.freeze([{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'printed_equals_trick',duration:'trick'}]),
      requires:Object.freeze(['printed_equals_trick_condition']),
      note:'순수 카드 분류 없이 실제 인쇄값과 트릭값이 같은 상태로 승리했는지만 검사한다.'
    }),
    Object.freeze({
      legacyId:'recolor',name:'색칠공부',printedSuit:'C',printedRank:9,status:'direct',activationStage:'3-1',
      cardText:'이 카드의 쇼다운 무늬를 현재 트럼프 무늬로 바꾼다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_last_showdown_suit_to_trump',duration:'set'}]),
      note:'카드는 on_play 전에 슬롯에 들어가므로 기존 최근 슬롯 액션이 자기 자신을 대상으로 삼도록 이관했다.'
    }),
    Object.freeze({
      legacyId:'fakeid',name:'가짜 신분증',printedSuit:'H',printedRank:10,status:'direct',activationStage:'3-1',
      cardText:'이 카드의 쇼다운 숫자 +1.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_last_showdown_rank',value:1,duration:'set'}]),
      note:'인쇄값은 유지하고 자기 쇼다운값만 바꾸는 형태로 이관했다.'
    })
  ]);

  const BY_ID=Object.freeze(Object.fromEntries(PLAN.map(entry=>[entry.legacyId,entry])));
  const DIRECT_IDS=Object.freeze(PLAN.filter(entry=>entry.status==='direct').map(entry=>entry.legacyId));
  const ACTIVE_IDS=Object.freeze(PLAN.filter(entry=>entry.proposedEffects.length>0).map(entry=>entry.legacyId));
  const BLOCKED_IDS=Object.freeze(PLAN.filter(entry=>entry.proposedEffects.length===0).map(entry=>entry.legacyId));

  function validatePlan(plan=PLAN){
    const errors=[];
    const ids=new Set(),slots=new Set();
    for(const entry of plan){
      if(!entry||typeof entry!=='object'){errors.push('invalid entry');continue}
      if(ids.has(entry.legacyId))errors.push(`duplicate id: ${entry.legacyId}`);else ids.add(entry.legacyId);
      if(!SUITS.includes(entry.printedSuit))errors.push(`${entry.legacyId}: invalid suit ${entry.printedSuit}`);
      if(!RANKS.includes(entry.printedRank))errors.push(`${entry.legacyId}: invalid rank ${entry.printedRank}`);
      const slot=`${entry.printedSuit}:${entry.printedRank}`;
      if(slots.has(slot))errors.push(`duplicate printed slot: ${slot}`);else slots.add(slot);
      if(!['direct','engine_support','redesign'].includes(entry.status))errors.push(`${entry.legacyId}: invalid status ${entry.status}`);
      if(!entry.cardText)errors.push(`${entry.legacyId}: missing cardText`);
      if(!Array.isArray(entry.proposedEffects))errors.push(`${entry.legacyId}: proposedEffects must be an array`);
      if(!entry.activationStage)errors.push(`${entry.legacyId}: missing activationStage`);
    }
    return errors;
  }
  function unsupportedRequirements(entry){return(entry?.requires||[]).filter(requirement=>!SUPPORTED_REQUIREMENTS.includes(requirement))}
  function engineSupportReady(entry){return!!entry&&unsupportedRequirements(entry).length===0}

  function summary(){
    return Object.freeze({
      stage:MIGRATION_STAGE,
      supportStage:SUPPORT_STAGE,
      activationStage:ACTIVATION_STAGE,
      runtimeActive:RUNTIME_ACTIVE,
      total:PLAN.length,
      direct:DIRECT_IDS.length,
      active:ACTIVE_IDS.length,
      blocked:BLOCKED_IDS.length,
      engineSupported:PLAN.filter(engineSupportReady).length,
      directIds:DIRECT_IDS,
      activeIds:ACTIVE_IDS,
      blockedIds:BLOCKED_IDS
    });
  }

  return{SUITS,RANKS,MIGRATION_STAGE,SUPPORT_STAGE,ACTIVATION_STAGE,RUNTIME_ACTIVE,SUPPORTED_REQUIREMENTS,PLAN,BY_ID,DIRECT_IDS,ACTIVE_IDS,BLOCKED_IDS,validatePlan,unsupportedRequirements,engineSupportReady,summary};
});
