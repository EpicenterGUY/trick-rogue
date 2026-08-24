const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');

test('배터리 1%는 소진 위험 20%를 유지하면서 쇼다운 보너스만 +10이다',()=>{
  const battery=Cards.CARD_DEFINITION_BY_ID['pack01.battery_1pct'];
  const exhaust=battery.effects.find(effect=>effect.handler==='deplete_battery_in_hand');
  const score=battery.effects.find(effect=>effect.action==='showdown_power');
  assert.equal(battery.rank,14);
  assert.equal(battery.suit,'S');
  assert.equal(exhaust.chance,0.2);
  assert.equal(score.value,10);
  assert.match(battery.description,/최종 쇼다운 위력 \+10/);
  assert.match(Cards.CARD_DETAIL_BY_ID['pack01.battery_1pct'].extra,/최종 위력 \+10/);
});

test('배터리 조정은 다른 pack01 핵심 수치를 바꾸지 않는다',()=>{
  const expected={
    'pack01.black_bullet':['damage_enemy',3,'showdown_power',4],
    'pack01.phoenix':['heal_player',4],
    'pack01.golden_hand':['gain_chips',1,'grant_next_trick_hand_capacity',1],
    'pack01.dirty_gambler':['gain_chips',2],
    'pack01.scheduled_delivery':['reserve_next_win_damage',6],
    'pack01.emergency_guard':['gain_shield',5],
    'pack01.sharp_glass':['apply_enemy_bleed',2],
    'pack01.ambush_observer':['increase_enemy_forecast',2]
  };
  for(const [id,flat] of Object.entries(expected)){
    const actual=Cards.CARD_DEFINITION_BY_ID[id].effects
      .filter(effect=>effect.action)
      .flatMap(effect=>[effect.action,effect.value]);
    assert.deepEqual(actual,flat,id);
  }
  assert.equal(Cards.CARD_DEFINITION_BY_ID['pack01.recursive_function'].effects[0].handler,'repeat_last_named_numeric');
});
