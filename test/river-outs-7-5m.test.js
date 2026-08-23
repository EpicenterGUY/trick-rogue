const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BattleCore=require('../battle-core.js');
const Resolution=require('../showdown-resolution.js');

const cards=(ranks,suits=['S','H','D','C'])=>ranks.map((rank,index)=>({rank,suit:suits[index%suits.length]}));

test('7.5-M은 4번째 트릭 종료 시점의 4장으로 리버 후보를 미리 고정한다',()=>{
  const snapshot=Resolution.createRiverSnapshot(cards([6,7,8,9]),{setIndex:3});
  assert.equal(snapshot.stage,'7.5-M');
  assert.equal(snapshot.setIndex,3);
  assert.equal(snapshot.capturedAfterTrick,4);
  assert.equal(snapshot.slotCount,4);
  assert.equal(snapshot.frozen,true);
  assert(snapshot.candidateCount>0);
  assert.equal(snapshot.lines[0],'스트레이트 가능: 5 / 10');
  const straight=snapshot.groups.find(group=>group.id==='straight');
  assert.deepEqual(straight.ranks,[5,10]);
  assert.equal(straight.count,8);
});

test('하트 4장은 4번째 트릭 종료 시 남은 하트가 플러시 후보로 표시된다',()=>{
  const snapshot=Resolution.createRiverSnapshot(cards([2,5,8,11],['H','H','H','H']),{setIndex:1});
  const flush=snapshot.groups.find(group=>group.id==='flush');
  assert(flush);
  assert.equal(flush.count,9);
  assert(snapshot.lines.includes('♥가 들어오면 플러시'));
});

test('리버 적중은 스냅샷 후보의 정확한 5번째 카드만 인정한다',()=>{
  const snapshot=Resolution.createRiverSnapshot(cards([6,7,8,9]),{setIndex:2});
  const hit=Resolution.resolveRiverHit(snapshot,{rank:10,suit:'C'},{setIndex:2});
  const miss=Resolution.resolveRiverHit(snapshot,{rank:3,suit:'C'},{setIndex:2});
  assert.equal(hit.active,true);
  assert.equal(hit.reason,'candidate_hit');
  assert.equal(hit.target.id,'straight');
  assert.deepEqual(hit.fifth,{rank:10,suit:'C',key:'C:10'});
  assert.equal(miss.active,false);
  assert.equal(miss.reason,'candidate_miss');
});

test('다른 세트의 낡은 리버 스냅샷은 적중에 사용할 수 없다',()=>{
  const snapshot=Resolution.createRiverSnapshot(cards([6,7,8,9]),{setIndex:1});
  const hit=Resolution.resolveRiverHit(snapshot,{rank:5,suit:'S'},{setIndex:2});
  assert.equal(hit.active,false);
  assert.equal(hit.reason,'stale_snapshot');
});

test('쇼다운에서 1~4번 카드가 바뀌어 새 족보가 생겨도 4장 스냅샷을 재계산하지 않는다',()=>{
  const snapshot=Resolution.createRiverSnapshot(cards([2,2,5,8]),{setIndex:1});
  assert.equal(Resolution.resolveRiverHit(snapshot,{rank:6,suit:'S'},{setIndex:1}).active,false);
  assert.equal(Resolution.evaluatePoker(cards([2,3,4,5,6])).id,'straight');
});

test('리버 적중 +25%는 이미 확정한 적중 결과를 배율 단계에 전달한다',()=>{
  const snapshot=Resolution.createRiverSnapshot(cards([2,3,4,5]),{setIndex:1});
  const hit=Resolution.resolveRiverHit(snapshot,{rank:6,suit:'S'},{setIndex:1});
  const player=Resolution.evaluatePoker(cards([2,3,4,5,6]));
  const enemy=Resolution.evaluatePoker(cards([2,5,8,11,13]));
  const model=Resolution.createBreakdown({playerHand:player,enemyHand:enemy,setIndex:1});
  Resolution.applyRiverHitBonus(model,hit);
  Resolution.finalizeBreakdown(model);
  assert.equal(model.riverHit.active,true);
  assert.deepEqual(model.player.multipliers.map(entry=>entry.id),['river_hit']);
  assert.equal(model.player.multipliers[0].factor,1.25);
  assert.equal(model.player.finalPower,30);
});

