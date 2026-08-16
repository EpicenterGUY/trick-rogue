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
function advantage(results){const setHistory=Core.createSetHistory();results.forEach(result=>Core.recordTrickResult(setHistory,result));return Core.resolveShowdownAdvantage({setHistory});}
test('3승 2패는 플레이어 우세다',()=>assert.deepEqual(advantage(['player','player','player','enemy','enemy']),{result:'player',playerWins:3,enemyWins:2,draws:0,powerBonus:6}));
test('2승 3패는 적 우세다',()=>assert.deepEqual(advantage(['player','player','enemy','enemy','enemy']),{result:'enemy',playerWins:2,enemyWins:3,draws:0,powerBonus:6}));
test('2승 2패 1무는 중립이다',()=>assert.deepEqual(advantage(['player','player','enemy','enemy','draw']),{result:'neutral',playerWins:2,enemyWins:2,draws:1,powerBonus:0}));
test('4승 0패 1무는 플레이어 우세다',()=>assert.deepEqual(advantage(['player','player','player','player','draw']),{result:'player',playerWins:4,enemyWins:0,draws:1,powerBonus:6}));
test('우세 보너스는 쇼다운 최종 위력의 우세한 쪽에만 더한다',()=>{
  assert.deepEqual(Core.applyShowdownAdvantage(10,20,advantage(['player'])),{playerPower:16,enemyPower:20});
  assert.deepEqual(Core.applyShowdownAdvantage(10,20,advantage(['enemy'])),{playerPower:10,enemyPower:26});
  assert.deepEqual(Core.applyShowdownAdvantage(10,20,advantage(['draw'])),{playerPower:10,enemyPower:20});
});
test('트릭 승리 직후에는 우세 위력 보너스를 적용하지 않는다',()=>{const state=Core.createBattleState();Core.endTrick(state,'player');assert.equal(state.phase,'trick');assert.equal(state.setHistory.trickResults.length,1);assert.equal(state.effects.length,0)});
test('다음 세트는 승패 기록만 초기화하고 battle 범위 상태를 유지한다',()=>{const state=Core.createBattleState();Core.addEffect(state,{id:'battle-state',duration:'battle'});for(const result of ['player','enemy','draw','player','enemy'])Core.endTrick(state,result);Core.finishShowdown(state);assert.deepEqual(state.setHistory.trickResults,[]);assert(state.effects.some(effect=>effect.id==='battle-state'))});
test('효과는 trick/set/battle/run 범위에 맞게 만료한다',()=>{const state=Core.createBattleState();for(const duration of Core.EFFECT_DURATIONS)Core.addEffect(state,{id:duration,duration});Core.endTrick(state);assert.deepEqual(state.effects.map(x=>x.id),['set','battle','run']);for(let i=0;i<4;i++)Core.endTrick(state);Core.finishShowdown(state);assert.deepEqual(state.effects.map(x=>x.id),['battle','run']);assert(state.effects.some(x=>x.id==='battle'));Core.endBattle(state);assert.deepEqual(state.effects.map(x=>x.id),['run'])});
test('중독은 쇼다운 종료 상태를 위한 자리만 제공하고 자동 적용하지 않는다',()=>{const state=Core.createBattleState();assert.equal(state.statuses.player.poison,0);assert.equal(state.statuses.enemy.poison,0)});
