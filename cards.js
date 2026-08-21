(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./card-packs/index.js'):root,
    typeof module!=='undefined'?require('./migrated-tactic-cards.js'):root.MigratedTacticCards
  );
  if(typeof module!=='undefined')module.exports=api;
  Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(packRegistry,migratedCards){
const IMPLEMENTED_CARD_EFFECTS = {
  'pack01.black_bullet': [{trigger:'on_trick_win',action:'damage_enemy',value:3,duration:'trick'},{trigger:'on_showdown_score',action:'showdown_power',value:4,duration:'set'}],
  'pack01.phoenix': [{trigger:'on_trick_win',action:'heal_player',value:4,duration:'trick'}],
  'pack01.golden_hand': [{trigger:'on_trick_win',action:'gain_chips',value:1,duration:'trick'},{trigger:'on_trick_win',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}],
  'pack01.dirty_gambler': [{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'effective_rank_at_most',conditionValue:5,duration:'trick'}],
  'pack01.recursive_function': [{trigger:'on_trick_win',handler:'repeat_last_named_numeric',duration:'trick'}],
  'pack01.scheduled_delivery': [{trigger:'on_play',action:'reserve_next_win_damage',value:6,duration:'trick'}],
  'pack01.emergency_guard': [{trigger:'on_play',action:'gain_shield',value:5,duration:'battle'}],
  'pack01.sharp_glass': [{trigger:'on_trick_win',action:'apply_enemy_bleed',value:2,duration:'battle'}],
  'pack01.ambush_observer': [{trigger:'after_card_slotted',action:'increase_enemy_forecast',value:2,condition:'slot_is',conditionValue:3,duration:'set'}],
  'pack01.battery_1pct': [{trigger:'on_trick_end',handler:'deplete_battery_in_hand',chance:0.2,duration:'battle'},{trigger:'on_showdown_score',action:'showdown_power',value:15,duration:'set'}]
};
const PLAYER_EFFECT_LABELS=Object.freeze({
  triggers:{on_play:'이 카드를 낼 때',on_set_start:'세트 시작 시',before_compare:'트릭 승패 비교 전',after_compare:'트릭 승패 비교 후',on_trick_win:'이 카드로 트릭 승리 시',on_trick_loss:'이 카드로 트릭 패배 시',on_trick_draw:'이 카드로 트릭 무승부 시',after_card_slotted:'쇼다운 슬롯에 놓인 후',on_trick_end:'트릭 종료 시',before_showdown:'쇼다운 계산 전',on_showdown_advantage:'쇼다운 우세 판정 시',on_showdown_score:'쇼다운 위력 계산 시',after_showdown_result:'쇼다운 결과 판정 후',on_set_end:'세트 종료 시',before_damage:'피해를 받기 전',after_damage:'피해를 받은 후'},
  conditions:{chips_spent:'이번 트릭에 칩을 1 이상 소비',effective_rank_at_most:'트릭 숫자가 지정된 수 이하',slot_is:'지정된 쇼다운 슬롯에 위치',slot_at_least:'지정된 쇼다운 슬롯 이후에 위치',in_hand:'손패에 있음',advantage_count_at_least:'내 우세 무늬가 지정 개수 이상',printed_equals_trick:'인쇄값과 트릭값이 같음',unmodified_trick_value:'다른 트릭값 보정이 없음'},
  actions:{damage_enemy:'적에게 피해',heal_player:'체력 회복',gain_chips:'칩 획득',gain_shield:'보호막 획득',apply_enemy_bleed:'적에게 출혈 부여',increase_enemy_forecast:'적 카드 예측 단계 증가',increase_effective_rank:'트릭 숫자 증가',showdown_power:'쇼다운 최종 위력 증가',reserve_next_win_damage:'다음 트릭 승리 시 추가 피해 예약',set_next_trick_suit_to_trump:'트릭 무늬를 현재 트럼프로 변경',increase_next_trick_rank:'트릭 숫자 증가',set_reverse_compare:'트릭 숫자 비교 반전',set_last_showdown_suit_to_trump:'쇼다운 무늬를 현재 트럼프로 변경',increase_last_showdown_rank:'쇼다운 숫자 증가',grant_next_trick_hand_capacity:'다음 트릭 손패 한도와 보충 드로우 증가',discard_secondary_target:'선택한 다른 손패 카드 버림',draw_cards:'일반 카드 드로우',reveal_next_enemy_card:'다음 적 카드 선공개'},
  durations:{trick:'트릭',set:'세트',battle:'전투',run:'런'}
});
const CARD_DETAIL_BY_ID=Object.freeze({
  'pack01.black_bullet':{activation:'이 카드로 트릭 승리 시',effect:'적에게 피해 3.',extra:'이 카드가 쇼다운 5장에 포함되어 있으면 쇼다운 최종 위력 +4.',terms:['트릭','쇼다운','최종 위력']},
  'pack01.phoenix':{activation:'이 카드로 트릭 승리 시',effect:'체력 4 회복. 최대 체력을 넘지 않는다.',terms:['트릭','회복']},
  'pack01.golden_hand':{activation:'이 카드로 트릭 승리 시',effect:'칩 +1. 다음 트릭의 손패 한도와 보충 드로우 +1.',extra:'추가 손패는 다음 트릭에만 적용되고 이후 기본 손패 한도로 돌아온다.',terms:['트릭','칩','손패','드로우']},
  'pack01.dirty_gambler':{activation:'이 카드로 트릭 승리 시',condition:'이 카드의 트릭 숫자가 5 이하.',effect:'칩 +2.',terms:['트릭','트릭값','칩']},
  'pack01.recursive_function':{activation:'이 카드로 트릭 승리 시',effect:'직전에 발동한 다른 네임드 카드의 복사 가능한 수치 효과 하나를 1회 복사.',extra:'복사 범위는 피해, 회복, 칩, 보호막, 출혈, 예측이며 자기 자신은 복사하지 않는다.',terms:['트릭','피해','회복','칩','보호막','출혈','예측']},
  'pack01.scheduled_delivery':{activation:'이 카드를 낼 때',effect:'바로 다음 트릭에서 승리하면 적에게 추가 피해 6을 주는 예약을 생성.',extra:'다음 트릭에서 패배하거나 무승부면 예약이 사라진다.',duration:'다음 트릭까지',terms:['트릭','예약','피해']},
  'pack01.emergency_guard':{activation:'이 카드를 낼 때',effect:'보호막 5 획득.',terms:['보호막']},
  'pack01.sharp_glass':{activation:'이 카드로 트릭 승리 시',effect:'적에게 출혈 2 부여.',extra:'출혈은 트릭 종료 시 피해를 주고 1 감소한다.',duration:'해당 전투가 끝나거나 출혈이 모두 감소할 때까지',terms:['트릭','출혈','피해']},
  'pack01.ambush_observer':{activation:'쇼다운 슬롯에 놓인 후',condition:'현재 세트의 3번 쇼다운 슬롯에 위치.',effect:'적 카드 예측 단계 +2.',duration:'현재 세트',terms:['세트','쇼다운 슬롯','예측']},
  'pack01.battery_1pct':{activation:'손에 들고 있는 동안 각 트릭 종료 시',condition:'20% 확률.',effect:'소진되어 이번 전투 동안 사용할 수 없다.',extra:'소진되지 않고 쇼다운 5장에 포함되면 쇼다운 최종 위력 +15. 손에 없으면 소진을 판정하지 않는다.',duration:'현재 전투',terms:['트릭','소진','전투','쇼다운','최종 위력']}
});
const {CARD_PACK_LIST,CARD_PACKS,defaultEnabledPacks,validateEnabledPacks,createRunPackState}=packRegistry;

function browserFallbackMigratedDefinitions(){
  const rows=[
    {id:'core.paint',legacyTacticId:'paint',name:'페인트',suit:'D',rank:4,text:'이 카드의 트릭 무늬를 현재 트럼프로 바꾼다. 인쇄값과 쇼다운값은 변하지 않는다.',terms:['트릭값','트럼프','인쇄값','쇼다운값'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'set_next_trick_suit_to_trump',duration:'trick'}]},
    {id:'core.plus2',legacyTacticId:'plus2',name:'숫자 +2',suit:'S',rank:3,text:'이 카드의 트릭 숫자 +2.',terms:['트릭값','인쇄값'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'increase_next_trick_rank',value:2,duration:'trick'}]},
    {id:'core.draw',legacyTacticId:'draw',name:'드로우',suit:'C',rank:6,text:'이 카드를 낸 뒤 다음 트릭의 손패가 1장 많아지도록 추가 드로우한다.',terms:['트릭','손패','드로우'],activation:'이 카드를 낼 때',migrationStage:'3-2B',effects:[{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}]},
    {id:'core.scout',legacyTacticId:'scout',name:'정찰',suit:'D',rank:9,text:'다음 트릭의 적 카드를 현재 트릭 종료 전에 미리 공개한다.',terms:['트릭','예측'],activation:'이 카드를 낼 때',migrationStage:'3-2B',effects:[{trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'}]},
    {id:'core.double',legacyTacticId:'double',name:'더블다운',suit:'H',rank:2,text:'쇼다운에서 내가 우세 무늬를 2개 이상 확보했다면 쇼다운 위력 +6.',terms:['쇼다운','우세','최종 위력'],activation:'쇼다운 위력 계산 시',migrationStage:'3-2B',effects:[{trigger:'on_showdown_score',action:'showdown_power',value:6,condition:'advantage_count_at_least',conditionValue:2,duration:'set'}]},
    {id:'core.barrier',legacyTacticId:'barrier',name:'임시 장벽',suit:'S',rank:6,text:'사용 시 보호막 3을 얻는다.',terms:['보호막'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'gain_shield',value:3,duration:'battle'}]},
    {id:'core.burn',legacyTacticId:'burn',name:'번',suit:'C',rank:2,text:'사용 시 손패에서 이 카드 외 1장을 선택해 버리고 칩 +1, 카드 1장을 뽑는다.',terms:['손패','버림','칩','드로우'],activation:'이 카드를 낼 때',migrationStage:'3-2B',targeting:{zone:'hand',count:1,excludeSelf:true},effects:[{trigger:'on_play',action:'discard_secondary_target',duration:'trick'},{trigger:'on_play',action:'gain_chips',value:1,duration:'trick'},{trigger:'on_play',action:'draw_cards',value:1,duration:'trick'}]},
    {id:'core.reverse',legacyTacticId:'reverse',name:'리버스',suit:'H',rank:3,text:'이번 트릭은 낮은 트릭 숫자가 승리한다.',terms:['트릭','트릭값'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'set_reverse_compare',duration:'trick'}]},
    {id:'core.pureboost',legacyTacticId:'pureboost',name:'기본에 충실',suit:'D',rank:5,text:'이 카드에 다른 트릭 보정이 없다면 트릭 숫자 +2.',terms:['트릭값','인쇄값'],activation:'이 카드를 낼 때',migrationStage:'3-2B',effects:[{trigger:'on_play',action:'increase_next_trick_rank',value:2,condition:'unmodified_trick_value',duration:'trick'}]},
    {id:'core.clean',legacyTacticId:'clean',name:'무첨가',suit:'S',rank:4,text:'이 카드의 트릭값이 인쇄값과 같은 상태로 승리하면 칩 +2.',terms:['트릭','트릭값','인쇄값','칩'],activation:'이 카드로 트릭 승리 시',migrationStage:'3-2B',effects:[{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'printed_equals_trick',duration:'trick'}]},
    {id:'core.recolor',legacyTacticId:'recolor',name:'색칠공부',suit:'C',rank:9,text:'이 카드의 쇼다운 무늬를 현재 트럼프 무늬로 바꾼다.',terms:['쇼다운값','트럼프'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'set_last_showdown_suit_to_trump',duration:'set'}]},
    {id:'core.fakeid',legacyTacticId:'fakeid',name:'가짜 신분증',suit:'H',rank:10,text:'이 카드의 쇼다운 숫자 +1.',terms:['쇼다운값'],activation:'이 카드를 낼 때',migrationStage:'3-1',effects:[{trigger:'on_play',action:'increase_last_showdown_rank',value:1,duration:'set'}]}
  ];
  return rows.map(row=>Object.freeze({id:row.id,legacyTacticId:row.legacyTacticId,name:row.name,short:row.name,suit:row.suit,rank:row.rank,printedSuit:row.suit,printedRank:row.rank,description:`발동: ${row.activation}. 효과: ${row.text}`,terms:Object.freeze(row.terms),effects:Object.freeze(row.effects.map(effect=>Object.freeze({...effect}))),targeting:row.targeting?Object.freeze({...row.targeting}):null,implemented:true,category:'general',rarity:'common',migrationStage:row.migrationStage}));
}

