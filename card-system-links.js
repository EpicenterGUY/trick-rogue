(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./effects.js'):root.CardEffects,
    typeof module!=='undefined'?require('./card-personality-runtime.js'):root.CardPersonalityRuntime,
    typeof module!=='undefined'?require('./chip-economy.js'):root.ChipEconomy,
    typeof module!=='undefined'?require('./combat-effects.js'):root.CombatEffects,
    typeof module!=='undefined'?require('./enemy-information.js'):root.EnemyInformation,
    root
  );
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CardSystemLinks=api;
  if(Array.isArray(root.EFFECT_CARD_DEFINITIONS))api.applyDefinitionPatches(root.EFFECT_CARD_DEFINITIONS);
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(NodeEffects,NodePersonality,NodeChipEconomy,NodeCombatEffects,NodeEnemyInformation,defaultRoot){
  const STAGE='CARD-SYSTEM-LINKS-V1';
  const STATE_KEY='cardSystemLinks';
  const MEMORY_KEY='cardEffectMemory';
  const COPYABLE_LABELS=Object.freeze({
    damage_enemy:'피해',heal_player:'회복',gain_chips:'칩',gain_shield:'보호막',apply_enemy_bleed:'출혈',increase_enemy_forecast:'예측'
  });
  let installed=false;

  const DEFINITION_PATCHES=Object.freeze({
    'pack01.recursive_function':Object.freeze({
      description:'낼 때 — 직전에 발동한 다른 효과 카드의 복사 가능한 수치 효과 하나를 기록한다. 승리 — 기록한 효과를 1회 재생한다. 자기 자신과 복사된 효과는 기록하지 않는다.',
      terms:['트릭','카드 메모리','피해','회복','칩','보호막','출혈','예측'],
      effects:[
        {trigger:'on_play',action:'snapshot_last_copyable_effect',memoryKey:'recursive_effect',duration:'set'},
        {trigger:'on_trick_win',action:'replay_card_memory_effect',memoryKey:'recursive_effect',duration:'trick'}
      ]
    }),
    'pack01.ambush_observer':Object.freeze({
      description:'3번 쇼다운 슬롯 — 다음 적 카드 정보 +2단계. 이미 다음 적 카드가 정확 공개 상태라면 대신 무료 손패 교환 1회를 준비한다.',
      terms:['쇼다운 슬롯','예측','정보','손패','드로우'],
      effects:[
        {trigger:'after_card_slotted',action:'increase_enemy_forecast',value:2,condition:'all',conditions:[{condition:'slot_is',conditionValue:3},{condition:'next_enemy_exact_unknown'}],duration:'set'},
        {trigger:'after_card_slotted',action:'grant_free_hand_exchange',value:1,condition:'all',conditions:[{condition:'slot_is',conditionValue:3},{condition:'next_enemy_exact_known'}],duration:'set'}
      ]
    }),
    'pack02.trump_signal':Object.freeze({
      description:'승리 — 최종 트릭 무늬가 현재 트럼프라면 칩 +1. 인쇄 무늬는 트럼프가 아니었는데 효과로 트럼프가 되었다면 추가 칩 +1.',
      terms:['트럼프','트릭값','인쇄값','칩'],
      effects:[
        {trigger:'on_trick_win',action:'gain_chips',value:1,condition:'effective_suit_is_trump',duration:'trick'},
        {trigger:'on_trick_win',action:'gain_chips',value:1,condition:'all',conditions:[{condition:'effective_suit_is_trump'},{condition:'printed_suit_is_not_trump'}],duration:'trick'}
      ]
    }),
    'pack02.long_game':Object.freeze({
      description:'낼 때 — 현재까지의 이번 세트 승리 횟수를 기록한다. 이 카드가 쇼다운에 남아 있는 동안 이후 트릭에서 승리할 때마다 기록 +1. 쇼다운 — 기록이 1/2/3승 이상이면 위력 +2/+4/+8.',
      terms:['세트','트릭','카드 메모리','쇼다운','최종 위력'],
      effects:[
        {trigger:'on_play',action:'track_card_memory',initialFrom:'set_wins',memoryKey:'compound_wins',trackerTrigger:'on_trick_win',trackerDelta:1,uiLabel:'기록 승리',duration:'set'},
        {trigger:'on_showdown_score',action:'showdown_power_from_memory_tiers',memoryKey:'compound_wins',tiers:[{atLeast:1,value:2},{atLeast:2,value:4},{atLeast:3,value:8}],duration:'set'}
      ]
    }),
    'pack02.loaded_die':Object.freeze({
      description:'낼 때 — 이번 트릭의 기본 숫자를 2~12 중 무작위로 바꾼다. 이번 트릭에 칩을 이미 소비했다면 범위가 7~12로 좁아진다. 쇼다운 숫자는 인쇄 6 유지.',
      terms:['트릭','적용 숫자','칩','쇼다운','인쇄값'],
      effects:[
        {trigger:'on_play',action:'randomize_trick_rank',minRank:7,maxRank:12,memoryKey:'loaded_die_roll',condition:'chips_spent',duration:'trick'},
        {trigger:'on_play',action:'randomize_trick_rank',minRank:2,maxRank:12,memoryKey:'loaded_die_roll',condition:'chips_not_spent',duration:'trick'}
      ]
    }),
    'pack02.last_word':Object.freeze({
      description:'5번 쇼다운 슬롯 — 쇼다운 위력 +5. 이 카드로 5번째 트릭까지 승리했다면 추가 +5.',
      terms:['쇼다운 슬롯','트릭','승리','쇼다운','최종 위력'],
      effects:[
        {trigger:'on_showdown_score',action:'showdown_power',value:5,condition:'slot_is',conditionValue:5,duration:'set'},
        {trigger:'on_showdown_score',action:'showdown_power',value:5,condition:'all',conditions:[{condition:'slot_is',conditionValue:5},{condition:'slot_result_is_win'}],duration:'set'}
      ]
    }),
    'pack03.time_bomb':Object.freeze({
      description:'낼 때 — 두 트릭 뒤 종료에 피해 6을 예약한다. 폭발 전까지 이후 트릭에서 승리할 때마다 예약 피해 +3. 세트 안에 두 트릭이 남지 않았다면 불발한다.',
      terms:['예약','트릭','승리','피해'],
      effects:[{trigger:'on_play',action:'reserve_dynamic_damage',value:6,delayTricks:2,adjustTrigger:'on_trick_win',adjustValue:3,duration:'set'}]
    }),
    'pack03.bad_check':Object.freeze({
      description:'낼 때 — 이번 트릭 적용 숫자 +8, 부채 10을 기록한다. 이후 이번 세트에서 트릭 승리마다 부채 -3. 쇼다운 — 남은 부채만큼 위력이 감소한다.',
      terms:['트릭','적용 숫자','카드 메모리','쇼다운','최종 위력'],
      effects:[
        {trigger:'on_play',action:'increase_next_trick_rank',value:8,duration:'trick'},
        {trigger:'on_play',action:'track_card_memory',value:10,memoryKey:'bad_check_debt',trackerTrigger:'on_trick_win',trackerDelta:-3,trackerFloor:0,uiLabel:'부채',duration:'set'},
        {trigger:'on_showdown_score',action:'showdown_power_from_memory',memoryKey:'bad_check_debt',multiplier:-1,duration:'set'}
      ]
    }),
    'pack03.russian_roulette':Object.freeze({
      description:'낼 때 — 1/6 확률로 이번 트릭 숫자가 2, 그 외에는 A가 된다. 단, 현재 적 숫자를 정확히 알고 있고 이번 트릭에 칩을 이미 소비했다면 실패 시 1회 자동 재굴림한다. 쇼다운 숫자는 인쇄 10 유지.',
      terms:['트릭','적용 숫자','정보','칩','쇼다운','인쇄값'],
      effects:[{trigger:'on_play',action:'russian_roulette_controlled_rank',fireChance:0.16666666666666666,failRank:2,safeRank:14,memoryKey:'roulette_result',duration:'trick'}]
    }),
    'pack04.copycat':Object.freeze({
      description:'비교 전 — 현재 적 카드의 정확한 숫자를 알고 있다면 이번 트릭 기본 숫자를 적 인쇄 숫자와 같게 맞춘다. 모른다면 대신 적용 숫자 +2. 쇼다운은 인쇄 A 유지.',
      terms:['정보','트릭','적용 숫자','인쇄값','쇼다운'],
      effects:[
        {trigger:'before_compare',action:'match_enemy_printed_rank',condition:'enemy_exact_info_known',duration:'trick'},
        {trigger:'before_compare',action:'increase_next_trick_rank',value:2,condition:'enemy_exact_info_unknown',duration:'trick'}
      ]
    }),
    'pack04.midpoint':Object.freeze({
      description:'비교 전 — 현재 적 카드의 정확한 숫자를 알고 있다면 이 카드 인쇄 숫자와 적 인쇄 숫자의 평균(반올림)으로 맞춘다. 모른다면 인쇄 10 그대로 낸다.',
      terms:['정보','트릭','적용 숫자','인쇄값','쇼다운'],
      effects:[{trigger:'before_compare',action:'set_trick_rank_midpoint_enemy',condition:'enemy_exact_info_known',duration:'trick'}]
    }),
    'pack04.reverse_odds':Object.freeze({
      description:'낼 때 — 칩 1을 지불할 수 있다면 소비하고 이번 트릭은 낮은 최종 적용 숫자가 승리한다. 이 반전 트릭에서 승리하면 칩 +3. 칩이 없으면 반전 없이 ♠2로 낸다.',
      terms:['트릭','적용 숫자','칩'],
      effects:[
        {trigger:'on_play',action:'spend_chips',value:1,memoryKey:'reverse_odds_paid',condition:'chips_at_least',conditionValue:1,duration:'trick'},
        {trigger:'on_play',action:'set_reverse_compare',condition:'card_memory_at_least',memoryKey:'reverse_odds_paid',conditionValue:1,duration:'trick'},
        {trigger:'on_trick_win',action:'gain_chips',value:3,condition:'card_memory_at_least',memoryKey:'reverse_odds_paid',conditionValue:1,duration:'trick'}
      ]
    }),
    'pack04.seat_swap':Object.freeze({
      description:'낼 때 — 바로 이전 쇼다운 카드와 이 카드의 쇼다운 숫자·무늬를 통째로 교환한다. 1번 슬롯이거나 이전 슬롯이 고정되어 있으면 아무 일도 없다.',
      effects:[{trigger:'on_play',action:'swap_showdown_with_previous',condition:'all',conditions:[{condition:'previous_showdown_slot_exists'},{condition:'previous_showdown_slot_unlocked'}],duration:'set'}]
    }),
    'boss.theater.encore':Object.freeze({
      description:'패배 — 다음 트릭에서 처음 발동한 자신의 복사 가능한 수치 효과를 절반(올림) 값으로 한 번 더 발동한다.',
      terms:['패배','예약','효과 이력','피해','회복','칩','보호막','출혈','예측'],
      effects:[
        {trigger:'on_trick_loss',action:'reserve_next_trick_first_effect_replay',value:0.5,duration:'set'},
        {trigger:'on_trick_loss',action:'gain_shield',value:5,condition:'enemy_signature_fallback',duration:'battle'}
      ]
    }),
    'boss.theater.curtain_call':Object.freeze({
      description:'승리 — 상대에게 출혈 2. 5번 슬롯이라면 쇼다운에서 적의 남은 출혈 1당 위력 +1(최대 +6).',
      terms:['트릭','출혈','쇼다운 슬롯','쇼다운','최종 위력'],
      effects:[
        {trigger:'on_trick_win',action:'apply_enemy_bleed',value:2,duration:'battle'},
        {trigger:'on_showdown_score',action:'showdown_power_from_enemy_status',statusId:'bleed',multiplier:1,cap:6,condition:'slot_is',conditionValue:5,duration:'set'}
      ]
    }),
    'boss.observatory.fog_mirror':Object.freeze({
      description:'무승부 — 이번 적 카드의 인쇄 숫자를 이 카드의 쇼다운 숫자로 복사하고, 다음 적 카드를 정확히 공개한다.',
      terms:['무승부','정보','인쇄값','쇼다운'],
      effects:[
        {trigger:'on_trick_draw',action:'copy_enemy_printed_rank_to_showdown',duration:'set'},
        {trigger:'on_trick_draw',action:'reveal_next_enemy_card',duration:'trick'},
        {trigger:'on_trick_draw',action:'gain_shield',value:6,condition:'enemy_signature_fallback',duration:'battle'}
      ]
    }),
    'boss.observatory.redaction':Object.freeze({
      description:'승리 — 자신에게 걸린 해제 가능한 부정 상태 하나를 제거한다. 제거했다면 다음 적 카드를 정확히 공개하고, 제거할 상태가 없다면 보호막 3.',
      terms:['트릭','상태','정보','보호막'],
      effects:[
        {trigger:'on_trick_win',action:'remove_negative_status_or_fallback',fallbackShield:3,memoryKey:'redaction_removed',duration:'battle'},
        {trigger:'on_trick_win',action:'damage_enemy',value:3,condition:'enemy_signature_fallback',duration:'trick'},
        {trigger:'on_trick_win',action:'gain_shield',value:2,condition:'enemy_signature_fallback',duration:'battle'}
      ]
    }),
    'boss.frontier.war_tax':Object.freeze({
      description:'승리 — 칩 +1. 이미 칩이 최대라 1개도 얻지 못했다면 대신 적에게 피해 5.',
      terms:['트릭','칩','피해'],
      effects:[
        {trigger:'on_trick_win',action:'gain_chips_or_damage_overflow',value:1,fallbackDamage:5,duration:'trick'},
        {trigger:'on_trick_win',action:'damage_enemy',value:5,condition:'enemy_signature_fallback',duration:'trick'}
      ]
    }),
    'boss.frontier.entrench':Object.freeze({
      description:'무승부 — 보호막 5를 얻고 이 쇼다운 슬롯을 고정한다. 고정된 채 쇼다운까지 남았다면 위력 +5.',
      terms:['무승부','보호막','쇼다운 슬롯','쇼다운','최종 위력'],
      effects:[
        {trigger:'on_trick_draw',action:'gain_shield',value:5,duration:'battle'},
        {trigger:'on_trick_draw',action:'lock_showdown_slot',duration:'set'},
        {trigger:'on_trick_draw',action:'gain_shield',value:2,condition:'enemy_signature_fallback',duration:'battle'},
        {trigger:'on_showdown_score',action:'showdown_power',value:5,condition:'showdown_slot_locked',duration:'set'}
      ]
    })
  });

  function effectsApi(runtimeRoot=defaultRoot){return runtimeRoot?.CardEffects||NodeEffects||null}
  function personalityApi(runtimeRoot=defaultRoot){return runtimeRoot?.CardPersonalityRuntime||NodePersonality||null}
  function chipApi(runtimeRoot=defaultRoot){return runtimeRoot?.ChipEconomy||NodeChipEconomy||null}
  function combatApi(runtimeRoot=defaultRoot){return runtimeRoot?.CombatEffects||NodeCombatEffects||null}
  function enemyInfoApi(runtimeRoot=defaultRoot){return runtimeRoot?.EnemyInformation||NodeEnemyInformation||null}
  function activeBattle(runtimeRoot=defaultRoot,context={}){if(context?.battle)return context.battle;try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function currentSet(context={}){return Number(context.setIndex??context.set??context.battle?.setIndex??context.battle?.set??1)}
  function currentTrick(context={}){return Number(context.trick??context.trickIndex??context.battle?.trick??context.battle?.trickIndex??1)}
  function sourceCardId(card){return card?.cardId||card?.definition?.id||card?.named?.id||card?.id||null}
  function sourceCardUid(card){return card?.uid??card?.metadata?.uid??card?.instanceId??null}
  function slotCard(entry){return entry?.card||entry||null}
  function printedRank(card){return Number(card?.printedRank??card?.rank)}
  function printedSuit(card){return card?.printedSuit??card?.suit??null}
  function trickSuit(context={}){return context.trickSuit??context.effectiveSuit??context.card?.trickSuit??context.card?.effectiveSuit??context.card?.suit??null}
  function currentTrump(context={}){return context.currentTrump??context.trump??context.battle?.trump??null}
  function turnKey(context={}){return`${currentSet(context)}:${currentTrick(context)}`}
  function nextTurn(context={}){const set=currentSet(context),trick=currentTrick(context);return trick>=5?{set:set+1,trick:1}:{set,trick:trick+1}}
  function isLaterTurn(set,trick,createdSet,createdTrick){return set>createdSet||(set===createdSet&&trick>createdTrick)}

  function ensureState(battle){
    if(!battle||typeof battle!=='object')return null;
    if(!battle[STATE_KEY]||typeof battle[STATE_KEY]!=='object')battle[STATE_KEY]={};
    const state=battle[STATE_KEY];
    if(!Array.isArray(state.effectHistory))state.effectHistory=[];
    if(!Array.isArray(state.effectReplayReservations))state.effectReplayReservations=[];
    if(!state.freeHandExchange||typeof state.freeHandExchange!=='object')state.freeHandExchange={count:0,sourceCardUid:null,sourceCardId:null};
    if(!state.processedTrackerEvents||typeof state.processedTrackerEvents!=='object')state.processedTrackerEvents={};
    return state;
  }
  function memoryFor(card){
    if(!card||typeof card!=='object')return null;
    if(!card[MEMORY_KEY]||typeof card[MEMORY_KEY]!=='object')card[MEMORY_KEY]={};
    return card[MEMORY_KEY];
  }
  function setMemory(card,key,value,context={},metadata={}){
    if(!key)return null;const memory=memoryFor(card);if(!memory)return null;
    memory[key]={value,setIndex:currentSet(context),...metadata};return memory[key];
  }
  function getMemory(card,key,context={}){
    const entry=card?.[MEMORY_KEY]?.[key];if(!entry)return null;
    if(entry.setIndex!==undefined&&Number.isFinite(currentSet(context))&&Number(entry.setIndex)!==currentSet(context))return null;
    return entry;
  }
  function memoryNumber(card,key,context={},fallback=0){const value=getMemory(card,key,context)?.value;const number=Number(value);return Number.isFinite(number)?number:fallback}

  function applyDefinitionPatches(cards){
    if(!Array.isArray(cards))return 0;let changed=0;
    for(const card of cards){const patch=DEFINITION_PATCHES[card?.id];if(!patch)continue;for(const[key,value]of Object.entries(patch)){card[key]=Array.isArray(value)?value.map(entry=>entry&&typeof entry==='object'?{...entry,conditions:Array.isArray(entry.conditions)?entry.conditions.map(item=>({...item})):entry.conditions}:entry):value}card.redesignStage=STAGE;changed++}
    return changed;
  }

  function patchCardUiRegistry(runtimeRoot=defaultRoot){
    const details=runtimeRoot?.CARD_DETAIL_BY_ID;
    if(details?.['pack01.recursive_function'])Object.assign(details['pack01.recursive_function'],{activation:'낼 때 / 승리',effect:'낼 때 직전 복사 가능 수치 효과를 기록하고, 승리하면 기록한 효과를 1회 재생한다.',extra:'자기 자신과 복사된 효과는 기록하지 않는다.',terms:['트릭','카드 메모리','피해','회복','칩','보호막','출혈','예측']});
    if(details?.['pack01.ambush_observer'])Object.assign(details['pack01.ambush_observer'],{activation:'3번 슬롯',effect:'다음 적 카드 정보 +2단계.',extra:'이미 정확 공개라면 무료 손패 교환 1회로 전환.',terms:['쇼다운 슬롯','예측','정보','손패','드로우']});
    const labels=runtimeRoot?.PLAYER_EFFECT_LABELS;
    const actions=labels?.actions,conditions=labels?.conditions;
    if(actions)Object.assign(actions,{
      snapshot_last_copyable_effect:'직전 복사 가능 효과 기록',replay_card_memory_effect:'기록 효과 재생',track_card_memory:'카드 메모리 추적',showdown_power_from_memory:'기록값을 쇼다운 위력으로 변환',reserve_dynamic_damage:'변동 피해 예약',russian_roulette_controlled_rank:'정보·칩 연계 룰렛',grant_free_hand_exchange:'무료 손패 교환 준비',reserve_next_trick_first_effect_replay:'다음 트릭 첫 수치 효과 재생 예약',copy_enemy_printed_rank_to_showdown:'적 인쇄 숫자를 쇼다운 숫자로 복사',gain_chips_or_damage_overflow:'칩 오버플로를 피해로 변환',remove_negative_status_or_fallback:'부정 상태 제거 또는 보호막',showdown_power_from_enemy_status:'적 상태를 쇼다운 위력으로 변환',lock_showdown_slot:'쇼다운 슬롯 고정'
    });
    if(conditions)Object.assign(conditions,{chips_not_spent:'이번 트릭에 칩을 소비하지 않음',enemy_exact_info_known:'현재 적 숫자를 내기 전부터 정확히 알고 있음',enemy_exact_info_unknown:'현재 적 숫자를 정확히 모르고 있음',next_enemy_exact_known:'다음 적 카드가 정확 공개 상태',next_enemy_exact_unknown:'다음 적 카드가 정확 공개가 아님',card_memory_below:'이 카드 기록값이 지정 수 미만',slot_result_is_win:'이 슬롯의 트릭에서 승리',showdown_slot_locked:'이 쇼다운 슬롯이 고정됨',previous_showdown_slot_unlocked:'이전 쇼다운 슬롯이 고정되지 않음'});
    return true;
  }

  function currentEnemyWasKnown(context={},runtimeRoot=defaultRoot){
    if(context.enemyExactKnown!==undefined)return context.enemyExactKnown===true;
    const battle=activeBattle(runtimeRoot,context),enemy=battle?.enemyCard||context.enemyCard;if(!battle||!enemy)return false;
    const state=battle.enemyInformation;
    if(state?.currentExact===true&&state.currentCard===enemy)return true;
    if(!battle.playerStage){const api=enemyInfoApi(runtimeRoot);try{return!!api?.currentEnemyExact?.(battle)}catch(_error){}}
    return false;
  }
  function nextEnemyExact(context={},runtimeRoot=defaultRoot){
    if(context.nextEnemyExactKnown!==undefined)return context.nextEnemyExactKnown===true;
    const battle=activeBattle(runtimeRoot,context),api=enemyInfoApi(runtimeRoot);if(!battle?.nextEnemyPreview)return false;
    try{return api?.previewKnowledgeLevel?.(battle,runtimeRoot)===api?.KNOWLEDGE?.EXACT}catch(_error){return Number(battle.enemyForecast)>=3}
  }

  function conditionPass(api,context,effect){if(!effect?.condition)return true;const fn=api?.conditions?.[effect.condition];if(typeof fn!=='function')return false;try{return!!fn(context,effect)}catch(_error){return false}}
  function copyableEffects(api,trigger,card,context){
    const effects=typeof api?.effectList==='function'?api.effectList(card):[];
    return effects.filter(effect=>effect?.trigger===trigger&&api.COPYABLE_NUMERIC_ACTIONS.includes(effect.action)&&Number.isFinite(Number(effect.value))&&conditionPass(api,context,effect));
  }
  function appendEffectRecord(battle,record){const state=ensureState(battle);if(!state)return null;state.effectHistory.push({...record});if(state.effectHistory.length>100)state.effectHistory.splice(0,state.effectHistory.length-100);return state.effectHistory.at(-1)}
  function makeEffectRecord(context,card,effect,{copied=false,value=effect?.value}={}){return{type:effect?.action||null,value:Number(value),sourceCardId:sourceCardId(card),sourceCardUid:sourceCardUid(card),copied:copied===true,setIndex:currentSet(context),trickIndex:currentTrick(context),slotIndex:Number.isInteger(Number(context.slotIndex))?Number(context.slotIndex):null}}
  function latestCopyableEffect(battle,{excludeCardId=null,excludeCopied=true}={}){const history=ensureState(battle)?.effectHistory||[];for(let index=history.length-1;index>=0;index--){const record=history[index];if(!record||!COPYABLE_LABELS[record.type]||!Number.isFinite(Number(record.value)))continue;if(excludeCopied&&record.copied)continue;if(excludeCardId&&record.sourceCardId===excludeCardId)continue;return{...record}}return null}
  function formatEffectRecord(record){if(!record)return'없음';const label=COPYABLE_LABELS[record.type]||record.type,value=Number(record.value)||0;if(record.type==='gain_chips'||record.type==='increase_enemy_forecast')return`${label} +${value}`;return`${label} ${value}`}

  function replayRecord(api,context,record,scale=1){
    if(!record||!api?.COPYABLE_NUMERIC_ACTIONS?.includes(record.type)||!Number.isFinite(Number(record.value)))return null;
    const value=Math.ceil(Number(record.value)*Number(scale||1));if(!Number.isFinite(value)||value===0)return null;
    api.runEffectList([{action:record.type,value,allowRepeat:true,duration:'trick'}],{...context,effectChain:null});
    const battle=activeBattle(defaultRoot,context);const copied=appendEffectRecord(battle,{...record,value,copied:true,setIndex:currentSet(context),trickIndex:currentTrick(context),slotIndex:Number.isInteger(Number(context.slotIndex))?Number(context.slotIndex):record.slotIndex});return copied;
  }

  function trackedCards(battle){const result=[],seen=new Set();for(const entry of battle?.slots||[]){const card=slotCard(entry);if(!card||seen.has(card))continue;seen.add(card);result.push(card)}return result}
  function updateTrackedMemories(trigger,context){
    const battle=activeBattle(defaultRoot,context),state=ensureState(battle);if(!state)return 0;
    const eventKey=`memory:${turnKey(context)}:${trigger}`;if(state.processedTrackerEvents[eventKey])return 0;state.processedTrackerEvents[eventKey]=true;
    let changed=0;for(const card of trackedCards(battle)){const memory=memoryFor(card);for(const entry of Object.values(memory||{})){const tracker=entry?.tracker;if(!tracker||tracker.trigger!==trigger)continue;if(Number(entry.setIndex)!==currentSet(context))continue;if(!isLaterTurn(currentSet(context),currentTrick(context),Number(tracker.createdSet),Number(tracker.createdTrick)))continue;let next=(Number(entry.value)||0)+(Number(tracker.delta)||0);if(Number.isFinite(Number(tracker.floor)))next=Math.max(Number(tracker.floor),next);if(Number.isFinite(Number(tracker.ceiling)))next=Math.min(Number(tracker.ceiling),next);entry.value=next;changed++}}
    return changed;
  }
  function updateDynamicReservations(trigger,context){
    const battle=activeBattle(defaultRoot,context),state=ensureState(battle);if(!state||!Array.isArray(battle?.reservations))return 0;
    const eventKey=`reservation:${turnKey(context)}:${trigger}`;if(state.processedTrackerEvents[eventKey])return 0;state.processedTrackerEvents[eventKey]=true;
    let changed=0;for(const reservation of battle.reservations){if(reservation?.type!=='dynamic_delayed_damage'||reservation.adjustTrigger!==trigger)continue;if(!isLaterTurn(currentSet(context),currentTrick(context),Number(reservation.createdSet),Number(reservation.createdTrick)))continue;if(currentSet(context)>Number(reservation.eligibleSet)||(currentSet(context)===Number(reservation.eligibleSet)&&currentTrick(context)>Number(reservation.eligibleTrick)))continue;reservation.value=Math.max(0,(Number(reservation.value)||0)+(Number(reservation.adjustValue)||0));const remaining=Math.max(0,Number(reservation.eligibleTrick)-currentTrick(context));reservation.label=`시한폭탄 · 폭발까지 ${remaining}트릭 · 예상 피해 ${reservation.value}`;changed++}
    return changed;
  }
  function processEffectReplayReservations(api,trigger,card,context,records){
    const battle=activeBattle(defaultRoot,context),state=ensureState(battle);if(!state||!state.effectReplayReservations.length)return 0;const set=currentSet(context),trick=currentTrick(context);let replayed=0;
    state.effectReplayReservations=state.effectReplayReservations.filter(reservation=>{
      if(set>reservation.eligibleSet||(set===reservation.eligibleSet&&trick>reservation.eligibleTrick))return false;
      if(set!==reservation.eligibleSet||trick!==reservation.eligibleTrick||!records.length)return true;
      replayRecord(api,context,records[0],reservation.scale);replayed++;return false;
    });
    return replayed;
  }

  function ensureAction(api,name,handler){if(!api.ACTIONS.includes(name))api.ACTIONS.push(name);api.registerActionHandler(name,handler)}
  function installEffects(api=effectsApi(),runtimeRoot=defaultRoot){
    if(!api?.conditions||!api?.registerActionHandler)return false;
    const personality=personalityApi(runtimeRoot);personality?.installEffects?.(api,runtimeRoot);
    api.conditions.chips_not_spent=context=>(Number(context?.history?.chipsSpent??context?.battle?.history?.chipsSpent)||0)<=0;
    api.conditions.enemy_exact_info_known=context=>currentEnemyWasKnown(context,runtimeRoot);
    api.conditions.enemy_exact_info_unknown=context=>!currentEnemyWasKnown(context,runtimeRoot);
    api.conditions.next_enemy_exact_known=context=>nextEnemyExact(context,runtimeRoot);
    api.conditions.next_enemy_exact_unknown=context=>!nextEnemyExact(context,runtimeRoot);
    api.conditions.card_memory_below=(context,effect)=>memoryNumber(context.card,effect.memoryKey,context,0)<Number(effect.conditionValue??1);
    api.conditions.slot_result_is_win=context=>{const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots,index=Number(context.slotIndex);return Array.isArray(slots)&&Number.isInteger(index)&&Number(slots[index]?.result)>0};
    api.conditions.showdown_slot_locked=context=>{const lock=context.card?.showdownSlotLock,index=Number(context.slotIndex);return!!lock&&Number(lock.setIndex)===currentSet(context)&&Number(lock.slotIndex)===index};
    api.conditions.previous_showdown_slot_unlocked=context=>{const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots,index=Number(context.slotIndex);if(!Array.isArray(slots)||!Number.isInteger(index)||index<1)return false;const previous=slotCard(slots[index-1]),lock=previous?.showdownSlotLock;return!lock||Number(lock.setIndex)!==currentSet(context)||Number(lock.slotIndex)!==index-1};
    api.conditions.enemy_signature_fallback=()=>false;
    if(typeof api.conditions.effective_suit_is_trump!=='function')api.conditions.effective_suit_is_trump=context=>!!currentTrump(context)&&trickSuit(context)===currentTrump(context);

    ensureAction(api,'snapshot_last_copyable_effect',(context,_value,effect)=>{
      const battle=activeBattle(runtimeRoot,context),record=latestCopyableEffect(battle,{excludeCardId:sourceCardId(context.card),excludeCopied:true}),key=effect.memoryKey||'recursive_effect';
      if(record)setMemory(context.card,key,record,context,{kind:'effect_record',uiLabel:'기록'});else{const memory=memoryFor(context.card);delete memory[key]}
      return record;
    });
    ensureAction(api,'replay_card_memory_effect',(context,_value,effect)=>{const record=getMemory(context.card,effect.memoryKey||'recursive_effect',context)?.value;return replayRecord(api,context,record,1)});
    ensureAction(api,'track_card_memory',(context,value,effect)=>{
      const initial=effect.initialFrom==='set_wins'?Number(context.setHistory?.wins??context.battle?.setHistory?.wins)||0:Number(value)||0;
      return setMemory(context.card,effect.memoryKey||'tracked',initial,context,{uiLabel:effect.uiLabel||null,tracker:{trigger:effect.trackerTrigger||null,delta:Number(effect.trackerDelta)||0,floor:Number.isFinite(Number(effect.trackerFloor))?Number(effect.trackerFloor):null,ceiling:Number.isFinite(Number(effect.trackerCeiling))?Number(effect.trackerCeiling):null,createdSet:currentSet(context),createdTrick:currentTrick(context)}});
    });
    ensureAction(api,'showdown_power_from_memory',(context,_value,effect)=>{const stored=memoryNumber(context.card,effect.memoryKey,context,0),bonus=stored*Number(effect.multiplier??1);if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);return bonus});
    ensureAction(api,'reserve_dynamic_damage',(context,value,effect)=>{
      const battle=activeBattle(runtimeRoot,context);if(!battle)return null;const delay=Math.max(1,Math.floor(Number(effect.delayTricks)||2)),target=currentTrick(context)+delay;if(target>5)return null;if(!Array.isArray(battle.reservations))battle.reservations=[];
      const reservation=api.createReservation({type:'dynamic_delayed_damage',timing:'on_trick_result',duration:'set',consume:'when_due',action:'damage_enemy',value:Number(value)||0,eligibleSet:currentSet(context),eligibleTrick:target,label:`시한폭탄 · 폭발까지 ${delay}트릭 · 예상 피해 ${Number(value)||0}`,ownerType:'card',ownerId:sourceCardId(context.card),metadata:{sourceCardId:sourceCardId(context.card),sourceCardUid:sourceCardUid(context.card),createdSet:currentSet(context),createdTrick:currentTrick(context),adjustTrigger:effect.adjustTrigger||null,adjustValue:Number(effect.adjustValue)||0}});battle.reservations.push(reservation);return reservation;
    });
    ensureAction(api,'russian_roulette_controlled_rank',(context,_value,effect)=>{
      const battle=activeBattle(runtimeRoot,context),card=context.card;if(!battle||!card)return null;const rng=typeof context.random==='function'?context.random:Math.random,chance=Math.max(0,Math.min(1,Number(effect.fireChance)||1/6));let failed=Number(rng())<chance,rerolled=false;const spent=(Number(context.history?.chipsSpent??battle.history?.chipsSpent)||0)>0;
      if(failed&&spent&&currentEnemyWasKnown(context,runtimeRoot)){rerolled=true;failed=Number(rng())<chance}
      const target=failed?(Number(effect.failRank)||2):(Number(effect.safeRank)||14),printed=printedRank(card);if(!Number.isFinite(target)||!Number.isFinite(printed))return null;if(!battle.mods||typeof battle.mods!=='object')battle.mods={};battle.mods.plus=(Number(battle.mods.plus)||0)+(target-printed);setMemory(card,effect.memoryKey||'roulette_result',{failed,rerolled,finalRank:target},context,{kind:'roulette'});return{failed,rerolled,finalRank:target};
    });
    ensureAction(api,'grant_free_hand_exchange',(context,value)=>{const battle=activeBattle(runtimeRoot,context),state=ensureState(battle);if(!state)return null;state.freeHandExchange={count:Math.max(1,Number(value)||1),sourceCardUid:sourceCardUid(context.card),sourceCardId:sourceCardId(context.card)};return state.freeHandExchange});
    ensureAction(api,'reserve_next_trick_first_effect_replay',(context,value)=>{const battle=activeBattle(runtimeRoot,context),state=ensureState(battle);if(!state)return null;const target=nextTurn(context),reservation={eligibleSet:target.set,eligibleTrick:target.trick,scale:Number(value)||0.5,sourceCardId:sourceCardId(context.card),sourceCardUid:sourceCardUid(context.card)};state.effectReplayReservations.push(reservation);return reservation});
    ensureAction(api,'copy_enemy_printed_rank_to_showdown',(context)=>{const battle=activeBattle(runtimeRoot,context),enemy=context.enemyCard||battle?.enemyCard,rank=printedRank(enemy);if(!context.card||!Number.isFinite(rank))return null;context.card.showdownRank=rank;return rank});
    ensureAction(api,'gain_chips_or_damage_overflow',(context,value,effect)=>{const battle=activeBattle(runtimeRoot,context);if(!battle)return null;const requested=Math.max(0,Math.floor(Number(value)||0)),before=Number(battle.chipEconomy?.balance??battle.chip)||0,cap=Number(battle.maxChip)||chipApi(runtimeRoot)?.CHIP_CAP||5,gained=Math.max(0,Math.min(requested,cap-before));if(typeof context.perform==='function')context.perform('gain_chips',requested,effect);const overflow=requested-gained;if(overflow>0&&typeof context.perform==='function')context.perform('damage_enemy',Number(effect.fallbackDamage)||5,effect);return{requested,gained,overflow}});
    ensureAction(api,'remove_negative_status_or_fallback',(context,_value,effect)=>{const battle=activeBattle(runtimeRoot,context),combat=combatApi(runtimeRoot),statuses=context.statuses||battle?.statuses;if(!statuses||!combat)return null;const candidates=Object.values(combat.STATUS_DEFINITIONS||{}).filter(def=>def?.implemented&&def.dispellable&&def.role==='amplify_damage'&&combat.getStatusValue(statuses,'player',def.id)>0);const target=candidates[0]||null,removed=!!target&&combat.removeStatus(statuses,'player',target.id);setMemory(context.card,effect.memoryKey||'redaction_removed',removed?1:0,context,{uiLabel:'말소'});const action=removed?'reveal_next_enemy_card':'gain_shield',value=removed?undefined:Number(effect.fallbackShield)||3;api.runEffectList([{action,value,allowRepeat:true,duration:removed?'trick':'battle'}],{...context,effectChain:null});return{removed,statusId:target?.id||null}});
    ensureAction(api,'showdown_power_from_enemy_status',(context,_value,effect)=>{const battle=activeBattle(runtimeRoot,context),combat=combatApi(runtimeRoot),statuses=context.statuses||battle?.statuses;if(!statuses)return 0;const statusId=effect.statusId||effect.status||'bleed',raw=combat?.getStatusValue?combat.getStatusValue(statuses,'enemy',statusId):Number(statuses.enemy?.[statusId])||0,cap=Number.isFinite(Number(effect.cap))?Number(effect.cap):Infinity,bonus=Math.min(cap,raw)*Number(effect.multiplier??1);if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);return bonus});
    ensureAction(api,'lock_showdown_slot',(context)=>{const index=Number(context.slotIndex);if(!context.card||!Number.isInteger(index))return null;const lock={setIndex:currentSet(context),slotIndex:index};context.card.showdownSlotLock=lock;return lock});

    if(!api.run.__cardSystemLinks){const original=api.run;api.run=function(trigger,card,context={}){const nextContext={...context,card:context.card||card,battle:activeBattle(runtimeRoot,context)},result=original.call(this,trigger,card,context);updateTrackedMemories(trigger,nextContext);updateDynamicReservations(trigger,nextContext);const records=[];for(const effect of copyableEffects(api,trigger,card,nextContext)){const record=makeEffectRecord(nextContext,card,effect,{copied:false});appendEffectRecord(nextContext.battle,record);records.push(record)}processEffectReplayReservations(api,trigger,card,nextContext,records);return result};api.run.__cardSystemLinks=true;api.run.__original=original}
    installed=true;return true;
  }

  function recycleDiscard(battle,runtimeRoot=defaultRoot){if(battle.deck?.length||!battle.discard?.length)return false;const pool=battle.discard.splice(0),shuffled=typeof runtimeRoot?.shuffle==='function'?runtimeRoot.shuffle(pool):pool;battle.deck.push(...(Array.isArray(shuffled)&&shuffled.length?shuffled:pool));return true}
  function freeExchangeAvailability(battle){const state=ensureState(battle),uid=battle?.selected;if(!battle||!state||state.freeHandExchange.count<1)return{ok:false,reason:'no_token'};if(!Array.isArray(battle.hand))return{ok:false,reason:'no_hand'};const index=battle.hand.findIndex(card=>sourceCardUid(card)===uid);if(index<0)return{ok:false,reason:'no_selection'};const replacements=(battle.deck?.length||0)+(battle.discard?.length||0);if(replacements<1)return{ok:false,reason:'no_replacement'};return{ok:true,index}}
  function useFreeHandExchange(runtimeRoot=defaultRoot){const battle=activeBattle(runtimeRoot),availability=freeExchangeAvailability(battle);if(!availability.ok)return availability;if(!Array.isArray(battle.deck))battle.deck=[];if(!Array.isArray(battle.discard))battle.discard=[];recycleDiscard(battle,runtimeRoot);if(!battle.deck.length)return{ok:false,reason:'no_replacement'};const outgoing=battle.hand.splice(availability.index,1)[0];battle.deck.unshift(outgoing);const incoming=battle.deck.pop();battle.hand.splice(availability.index,0,incoming);const state=ensureState(battle);state.freeHandExchange.count=Math.max(0,state.freeHandExchange.count-1);if(battle.history)battle.history.cardsDrawn=(Number(battle.history.cardsDrawn)||0)+1;battle.selected=null;if(typeof runtimeRoot?.flash==='function')runtimeRoot.flash('관측 교환 · 무료');if(typeof runtimeRoot?.renderBattle==='function')runtimeRoot.renderBattle();return{ok:true,outgoing,incoming,remaining:state.freeHandExchange.count}}

  function reservationStateLine(card,battle){const uid=sourceCardUid(card),id=sourceCardId(card),reservation=(battle?.reservations||[]).find(item=>item?.type==='dynamic_delayed_damage'&&((uid&&item.sourceCardUid===uid)||(!uid&&item.sourceCardId===id)));if(!reservation)return null;const remaining=Number(reservation.eligibleSet)===Number(battle.setIndex)?Math.max(0,Number(reservation.eligibleTrick)-Number(battle.trick)):0;return`폭발까지 ${remaining}트릭 · 예상 피해 ${Number(reservation.value)||0}`}
  function cardStateLines(card,battle){if(!card)return[];const id=sourceCardId(card),lines=[];
    if(id==='pack01.recursive_function')lines.push(`기록: ${formatEffectRecord(getMemory(card,'recursive_effect',{battle})?.value)}`);
    if(id==='pack02.long_game')lines.push(`기록 승리: ${memoryNumber(card,'compound_wins',{battle},0)}`);
    if(id==='pack03.bad_check')lines.push(`부채: ${memoryNumber(card,'bad_check_debt',{battle},0)}`);
    if(id==='pack03.time_bomb'){const line=reservationStateLine(card,battle);if(line)lines.push(line)}
    if(id==='pack03.russian_roulette'){const result=getMemory(card,'roulette_result',{battle})?.value;if(result)lines.push(`룰렛: ${result.finalRank===14?'A':result.finalRank}${result.rerolled?' · 재굴림':''}`)}
    if(card.showdownSlotLock&&Number(card.showdownSlotLock.setIndex)===Number(battle?.setIndex))lines.push(`슬롯 고정: ${Number(card.showdownSlotLock.slotIndex)+1}번`);
    const free=ensureState(battle)?.freeHandExchange;if(free?.count>0&&((free.sourceCardUid&&free.sourceCardUid===sourceCardUid(card))||free.sourceCardId===id))lines.push(`무료 손패 교환: ${free.count}회`);
    return lines;
  }
  function syncFreeExchangeButton(runtimeRoot=defaultRoot){const doc=runtimeRoot?.document,battle=activeBattle(runtimeRoot);if(!doc?.createElement)return false;const title=doc.querySelector?.('#handPanel .panelTitle');if(!title)return false;let button=doc.getElementById?.('systemLinkExchangeBtn');if(!button){button=doc.createElement('button');button.id='systemLinkExchangeBtn';button.type='button';button.className='pixelBtn cyan';button.addEventListener?.('click',event=>{event?.preventDefault?.();useFreeHandExchange(runtimeRoot)});const existing=doc.getElementById?.('exchangeBtn');if(existing?.parentElement===title)title.insertBefore(button,existing);else title.appendChild(button)}const state=ensureState(battle),active=!!battle&&state?.freeHandExchange?.count>0;button.style.display=active?'':'none';button.textContent=active?`관측 교환 무료 ×${state.freeHandExchange.count}`:'관측 교환 무료';const availability=active?freeExchangeAvailability(battle):{ok:false};button.disabled=!availability.ok;button.title=active?'선택한 손패 1장을 덱 맨 아래로 보내고 카드 1장을 무료로 뽑는다.':'무료 교환이 준비되지 않았다.';return active}
  function installBrowserAdapters(runtimeRoot=defaultRoot){
    if(typeof runtimeRoot?.renderBattle==='function'&&!runtimeRoot.renderBattle.__cardSystemLinks){const original=runtimeRoot.renderBattle;runtimeRoot.renderBattle=function(){const result=original.apply(this,arguments);syncFreeExchangeButton(runtimeRoot);return result};runtimeRoot.renderBattle.__cardSystemLinks=true;runtimeRoot.renderBattle.__original=original}
    if(typeof runtimeRoot?.inspectCard==='function'&&!runtimeRoot.inspectCard.__cardSystemLinks){const original=runtimeRoot.inspectCard;runtimeRoot.inspectCard=function(card){const result=original.apply(this,arguments),battle=activeBattle(runtimeRoot),lines=cardStateLines(card,battle),apply=runtimeRoot.document?.getElementById?.('inspectApply');if(apply&&lines.length)apply.textContent=`${apply.textContent}${apply.textContent?' · ':''}${lines.join(' · ')}`;return result};runtimeRoot.inspectCard.__cardSystemLinks=true;runtimeRoot.inspectCard.__original=original}
    return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    if(typeof document==='undefined'){applyDefinitionPatches(runtimeRoot?.EFFECT_CARD_DEFINITIONS||[]);patchCardUiRegistry(runtimeRoot);return installEffects(effectsApi(runtimeRoot),runtimeRoot)}
    let attempts=0;const attempt=()=>{applyDefinitionPatches(runtimeRoot?.EFFECT_CARD_DEFINITIONS||[]);patchCardUiRegistry(runtimeRoot);if(installEffects(effectsApi(runtimeRoot),runtimeRoot)){installBrowserAdapters(runtimeRoot);return}if(attempts++<100)setTimeout(attempt,25);else console.warn('[card-system-links] 공용 효과 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }

  if(NodeEffects)installEffects(NodeEffects,defaultRoot);
  return{STAGE,STATE_KEY,MEMORY_KEY,COPYABLE_LABELS,DEFINITION_PATCHES,effectsApi,personalityApi,chipApi,combatApi,enemyInfoApi,activeBattle,currentSet,currentTrick,sourceCardId,sourceCardUid,ensureState,memoryFor,setMemory,getMemory,memoryNumber,applyDefinitionPatches,patchCardUiRegistry,currentEnemyWasKnown,nextEnemyExact,appendEffectRecord,makeEffectRecord,latestCopyableEffect,formatEffectRecord,replayRecord,updateTrackedMemories,updateDynamicReservations,installEffects,freeExchangeAvailability,useFreeHandExchange,reservationStateLine,cardStateLines,syncFreeExchangeButton,installBrowserAdapters,installWhenReady,get installed(){return installed}};
});
