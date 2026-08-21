(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.TacticCardMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUITS=Object.freeze(['S','H','D','C']);
  const RANKS=Object.freeze([2,3,4,5,6,7,8,9,10,11,12,13,14]);
  const MIGRATION_STAGE='3-0';
  const SUPPORT_STAGE='3-2A';
  const RUNTIME_ACTIVE=false;
  const SUPPORTED_REQUIREMENTS=Object.freeze([
    'temporary_hand_capacity','post_refill_draw','secondary_hand_target','next_enemy_preview_ui',
    'advantage_count_condition','unmodified_trick_value_condition','printed_equals_trick_condition'
  ]);

  const PLAN=Object.freeze([
    Object.freeze({
      legacyId:'paint',name:'페인트',printedSuit:'D',printedRank:4,status:'direct',
      cardText:'이 카드의 트릭 무늬를 현재 트럼프로 바꾼다. 인쇄값과 쇼다운값은 변하지 않는다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_next_trick_suit_to_trump',duration:'trick'}]),
      note:'기존 전술 액션이 on_play에서 현재 카드의 트릭값에 적용되도록 옮길 수 있다.'
    }),
    Object.freeze({
      legacyId:'plus2',name:'숫자 +2',printedSuit:'S',printedRank:3,status:'direct',
      cardText:'이 카드의 트릭 숫자 +2.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_next_trick_rank',value:2,duration:'trick'}]),
      note:'낮은 인쇄 숫자에 즉시 트릭 보정을 붙이는 기본 효과 카드 후보.'
    }),
    Object.freeze({
      legacyId:'draw',name:'드로우',printedSuit:'C',printedRank:6,status:'engine_support',
      cardText:'이 카드를 낸 뒤 다음 트릭의 손패가 1장 많아지도록 추가 드로우한다.',
      proposedEffects:Object.freeze([]),
      requires:Object.freeze(['temporary_hand_capacity','post_refill_draw']),
      note:'3-2A에서 다음 트릭 한정 손패 한도와 보충 후 추가 드로우 기반을 마련했다. 실제 카드 활성화는 3-2B에서 한다.'
    }),
    Object.freeze({
      legacyId:'scout',name:'정찰',printedSuit:'D',printedRank:9,status:'redesign',
      cardText:'다음 트릭의 적 카드를 현재 트릭 종료 전에 미리 공개한다.',
      proposedEffects:Object.freeze([]),
      requires:Object.freeze(['next_enemy_preview_ui']),
      note:'현재 트릭의 적 카드는 기본 완전 공개이므로 다음 트릭 카드 선공개로 재설계한다. 3-2A에서 미리보기 공개 훅을 마련했다.'
    }),
    Object.freeze({
      legacyId:'double',name:'더블다운',printedSuit:'H',printedRank:2,status:'redesign',
      cardText:'쇼다운에서 내가 우세 무늬를 2개 이상 확보했다면 쇼다운 위력 +6.',
      proposedEffects:Object.freeze([]),
      requires:Object.freeze(['advantage_count_condition']),
      note:'3-2A에서 우세 개수 조건을 지원한다. +6 수치는 3-2B 밸런스 확정 전까지 활성화하지 않는다.'
    }),
    Object.freeze({
      legacyId:'barrier',name:'임시 장벽',printedSuit:'S',printedRank:6,status:'direct',
      cardText:'사용 시 보호막 3을 얻는다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'gain_shield',value:3,duration:'battle'}]),
      note:'기존 공통 상태/피해 엔진에 그대로 연결 가능.'
    }),
    Object.freeze({
      legacyId:'burn',name:'번',printedSuit:'C',printedRank:2,status:'engine_support',
      cardText:'사용 시 손패에서 이 카드 외 1장을 선택해 버리고 칩 +1, 카드 1장을 뽑는다.',
      proposedEffects:Object.freeze([]),
      requires:Object.freeze(['secondary_hand_target']),
      note:'3-2A에서 일반 카드 사용 전 2차 손패 대상 선택과 대상 전달 기반을 마련했다. 실제 카드 활성화는 3-2B에서 한다.'
    }),
    Object.freeze({
      legacyId:'reverse',name:'리버스',printedSuit:'H',printedRank:3,status:'direct',
      cardText:'이번 트릭은 낮은 트릭 숫자가 승리한다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_reverse_compare',duration:'trick'}]),
      note:'낮은 인쇄 숫자와 효과가 자연스럽게 맞물리는 트릭 특화 카드.'
    }),
    Object.freeze({
      legacyId:'pureboost',name:'기본에 충실',printedSuit:'D',printedRank:5,status:'redesign',
      cardText:'이 카드에 다른 트릭 보정이 없다면 트릭 숫자 +2.',
      proposedEffects:Object.freeze([]),
      requires:Object.freeze(['unmodified_trick_value_condition']),
      note:'3-2A에서 순수 카드 타입 대신 인쇄값과 트릭값 동일 여부를 검사하는 조건을 지원한다.'
    }),
    Object.freeze({
      legacyId:'clean',name:'무첨가',printedSuit:'S',printedRank:4,status:'redesign',
      cardText:'이 카드의 트릭값이 인쇄값과 같은 상태로 승리하면 칩 +2.',
      proposedEffects:Object.freeze([]),
      requires:Object.freeze(['printed_equals_trick_condition']),
      note:'3-2A에서 순수 카드 타입 의존 없이 값 변경 여부를 판정하는 조건을 지원한다.'
    }),
    Object.freeze({
      legacyId:'recolor',name:'색칠공부',printedSuit:'C',printedRank:9,status:'direct',
      cardText:'이 카드의 쇼다운 무늬를 현재 트럼프 무늬로 바꾼다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_last_showdown_suit_to_trump',duration:'set'}]),
      note:'카드는 on_play 전에 슬롯에 들어가므로 기존 최근 슬롯 액션이 자기 자신을 대상으로 삼을 수 있다.'
    }),
    Object.freeze({
      legacyId:'fakeid',name:'가짜 신분증',printedSuit:'H',printedRank:10,status:'direct',
      cardText:'이 카드의 쇼다운 숫자 +1.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_last_showdown_rank',value:1,duration:'set'}]),
      note:'인쇄값은 유지하고 자기 쇼다운값만 바꾸는 형태로 직접 이관 가능.'
    })
  ]);

  const BY_ID=Object.freeze(Object.fromEntries(PLAN.map(entry=>[entry.legacyId,entry])));
  const DIRECT_IDS=Object.freeze(PLAN.filter(entry=>entry.status==='direct').map(entry=>entry.legacyId));
  const BLOCKED_IDS=Object.freeze(PLAN.filter(entry=>entry.status!=='direct').map(entry=>entry.legacyId));

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
    }
    return errors;
  }
  function unsupportedRequirements(entry){return(entry?.requires||[]).filter(requirement=>!SUPPORTED_REQUIREMENTS.includes(requirement))}
  function engineSupportReady(entry){return!!entry&&entry.status!=='direct'&&unsupportedRequirements(entry).length===0}

  function summary(){
    return Object.freeze({
      stage:MIGRATION_STAGE,
      supportStage:SUPPORT_STAGE,
      runtimeActive:RUNTIME_ACTIVE,
      total:PLAN.length,
      direct:DIRECT_IDS.length,
      blocked:BLOCKED_IDS.length,
      engineSupported:BLOCKED_IDS.filter(id=>engineSupportReady(BY_ID[id])).length,
      directIds:DIRECT_IDS,
      blockedIds:BLOCKED_IDS
    });
  }

  return{SUITS,RANKS,MIGRATION_STAGE,SUPPORT_STAGE,RUNTIME_ACTIVE,SUPPORTED_REQUIREMENTS,PLAN,BY_ID,DIRECT_IDS,BLOCKED_IDS,validatePlan,unsupportedRequirements,engineSupportReady,summary};
});