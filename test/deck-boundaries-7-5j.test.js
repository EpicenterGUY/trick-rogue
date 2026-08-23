const assert=require('node:assert/strict');
const test=require('node:test');
const Core=require('../battle-core.js');
const Boundaries=require('../deck-boundaries.js');

function makeDeck(count=12){return Array.from({length:count},(_,i)=>({id:`c${i}`,rank:2+(i%13),suit:['S','H','D','C'][i%4]}))}
function taggedDeck(){
  return[
    ...Array.from({length:5},(_,i)=>({id:`named-${i}`,named:{id:`n${i}`}})),
    ...Array.from({length:10},(_,i)=>({id:`effect-${i}`,definition:{id:`e${i}`},effects:[{action:'noop'}]})),
    ...Array.from({length:20},(_,i)=>({id:`plain-${i}`}))
  ];
}

test('7.5-J 기본 시작 덱 목표는 12장이고 캐릭터 압축도 10~14장 범위에 남는다',()=>{
  assert.equal(Boundaries.DEFAULT_STARTING_DECK_SIZE,12);
  assert.equal(Boundaries.startingDeckSizeForCharacter({remove:0}),12);
  assert.equal(Boundaries.startingDeckSizeForCharacter({remove:1}),11);
  assert.equal(Boundaries.startingDeckSizeForCharacter({remove:2}),10);
  assert.equal(Boundaries.startingDeckSizeForCharacter({remove:99}),10);
});

test('7.5-J 시작 덱 축소는 캐릭터 네임드를 우선 보존하고 최소 2장 순수 카드를 남긴다',()=>{
  const result=Boundaries.selectStartingDeck(taggedDeck(),{targetSize:10,minPlain:2});
  assert.equal(result.length,10);
  assert.equal(result.filter(Boundaries.isNamedCard).length,5);
  assert.equal(result.filter(Boundaries.isEffectCard).length,3);
  assert.equal(result.filter(Boundaries.isPlainCard).length,2);
});

test('7.5-J BattleCore 어댑터는 전투 시작 3장 손패와 별도 쇼다운 적재 공간을 만든다',()=>{
  Boundaries.installBattleCoreAdapter(Core);
  const state=Core.createBattleState({deck:makeDeck(12),shuffleFn:cards=>cards});
  assert.equal(state.hand.length,3);
  assert.equal(state.deck.length,9);
  assert.deepEqual(state.showdownCards,[]);
});

test('7.5-J 모든 트릭은 사용 직후 1장 보충하고 5번째 카드도 쇼다운 전에 손패 3장을 유지한다',()=>{
  Boundaries.installBattleCoreAdapter(Core);
  const state=Core.createBattleState({deck:makeDeck(12),shuffleFn:cards=>cards});
  for(let trick=1;trick<=5;trick++){
    Core.playCard(state,0);
    assert.equal(state.hand.length,3,`${trick}번째 트릭 보충 실패`);
    assert.equal(state.showdownCards.length,trick);
    assert.equal(state.discard.length,0);
    Core.endTrick(state,'player');
  }
  assert.equal(state.phase,'showdown');
  assert.equal(state.showdownCards.length,5);
  assert.equal(state.deck.length,4);
});

test('7.5-J 쇼다운 종료 시 사용한 5장만 버림 더미로 이동하고 손패·드로우 덱은 그대로 다음 세트로 넘어간다',()=>{
  Boundaries.installBattleCoreAdapter(Core);
  const state=Core.createBattleState({deck:makeDeck(12),shuffleFn:cards=>cards});
  for(let trick=1;trick<=5;trick++){Core.playCard(state,0);Core.endTrick(state,'player')}
  const handBefore=state.hand.map(card=>card.id),deckBefore=state.deck.map(card=>card.id);
  Core.finishShowdown(state);
  assert.equal(state.setIndex,2);
  assert.equal(state.trickIndex,1);
  assert.equal(state.phase,'trick');
  assert.deepEqual(state.hand.map(card=>card.id),handBefore);
  assert.deepEqual(state.deck.map(card=>card.id),deckBefore);
  assert.equal(state.discard.length,5);
  assert.deepEqual(state.showdownCards,[]);
});

test('7.5-J 버림 더미는 드로우 덱이 완전히 빈 순간에만 재순환한다',()=>{
  const state={deck:[{id:'top'}],discard:[{id:'old-a'},{id:'old-b'}],hand:[],showdownCards:[],maxHandSize:1,phase:'trick',shuffleFn:cards=>cards};
  Boundaries.drawToMaxHand(state);
  assert.deepEqual(state.hand.map(card=>card.id),['top']);
  assert.deepEqual(state.discard.map(card=>card.id),['old-a','old-b']);
  assert.equal(state.deck.length,0);
  state.maxHandSize=3;
  Boundaries.drawToMaxHand(state);
  assert.equal(state.discard.length,0);
  assert.deepEqual(state.hand.map(card=>card.id),['top','old-b','old-a']);
});

test('7.5-J 현재 세트의 쇼다운 카드는 덱이 비어도 쇼다운 전 재순환 대상이 아니다',()=>{
  const state={deck:[],discard:[],hand:[{id:'held'}],showdownCards:[{id:'slot-1'},{id:'slot-2'},{id:'slot-3'},{id:'slot-4'},{id:'slot-5'}],maxHandSize:3,phase:'showdown',shuffleFn:cards=>cards};
  Boundaries.drawToMaxHand(state);
  assert.deepEqual(state.hand.map(card=>card.id),['held']);
  assert.equal(state.showdownCards.length,5);
  assert.equal(state.discard.length,0);
});

test('7.5-J 브라우저 beginRun 어댑터는 거대한 52장 규격 풀과 실제 시작 런 덱을 분리한다',()=>{
  Boundaries.resetBrowserAdapterForTests();
  const root={
    BattleCore:Core,
    run:null,
    battle:null,
    renderMapCalls:0,
    renderMap(){this.renderMapCalls++},
    beginRun(){this.run={char:{remove:2},deck:taggedDeck()}},
    async showdown(){return'legacy-showdown'}
  };
  assert.equal(Boundaries.installBrowserAdapter(root),true);
  root.beginRun();
  assert.equal(root.run.deck.length,10);
  assert.equal(root.run.startingDeckSize,10);
  assert.equal(root.run.startingDeckRule,'7.5-J');
  assert.equal(root.run.deck.filter(Boundaries.isPlainCard).length,2);
  assert.equal(root.renderMapCalls,1);
});

test('7.5-J 브라우저 쇼다운 어댑터는 5번째 트릭 직후 기존 쇼다운 처리보다 먼저 손패를 보충한다',async()=>{
  Boundaries.resetBrowserAdapterForTests();
  const seen=[];
  const root={
    BattleCore:Core,
    run:{char:{remove:0},deck:taggedDeck()},
    battle:{slots:Array.from({length:5},()=>({})),hand:[{id:'h1'},{id:'h2'}],deck:[{id:'drawn'}],discard:[],maxHandSize:3},
    beginRun(){},
    drawP(){while(this.battle.hand.length<this.battle.maxHandSize&&this.battle.deck.length)this.battle.hand.push(this.battle.deck.pop())},
    async showdown(){seen.push(this.battle.hand.map(card=>card.id));return'legacy-showdown'}
  };
  Boundaries.installBrowserAdapter(root);
  const result=await root.showdown();
  assert.equal(result,'legacy-showdown');
  assert.deepEqual(seen,[['h1','h2','drawn']]);
  assert.equal(root.battle.hand.length,3);
});
