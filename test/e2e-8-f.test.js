const test=require('node:test');
const assert=require('node:assert/strict');
const Persistence=require('../run-persistence.js');
const RunMapGeneration=require('../run-map-generation.js');
const Showdown=require('../showdown-resolution.js');

function showdownEntry(suit,rank){return{card:{uid:`${suit}${rank}`,suit,rank,printedSuit:suit,printedRank:rank}}}
function runCheckpoint(seed=123456){
  return{runSeed:seed>>>0,actId:'act1',actIndex:1,hp:60,maxHp:60,gold:60,deck:[{uid:'c1',suit:'S',rank:2,printedSuit:'S',printedRank:2}],map:RunMapGeneration.generateActMap('act1',{runSeed:seed}).map,available:new Set(['n0']),completed:new Set(),currentNodeId:null,runComplete:false};
}

test('E2E 8-F 같은 런 시드는 저장 전후에도 같은 맵 변형을 재현한다',()=>{
  const original=runCheckpoint(0xdecafbad),text=Persistence.stringifySave(original,{now:0,reason:'e2e'}),restored=Persistence.parseSave(text).runState;
  const a=RunMapGeneration.generateActMap('act1',{runSeed:original.runSeed}),b=RunMapGeneration.generateActMap('act1',{runSeed:restored.runSeed});
  assert.equal(a.variantId,b.variantId);assert.deepEqual(a.map.map(n=>[n.id,n.type,n.next]),b.map.map(n=>[n.id,n.type,n.next]));assert.equal(Persistence.runFingerprint(original),Persistence.runFingerprint(restored));
});

test('E2E 8-F 최신 쇼다운은 플레이어 선공 처치→적 반격 취소까지 실행하고 전투 종료 뒤 런 체크포인트를 저장할 수 있다',()=>{
  const playerEntries=[showdownEntry('S',6),showdownEntry('H',7),showdownEntry('D',8),showdownEntry('C',9),showdownEntry('S',10)];
  const enemyEntries=[showdownEntry('S',2),showdownEntry('H',4),showdownEntry('D',6),showdownEntry('C',8),showdownEntry('S',11)];
  const model=Showdown.createBreakdown({playerHand:Showdown.evaluatePoker(playerEntries),enemyHand:Showdown.evaluatePoker(enemyEntries),setIndex:1});Showdown.finalizeBreakdown(model);
  const battle={ended:false,enemy:{hp:20,maxHp:20}},run=runCheckpoint(555),root={
    damageEnemy(amount){const before=battle.enemy.hp;battle.enemy.hp=Math.max(0,before-amount);return before-battle.enemy.hp},
    damagePlayer(amount){const before=run.hp;run.hp=Math.max(0,before-amount);return before-run.hp},flash(){},document:null
  };
  const sequence=Showdown.resolveShowdownAttacks(root,battle,run,model);
  assert.equal(model.player.finalPower,24);assert.equal(sequence.enemyDefeated,true);assert.equal(sequence.enemyAttackCancelled,true);assert.equal(run.hp,60);
  assert.equal(Persistence.saveAvailability(run,battle).reason,'battle_active');battle.ended=true;assert.equal(Persistence.saveAvailability(run,battle).allowed,true);
  const restored=Persistence.parseSave(Persistence.stringifySave(run,{now:0,reason:'post_battle'})).runState;assert.equal(restored.hp,60);assert.equal(restored.runSeed,555);assert.ok(restored.available instanceof Set);
});

test('E2E 8-F 손상된 체크포인트는 정상 런을 덮어쓰기 전에 차단된다',()=>{
  const good=Persistence.stringifySave(runCheckpoint(77),{now:0}),raw=JSON.parse(good);raw.payload.run.hp=1;
  assert.throws(()=>Persistence.parseSave(JSON.stringify(raw)),/checksum_mismatch/);
});
