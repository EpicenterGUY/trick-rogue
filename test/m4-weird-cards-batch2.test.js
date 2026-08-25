const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const BattleCore=require('../battle-core.js');

function battleState(overrides={}){
  const history=Effects.newHistory();
  return{
    setIndex:1,trick:1,chip:0,chipEconomy:{balance:0,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0},
    mods:{paint:false,plus:0,reverse:false,double:false},slots:[],history,
    ...overrides,
    history:overrides.history||history
  };
}

function execute(id,trigger,{battle=battleState(),card=null,perform=null,...overrides}={}){
  const instance=card||Cards.createDefinitionCard(id,{uid:`test-${id}`});
  const calls=[];
  const context={
    card:instance,battle,history:battle.history,setIndex:battle.setIndex,trick:battle.trick,
    slotIndex:battle.slots.length,slots:battle.slots,random:()=>0,
    perform:perform||((...args)=>calls.push(args)),...overrides
  };
  const count=Effects.run(trigger,instance,context);
  return{card:instance,battle,context,calls,count};
}

test('M4 2차 특이 카드 3장이 공용 효과 카드 카탈로그에 등록된다',()=>{
  for(const id of ['pack02.receipt','pack02.mirror','pack02.loaded_die']){
    const definition=Cards.CARD_DEFINITION_BY_ID[id];
    assert.ok(definition,id);
    assert.equal(definition.implemented,true,id);
    assert.ok(definition.effects.length>0,id);
  }
  for(const action of ['spend_all_chips','showdown_power_from_memory_multiplier','copy_previous_showdown_suit','randomize_trick_rank']){
    assert.ok(Effects.ACTIONS.includes(action),action);
  }
});

test('영수증은 현재 칩을 전부 소비하고 같은 세트 쇼다운에서 칩당 위력 +3으로 환산한다',()=>{
  const battle=battleState({chip:4,chipEconomy:{balance:4,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}});
  const played=execute('pack02.receipt','on_play',{battle});
  assert.equal(played.battle.chip,0);
  assert.equal(played.battle.chipEconomy.balance,0);
  assert.equal(played.battle.history.chipsSpent,4);
  assert.equal(played.card.cardEffectMemory.receipt_spent.value,4);

  const showdownCalls=[];
  execute('pack02.receipt','on_showdown_score',{battle,card:played.card,perform:(...args)=>showdownCalls.push(args)});
  assert.deepEqual(showdownCalls.map(call=>call.slice(0,2)),[['showdown_power',12]]);

  const nextSetCalls=[];
  battle.setIndex=2;
  execute('pack02.receipt','on_showdown_score',{battle,card:played.card,perform:(...args)=>nextSetCalls.push(args)});
  assert.deepEqual(nextSetCalls,[]);
});

test('거울은 2번 이후 슬롯에서 바로 이전 쇼다운 카드의 무늬만 복사한다',()=>{
  const previous=Cards.createCardRecord({suit:'S',rank:9,metadata:{uid:'previous'}});
  previous.showdownSuit='D';
  const battle=battleState({slots:[{card:previous}]});
  const result=execute('pack02.mirror','on_play',{battle});
  assert.equal(result.card.showdownSuit,'D');
  assert.equal(BattleCore.showdownValue(result.card,'Rank'),5);

  const firstSlot=battleState({slots:[]});
  const noCopy=execute('pack02.mirror','on_play',{battle:firstSlot});
  assert.equal(noCopy.card.showdownSuit,undefined);
});

test('사기 주사위는 트럼프 보너스 전 트릭 숫자를 2~12로 바꾸고 쇼다운 숫자 6은 보존한다',()=>{
  const lowBattle=battleState();
  const low=execute('pack02.loaded_die','on_play',{battle:lowBattle,random:()=>0});
  assert.equal(low.battle.mods.plus,-4);
  assert.equal(low.card.cardEffectMemory.loaded_die_roll.value,2);
  assert.equal(BattleCore.resolveTrickValue(low.card,null,{cardRankModifier:low.battle.mods.plus}).finalValue,2);
  assert.equal(BattleCore.showdownValue(low.card,'Rank'),6);

  const highBattle=battleState();
  const high=execute('pack02.loaded_die','on_play',{battle:highBattle,random:()=>0.999999});
  assert.equal(high.battle.mods.plus,6);
  assert.equal(high.card.cardEffectMemory.loaded_die_roll.value,12);
  assert.equal(BattleCore.resolveTrickValue(high.card,'C',{cardRankModifier:high.battle.mods.plus}).finalValue,15,'트럼프 +3은 무작위 숫자 뒤에 별도 적용');
  assert.equal(BattleCore.showdownValue(high.card,'Rank'),6);
});
