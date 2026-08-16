(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./card-packs/pack01.js'):root.PACK01_CARDS
  );
  if(typeof module!=='undefined')module.exports=api;
  Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(PACK01_CARDS){
const IMPLEMENTED_CARD_EFFECTS = {
  'pack01.black_bullet': [{trigger:'on_trick_win',action:'damage_enemy',value:3},{trigger:'on_showdown_score',action:'showdown_power',value:4}],
  'pack01.phoenix': [{trigger:'on_trick_win',action:'heal_player',value:4}],
  'pack01.golden_hand': [{trigger:'on_trick_win',action:'gain_chips',value:1,condition:'tactic_or_chip_used'}],
  'pack01.dirty_gambler': [{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'effective_rank_at_most',conditionValue:5}],
  'pack01.recursive_function': [{trigger:'on_trick_win',handler:'repeat_last_named'}],
  'pack01.scheduled_delivery': [{trigger:'on_play',action:'reserve_next_win_damage',value:6}],
  'pack01.emergency_guard': [{trigger:'on_play',action:'gain_shield',value:5}],
  'pack01.sharp_glass': [{trigger:'on_trick_win',action:'apply_enemy_bleed',value:2}],
  'pack01.ambush_observer': [{trigger:'after_card_slotted',action:'increase_enemy_forecast',value:2,condition:'slot_is',conditionValue:3},{trigger:'on_showdown_score',action:'showdown_power',value:4,condition:'slot_is',conditionValue:3}],
  'pack01.battery_1pct': [{trigger:'on_showdown_score',action:'showdown_power',value:15}]
};
const makePack=(metadata,cards)=>Object.freeze({...metadata,cards:Object.freeze(cards),cardIds:Object.freeze(cards.map(card=>card.id))});
const CARD_PACK_LIST=Object.freeze([
  makePack({id:'pack01',name:'신규 1팩',version:'1.0.0',enabledByDefault:true,rewardWeight:1},PACK01_CARDS)
]);
const CARD_PACKS=Object.freeze(Object.fromEntries(CARD_PACK_LIST.map(pack=>[pack.id,pack])));

const CARD_DEFINITIONS=Object.values(CARD_PACKS).flatMap(pack=>pack.cards);
for(const card of CARD_DEFINITIONS){card.implemented=Object.hasOwn(IMPLEMENTED_CARD_EFFECTS,card.id);card.effects=IMPLEMENTED_CARD_EFFECTS[card.id]||[]}
const CARD_DEFINITION_BY_ID=Object.fromEntries(CARD_DEFINITIONS.map(card=>[card.id,card]));
const CARD_DEFINITION_BY_BASE=Object.fromEntries(CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card]));
function defaultEnabledPacks(){return Object.values(CARD_PACKS).filter(pack=>pack.enabledByDefault).map(pack=>pack.id)}
function rewardCardIds(enabledPacks=defaultEnabledPacks()){
  const enabled=new Set(enabledPacks);
  return Object.values(CARD_PACKS).filter(pack=>enabled.has(pack.id)).flatMap(pack=>pack.cards.flatMap(card=>Array(Math.max(0,pack.rewardWeight)).fill(card.id)));
}
const BASE_CARD_SLOTS=Object.freeze(['S','H','D','C'].flatMap(suit=>Array.from({length:13},(_,index)=>Object.freeze({suit,rank:index+2}))));
function createBaseCardSlots(){return BASE_CARD_SLOTS.map(slot=>({suit:slot.suit,rank:slot.rank,named:null,cardId:null}))}
return{CARD_PACK_LIST,CARD_DEFINITIONS,CARD_DEFINITION_BY_ID,CARD_DEFINITION_BY_BASE,CARD_PACKS,BASE_CARD_SLOTS,createBaseCardSlots,defaultEnabledPacks,rewardCardIds};
});
