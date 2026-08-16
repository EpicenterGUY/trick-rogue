(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./card-packs/index.js'):root
  );
  if(typeof module!=='undefined')module.exports=api;
  Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(packRegistry){
const IMPLEMENTED_CARD_EFFECTS = {
  'pack01.black_bullet': [{trigger:'on_trick_win',action:'damage_enemy',value:3,duration:'trick'},{trigger:'on_showdown_score',action:'showdown_power',value:4,duration:'set'}],
  'pack01.phoenix': [{trigger:'on_trick_win',action:'heal_player',value:4,duration:'trick'}],
  'pack01.golden_hand': [{trigger:'on_trick_win',action:'gain_chips',value:1,condition:'chips_spent',duration:'trick'},{trigger:'on_trick_win',action:'draw_tactic',value:1,condition:'chips_spent',duration:'trick'}],
  'pack01.dirty_gambler': [{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'effective_rank_at_most',conditionValue:5,duration:'trick'}],
  'pack01.recursive_function': [{trigger:'on_trick_win',handler:'repeat_last_named_numeric',duration:'trick'}],
  'pack01.scheduled_delivery': [{trigger:'on_play',action:'reserve_next_win_damage',value:6,duration:'trick'}],
  'pack01.emergency_guard': [{trigger:'on_play',action:'gain_shield',value:5,duration:'battle'}],
  'pack01.sharp_glass': [{trigger:'on_trick_win',action:'apply_enemy_bleed',value:2,duration:'battle'}],
  'pack01.ambush_observer': [{trigger:'after_card_slotted',action:'increase_enemy_forecast',value:2,condition:'slot_is',conditionValue:3,duration:'set'}],
  'pack01.battery_1pct': [{trigger:'on_trick_end',handler:'deplete_battery_in_hand',chance:0.2,duration:'battle'},{trigger:'on_showdown_score',action:'showdown_power',value:15,duration:'set'}]
};
// Effect data stays machine-readable above; every player-facing label lives here so
// engine identifiers never have to leak into card details or future UI surfaces.
const PLAYER_EFFECT_LABELS=Object.freeze({
  triggers:{on_play:'이 카드를 낼 때',on_set_start:'세트 시작 시',before_compare:'트릭 승패 비교 전',after_compare:'트릭 승패 비교 후',on_trick_win:'이 카드로 트릭 승리 시',on_trick_loss:'이 카드로 트릭 패배 시',after_card_slotted:'쇼다운 슬롯에 놓인 후',on_trick_end:'트릭 종료 시',before_showdown:'쇼다운 계산 전',on_showdown_advantage:'쇼다운 우세 판정 시',on_showdown_score:'쇼다운 위력 계산 시',after_showdown_result:'쇼다운 결과 판정 후',on_set_end:'세트 종료 시',before_damage:'피해를 받기 전',after_damage:'피해를 받은 후'},
  conditions:{chips_spent:'이번 트릭에 칩을 1 이상 소비',effective_rank_at_most:'적용 숫자가 지정된 수 이하',slot_is:'지정된 쇼다운 슬롯에 위치',slot_at_least:'지정된 쇼다운 슬롯 이후에 위치',in_hand:'손패에 있음'},
  actions:{damage_enemy:'적에게 피해',heal_player:'체력 회복',gain_chips:'칩 획득',gain_shield:'보호막 획득',apply_enemy_bleed:'적에게 출혈 부여',increase_enemy_forecast:'적 카드 예측 단계 증가',draw_tactic:'전술 카드 드로우',increase_effective_rank:'적용 숫자 증가',showdown_power:'쇼다운 최종 위력 증가',reserve_next_win_damage:'다음 트릭 승리 시 추가 피해 예약'},
  durations:{trick:'트릭',set:'세트',battle:'전투',run:'런'}
});
const CARD_DETAIL_BY_ID=Object.freeze({
  'pack01.black_bullet':{activation:'이 카드로 트릭 승리 시',effect:'적에게 피해 3.',extra:'이 카드가 쇼다운 5장에 포함되어 있으면 쇼다운 최종 위력 +4.',terms:['트릭','쇼다운','최종 위력']},
  'pack01.phoenix':{activation:'이 카드로 트릭 승리 시',effect:'체력 4 회복. 최대 체력을 넘지 않는다.',terms:['트릭','회복']},
  'pack01.golden_hand':{activation:'이 카드로 트릭 승리 시',condition:'이번 트릭에 칩을 1 이상 소비.',effect:'칩 +1, 전술 카드 1장 드로우.',terms:['트릭','칩','전술 카드','드로우']},
  'pack01.dirty_gambler':{activation:'이 카드로 트릭 승리 시',condition:'이 카드의 적용 숫자가 5 이하.',effect:'칩 +2.',terms:['트릭','적용 숫자','칩']},
  'pack01.recursive_function':{activation:'이 카드로 트릭 승리 시',effect:'직전에 발동한 다른 네임드 카드의 수치 효과 하나를 1회 복사.',extra:'복사 범위는 피해, 회복, 칩, 보호막, 출혈, 예측, 전술 카드 드로우이며 자기 자신은 복사하지 않는다.',terms:['트릭','피해','회복','칩','보호막','출혈','예측','전술 카드']},
  'pack01.scheduled_delivery':{activation:'이 카드를 낼 때',effect:'바로 다음 트릭에서 승리하면 적에게 추가 피해 6을 주는 예약을 생성.',extra:'다음 트릭에서 패배하거나 무승부면 예약이 사라진다.',duration:'다음 트릭까지',terms:['트릭','예약','피해']},
  'pack01.emergency_guard':{activation:'이 카드를 낼 때',effect:'보호막 5 획득.',terms:['보호막']},
  'pack01.sharp_glass':{activation:'이 카드로 트릭 승리 시',effect:'적에게 출혈 2 부여.',extra:'출혈은 트릭 종료 시 피해를 주고 1 감소한다.',duration:'해당 전투가 끝나거나 출혈이 모두 감소할 때까지',terms:['트릭','출혈','피해']},
  'pack01.ambush_observer':{activation:'쇼다운 슬롯에 놓인 후',condition:'현재 세트의 3번 쇼다운 슬롯에 위치.',effect:'적 카드 예측 단계 +2.',duration:'현재 세트',terms:['세트','쇼다운 슬롯','예측']},
  'pack01.battery_1pct':{activation:'손에 들고 있는 동안 각 트릭 종료 시',condition:'20% 확률.',effect:'소진되어 이번 전투 동안 사용할 수 없다.',extra:'소진되지 않고 쇼다운 5장에 포함되면 쇼다운 최종 위력 +15. 손에 없으면 소진을 판정하지 않는다.',duration:'현재 전투',terms:['트릭','소진','전투','쇼다운','최종 위력']}
});
const {CARD_PACK_LIST,CARD_PACKS,defaultEnabledPacks,validateEnabledPacks,createRunPackState}=packRegistry;

const CARD_DEFINITIONS=Object.values(CARD_PACKS).flatMap(pack=>pack.cards);
for(const card of CARD_DEFINITIONS){card.implemented=Object.hasOwn(IMPLEMENTED_CARD_EFFECTS,card.id);card.effects=IMPLEMENTED_CARD_EFFECTS[card.id]||[]}
const CARD_DEFINITION_BY_ID=Object.fromEntries(CARD_DEFINITIONS.map(card=>[card.id,card]));
const CARD_DEFINITION_BY_BASE=Object.fromEntries(CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card]));
function rewardCardIds(enabledPacks=defaultEnabledPacks()){
  const enabled=new Set(validateEnabledPacks(enabledPacks));
  return CARD_PACK_LIST.filter(pack=>enabled.has(pack.id)).flatMap(pack=>pack.cards.flatMap(card=>Array(pack.rewardWeight).fill(card.id)));
}
const BASE_CARD_SLOTS=Object.freeze(['S','H','D','C'].flatMap(suit=>Array.from({length:13},(_,index)=>Object.freeze({suit,rank:index+2}))));
function createBaseCardSlots(){return BASE_CARD_SLOTS.map(slot=>({suit:slot.suit,rank:slot.rank,named:null,cardId:null}))}
return{CARD_PACK_LIST,CARD_DEFINITIONS,CARD_DEFINITION_BY_ID,CARD_DEFINITION_BY_BASE,CARD_PACKS,BASE_CARD_SLOTS,PLAYER_EFFECT_LABELS,CARD_DETAIL_BY_ID,createBaseCardSlots,defaultEnabledPacks,validateEnabledPacks,createRunPackState,rewardCardIds};
});
