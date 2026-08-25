const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const BattleCore=require('../battle-core.js');

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
    random:()=>0,
    perform:perform||((...args)=>calls.push(args)),
    ...overrides
  };
  const count=Effects.run(trigger,instance,context);
  return{card:instance,battle,context,calls,count};
}

test('M4 4차 특이 카드 3장과 공용 액션이 등록된다',()=>{
  for(const id of ['pack03.doppelganger','pack03.russian_roulette','pack03.black_box']){
    const definition=Cards.CARD_DEFINITION_BY_ID[id];
    assert.ok(definition,id);
    assert.equal(definition.implemented,true,id);
    assert.ok(definition.effects.length>0,id);
  }
  for(const action of ['copy_previous_showdown_card','russian_roulette_rank','mark_card_memory','showdown_power_if_memory']){
    assert.ok(Effects.ACTIONS.includes(action),action);
  }
});

test('도플갱어는 직전 쇼다운 카드의 숫자와 무늬를 모두 복사하고 트릭 인쇄값은 K를 유지한다',()=>{
  const previous=Cards.createCardRecord({suit:'S',rank:9,metadata:{uid:'previous'}});
  previous.showdownRank=7;
  previous.showdownSuit='D';
  const doppel=Cards.createDefinitionCard('pack03.doppelganger',{uid:'doppel'});
  const battle=battleState({slots:[{card:previous},{card:doppel}]});

  execute('pack03.doppelganger','on_play',{battle,card:doppel,slotIndex:1});
  assert.equal(BattleCore.showdownValue(doppel,'Rank'),7);
  assert.equal(BattleCore.showdownValue(doppel,'Suit'),'D');
  assert.equal(BattleCore.printedValue(doppel,'Rank'),13);

  const first=Cards.createDefinitionCard('pack03.doppelganger',{uid:'first'});
  execute('pack03.doppelganger','on_play',{battle:battleState({slots:[{card:first}]}),card:first,slotIndex:0});
  assert.equal(first.showdownRank,undefined);
  assert.equal(first.showdownSuit,undefined);
});

test('러시안 룰렛은 1/6 실패 시 2, 생존 시 A로 트릭 숫자를 바꾸고 쇼다운은 인쇄 10을 유지한다',()=>{
  const failBattle=battleState();
  const failed=execute('pack03.russian_roulette','on_play',{battle:failBattle,random:()=>0});
  assert.equal(failBattle.mods.plus,-8);
  assert.equal(failed.card.cardEffectMemory.roulette_fired.value,1);
  assert.equal(BattleCore.resolveTrickValue(failed.card,null,{cardRankModifier:failBattle.mods.plus}).finalValue,2);
  assert.equal(BattleCore.showdownValue(failed.card,'Rank'),10);

  const safeBattle=battleState();
  const survived=execute('pack03.russian_roulette','on_play',{battle:safeBattle,random:()=>0.5});
  assert.equal(safeBattle.mods.plus,4);
  assert.equal(survived.card.cardEffectMemory.roulette_fired.value,0);
  assert.equal(BattleCore.resolveTrickValue(survived.card,null,{cardRankModifier:safeBattle.mods.plus}).finalValue,14);
  assert.equal(BattleCore.showdownValue(survived.card,'Rank'),10);
});

test('블랙박스는 무승부가 난 같은 세트에서만 쇼다운 위력 +15를 준다',()=>{
  const battle=battleState({setIndex:1});
  const card=Cards.createDefinitionCard('pack03.black_box',{uid:'black-box'});
  execute('pack03.black_box','on_trick_draw',{battle,card});
  assert.equal(card.cardEffectMemory.black_box_draw.value,1);
  assert.equal(card.cardEffectMemory.black_box_draw.setIndex,1);

  const calls=[];
  execute('pack03.black_box','on_showdown_score',{battle,card,perform:(...args)=>calls.push(args)});
  assert.deepEqual(calls.map(call=>call.slice(0,2)),[['showdown_power',15]]);

  battle.setIndex=2;
  const nextSet=[];
  execute('pack03.black_box','on_showdown_score',{battle,card,perform:(...args)=>nextSet.push(args)});
  assert.deepEqual(nextSet,[]);
});
