(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.TacticCardMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUITS=Object.freeze(['S','H','D','C']);
  const RANKS=Object.freeze([2,3,4,5,6,7,8,9,10,11,12,13,14]);
  const MIGRATION_STAGE='3-0';
  const SUPPORT_STAGE='7.5-P';
  const ACTIVATION_STAGE='7.5-P';
  const RUNTIME_ACTIVE=true;
  const SUPPORTED_REQUIREMENTS=Object.freeze([
    'temporary_hand_capacity','post_refill_draw','secondary_hand_target','next_enemy_preview_ui',
    'set_wins_condition','pure_card_in_hand_condition','pure_card_in_showdown_condition'
  ]);

  const PLAN=Object.freeze([
    Object.freeze({
      legacyId:'paint',name:'트럼프 페인트',printedSuit:'D',printedRank:4,status:'direct',activationStage:'3-1',
      cardText:'낼 때 — 원래 무늬가 현재 트럼프가 아니면 이번 트릭의 무늬를 현재 트럼프로 바꾼다. 원래부터 트럼프였다면 대신 적용 숫자 +4. 인쇄값과 쇼다운값은 바뀌지 않는다.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'printed_suit_is_not_trump',duration:'trick'},
        {trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'printed_suit_is_trump',duration:'trick'}
      ]),
      note:'트럼프를 덧칠하되 이미 같은 색이면 숫자 보정으로 전환한다.'
    }),
    Object.freeze({
      legacyId:'plus2',name:'랭크 부스트',printedSuit:'S',printedRank:3,status:'direct',activationStage:'3-1',
      cardText:'낼 때 — 이번 트릭 적용 숫자 +3.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_next_trick_rank',value:3,duration:'trick'}]),
      note:'복잡한 카드 사이의 단순 기준 카드다.'
    }),
    Object.freeze({
      legacyId:'draw',name:'드로우',printedSuit:'C',printedRank:6,status:'engine_support',activationStage:'3-2B',
      cardText:'낼 때 — 다음 트릭의 최대 손패와 보충 드로우 +1.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}]),
      requires:Object.freeze(['temporary_hand_capacity','post_refill_draw']),
      note:'최대 손패 3의 압박을 유지하고 다음 트릭에만 한 장을 더 준다.'
    }),
    Object.freeze({
      legacyId:'scout',name:'정찰',printedSuit:'D',printedRank:9,status:'redesign',activationStage:'3-2B',
      cardText:'낼 때 — 다음 트릭에 적이 사용할 카드의 인쇄 숫자와 무늬를 정확히 공개한다. 그 다음 트릭에서 더 낮은 인쇄 숫자를 냈는데 승리했다면 칩 +1.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'},
        {trigger:'on_play',action:'reserve_next_trick_comparison_reward',value:1,rewardAction:'gain_chips',duration:'battle'}
      ]),
      requires:Object.freeze(['next_enemy_preview_ui']),
      note:'정보를 실제 위험한 역전 승리로 연결하는 다음 트릭 1회 예약이다.'
    }),
    Object.freeze({
      legacyId:'double',name:'더블다운',printedSuit:'H',printedRank:2,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'낼 때 — 칩이 1개 이상이면 칩 1을 소비하고 이번 트릭 적용 숫자 +5. 이 효과로 칩을 소비한 뒤 승리하면 칩 +2.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'spend_chips',value:1,condition:'chips_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'},
        {trigger:'on_play',action:'increase_next_trick_rank',value:5,condition:'card_memory_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'},
        {trigger:'on_trick_win',action:'gain_chips',value:2,condition:'card_memory_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'}
      ]),
      note:'실제 칩을 걸어 이번 트릭을 밀어붙이고 성공하면 추가 칩을 회수한다.'
    }),
    Object.freeze({
      legacyId:'barrier',name:'세이프가드',printedSuit:'S',printedRank:6,status:'direct',activationStage:'3-1',
      cardText:'낼 때 — 보호막 3. 패배 — 보호막 3 추가.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'gain_shield',value:3,duration:'battle'},
        {trigger:'on_trick_loss',action:'gain_shield',value:3,duration:'battle'}
      ]),
      note:'패배를 감수해도 방어 이득을 남기는 기준 카드다.'
    }),
    Object.freeze({
      legacyId:'burn',name:'패갈이',printedSuit:'C',printedRank:2,status:'engine_support',activationStage:'3-2B',
      cardText:'낼 때 — 이 카드 이외의 손패 1장을 버린다. 칩 +1. 카드 1장 드로우.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'discard_secondary_target',duration:'trick'},
        {trigger:'on_play',action:'gain_chips',value:1,duration:'trick'},
        {trigger:'on_play',action:'draw_cards',value:1,duration:'trick'}
      ]),
      requires:Object.freeze(['secondary_hand_target']),
      targeting:Object.freeze({zone:'hand',count:1,excludeSelf:true}),
      note:'기존 대상 지정과 손패 교환 기능을 그대로 유지한다.'
    }),
    Object.freeze({
      legacyId:'reverse',name:'리버스',printedSuit:'H',printedRank:3,status:'direct',activationStage:'3-1',
      cardText:'낼 때 — 이번 트릭은 낮은 최종 적용 숫자가 승리. 동점은 무승부.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_reverse_compare',duration:'trick'}]),
      note:'트럼프 계산은 유지하고 최종 숫자 비교 방향만 뒤집는다.'
    }),
    Object.freeze({
      legacyId:'pureboost',name:'정공법',printedSuit:'D',printedRank:5,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'낼 때 — 바로 이전 쇼다운 슬롯의 카드가 순수 카드라면 이번 트릭 적용 숫자 +4. 1번 슬롯에서는 발동하지 않는다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'previous_showdown_slot_is_pure',duration:'trick'}]),
      note:'순수 카드의 총량이 아니라 직전 슬롯과의 순서를 고민하게 한다.'
    }),
    Object.freeze({
      legacyId:'clean',name:'무첨가',printedSuit:'S',printedRank:4,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'승리 — 현재 쇼다운 슬롯에 이 카드 이외의 순수 카드가 1장 이상 있다면 칩 +2.',
      proposedEffects:Object.freeze([{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'pure_card_in_showdown',duration:'trick'}]),
      requires:Object.freeze(['pure_card_in_showdown_condition']),
      note:'효과 카드인 자기 자신은 순수 카드 조건을 충족하지 않는다.'
    }),
    Object.freeze({
      legacyId:'recolor',name:'재도색',printedSuit:'C',printedRank:9,status:'direct',activationStage:'3-1',
      cardText:'낼 때 — 이 카드의 쇼다운 무늬를 현재 트럼프 무늬로 바꾼다. 트릭 무늬와 인쇄 무늬는 바뀌지 않는다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_last_showdown_suit_to_trump',duration:'set'}]),
      note:'쇼다운 족보만 조작하는 기준 카드다.'
    }),
    Object.freeze({
      legacyId:'fakeid',name:'가짜 신분증',printedSuit:'H',printedRank:10,status:'direct',activationStage:'3-1',
      cardText:'낼 때 — 바로 이전 쇼다운 카드의 숫자를 복사한다. 무늬는 바뀌지 않는다. 1번 슬롯에서는 효과가 없다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'copy_previous_showdown_rank',condition:'previous_showdown_slot_exists',duration:'set'}]),
      note:'이전 슬롯의 쇼다운 숫자를 복제해 족보를 조작한다.'
    })
  ]);

  const BY_ID=Object.freeze(Object.fromEntries(PLAN.map(entry=>[entry.legacyId,entry])));
  const DIRECT_IDS=Object.freeze(PLAN.filter(entry=>entry.status==='direct').map(entry=>entry.legacyId));
  const ACTIVE_IDS=Object.freeze(PLAN.filter(entry=>entry.proposedEffects.length>0).map(entry=>entry.legacyId));
  const BLOCKED_IDS=Object.freeze(PLAN.filter(entry=>entry.proposedEffects.length===0).map(entry=>entry.legacyId));

  function validatePlan(plan=PLAN){
    const errors=[];const ids=new Set(),slots=new Set();
    for(const entry of plan){
      if(!entry||typeof entry!=='object'){errors.push('invalid entry');continue}
      if(ids.has(entry.legacyId))errors.push(`duplicate id: ${entry.legacyId}`);else ids.add(entry.legacyId);
      if(!SUITS.includes(entry.printedSuit))errors.push(`${entry.legacyId}: invalid suit ${entry.printedSuit}`);
      if(!RANKS.includes(entry.printedRank))errors.push(`${entry.legacyId}: invalid rank ${entry.printedRank}`);
      const slot=`${entry.printedSuit}:${entry.printedRank}`;if(slots.has(slot))errors.push(`duplicate printed slot: ${slot}`);else slots.add(slot);
      if(!['direct','engine_support','redesign'].includes(entry.status))errors.push(`${entry.legacyId}: invalid status ${entry.status}`);
      if(!entry.cardText)errors.push(`${entry.legacyId}: missing cardText`);
      if(!Array.isArray(entry.proposedEffects))errors.push(`${entry.legacyId}: proposedEffects must be an array`);
      if(!entry.activationStage)errors.push(`${entry.legacyId}: missing activationStage`);
    }
    return errors;
  }
  function unsupportedRequirements(entry){return(entry?.requires||[]).filter(requirement=>!SUPPORTED_REQUIREMENTS.includes(requirement))}
  function engineSupportReady(entry){return!!entry&&unsupportedRequirements(entry).length===0}
  function summary(){return Object.freeze({stage:MIGRATION_STAGE,supportStage:SUPPORT_STAGE,activationStage:ACTIVATION_STAGE,runtimeActive:RUNTIME_ACTIVE,total:PLAN.length,direct:DIRECT_IDS.length,active:ACTIVE_IDS.length,blocked:BLOCKED_IDS.length,engineSupported:PLAN.filter(engineSupportReady).length,directIds:DIRECT_IDS,activeIds:ACTIVE_IDS,blockedIds:BLOCKED_IDS})}

  return{SUITS,RANKS,MIGRATION_STAGE,SUPPORT_STAGE,ACTIVATION_STAGE,RUNTIME_ACTIVE,SUPPORTED_REQUIREMENTS,PLAN,BY_ID,DIRECT_IDS,ACTIVE_IDS,BLOCKED_IDS,validatePlan,unsupportedRequirements,engineSupportReady,summary};
});
