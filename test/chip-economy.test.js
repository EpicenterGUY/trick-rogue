const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Chips=require('../chip-economy.js');

function state(balance=0){
  const battle={
    phase:'trick',animating:false,setIndex:1,trick:1,
    chip:balance,maxChip:3,
    hand:[],deck:[],discard:[],
    history:{chipsSpent:0,cardsDrawn:0},selected:null,inspectSlot:null,inspectStage:null
  };
  Chips.initializeBattleChipState(battle,{balance});
  return battle;
}

test('7.5-B 전투 칩은 0에서 시작하고 최대치는 5다',()=>{
  const battle={chip:3,maxChip:3};
  Chips.initializeBattleChipState(battle);
  assert.equal(Chips.CHIP_CAP,5);
  assert.equal(Chips.TRICK_WIN_REWARD,1);
  assert.equal(Chips.HAND_EXCHANGE_COST,2);
  assert.equal(battle.chip,0);
  assert.equal(battle.maxChip,5);
});

test('칩 획득은 어떤 효과에서도 최대 5를 넘지 않는다',()=>{
  const battle=state(4);
  const first=Chips.grantChips(battle,3,{source:'card'});
  assert.equal(first.gained,1);
  assert.equal(battle.chip,5);
  const second=Chips.grantChips(battle,2,{source:'relic'});
  assert.equal(second.gained,0);
  assert.equal(battle.chip,5);
});

test('트릭 승리 기본 보상은 같은 트릭에 정확히 한 번만 칩 +1을 준다',()=>{
  const battle=state(0);
  assert.equal(Chips.rewardTrickWin(battle).gained,1);
  assert.equal(Chips.rewardTrickWin(battle).gained,0);
  assert.equal(battle.chip,1);
  battle.trick=2;
  assert.equal(Chips.rewardTrickWin(battle).gained,1);
  assert.equal(battle.chip,2);
});

test('손패 교환은 선택 카드 1장을 버리고 2칩을 지불해 카드 1장을 같은 자리에 뽑는다',()=>{
  const battle=state(4);
  battle.hand=[{uid:'a'},{uid:'b'},{uid:'c'}];
  battle.deck=[{uid:'d'},{uid:'e'}];
  battle.selected='b';
  const result=Chips.exchangeHandCard(battle,'b');
  assert.equal(result.ok,true);
  assert.deepEqual(battle.hand.map(card=>card.uid),['a','e','c']);
  assert.deepEqual(battle.discard.map(card=>card.uid),['b']);
  assert.equal(battle.chip,2);
  assert.equal(battle.history.chipsSpent,2);
  assert.equal(battle.history.cardsDrawn,1);
  assert.equal(battle.selected,null);
});

test('덱이 비면 기존 버림 더미를 재활용한 뒤 교환한 카드는 나중에 버려 즉시 자기 자신을 다시 뽑지 않는다',()=>{
  const battle=state(2);
  battle.hand=[{uid:'a'},{uid:'b'}];
  battle.deck=[];
  battle.discard=[{uid:'old'}];
  const result=Chips.exchangeHandCard(battle,'a',{shuffle:cards=>cards});
  assert.equal(result.ok,true);
  assert.equal(result.drawn.uid,'old');
  assert.deepEqual(battle.hand.map(card=>card.uid),['old','b']);
  assert.deepEqual(battle.discard.map(card=>card.uid),['a']);
});

test('칩 부족이나 교환 카드 부재에서는 손패와 칩을 소비하지 않는다',()=>{
  const low=state(1);
  low.hand=[{uid:'a'}];low.deck=[{uid:'b'}];
  assert.equal(Chips.exchangeHandCard(low,'a').reason,'not_enough_chips');
  assert.equal(low.chip,1);
  assert.deepEqual(low.hand.map(card=>card.uid),['a']);

  const empty=state(2);
  empty.hand=[{uid:'a'}];
  assert.equal(Chips.exchangeHandCard(empty,'a').reason,'no_replacement');
  assert.equal(empty.chip,2);
  assert.deepEqual(empty.hand.map(card=>card.uid),['a']);
});

test('레거시 트릭/세트의 칩 전량 리셋 값은 7.5-B 저장 잔액으로 다시 동기화된다',()=>{
  const battle=state(2);
  battle.chip=5;
  battle.maxChip=5;
  Chips.ensureChipState(battle);
  assert.equal(battle.chip,2);
  battle.chip=5;
  Chips.ensureChipState(battle);
  assert.equal(battle.chip,2);
});

test('브라우저 어댑터는 레거시 시작 3칩을 0칩으로 바꾸고 승리 보상을 카드 효과 전에 적용한다',()=>{
  const seen=[];
  const root={
    battle:null,
    startBattle(){this.battle={phase:'trick',animating:false,setIndex:1,trick:1,chip:3,maxChip:3,hand:[],deck:[],discard:[],history:{chipsSpent:0,cardsDrawn:0}};return this.battle},
    renderBattle(){},
    runCardEffects(trigger){seen.push([trigger,this.battle.chip]);return 1}
  };
  Chips.wrapStartBattle(root);
  Chips.wrapRunCardEffects(root);
  root.startBattle();
  assert.equal(root.battle.chip,0);
  assert.equal(root.battle.maxChip,5);
  root.runCardEffects('on_trick_win',{}, {result:1});
  assert.equal(root.battle.chip,1);
  assert.deepEqual(seen.at(-1),['on_trick_win',1]);
  root.runCardEffects('on_trick_win',{}, {result:1});
  assert.equal(root.battle.chip,1);
});

test('적 행동 부트스트랩은 7.5-A 우세 뒤, 전투 레이아웃 전에 7.5-B 칩 경제를 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert(source.includes("loadScript('chip-economy.js','trick-chip-economy-runtime')"));
  assert(source.includes("if(root.ChipEconomy){loadBattleLayoutFile();return;}"));
  assert(source.includes("if(script?.dataset?.loaded==='true')loadBattleLayoutFile();else script?.addEventListener?.('load',loadBattleLayoutFile,{once:true});"));
  assert(source.includes("if(root.ShowdownAdvantage){loadBattleLayoutRuntime();return;}"));
  assert(source.includes("loadScript('battle-layout.js','trick-battle-layout-runtime')"));
});
