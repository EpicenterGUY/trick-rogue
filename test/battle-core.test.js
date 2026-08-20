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
function advantage(playerSuits,enemySuits){return Core.resolveShowdownAdvantage({playerCards:cards(playerSuits),enemyCards:cards(enemySuits)})}
test('3장 대 2장은 무늬 우세가 아니다',()=>assert.deepEqual(advantage(['S','S','S','H','D'],['S','S','H','D','C']).playerAdvantages,[]));
test('3장 대 1장은 해당 무늬 우세다',()=>assert.deepEqual(advantage(['S','S','S','H','D'],['S','H','H','D','C']).playerAdvantages,['S']));
test('복수 우세와 양측 무늬 수가 배열/맵으로 유지된다',()=>{const a=advantage(['S','S','S','D','D'],['S','H','H','C','C']);assert.deepEqual(a.playerAdvantages,['S','D']);assert.deepEqual(a.enemyAdvantages,['H','C']);assert.equal(a.playerSuitCounts.S,3);assert.equal(a.enemySuitCounts.C,2)});
test('우세 1종당 자기 위력만 +3하고 상대 위력을 깎지 않는다',()=>{const a=advantage(['S','S','S','D','D'],['S','H','H','C','C']);assert.deepEqual(Core.applyShowdownAdvantage(10,20,a),{playerPower:16,enemyPower:26})});
test('트릭은 한쪽 트럼프를 우선하고 같은 트럼프 상태에서는 적용 숫자만 비교한다',()=>{assert.equal(Core.compareTrick({effectiveSuit:'H',effectiveRank:2},{effectiveSuit:'S',effectiveRank:14},'H'),1);assert.equal(Core.compareTrick({effectiveSuit:'S',effectiveRank:9},{effectiveSuit:'D',effectiveRank:7},'H'),1);assert.equal(Core.compareTrick({effectiveSuit:'S',effectiveRank:9},{effectiveSuit:'D',effectiveRank:9},'H'),0)});
test('적용값은 인쇄값을 mutate하지 않고 쇼다운은 기본 인쇄값을 사용한다',()=>{const card={rank:4,suit:'C'},effective=Core.effectiveCard(card,{rank:9,suit:'H'});assert.deepEqual(card,{rank:4,suit:'C'});assert.equal(effective.printedRank,4);assert.equal(Core.showdownValue(effective,'Rank'),4);effective.showdownRank=6;assert.equal(Core.showdownValue(effective,'Rank'),6)});
test('트릭 승리 직후에는 우세 위력 보너스를 적용하지 않는다',()=>{const state=Core.createBattleState();Core.endTrick(state,'player');assert.equal(state.phase,'trick');assert.equal(state.setHistory.trickResults.length,1);assert.equal(state.effects.length,0)});
test('다음 세트는 승패 기록만 초기화하고 battle 범위 상태를 유지한다',()=>{const state=Core.createBattleState();Core.addEffect(state,{id:'battle-state',duration:'battle'});for(const result of ['player','enemy','draw','player','enemy'])Core.endTrick(state,result);Core.finishShowdown(state);assert.deepEqual(state.setHistory.trickResults,[]);assert(state.effects.some(effect=>effect.id==='battle-state'))});
test('효과는 trick/set/battle/run 범위에 맞게 만료한다',()=>{const state=Core.createBattleState();for(const duration of Core.EFFECT_DURATIONS)Core.addEffect(state,{id:duration,duration});Core.endTrick(state);assert.deepEqual(state.effects.map(x=>x.id),['set','battle','run']);for(let i=0;i<4;i++)Core.endTrick(state);Core.finishShowdown(state);assert.deepEqual(state.effects.map(x=>x.id),['battle','run']);assert(state.effects.some(x=>x.id==='battle'));Core.endBattle(state);assert.deepEqual(state.effects.map(x=>x.id),['run'])});
test('중독은 쇼다운 종료 상태를 위한 자리만 제공하고 자동 적용하지 않는다',()=>{const state=Core.createBattleState();assert.equal(state.statuses.player.poison,0);assert.equal(state.statuses.enemy.poison,0)});
