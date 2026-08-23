const assert=require('node:assert/strict');
const test=require('node:test');
const Core=require('../battle-core.js');
const deck=()=>Array.from({length:10},(_,i)=>({id:`card-${i}`,named:i===0}));

test('전투 시작 손패는 정상 덱 순서에서 정확히 3장이고 네임드 우선 보정이 없다',()=>{
  const state=Core.createBattleState({deck:deck()});
  assert.equal(state.hand.length,3);
  assert.deepEqual(state.hand.map(x=>x.id),['card-9','card-8','card-7']);
  assert(!state.hand.some(x=>x.named));
});
test('카드 1장 사용 후 최대 손패 3장까지 보충한다',()=>{const state=Core.createBattleState({deck:deck()});Core.playCard(state,1);assert.equal(state.hand.length,3);assert.equal(state.maxHandSize,3)});
test('5번째 트릭 후 쇼다운이 발생하고 다음 세트를 시작한다',()=>{const state=Core.createBattleState();for(let i=0;i<4;i++)assert.equal(Core.endTrick(state),'trick');assert.equal(Core.endTrick(state),'showdown');assert.equal(state.phase,'showdown');Core.finishShowdown(state);assert.equal(state.setIndex,2);assert.equal(state.trickIndex,1);assert.equal(state.phase,'trick')});
const cards=suits=>suits.map((suit,index)=>({rank:index+2,suit}));
test('쇼다운 무늬 분포는 자동 우세를 만들지 않는다',()=>{
  const advantage=Core.resolveShowdownAdvantage({playerCards:cards(['S','S','S','S','D']),enemyCards:cards(['S','H','H','C','C'])});
  assert.deepEqual(advantage.playerAdvantages,[]);
  assert.deepEqual(advantage.enemyAdvantages,[]);
  assert.equal(advantage.playerAdvantageCount,0);
  assert.equal(advantage.enemyAdvantageCount,0);
  assert.equal(Core.showdownAdvantageBonus(['S']),0);
  assert.deepEqual(Core.applyShowdownAdvantage(40,40,advantage),{playerPower:40,enemyPower:40});
});
test('우세는 명시적으로 획득했을 때만 활성화되고 출처를 중복 없이 기록한다',()=>{
  const state=Core.createBattleState();
  assert.equal(Core.hasShowdownAdvantage(state,'player'),false);
  Core.grantShowdownAdvantage(state,'player','card:double-down');
  Core.grantShowdownAdvantage(state,'player','card:double-down');
  assert.equal(Core.hasShowdownAdvantage(state,'player'),true);
  assert.deepEqual(state.showdownAdvantage.playerSources,['card:double-down']);
  assert.equal(Core.hasShowdownAdvantage(state,'enemy'),false);
});
test('명시적 우세는 이번 쇼다운 최종 위력을 1.25배 한다',()=>{
  const advantage=Core.createShowdownAdvantageState();
  Core.grantShowdownAdvantage(advantage,'player','test');
  assert.deepEqual(Core.applyShowdownAdvantageMultiplier(40,32,advantage),{playerPower:50,enemyPower:32});
});
test('우세는 쇼다운 종료 후 제거된다',()=>{
  const state=Core.createBattleState();
  Core.grantShowdownAdvantage(state,'player','test');
  for(let i=0;i<5;i++)Core.endTrick(state,'player');
  assert.equal(state.phase,'showdown');
  Core.finishShowdown(state);
  assert.equal(Core.hasShowdownAdvantage(state,'player'),false);
  assert.deepEqual(state.showdownAdvantage.playerSources,[]);
});
test('트릭은 한쪽 트럼프를 우선하고 같은 트럼프 상태에서는 적용 숫자만 비교한다',()=>{assert.equal(Core.compareTrick({effectiveSuit:'H',effectiveRank:2},{effectiveSuit:'S',effectiveRank:14},'H'),1);assert.equal(Core.compareTrick({effectiveSuit:'S',effectiveRank:9},{effectiveSuit:'D',effectiveRank:7},'H'),1);assert.equal(Core.compareTrick({effectiveSuit:'S',effectiveRank:9},{effectiveSuit:'D',effectiveRank:9},'H'),0)});
test('트럼프로 취급과 트릭 무늬 변경은 서로 독립적이다',()=>{const treated=Core.effectiveCard({rank:3,suit:'H'},{treatedAsTrump:true});const changed=Core.effectiveCard({rank:3,suit:'H'},{suit:'S'});assert.equal(treated.trickSuit,'H');assert.equal(treated.treatedAsTrump,true);assert.equal(changed.trickSuit,'S');assert.equal(changed.treatedAsTrump,false);assert.equal(Core.compareTrick(treated,{rank:14,suit:'D'},'S'),1);assert.equal(Core.compareTrick(changed,{rank:14,suit:'D'},'S'),1)});
test('적용값은 인쇄값을 mutate하지 않고 쇼다운은 기본 인쇄값을 사용한다',()=>{const card={rank:4,suit:'C'},effective=Core.effectiveCard(card,{rank:9,suit:'H'});assert.deepEqual(card,{rank:4,suit:'C'});assert.equal(effective.printedRank,4);assert.equal(effective.printedSuit,'C');assert.equal(effective.rank,9);assert.equal(effective.suit,'H');assert.equal(effective.trickRank,9);assert.equal(effective.trickSuit,'H');assert.equal(Core.showdownValue(effective,'Rank'),4);assert.equal(Core.showdownValue(effective,'Suit'),'C');effective.showdownRank=6;assert.equal(Core.showdownValue(effective,'Rank'),6)});
test('무승부는 승패 수를 올리지 않고 연승/연패를 끊는다',()=>{const h=Core.createSetHistory();Core.recordTrickResult(h,'player');Core.recordTrickResult(h,'player');assert.equal(h.winStreak,2);Core.recordTrickResult(h,'draw');assert.equal(h.wins,2);assert.equal(h.losses,0);assert.equal(h.draws,1);assert.equal(h.winStreak,0);assert.equal(h.lossStreak,0);assert.equal(h.lastResult,'draw')});
test('트릭 승리 직후에는 우세 위력 보너스를 적용하지 않는다',()=>{const state=Core.createBattleState();Core.endTrick(state,'player');assert.equal(state.phase,'trick');assert.equal(state.setHistory.trickResults.length,1);assert.equal(state.effects.length,0);assert.equal(Core.hasShowdownAdvantage(state,'player'),false)});
test('다음 세트는 승패 기록만 초기화하고 battle 범위 상태를 유지한다',()=>{const state=Core.createBattleState();Core.addEffect(state,{id:'battle-state',duration:'battle'});for(const result of ['player','enemy','draw','player','enemy'])Core.endTrick(state,result);Core.finishShowdown(state);assert.deepEqual(state.setHistory.trickResults,[]);assert.equal(state.setHistory.wins,0);assert.equal(state.setHistory.draws,0);assert(state.effects.some(effect=>effect.id==='battle-state'))});
test('효과는 trick/set/battle/run 범위에 맞게 만료한다',()=>{const state=Core.createBattleState();for(const duration of Core.EFFECT_DURATIONS)Core.addEffect(state,{id:duration,duration});Core.endTrick(state);assert.deepEqual(state.effects.map(x=>x.id),['set','battle','run']);for(let i=0;i<4;i++)Core.endTrick(state);Core.finishShowdown(state);assert.deepEqual(state.effects.map(x=>x.id),['battle','run']);assert(state.effects.some(x=>x.id==='battle'));Core.endBattle(state);assert.deepEqual(state.effects.map(x=>x.id),['run'])});
test('중독은 쇼다운 종료 상태를 위한 자리만 제공하고 자동 적용하지 않는다',()=>{const state=Core.createBattleState();assert.equal(state.statuses.player.poison,0);assert.equal(state.statuses.enemy.poison,0)});
