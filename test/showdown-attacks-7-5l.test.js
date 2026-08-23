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

test('7.5-L 양쪽 최종 위력은 서로 빼지 않고 각각 독립 쇼다운 공격값이 된다',()=>{
  const value=model(24,5);
  assert.equal(value.attacks.player.plannedAmount,24);
  assert.equal(value.attacks.enemy.plannedAmount,5);
  assert.deepEqual(value.attackSequence,null);
  assert.equal('damage' in value,false);
});

test('내 위력이 적보다 낮아도 플레이어 공격이 먼저 들어가고 적이 살아 있으면 적 전체 위력으로 반격한다',()=>{
  const result=runtime({playerPower:5,enemyPower:24,enemyHp:40,playerHp:50});
  assert.deepEqual(result.calls.filter(call=>call.side==='player'||call.side==='enemy').map(call=>[call.side,call.amount]),[['player',5],['enemy',24]]);
  assert.equal(result.state.enemy.hp,35);
  assert.equal(result.runState.hp,26);
  assert.equal(result.model.attackSequence.enemyAttackCancelled,false);
});

test('양쪽 위력이 같아도 무피해 동점이 아니라 양쪽이 각자 공격한다',()=>{
  const result=runtime({playerPower:10,enemyPower:10,enemyHp:30,playerHp:30});
  assert.deepEqual(result.calls.filter(call=>call.side==='player'||call.side==='enemy').map(call=>[call.side,call.amount]),[['player',10],['enemy',10]]);
  assert.equal(result.state.enemy.hp,20);
  assert.equal(result.runState.hp,20);
});

test('플레이어 쇼다운 선공으로 적을 처치하면 적 쇼다운 공격은 완전히 취소된다',()=>{
  const result=runtime({playerPower:24,enemyPower:42,enemyHp:20,playerHp:50});
  assert.deepEqual(result.calls.filter(call=>call.side==='player'||call.side==='enemy').map(call=>[call.side,call.amount]),[['player',24]]);
  assert.equal(result.state.enemy.hp,0);
  assert.equal(result.runState.hp,50);
  assert.equal(result.model.attacks.player.targetDefeated,true);
  assert.equal(result.model.attacks.enemy.cancelled,true);
  assert.equal(result.model.attacks.enemy.cancelReason,'enemy_defeated');
  assert.equal(result.model.attacks.enemy.dealt,0);
  assert.equal(result.model.attackSequence.enemyDefeated,true);
  assert.equal(result.model.attackSequence.enemyAttackCancelled,true);
});

test('쇼다운 양측 공격은 서로 다른 피해 출처 메타데이터로 실제 피해 함수를 통과한다',()=>{
  const result=runtime({playerPower:18,enemyPower:10,enemyHp:50,playerHp:50});
  const attacks=result.calls.filter(call=>call.side==='player'||call.side==='enemy');
  assert.equal(attacks[0].feedback,'showdown');
  assert.equal(attacks[0].metadata.source,'showdown_player_attack');
  assert.equal(attacks[0].metadata.attacker,'player');
  assert.equal(attacks[0].metadata.target,'enemy');
  assert.equal(attacks[1].feedback,'showdown');
  assert.equal(attacks[1].metadata.source,'showdown_enemy_attack');
  assert.equal(attacks[1].metadata.attacker,'enemy');
  assert.equal(attacks[1].metadata.target,'player');
});

test('7.5-L 실제 쇼다운 코드에는 최종 위력 차이를 단일 피해로 만드는 구버전 계산이 남지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','showdown-resolution.js'),'utf8');
  assert(!source.includes('Math.abs(model.player.finalPower-model.enemy.finalPower)'));
  assert(!source.includes("model.damage={target:"));
  assert(source.includes("order:['player_attack','enemy_survival_check','enemy_attack']"));
  assert(source.includes("cancelReason='enemy_defeated'"));
});
