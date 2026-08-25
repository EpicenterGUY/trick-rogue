(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./card-packs/index.js'):root,
    typeof module!=='undefined'?require('./migrated-tactic-cards.js'):root.MigratedTacticCards
  );
  if(typeof module!=='undefined')module.exports=api;
  Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(packRegistry,migratedCards){
const PLAYER_EFFECT_LABELS=Object.freeze({
  triggers:{on_play:'낼 때',on_set_start:'세트 시작',before_compare:'트릭 비교 전',after_compare:'트릭 비교 후',on_trick_win:'승리',on_trick_loss:'패배',on_trick_draw:'무승부',after_card_slotted:'슬롯 배치',on_trick_end:'트릭 종료',before_showdown:'쇼다운 전',on_showdown_advantage:'우세 판정',on_showdown_score:'쇼다운',after_showdown_result:'쇼다운 결과',on_set_end:'세트 종료',before_damage:'피해 전',after_damage:'피해 후'},
  conditions:{
    chips_spent:'이번 트릭에 칩 소비',chips_at_least:'현재 칩이 지정 수 이상',effective_rank_at_most:'최종 적용 숫자가 지정 수 이하',effective_suit_is_trump:'최종 트릭 무늬가 현재 트럼프',
    printed_suit_is_trump:'인쇄 무늬가 현재 트럼프',printed_suit_is_not_trump:'인쇄 무늬가 현재 트럼프가 아님',river_hit:'고정한 리버 후보 적중',river_miss_with_candidates:'리버 후보가 있었지만 빗나감',
    slot_is:'지정된 쇼다운 슬롯',slot_at_least:'지정 슬롯 이후',previous_showdown_slot_exists:'바로 이전 쇼다운 카드가 있음',previous_showdown_slot_is_pure:'바로 이전 쇼다운 카드가 순수 카드',
    pure_cards_at_least:'쇼다운의 순수 카드가 지정 장수 이상',in_hand:'손패에 있음',player_has_advantage:'명시적 우세가 있음',enemy_has_advantage:'적의 명시적 우세가 있음',set_wins_at_least:'이번 세트 승리가 지정 횟수 이상',
    pure_card_in_hand:'손패에 순수 카드가 있음',pure_card_in_showdown:'쇼다운에 순수 카드가 있음',printed_equals_trick:'인쇄값과 트릭값이 같음',unmodified_trick_value:'최종 트릭값이 인쇄값 그대로',
    card_memory_at_least:'이 카드가 기록한 값이 지정 수 이상',player_hp_ratio_at_most:'현재 체력 비율이 지정 비율 이하',enemy_has_status:'적이 지정 상태 보유',trick_is:'지정 번째 트릭',player_shield_at_least:'보호막이 지정 수 이상',all:'모든 조건 충족'
  },
  actions:{
    damage_enemy:'적에게 피해',heal_player:'체력 회복',gain_chips:'칩 획득',spend_chips:'칩 소비',gain_shield:'보호막 획득',apply_enemy_bleed:'적에게 출혈 부여',increase_enemy_forecast:'적 카드 예측 단계 증가',increase_effective_rank:'트릭 숫자 증가',
    showdown_power:'쇼다운 위력 변경',reserve_next_win_damage:'다음 트릭 승리 피해 예약',reserve_next_trick_comparison_reward:'다음 트릭 인쇄 숫자 비교 보상 예약',set_next_trick_suit_to_trump:'트릭 무늬를 현재 트럼프로 변경',increase_next_trick_rank:'트릭 숫자 증가',
    set_reverse_compare:'트릭 숫자 비교 반전',set_last_showdown_suit_to_trump:'쇼다운 무늬를 현재 트럼프로 변경',increase_last_showdown_rank:'쇼다운 숫자 증가',copy_previous_showdown_rank:'이전 쇼다운 숫자 복사',snapshot_set_wins:'현재 세트 승리 횟수 기록',showdown_power_from_memory_tiers:'기록값에 따라 쇼다운 위력 변경',
    grant_next_trick_hand_capacity:'다음 트릭 손패 한도와 보충 드로우 증가',discard_secondary_target:'선택한 다른 손패 카드 버림',draw_cards:'카드 드로우',reveal_next_enemy_card:'다음 적 카드 정확 공개',apply_status:'상태 부여',remove_status:'상태 제거',add_reservation:'예약 생성'
  },
  durations:{trick:'트릭',set:'세트',battle:'전투',run:'런'}
});

const CARD_DETAIL_BY_ID=Object.freeze({
  'pack01.black_bullet':{activation:'승리',effect:'적에게 피해 4.',extra:'정확히 5번 쇼다운 슬롯에서 승리했다면 추가 피해 4.',terms:['트릭','피해','쇼다운 슬롯']},
  'pack01.phoenix':{activation:'승리',effect:'체력 4 회복.',extra:'효과 처리 직전 체력이 최대 체력의 50% 이하라면 추가로 3 회복.',terms:['트릭','회복']},
  'pack01.golden_hand':{activation:'승리',effect:'칩 +1. 다음 트릭의 최대 손패와 보충 드로우 +1.',terms:['트릭','칩','손패','드로우']},
  'pack01.dirty_gambler':{activation:'승리',condition:'최종 적용 숫자 5 이하.',effect:'칩 +2.',terms:['트릭','적용 숫자','칩']},
  'pack01.recursive_function':{activation:'승리',effect:'직전에 발동한 다른 효과 카드의 복사 가능한 수치 효과 하나를 1회 복사.',extra:'자기 자신은 복사하지 않는다.',terms:['트릭','피해','회복','칩','보호막','출혈','예측']},
  'pack01.scheduled_delivery':{activation:'낼 때',effect:'예약 생성. 바로 다음 트릭에서 승리하면 적에게 피해 8.',extra:'패배하거나 무승부면 예약 소멸.',duration:'다음 트릭까지',terms:['트릭','예약','피해']},
  'pack01.emergency_guard':{activation:'낼 때 / 쇼다운',effect:'보호막 6.',extra:'쇼다운 때 보호막이 1 이상 남아 있다면 쇼다운 위력 +6.',terms:['보호막','쇼다운','최종 위력']},
  'pack01.sharp_glass':{activation:'승리',effect:'적이 이미 출혈 중이면 먼저 피해 3. 그 후 출혈 3.',terms:['트릭','출혈','피해']},
  'pack01.ambush_observer':{activation:'3번 쇼다운 슬롯',effect:'적 카드 예측 단계 +2.',terms:['쇼다운 슬롯','예측']},
  'pack01.battery_1pct':{activation:'손에 있는 동안 트릭 종료',condition:'20% 확률.',effect:'소진.',extra:'소진되지 않고 5번 쇼다운 슬롯에 들어가면 쇼다운 위력 +12. 손에 없을 때는 소진 판정하지 않는다.',duration:'현재 전투',terms:['트릭','소진','전투','쇼다운 슬롯','최종 위력']}
});

function browserFallbackMigratedDefinitions(){
  const rows=[
    {id:'core.paint',legacyTacticId:'paint',name:'트럼프 페인트',suit:'D',rank:4,text:'낼 때 — 원래 무늬가 현재 트럼프가 아니면 이번 트릭의 무늬를 현재 트럼프로 바꾼다. 원래부터 트럼프였다면 대신 적용 숫자 +4. 인쇄값과 쇼다운값은 바뀌지 않는다.',terms:['트릭값','트럼프','인쇄값','쇼다운값'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'printed_suit_is_not_trump',duration:'trick'},{trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'printed_suit_is_trump',duration:'trick'}]},
    {id:'core.plus2',legacyTacticId:'plus2',name:'랭크 부스트',suit:'S',rank:3,text:'낼 때 — 이번 트릭 적용 숫자 +3.',terms:['트릭값','인쇄값'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'increase_next_trick_rank',value:3,duration:'trick'}]},
    {id:'core.draw',legacyTacticId:'draw',name:'드로우',suit:'C',rank:6,text:'낼 때 — 다음 트릭의 최대 손패와 보충 드로우 +1.',terms:['트릭','손패','드로우'],activation:'이 카드를 낼 때',migrationStage:'3-2B',effects:[{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}]},
    {id:'core.scout',legacyTacticId:'scout',name:'정찰',suit:'D',rank:9,text:'낼 때 — 다음 트릭에 적이 사용할 카드의 인쇄 숫자와 무늬를 정확히 공개한다. 그 다음 트릭에서 더 낮은 인쇄 숫자를 냈는데 승리했다면 칩 +1.',terms:['트릭','예측','칩','인쇄값'],activation:'이 카드를 낼 때',migrationStage:'3-2B',effects:[{trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'},{trigger:'on_play',action:'reserve_next_trick_comparison_reward',value:1,rewardAction:'gain_chips',duration:'battle'}]},
    {id:'core.double',legacyTacticId:'double',name:'더블다운',suit:'H',rank:2,text:'낼 때 — 칩이 1개 이상이면 칩 1을 소비하고 이번 트릭 적용 숫자 +5. 이 효과로 칩을 소비한 뒤 승리하면 칩 +2.',terms:['트릭','칩','적용 숫자'],activation:'이 카드를 낼 때',migrationStage:'7.5-P',effects:[{trigger:'on_play',action:'spend_chips',value:1,condition:'chips_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'},{trigger:'on_play',action:'increase_next_trick_rank',value:5,condition:'card_memory_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'},{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'card_memory_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'}]},
    {id:'core.barrier',legacyTacticId:'barrier',name:'세이프가드',suit:'S',rank:6,text:'낼 때 — 보호막 3. 패배 — 보호막 3 추가.',terms:['트릭','보호막'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'gain_shield',value:3,duration:'battle'},{trigger:'on_trick_loss',action:'gain_shield',value:3,duration:'battle'}]},
    {id:'core.burn',legacyTacticId:'burn',name:'패갈이',suit:'C',rank:2,text:'낼 때 — 이 카드 이외의 손패 1장을 버린다. 칩 +1. 카드 1장 드로우.',terms:['손패','버림','칩','드로우'],activation:'이 카드를 낼 때',migrationStage:'3-2B',targeting:{zone:'hand',count:1,excludeSelf:true},effects:[{trigger:'on_play',action:'discard_secondary_target',duration:'trick'},{trigger:'on_play',action:'gain_chips',value:1,duration:'trick'},{trigger:'on_play',action:'draw_cards',value:1,duration:'trick'}]},
    {id:'core.reverse',legacyTacticId:'reverse',name:'리버스',suit:'H',rank:3,text:'낼 때 — 이번 트릭은 낮은 최종 적용 숫자가 승리. 동점은 무승부.',terms:['트릭','트릭값'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'set_reverse_compare',duration:'trick'}]},
    {id:'core.pureboost',legacyTacticId:'pureboost',name:'정공법',suit:'D',rank:5,text:'낼 때 — 바로 이전 쇼다운 슬롯의 카드가 순수 카드라면 이번 트릭 적용 숫자 +4. 1번 슬롯에서는 발동하지 않는다.',terms:['순수 카드','쇼다운','쇼다운 슬롯','트릭값'],activation:'이 카드를 낼 때',migrationStage:'7.5-P',effects:[{trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'previous_showdown_slot_is_pure',duration:'trick'}]},
    {id:'core.clean',legacyTacticId:'clean',name:'무첨가',suit:'S',rank:4,text:'승리 — 현재 쇼다운 슬롯에 이 카드 이외의 순수 카드가 1장 이상 있다면 칩 +2.',terms:['순수 카드','쇼다운','트릭','칩'],activation:'이 카드로 트릭 승리 시',migrationStage:'7.5-P',effects:[{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'pure_card_in_showdown',duration:'trick'}]},
    {id:'core.recolor',legacyTacticId:'recolor',name:'재도색',suit:'C',rank:9,text:'낼 때 — 이 카드의 쇼다운 무늬를 현재 트럼프 무늬로 바꾼다. 트릭 무늬와 인쇄 무늬는 바뀌지 않는다.',terms:['쇼다운값','트럼프'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'set_last_showdown_suit_to_trump',duration:'set'}]},
    {id:'core.fakeid',legacyTacticId:'fakeid',name:'가짜 신분증',suit:'H',rank:10,text:'낼 때 — 바로 이전 쇼다운 카드의 숫자를 복사한다. 무늬는 바뀌지 않는다. 1번 슬롯에서는 효과가 없다.',terms:['쇼다운값','쇼다운 슬롯'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'copy_previous_showdown_rank',condition:'previous_showdown_slot_exists',duration:'set'}]}
  ];
  return rows.map(row=>Object.freeze({id:row.id,legacyTacticId:row.legacyTacticId,name:row.name,short:row.name,suit:row.suit,rank:row.rank,printedSuit:row.suit,printedRank:row.rank,description:row.text,activation:row.activation,terms:Object.freeze(row.terms),effects:Object.freeze(row.effects.map(effect=>Object.freeze({...effect}))),targeting:row.targeting?Object.freeze({...row.targeting}):null,implemented:true,category:'general',rarity:'common',migrationStage:row.migrationStage}));
}

