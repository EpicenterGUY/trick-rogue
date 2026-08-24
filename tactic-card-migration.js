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
      cardText:'이 카드의 트릭 무늬를 현재 트럼프로 바꾸고 트릭 숫자 +1. 인쇄값과 쇼다운값은 변하지 않는다.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'set_next_trick_suit_to_trump',duration:'trick'},
        {trigger:'on_play',action:'increase_next_trick_rank',value:1,duration:'trick'}
      ]),
      note:'트럼프 시너지 없이도 최소한의 트릭 가치를 갖도록 숫자 +1을 함께 부여한다.'
    }),
    Object.freeze({
      legacyId:'plus2',name:'랭크 부스트',printedSuit:'S',printedRank:3,status:'direct',activationStage:'3-1',
      cardText:'이 카드의 트릭 숫자 +2.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_next_trick_rank',value:2,duration:'trick'}]),
      note:'낮은 인쇄 숫자에 즉시 트릭 보정을 붙이는 기준 카드다.'
    }),
    Object.freeze({
      legacyId:'draw',name:'드로우',printedSuit:'C',printedRank:6,status:'engine_support',activationStage:'3-2B',
      cardText:'이 카드를 낸 뒤 다음 트릭의 손패가 1장 많아지도록 추가 드로우한다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}]),
      requires:Object.freeze(['temporary_hand_capacity','post_refill_draw']),
      note:'최대 손패 3 규칙은 유지하고 다음 트릭 한정으로 손패 한도와 보충 드로우를 각각 +1 한다.'
    }),
    Object.freeze({
      legacyId:'scout',name:'정찰',printedSuit:'D',printedRank:9,status:'redesign',activationStage:'3-2B',
      cardText:'다음 트릭의 적 카드를 현재 트릭 종료 전에 미리 공개한다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'}]),
      requires:Object.freeze(['next_enemy_preview_ui']),
      note:'적 부분 정보 규칙과 연결해 다음 트릭의 적 카드를 정확히 선공개한다.'
    }),
    Object.freeze({
      legacyId:'double',name:'더블다운',printedSuit:'H',printedRank:2,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'이번 세트에서 트릭을 3번 이상 이겼다면 쇼다운 위력 +6.',
      proposedEffects:Object.freeze([{trigger:'on_showdown_score',action:'showdown_power',value:6,condition:'set_wins_at_least',conditionValue:3,duration:'set'}]),
      requires:Object.freeze(['set_wins_condition']),
      note:'세트의 실제 트릭 성과를 보상하는 저랭크 카드다.'
    }),
    Object.freeze({
      legacyId:'barrier',name:'세이프가드',printedSuit:'S',printedRank:6,status:'direct',activationStage:'3-1',
      cardText:'이 카드를 낼 때 보호막 3. 이 카드로 트릭 패배 시 보호막 3을 추가로 얻는다.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'gain_shield',value:3,duration:'battle'},
        {trigger:'on_trick_loss',action:'gain_shield',value:3,duration:'battle'}
      ]),
      note:'즉시 방어만 하는 비상 방패와 달리 패배를 감수하면 추가 보호막을 얻는다.'
    }),
    Object.freeze({
      legacyId:'burn',name:'패갈이',printedSuit:'C',printedRank:2,status:'engine_support',activationStage:'3-2B',
      cardText:'사용 시 손패에서 이 카드 외 1장을 선택해 버리고 칩 +1, 카드 1장을 뽑는다.',
      proposedEffects:Object.freeze([
        {trigger:'on_play',action:'discard_secondary_target',duration:'trick'},
        {trigger:'on_play',action:'gain_chips',value:1,duration:'trick'},
        {trigger:'on_play',action:'draw_cards',value:1,duration:'trick'}
      ]),
      requires:Object.freeze(['secondary_hand_target']),
      targeting:Object.freeze({zone:'hand',count:1,excludeSelf:true}),
      note:'손패 1장을 교체하면서 칩을 얻는 손패 관리 카드다.'
    }),
    Object.freeze({
      legacyId:'reverse',name:'리버스',printedSuit:'H',printedRank:3,status:'direct',activationStage:'3-1',
      cardText:'이번 트릭은 낮은 트릭 숫자가 승리한다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_reverse_compare',duration:'trick'}]),
      note:'낮은 인쇄 숫자와 효과가 자연스럽게 맞물리는 트릭 특화 카드다.'
    }),
    Object.freeze({
      legacyId:'pureboost',name:'정공법',printedSuit:'D',printedRank:5,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'이 카드를 낼 때 이미 쇼다운 슬롯에 순수 카드가 1장 이상 있으면 트릭 숫자 +3.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_next_trick_rank',value:3,condition:'pure_card_in_showdown',duration:'trick'}]),
      requires:Object.freeze(['pure_card_in_showdown_condition']),
      note:'순수 카드를 먼저 쇼다운에 쌓았을 때 높은 트릭 보정을 얻는 연계 카드다.'
    }),
    Object.freeze({
      legacyId:'clean',name:'무첨가',printedSuit:'S',printedRank:4,status:'redesign',activationStage:ACTIVATION_STAGE,
      cardText:'이 카드로 트릭 승리 시 현재 쇼다운 슬롯에 순수 카드가 1장 이상 있으면 칩 +2.',
      proposedEffects:Object.freeze([{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'pure_card_in_showdown',duration:'trick'}]),
      requires:Object.freeze(['pure_card_in_showdown_condition']),
      note:'순수 카드를 쇼다운 재료로 사용했을 때 칩 자원으로 환급하는 연계 카드다.'
    }),
    Object.freeze({
      legacyId:'recolor',name:'재도색',printedSuit:'C',printedRank:9,status:'direct',activationStage:'3-1',
      cardText:'이 카드의 쇼다운 무늬를 현재 트럼프 무늬로 바꾼다.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'set_last_showdown_suit_to_trump',duration:'set'}]),
      note:'자기 쇼다운 무늬만 바꾸는 족보 조작 카드다.'
    }),
    Object.freeze({
      legacyId:'fakeid',name:'가짜 신분증',printedSuit:'H',printedRank:10,status:'direct',activationStage:'3-1',
      cardText:'이 카드의 쇼다운 숫자 +1.',
      proposedEffects:Object.freeze([{trigger:'on_play',action:'increase_last_showdown_rank',value:1,duration:'set'}]),
      note:'인쇄값은 유지하고 자기 쇼다운값만 바꾼다.'
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