test('브라우저 nextEnemy 어댑터는 5번째 트릭 시작 직전에 4장 스냅샷을 잡는다',()=>{
  const state={setIndex:2,trick:5,phase:'trick',slots:cards([6,7,8,9]).map(card=>({card})),riverSnapshot:null};
  const root={battle:state,BattleCore:{showdownValue(card,key){return card[key.toLowerCase()]}},nextEnemy(){this.called=(this.called||0)+1}};
  Resolution.wrapNextEnemy(root);
  root.nextEnemy();
  assert.equal(root.called,1);
  assert.equal(state.riverSnapshot.setIndex,2);
  assert.equal(state.riverSnapshot.capturedAfterTrick,4);
  assert.equal(state.riverSnapshot.lines[0],'스트레이트 가능: 5 / 10');
});

test('실제 쇼다운은 리버 적중을 쇼다운 전 효과보다 먼저 잠근다',async()=>{
  const firstFour=cards([2,3,4,5]);
  const fifth={rank:6,suit:'S',uid:'p4'};
  const playerSlots=[...firstFour.map((card,index)=>({card:{...card,uid:`p${index}`}})),{card:fifth}];
  const enemySlots=cards([2,5,8,11,13]).map((card,index)=>({card:{...card,uid:`e${index}`}}));
  const snapshot=Resolution.createRiverSnapshot(playerSlots.slice(0,4),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key),setIndex:1});
  const state={
    type:'battle',enemy:{hp:100,maxHp:100},slots:playerSlots,enemySlots,riverSnapshot:snapshot,
    discard:[],hand:[],effects:[],setIndex:1,trick:5,phase:'trick',setHistory:{trickResults:[]},slotBonus:0,maxHandSize:3,mods:{},
  };
  const root={
    battle:state,run:{hp:50,maxHp:50},
    BattleCore:{...BattleCore,resolveShowdownAdvantage(){return{playerActive:false,enemyActive:false,playerAdvantageCount:0,enemyAdvantageCount:0,multiplier:1.25}}},
    CardEffects:{newHistory(){return{}}},sfx(){},renderBattle(){},showShowdownStep(){},wait:async()=>{},flash(){},
    runCardEffects(trigger,card){if(trigger==='before_showdown'&&card===fifth)card.showdownRank=9;return 0},
    damageEnemy(amount){state.enemy.hp-=amount;return amount},damagePlayer(amount){this.run.hp-=amount;return amount},
    drawSetTrump(){return'H'},drawP(){},nextEnemy(){},loseRun(){},async winBattle(){}
  };
  const result=await Resolution.resolveRuntimeShowdown(root);
  assert.equal(result.riverHit.active,true);
  assert.equal(result.riverHit.fifth.rank,6);
  assert.equal(result.player.hand.id,'high_card');
  assert(result.player.multipliers.some(entry=>entry.id==='river_hit'));
});

test('구버전의 사후 detectRiverCompletion 방식은 공개 API와 실제 런타임에서 제거된다',()=>{
  assert.equal(Resolution.detectRiverCompletion,undefined);
  assert.equal(Resolution.addRiverCompletionMultiplier,undefined);
  const source=fs.readFileSync(path.join(__dirname,'..','showdown-resolution.js'),'utf8');
  assert(!source.includes('function detectRiverCompletion'));
  assert(!source.includes('addRiverCompletionMultiplier'));
  assert(source.includes('resolveRiverHit(state.riverSnapshot,state.slots[4]'));
});