const {CARD_PACK_LIST,CARD_PACKS,defaultEnabledPacks,validateEnabledPacks,createRunPackState}=packRegistry;
const CARD_DEFINITIONS=Object.values(CARD_PACKS).flatMap(pack=>pack.cards);
for(const card of CARD_DEFINITIONS){
  const embedded=Array.isArray(card.effects)?card.effects:[];
  card.effects=embedded.map(effect=>({...effect}));
  card.implemented=card.effects.length>0;
}
const GENERAL_EFFECT_CARD_DEFINITIONS=Object.freeze([...(migratedCards?.ACTIVE_CARD_DEFINITIONS||migratedCards?.DIRECT_CARD_DEFINITIONS||browserFallbackMigratedDefinitions())]);
const ALL_CARD_DEFINITIONS=Object.freeze([...CARD_DEFINITIONS,...GENERAL_EFFECT_CARD_DEFINITIONS]);
const CARD_DEFINITION_BY_ID=Object.fromEntries(ALL_CARD_DEFINITIONS.map(card=>[card.id,card]));
function definitionsByBase(definitions){
  const grouped={};
  for(const card of definitions||[]){const key=`${card.suit}${card.rank}`;if(!grouped[key])grouped[key]=[];grouped[key].push(card)}
  return Object.freeze(Object.fromEntries(Object.entries(grouped).map(([key,cards])=>[key,Object.freeze([...cards])])));
}
const CARD_DEFINITIONS_BY_BASE=definitionsByBase(ALL_CARD_DEFINITIONS);
const GENERAL_EFFECT_CARDS_BY_BASE=definitionsByBase(GENERAL_EFFECT_CARD_DEFINITIONS);
const CARD_DEFINITION_BY_BASE=Object.fromEntries(ALL_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card]));
const GENERAL_EFFECT_CARD_BY_BASE=Object.fromEntries(GENERAL_EFFECT_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card]));
function rewardCardIds(enabledPacks=defaultEnabledPacks()){
  const enabled=new Set(validateEnabledPacks(enabledPacks));
  return CARD_PACK_LIST.filter(pack=>enabled.has(pack.id)).flatMap(pack=>pack.cards.flatMap(card=>Array(pack.rewardWeight).fill(card.id)));
}
function createCardRecord({suit,rank,cardId=null,definitionId=null,effects,metadata={}}={}){
  if(!['S','H','D','C'].includes(suit))throw new TypeError(`Unknown card suit: ${suit}`);
  if(!Number.isInteger(rank)||rank<2||rank>14)throw new TypeError(`Invalid card rank: ${rank}`);
  const lookupId=definitionId||cardId;const definition=lookupId?CARD_DEFINITION_BY_ID[lookupId]||null:null;
  if(definitionId&&!definition)throw new TypeError(`Unknown card definition: ${definitionId}`);
  const effectList=effects===undefined?(definition?.effects||[]):effects;if(!Array.isArray(effectList))throw new TypeError('Card effects must be an array');
  return{...metadata,suit,rank,printedSuit:suit,printedRank:rank,cardId:definition?.id||cardId||null,definition,name:metadata.name??definition?.name??null,named:definition?.packId?definition:null,effects:effectList.map(effect=>({...effect}))};
}
function isPureCard(entry){const card=entry?.card||entry;return!!card&&!card.named&&!card.definition&&!card.cardId&&(!Array.isArray(card.effects)||card.effects.length===0)}
function createDefinitionCard(definitionId,metadata={}){const definition=CARD_DEFINITION_BY_ID[definitionId];if(!definition)throw new TypeError(`Unknown card definition: ${definitionId}`);return createCardRecord({suit:definition.suit,rank:definition.rank,definitionId,metadata})}
const BASE_CARD_SLOTS=Object.freeze(['S','H','D','C'].flatMap(suit=>Array.from({length:13},(_,index)=>Object.freeze({suit,rank:index+2}))));
function createBaseCardSlots(){return BASE_CARD_SLOTS.map(slot=>createCardRecord({suit:slot.suit,rank:slot.rank}))}
return{CARD_PACK_LIST,CARD_DEFINITIONS,GENERAL_EFFECT_CARD_DEFINITIONS,ALL_CARD_DEFINITIONS,CARD_DEFINITION_BY_ID,CARD_DEFINITION_BY_BASE,CARD_DEFINITIONS_BY_BASE,GENERAL_EFFECT_CARD_BY_BASE,GENERAL_EFFECT_CARDS_BY_BASE,CARD_PACKS,BASE_CARD_SLOTS,PLAYER_EFFECT_LABELS,CARD_DETAIL_BY_ID,createCardRecord,isPureCard,createDefinitionCard,createBaseCardSlots,defaultEnabledPacks,validateEnabledPacks,createRunPackState,rewardCardIds};
});
