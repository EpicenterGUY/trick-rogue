(function(root,factory){
const api=factory();
if(typeof module!=='undefined')module.exports=api;
root.Cards=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
const CARD_PACK_LIST=Object.freeze(['pack01']);
const PLAYER_EFFECT_LABELS=Object.freeze({
  on_play:'제출 시',on_trick_win:'트릭 승리 시',on_trick_loss:'트릭 패배 시',on_trick_draw:'트릭 무승부 시',on_showdown_score:'쇼다운 시',on_draw:'드로우 시',on_discard:'버림 시',on_set_start:'세트 시작 시',on_trick_start:'트릭 시작 시',on_trick_end:'트릭 종료 시'
});
const CARD_DEFINITIONS=Object.freeze([
  Object.freeze({id:'pack01.black_bullet',packId:'pack01',name:'검은 탄환',suit:'S',rank:14,effects:Object.freeze([Object.freeze({id:'black-bullet-win',trigger:'on_trick_win',action:'damage_enemy',value:4,duration:'trick'}),Object.freeze({id:'black-bullet-showdown',trigger:'on_showdown_score',action:'add_showdown_power',value:4,duration:'set'})])}),
  Object.freeze({id:'pack01.phoenix',packId:'pack01',name:'불사조',suit:'H',rank:13,effects:Object.freeze([Object.freeze({id:'phoenix-win',trigger:'on_trick_win',action:'heal_player',value:4,duration:'trick'})])}),
  Object.freeze({id:'pack01.golden_hand',packId:'pack01',name:'황금손',suit:'D',rank:12,effects:Object.freeze([Object.freeze({id:'golden-hand-win-chip',trigger:'on_trick_win',action:'gain_chips',value:1,duration:'trick'}),Object.freeze({id:'golden-hand-win-hand',trigger:'on_trick_win',action:'increase_next_trick_hand',value:1,duration:'trick'})])}),
  Object.freeze({id:'pack01.dirty_gambler',packId:'pack01',name:'비열한 승부사',suit:'C',rank:11,effects:Object.freeze([Object.freeze({id:'dirty-gambler-win',trigger:'on_trick_win',condition:'effective_rank_at_most',conditionValue:5,action:'gain_chips',value:2,duration:'trick'})])}),
  Object.freeze({id:'pack01.scheduled_delivery',packId:'pack01',name:'예약 발송',suit:'S',rank:9,effects:Object.freeze([Object.freeze({id:'scheduled-delivery-play',trigger:'on_play',action:'reserve_next_win_damage',value:5,duration:'trick'})])}),
  Object.freeze({id:'pack01.sharp_glass',packId:'pack01',name:'날 선 유리',suit:'H',rank:8,effects:Object.freeze([Object.freeze({id:'sharp-glass-play',trigger:'on_play',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'bleed',amount:2}),duration:'battle'})])}),
  Object.freeze({id:'pack01.emergency_gear',packId:'pack01',name:'응급 보호구',suit:'D',rank:7,effects:Object.freeze([Object.freeze({id:'emergency-gear-play',trigger:'on_play',action:'apply_status',value:Object.freeze({target:'player',statusId:'shield',amount:5}),duration:'battle'})])}),
  Object.freeze({id:'pack01.recursive_function',packId:'pack01',name:'재귀 함수',suit:'C',rank:6,effects:Object.freeze([Object.freeze({id:'recursive-function-play',trigger:'on_play',action:'copy_previous_named_numeric_effect',value:1,duration:'trick'})])}),
  Object.freeze({id:'pack01.one_percent_battery',packId:'pack01',name:'배터리 1%',suit:'S',rank:4,effects:Object.freeze([Object.freeze({id:'one-percent-battery-start',trigger:'on_trick_start',condition:'random_chance',conditionValue:.2,action:'mark_self_consumed',value:1,duration:'trick'}),Object.freeze({id:'one-percent-battery-showdown',trigger:'on_showdown_score',condition:'self_not_consumed',action:'add_showdown_power',value:15,duration:'set'})])}),
  Object.freeze({id:'pack01.ambush_observer',packId:'pack01',name:'매복한 관측자',suit:'H',rank:3,effects:Object.freeze([Object.freeze({id:'ambush-observer-play',trigger:'on_play',condition:'slot_equals',conditionValue:3,action:'increase_prediction',value:2,duration:'set'})])})
]);
const GENERAL_EFFECT_CARD_DEFINITIONS=Object.freeze([
  Object.freeze({id:'core.draw',packId:null,category:'general',name:'드로우',suit:'S',rank:2,effects:Object.freeze([Object.freeze({id:'core-draw-play',trigger:'on_play',action:'increase_next_trick_hand',value:1,duration:'trick'})])}),
  Object.freeze({id:'core.scout',packId:null,category:'general',name:'정찰',suit:'H',rank:2,effects:Object.freeze([Object.freeze({id:'core-scout-play',trigger:'on_play',action:'reveal_next_enemy',value:1,duration:'trick'})])}),
  Object.freeze({id:'core.double_down',packId:null,category:'general',name:'더블다운',suit:'D',rank:2,effects:Object.freeze([Object.freeze({id:'core-double-down-showdown',trigger:'on_showdown_score',condition:'set_wins_at_least',conditionValue:3,action:'add_showdown_power',value:6,duration:'set'})])}),
  Object.freeze({id:'core.burn',packId:null,category:'general',name:'번',suit:'C',rank:2,effects:Object.freeze([Object.freeze({id:'core-burn-play',trigger:'on_play',condition:'secondary_hand_card_selected',action:'discard_secondary_hand_card',value:1,duration:'trick'}),Object.freeze({id:'core-burn-chip',trigger:'on_play',condition:'secondary_hand_card_selected',action:'gain_chips',value:2,duration:'trick'}),Object.freeze({id:'core-burn-draw',trigger:'on_play',condition:'secondary_hand_card_selected',action:'draw_cards',value:1,duration:'trick'})])}),
  Object.freeze({id:'core.back_to_basics',packId:null,category:'general',name:'기본에 충실',suit:'S',rank:5,effects:Object.freeze([Object.freeze({id:'core-back-to-basics-play',trigger:'on_play',condition:'hand_has_pure_card',action:'add_self_trick_rank',value:2,duration:'trick'})])}),
  Object.freeze({id:'core.unadulterated',packId:null,category:'general',name:'무첨가',suit:'H',rank:5,effects:Object.freeze([Object.freeze({id:'core-unadulterated-win',trigger:'on_trick_win',condition:'showdown_has_pure_card',action:'gain_chips',value:2,duration:'trick'})])}),
  Object.freeze({id:'core.high_voltage',packId:null,category:'general',name:'고전압',suit:'D',rank:5,effects:Object.freeze([Object.freeze({id:'core-high-voltage-play',trigger:'on_play',action:'add_self_trick_rank',value:3,duration:'trick'})])}),
  Object.freeze({id:'core.last_word',packId:null,category:'general',name:'마지막 한마디',suit:'C',rank:5,effects:Object.freeze([Object.freeze({id:'core-last-word-showdown',trigger:'on_showdown_score',condition:'slot_equals',conditionValue:5,action:'add_showdown_power',value:5,duration:'set'})])}),
  Object.freeze({id:'core.recovery',packId:null,category:'general',name:'회수',suit:'S',rank:8,effects:Object.freeze([Object.freeze({id:'core-recovery-draw',trigger:'on_draw',action:'gain_chips',value:1,duration:'trick'})])}),
  Object.freeze({id:'core.counterweight',packId:null,category:'general',name:'균형추',suit:'H',rank:8,effects:Object.freeze([Object.freeze({id:'core-counterweight-draw',trigger:'on_draw',action:'apply_status',value:Object.freeze({target:'player',statusId:'shield',amount:2}),duration:'battle'})])}),
  Object.freeze({id:'core.failsafe',packId:null,category:'general',name:'안전장치',suit:'D',rank:8,effects:Object.freeze([Object.freeze({id:'core-failsafe-loss',trigger:'on_trick_loss',action:'gain_chips',value:1,duration:'trick'})])}),
  Object.freeze({id:'core.equalizer',packId:null,category:'general',name:'동점 장치',suit:'C',rank:8,effects:Object.freeze([Object.freeze({id:'core-equalizer-draw',trigger:'on_trick_draw',action:'gain_chips',value:1,duration:'trick'})])})
]);
const ALL_CARD_DEFINITIONS=Object.freeze([...CARD_DEFINITIONS,...GENERAL_EFFECT_CARD_DEFINITIONS]);
const CARD_DEFINITION_BY_ID=Object.freeze(Object.fromEntries(ALL_CARD_DEFINITIONS.map(card=>[card.id,card])));
const CARD_DEFINITION_BY_BASE=Object.freeze(Object.fromEntries(CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card])));
const GENERAL_EFFECT_CARD_BY_BASE=Object.freeze(Object.fromEntries(GENERAL_EFFECT_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card])));
const CARD_PACKS=Object.freeze({pack01:Object.freeze(CARD_DEFINITIONS.map(card=>card.id))});
const CARD_DETAIL_BY_ID=Object.freeze(Object.fromEntries(CARD_DEFINITIONS.map(card=>[card.id,Object.freeze({name:card.name,packId:card.packId,suit:card.suit,rank:card.rank,effects:card.effects})])));
function defaultEnabledPacks(){return CARD_PACK_LIST.slice()}
function validateEnabledPacks(packs=[]){return packs.filter(pack=>CARD_PACK_LIST.includes(pack))}
function createRunPackState(packs=defaultEnabledPacks()){return{enabledPacks:validateEnabledPacks(packs)}}
function rewardCardIds(runState={}){const enabled=new Set(validateEnabledPacks(runState.enabledPacks||defaultEnabledPacks()));return CARD_DEFINITIONS.filter(card=>enabled.has(card.packId)).map(card=>card.id)}
function createCardRecord({suit,rank,cardId=null,definitionId=null,effects,metadata={}}={}){
  if(!['S','H','D','C'].includes(suit))throw new TypeError(`Unknown card suit: ${suit}`);
  if(!Number.isInteger(rank)||rank<2||rank>14)throw new TypeError(`Invalid card rank: ${rank}`);
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
function isPureCard(entry){
  const card=entry?.card||entry;
  return!!card&&!card.named&&!card.definition&&!card.cardId&&(!Array.isArray(card.effects)||card.effects.length===0);
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
return{CARD_PACK_LIST,CARD_DEFINITIONS,GENERAL_EFFECT_CARD_DEFINITIONS,ALL_CARD_DEFINITIONS,CARD_DEFINITION_BY_ID,CARD_DEFINITION_BY_BASE,CARD_PACKS,BASE_CARD_SLOTS,PLAYER_EFFECT_LABELS,CARD_DETAIL_BY_ID,createCardRecord,isPureCard,createDefinitionCard,createBaseCardSlots,defaultEnabledPacks,validateEnabledPacks,createRunPackState,rewardCardIds};
});