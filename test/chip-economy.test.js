const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Chips=require('../chip-economy.js');
const LoaderChain=require('../runtime-loader-chain.js');

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

test('7.5-I 전투 칩은 0에서 시작하고 최대치는 5다',()=>{
  const battle={chip:3,maxChip:3};
  Chips.initializeBattleChipState(battle);
  assert.equal(Chips.STAGE,'7.5-I');
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

test('7.5-I 손패 교환은 2칩을 내고 선택 카드를 드로우 덱 맨 아래로 보낸 뒤 위에서 1장 뽑는다',()=>{
  const battle=state(4);
  battle.hand=[{uid:'a'},{uid:'b'},{uid:'c'}];
  battle.deck=[{uid:'d'},{uid:'e'}];
  battle.selected='b';
  const result=Chips.exchangeHandCard(battle,'b');
  assert.equal(result.ok,true);
  assert.equal(result.returnedToDeckBottom.uid,'b');
  assert.equal(result.drawn.uid,'e');
  assert.deepEqual(battle.hand.map(card=>card.uid),['a','e','c']);
  assert.deepEqual(battle.deck.map(card=>card.uid),['b','d']);
  assert.deepEqual(battle.discard,[]);
  assert.equal(battle.chip,2);
  assert.equal(battle.history.chipsSpent,2);
  assert.equal(battle.history.cardsDrawn,1);
  assert.equal(battle.selected,null);
  assert.equal(battle.trick,1);
});

test('7.5-I 덱이 비면 기존 버림 더미를 먼저 재순환하고 교환 카드는 그 뒤 맨 아래에 둔다',()=>{
  const battle=state(2);
  battle.hand=[{uid:'a'},{uid:'b'}];
  battle.deck=[];
  battle.discard=[{uid:'old1'},{uid:'old2'}];
  const result=Chips.exchangeHandCard(battle,'a',{shuffle:cards=>cards});
  assert.equal(result.ok,true);
  assert.equal(result.drawn.uid,'old2');
  assert.deepEqual(battle.hand.map(card=>card.uid),['old2','b']);
  assert.deepEqual(battle.deck.map(card=>card.uid),['a','old1']);
  assert.deepEqual(battle.discard,[]);
});

test('7.5-I 같은 트릭에서는 손패 교환을 최대 한 번만 허용하고 다음 트릭에는 다시 허용한다',()=>{
  const battle=state(5);
  battle.hand=[{uid:'a'},{uid:'b'}];
  battle.deck=[{uid:'c'},{uid:'d'},{uid:'e'}];
  assert.equal(Chips.exchangeHandCard(battle,'a').ok,true);
  assert.equal(battle.chip,3);

  const handAfterFirst=battle.hand.map(card=>card.uid);
  const deckAfterFirst=battle.deck.map(card=>card.uid);
  const second=Chips.exchangeHandCard(battle,battle.hand[0].uid);
  assert.equal(second.ok,false);
  assert.equal(second.reason,'already_exchanged');
  assert.equal(battle.chip,3);
  assert.deepEqual(battle.hand.map(card=>card.uid),handAfterFirst);
  assert.deepEqual(battle.deck.map(card=>card.uid),deckAfterFirst);

  battle.trick=2;
  const third=Chips.exchangeHandCard(battle,battle.hand[0].uid);
  assert.equal(third.ok,true);
  assert.equal(battle.chip,1);
  assert.equal(battle.trick,2);
});

test('7.5-I 세트가 바뀌면 교환 제한 키만 자연스럽게 새로 열리고 칩 잔액은 유지된다',()=>{
  const battle=state(5);
  battle.hand=[{uid:'a'}];
  battle.deck=[{uid:'b'},{uid:'c'}];
  assert.equal(Chips.exchangeHandCard(battle,'a').ok,true);
  assert.equal(battle.chip,3);

  battle.setIndex=2;
  battle.trick=1;
  const current=battle.hand[0].uid;
  assert.equal(Chips.exchangeAvailability(battle,current).ok,true);
  assert.equal(battle.chip,3);
});

test('칩 부족이나 교환 카드 부재에서는 손패·덱·칩을 소비하지 않는다',()=>{
  const low=state(1);
  low.hand=[{uid:'a'}];low.deck=[{uid:'b'}];
  assert.equal(Chips.exchangeHandCard(low,'a').reason,'not_enough_chips');
  assert.equal(low.chip,1);
  assert.deepEqual(low.hand.map(card=>card.uid),['a']);
  assert.deepEqual(low.deck.map(card=>card.uid),['b']);

  const empty=state(2);
  empty.hand=[{uid:'a'}];
  assert.equal(Chips.exchangeHandCard(empty,'a').reason,'no_replacement');
  assert.equal(empty.chip,2);
  assert.deepEqual(empty.hand.map(card=>card.uid),['a']);
  assert.deepEqual(empty.deck,[]);
});

test('레거시 트릭/세트의 칩 전량 리셋 값은 저장된 전투 칩 잔액으로 다시 동기화된다',()=>{
  const battle=state(2);
  battle.chip=5;
  battle.maxChip=5;
  Chips.ensureChipState(battle);
  assert.equal(battle.chip,2);
  battle.chip=5;
  Chips.ensureChipState(battle);
  assert.equal(battle.chip,2);
});

test('7.5-I 전투 종료 시 칩 잔액과 트릭별 교환 상태를 0으로 초기화한다',()=>{
  const battle=state(5);
  battle.hand=[{uid:'a'}];battle.deck=[{uid:'b'}];
  Chips.exchangeHandCard(battle,'a');
  assert.equal(battle.chip,3);
  assert.equal(battle.chipEconomy.lastExchangeKey,'1:1');
  Chips.resetBattleChipState(battle);
  assert.equal(battle.chip,0);
  assert.equal(battle.chipEconomy.balance,0);
  assert.equal(battle.chipEconomy.lastExchangeKey,null);
  assert.equal(battle.chipEconomy.lastBaseWinKey,null);
  assert.equal(battle.chipEconomy.exchanges,0);
});

test('브라우저 어댑터는 시작 0칩, 승리 보상 선적용, 전투 종료 0칩을 보장한다',()=>{
  const seen=[];
  const root={
    battle:null,
    startBattle(){this.battle={phase:'trick',animating:false,setIndex:1,trick:1,chip:3,maxChip:3,hand:[],deck:[],discard:[],history:{chipsSpent:0,cardsDrawn:0}};return this.battle},
    renderBattle(){},
    runCardEffects(trigger){seen.push([trigger,this.battle.chip]);return 1},
    winBattle(){seen.push(['winBattle',this.battle.chip]);this.battle.ended=true},
    loseRun(){seen.push(['loseRun',this.battle.chip]);this.battle.ended=true}
  };
  Chips.wrapStartBattle(root);
  Chips.wrapRunCardEffects(root);
  Chips.wrapBattleEnd(root,'winBattle');
  Chips.wrapBattleEnd(root,'loseRun');
  root.startBattle();
  assert.equal(root.battle.chip,0);
  assert.equal(root.battle.maxChip,5);
  root.runCardEffects('on_trick_win',{}, {result:1});
  assert.equal(root.battle.chip,1);
  assert.deepEqual(seen.at(-1),['on_trick_win',1]);
  root.runCardEffects('on_trick_win',{}, {result:1});
  assert.equal(root.battle.chip,1);
  root.winBattle();
  assert.deepEqual(seen.at(-1),['winBattle',0]);
  assert.equal(root.battle.chip,0);
});

test('7.5-I 교환 UI 설명은 버림이 아니라 덱 맨 아래 이동과 트릭당 1회를 안내한다',()=>{
  assert.match(Chips.reasonText('already_exchanged'),/이번 트릭/);
  const source=fs.readFileSync(path.join(__dirname,'..','chip-economy.js'),'utf8');
  assert.match(source,/드로우 덱 맨 아래로 보내고 카드 1장을 뽑는다\. 트릭당 1회/);
  assert.doesNotMatch(source,/선택한 손패 1장을 버리고 카드 1장을 뽑는다/);
});

test('적 행동 부트스트랩은 우세 뒤, 전투 레이아웃 전에 칩 경제를 로드한다',()=>{
  const names=LoaderChain.ENTRIES.map(entry=>entry.globalName);
  const start=names.indexOf('ShowdownAdvantage');
  assert.deepEqual(names.slice(start,start+4),['ShowdownAdvantage','ChipEconomy','ShowdownResolution','ShowdownHighRoll']);
  assert.deepEqual(LoaderChain.entry('ChipEconomy'),{globalName:'ChipEconomy',src:'chip-economy.js',dataset:'trick-chip-economy-runtime',after:null});
  assert(LoaderChain.indexOf('ChipEconomy')<LoaderChain.indexOf('BattleLayout'));
});
