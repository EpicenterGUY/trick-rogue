const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');

function battleState(overrides={}){
  const history=Effects.newHistory();
  return{
    setIndex:1,
    trick:1,
    reservations:[],
    mods:{paint:false,plus:0,reverse:false,double:false},
    slots:[],
    history,
    ...overrides,
    history:overrides.history||history
  };
}

function execute(id,trigger,{battle=battleState(),card=null,perform=null,...overrides}={}){
  const instance=card||Cards.createDefinitionCard(id,{uid:`test-${id}`});
  const calls=[];
  const context={
    card:instance,
    battle,
    history:battle.history,
    setIndex:battle.setIndex,
    trick:battle.trick,
    slotIndex:battle.slots.length,
    slots:battle.slots,
    perform:perform||((...args)=>calls.push(args)),
    ...overrides
  };
  const count=Effects.run(trigger,instance,context);
  return{card:instance,battle,context,calls,count};
}

function pure(suit='H',rank=9){
  return Cards.createCardRecord({suit,rank,metadata:{uid:`pure-${suit}-${rank}`}});
}

function effect(id){
  return Cards.createDefinitionCard(id,{uid:`neighbor-${id}`});
}

test('M4 3차 특이 카드 3장이 카탈로그와 공용 액션에 등록된다',()=>{
  for(const id of ['pack03.time_bomb','pack03.bad_check','pack03.infection']){
    const definition=Cards.CARD_DEFINITION_BY_ID[id];
    assert.ok(definition,id);
    assert.equal(definition.implemented,true,id);
    assert.ok(definition.effects.length>0,id);
  }
  for(const action of ['reserve_delayed_damage','showdown_power_from_adjacent_effect_cards']){
    assert.ok(Effects.ACTIONS.includes(action),action);
  }
});

test('시한폭탄은 1번째 트릭에 내면 정확히 3번째 트릭 결과 처리 때 피해 12가 발동한다',()=>{
  const battle=battleState({trick:1});
  execute('pack03.time_bomb','on_play',{battle});
  assert.equal(battle.reservations.length,1);
  assert.equal(battle.reservations[0].eligibleSet,1);
  assert.equal(battle.reservations[0].eligibleTrick,3);
  assert.equal(battle.reservations[0].action,'damage_enemy');
  assert.equal(battle.reservations[0].value,12);

  const calls=[];
  battle.reservations=Effects.resolveNextWinReservations(
    battle.reservations,
    {set:1,trick:2},
    false,
    (action,value)=>calls.push([action,value])
  );
  assert.deepEqual(calls,[]);
  assert.equal(battle.reservations.length,1);

  battle.reservations=Effects.resolveNextWinReservations(
    battle.reservations,
    {set:1,trick:3},
    false,
    (action,value)=>calls.push([action,value])
  );
  assert.deepEqual(calls,[['damage_enemy',12]]);
  assert.equal(battle.reservations.length,0);
});

test('시한폭탄은 세트 안에 두 트릭이 남지 않은 4~5번째 트릭에서는 예약을 만들지 않는다',()=>{
  for(const trick of [4,5]){
    const battle=battleState({trick});
    execute('pack03.time_bomb','on_play',{battle});
    assert.deepEqual(battle.reservations,[],`trick=${trick}`);
  }
});

test('부도수표는 현재 트릭에 +8을 빌리고 쇼다운에서 -10으로 갚는다',()=>{
  const battle=battleState();
  const onPlay=execute('pack03.bad_check','on_play',{battle});
  assert.deepEqual(onPlay.calls.map(call=>call.slice(0,2)),[['increase_next_trick_rank',8]]);
  const showdown=execute('pack03.bad_check','on_showdown_score',{battle,card:onPlay.card});
  assert.deepEqual(showdown.calls.map(call=>call.slice(0,2)),[['showdown_power',-10]]);
});

test('감염 카드는 인접 효과 카드 한 장이면 +4, 양쪽이면 총 +12, 없으면 0이다',()=>{
  const infection=effect('pack03.infection');
  const left=effect('pack01.black_bullet');
  const right=effect('pack02.receipt');

  const bothBattle=battleState({slots:[{card:left},{card:infection},{card:right}]});
  const both=execute('pack03.infection','on_showdown_score',{battle:bothBattle,card:infection,slotIndex:1});
  assert.deepEqual(both.calls.map(call=>call.slice(0,2)),[['showdown_power',12]]);

  const oneBattle=battleState({slots:[{card:pure()},{card:infection},{card:right}]});
  const one=execute('pack03.infection','on_showdown_score',{battle:oneBattle,card:infection,slotIndex:1});
  assert.deepEqual(one.calls.map(call=>call.slice(0,2)),[['showdown_power',4]]);

  const noneBattle=battleState({slots:[{card:pure('H',7)},{card:infection},{card:pure('D',10)}]});
  const none=execute('pack03.infection','on_showdown_score',{battle:noneBattle,card:infection,slotIndex:1});
  assert.deepEqual(none.calls,[]);
});