// CARD_DEFINITIONS remains the named/pack registry for compatibility.
const CARD_DEFINITIONS=Object.values(CARD_PACKS).flatMap(pack=>pack.cards);
for(const card of CARD_DEFINITIONS){card.implemented=Object.hasOwn(IMPLEMENTED_CARD_EFFECTS,card.id);card.effects=IMPLEMENTED_CARD_EFFECTS[card.id]||[]}
const GENERAL_EFFECT_CARD_DEFINITIONS=Object.freeze([...(migratedCards?.ACTIVE_CARD_DEFINITIONS||migratedCards?.DIRECT_CARD_DEFINITIONS||browserFallbackMigratedDefinitions())]);
const ALL_CARD_DEFINITIONS=Object.freeze([...CARD_DEFINITIONS,...GENERAL_EFFECT_CARD_DEFINITIONS]);
const CARD_DEFINITION_BY_ID=Object.fromEntries(ALL_CARD_DEFINITIONS.map(card=>[card.id,card]));
const CARD_DEFINITION_BY_BASE=Object.fromEntries(ALL_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card]));
const GENERAL_EFFECT_CARD_BY_BASE=Object.fromEntries(GENERAL_EFFECT_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card]));
function rewardCardIds(enabledPacks=defaultEnabledPacks()){
  const enabled=new Set(validateEnabledPacks(enabledPacks));
  return CARD_PACK_LIST.filter(pack=>enabled.has(pack.id)).flatMap(pack=>pack.cards.flatMap(card=>Array(pack.rewardWeight).fill(card.id)));
}
function createCardRecord({suit,rank,cardId=null,definitionId=null,effects,metadata={}}={}){
  if(!['S','H','D','C'].includes(suit))throw new TypeError(`Unknown card suit: ${suit}`);
  if(!Number.isFinite(rank)||rank<2||rank>14)throw new TypeError(`Invalid card rank: ${rank}`);
  const lookupId=definitionId||cardId;
  const definition=lookupId?CARD_DEFINITION_BY_ID[lookupId]||null:null;
  if(definitionId&&!definition)throw new TypeError(`Unknown card definition: ${definitionId}`);
  const effectList=effects===undefined?(definition?.effects||[]):effects;
  if(!Array.isArray(effectList))throw new TypeError('Card effects must be an array');
  return{
    ...metadata,
    suit,rank,printedSuit:suit,printedRank:rank,
    cardId:definition?.id||cardId||null,
    definition,
    name:metadata.name??definition?.name??null,
    named:definition?.packId?definition:null,
    effects:effectList.map(effect=>({...effect}))
  };
}
function createDefinitionCard(definitionId,metadata={}){
  const definition=CARD_DEFINITION_BY_ID[definitionId];
  if(!definition)throw new TypeError(`Unknown card definition: ${definitionId}`);
  return createCardRecord({suit:definition.suit,rank:definition.rank,definitionId,metadata});
}
const BASE_CARD_SLOTS=Object.freeze(['S','H','D','C'].flatMap(suit=>Array.from({length:13},(_,index)=>Object.freeze({suit,rank:index+2}))));
function createBaseCardSlots(){
  return BASE_CARD_SLOTS.map(slot=>{
    const migrated=GENERAL_EFFECT_CARD_BY_BASE[`${slot.suit}${slot.rank}`];
    return migrated?createCardRecord({suit:slot.suit,rank:slot.rank,definitionId:migrated.id}):createCardRecord({suit:slot.suit,rank:slot.rank});
  });
}
return{CARD_PACK_LIST,CARD_DEFINITIONS,GENERAL_EFFECT_CARD_DEFINITIONS,ALL_CARD_DEFINITIONS,CARD_DEFINITION_BY_ID,CARD_DEFINITION_BY_BASE,CARD_PACKS,BASE_CARD_SLOTS,PLAYER_EFFECT_LABELS,CARD_DETAIL_BY_ID,createCardRecord,createDefinitionCard,createBaseCardSlots,defaultEnabledPacks,validateEnabledPacks,createRunPackState,rewardCardIds};
});
