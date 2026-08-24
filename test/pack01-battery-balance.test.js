const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');

test('잔량 1%는 소진 위험 20%와 5번 슬롯 보너스 +12를 사용한다',()=>{
  const battery=Cards.CARD_DEFINITION_BY_ID['pack01.battery_1pct'];
  const exhaust=battery.effects.find(effect=>effect.handler==='deplete_battery_in_hand');
  const score=battery.effects.find(effect=>effect.action==='showdown_power');
  assert.equal(battery.name,'잔량 1%');
  assert.equal(battery.rank,14);
  assert.equal(battery.suit,'S');
  assert.equal(exhaust.chance,0.2);
  assert.equal(score.value,12);
  assert.equal(score.condition,'slot_is');
  assert.equal(score.conditionValue,5);
  assert.match(battery.description,/5번 쇼다운 슬롯/);
  assert.match(battery.description,/최종 쇼다운 위력 \+12/);
  assert.match(Cards.CARD_DETAIL_BY_ID['pack01.battery_1pct'].extra,/5번 쇼다운 슬롯/);
  assert.match(Cards.CARD_DETAIL_BY_ID['pack01.battery_1pct'].extra,/최종 위력 \+12/);
});

test('pack01 1차 밸런스 조정 수치와 표시명을 유지한다',()=>{
  const expected={
    'pack01.black_bullet':{name:'검은 탄환',flat:['damage_enemy',3,'showdown_power',3]},
    'pack01.phoenix':{name:'불사조',flat:['heal_player',4]},
    'pack01.golden_hand':{name:'골든 핸드',flat:['gain_chips',1,'grant_next_trick_hand_capacity',1]},
    'pack01.dirty_gambler':{name:'로우 블러프',flat:['gain_chips',2]},
    'pack01.scheduled_delivery':{name:'예약 사격',flat:['reserve_next_win_damage',6]},
    'pack01.emergency_guard':{name:'비상 방패',flat:['gain_shield',5]},
    'pack01.sharp_glass':{name:'유리 칼날',flat:['apply_enemy_bleed',3]},
    'pack01.ambush_observer':{name:'잠복 관측자',flat:['increase_enemy_forecast',2]}
  };
  for(const [id,{name,flat}] of Object.entries(expected)){
    const definition=Cards.CARD_DEFINITION_BY_ID[id];
    assert.equal(definition.name,name,id);
    const actual=definition.effects.filter(effect=>effect.action).flatMap(effect=>[effect.action,effect.value]);
    assert.deepEqual(actual,flat,id);
  }
  assert.equal(Cards.CARD_DEFINITION_BY_ID['pack01.recursive_function'].name,'재귀 함수');
  assert.equal(Cards.CARD_DEFINITION_BY_ID['pack01.recursive_function'].effects[0].handler,'repeat_last_named_numeric');
});
