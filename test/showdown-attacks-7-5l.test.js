const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Resolution=require('../showdown-resolution.js');

function hand(power,name='테스트 족보'){
  return{id:'test',name,power,ranks:[2,3,4,5,6],suits:['S','H','D','C','S']};
}

function model(playerPower,enemyPower){
  const value=Resolution.createBreakdown({playerHand:hand(playerPower,'내 족보'),enemyHand:hand(enemyPower,'적 족보'),setIndex:1});
  Resolution.finalizeBreakdown(value);
  return value;
}

function runtime({playerPower=24,enemyPower=5,enemyHp=100,playerHp=50}={}){
  const state={enemy:{hp:enemyHp,maxHp:enemyHp}};
  const runState={hp:playerHp,maxHp:playerHp};
  const calls=[];
  const root={
    damageEnemy(amount,feedback,metadata){calls.push({side:'player',amount,feedback,metadata});const dealt=Math.min(state.enemy.hp,amount);state.enemy.hp-=dealt;return dealt},
    damagePlayer(amount,feedback,metadata){calls.push({side:'enemy',amount,feedback,metadata});const dealt=Math.min(runState.hp,amount);runState.hp-=dealt;return dealt},
    flash(message){calls.push({side:'flash',message})}
  };
  const value=model(playerPower,enemyPower);
  Resolution.resolveShowdownAttacks(root,state,runState,value);
  return{state,runState,calls,model:value};
}

test('7.5-L 양쪽 최종 위력을 비교해 승자와 차이 피해를 확정한다',()=>{
  const value=model(24,5);
  assert.equal(value.comparison.winner,'player');
  assert.equal(value.comparison.draw,false);
  assert.equal(value.comparison.difference,19);
  assert.equal(value.comparison.plannedDamage,19);
  assert.equal(value.comparison.target,'enemy');
});

test('플레이어 위력이 높으면 차이만큼 적에게 한 번만 피해를 준다',()=>{
  const result=runtime({playerPower:24,enemyPower:5,enemyHp:40,playerHp:50});
  assert.deepEqual(result.calls.filter(call=>call.side==='player'||call.side==='enemy').map(call=>[call.side,call.amount]),[['player',19]]);
  assert.equal(result.state.enemy.hp,21);
  assert.equal(result.runState.hp,50);
  assert.equal(result.model.attacks.player.plannedAmount,19);
  assert.equal(result.model.attacks.enemy.plannedAmount,0);
  assert.equal(result.model.attackSequence.winner,'player');
  assert.equal(result.model.attackSequence.enemyAttackCancelled,true);
});

test('적 위력이 높으면 차이만큼 플레이어에게 한 번만 피해를 준다',()=>{
  const result=runtime({playerPower:5,enemyPower:24,enemyHp:40,playerHp:50});
  assert.deepEqual(result.calls.filter(call=>call.side==='player'||call.side==='enemy').map(call=>[call.side,call.amount]),[['enemy',19]]);
  assert.equal(result.state.enemy.hp,40);
  assert.equal(result.runState.hp,31);
  assert.equal(result.model.attacks.player.plannedAmount,0);
  assert.equal(result.model.attacks.enemy.plannedAmount,19);
  assert.equal(result.model.attackSequence.winner,'enemy');
  assert.equal(result.model.attackSequence.playerAttackCancelled,true);
});

test('양쪽 최종 위력이 같으면 무승부이며 양쪽 모두 피해를 주지 않는다',()=>{
  const result=runtime({playerPower:10,enemyPower:10,enemyHp:30,playerHp:30});
  assert.deepEqual(result.calls.filter(call=>call.side==='player'||call.side==='enemy'),[]);
  assert.equal(result.state.enemy.hp,30);
  assert.equal(result.runState.hp,30);
  assert.equal(result.model.attackSequence.winner,'draw');
  assert.equal(result.model.attackSequence.draw,true);
  assert.equal(result.model.attackSequence.difference,0);
  assert.equal(result.model.attacks.player.cancelReason,'draw');
  assert.equal(result.model.attacks.enemy.cancelReason,'draw');
});

test('차이 피해가 적 남은 HP를 넘으면 실제 피해 함수가 처치를 확정한다',()=>{
  const result=runtime({playerPower:42,enemyPower:5,enemyHp:20,playerHp:50});
  assert.deepEqual(result.calls.filter(call=>call.side==='player'||call.side==='enemy').map(call=>[call.side,call.amount]),[['player',37]]);
  assert.equal(result.state.enemy.hp,0);
  assert.equal(result.runState.hp,50);
  assert.equal(result.model.attacks.player.dealt,20);
  assert.equal(result.model.attacks.player.targetDefeated,true);
  assert.equal(result.model.attackSequence.enemyDefeated,true);
});

test('쇼다운 차이 피해는 기존 피해 파이프라인을 통과하되 power_difference 메타데이터를 남긴다',()=>{
  const playerWin=runtime({playerPower:18,enemyPower:10,enemyHp:50,playerHp:50});
  const playerCall=playerWin.calls.find(call=>call.side==='player');
  assert.equal(playerCall.feedback,'showdown');
  assert.equal(playerCall.metadata.source,'showdown_player_attack');
  assert.equal(playerCall.metadata.resolution,'power_difference');
  assert.equal(playerCall.metadata.difference,8);
  assert.equal(playerCall.metadata.playerPower,18);
  assert.equal(playerCall.metadata.enemyPower,10);

  const enemyWin=runtime({playerPower:10,enemyPower:18,enemyHp:50,playerHp:50});
  const enemyCall=enemyWin.calls.find(call=>call.side==='enemy');
  assert.equal(enemyCall.feedback,'showdown');
  assert.equal(enemyCall.metadata.source,'showdown_enemy_attack');
  assert.equal(enemyCall.metadata.resolution,'power_difference');
  assert.equal(enemyCall.metadata.difference,8);
});

test('7.5-L 실제 쇼다운 정산에는 플레이어 선공→생존 확인→적 반격 순서가 남지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','showdown-resolution.js'),'utf8');
  assert(source.includes('Math.abs(playerPower-enemyPower)'));
  assert(source.includes("order:['power_comparison','winner_determined','difference_damage']"));
  assert(!source.includes("order:['player_attack','enemy_survival_check','enemy_attack']"));
  assert(!source.includes("cancelReason='enemy_defeated'"));
});
