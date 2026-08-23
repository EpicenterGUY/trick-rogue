const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Fold=require('../fold-experiment.js');

function card(uid,suit='S',rank=2){return{uid,suit,rank,printedSuit:suit,printedRank:rank}}
function entry(uid,result=0,suit='S',rank=2){return{card:card(uid,suit,rank),result}}
function battle(slotCount=3,overrides={}){
  const slots=[entry('a',1,'S',2),entry('b',-1,'H',3),entry('c',0,'D',4),entry('d',1,'C',5)].slice(0,slotCount);
  const enemySlots=[entry('ea',-1),entry('eb',1),entry('ec',0),entry('ed',-1)].slice(0,slotCount);
  return{
    setIndex:1,trick:slotCount+1,phase:'trick',slots,enemySlots,
    hand:[card('h1','C',8),card('h2','S',9),card('h3','H',10)],deck:[card('deck1')],discard:[],
    enemy:{hp:40,maxHp:40},effects:[{duration:'set',id:'set-effect'},{duration:'battle',id:'battle-effect'}],
    riverSnapshot:slotCount===4?{setIndex:1,id:'river'}:null,riverHit:{active:true},advantage:{playerActive:true},
    contractTabooLastResolution:{setIndex:1},contractTabooResolvedSet:1,mods:{paint:true,plus:3,reverse:true,double:true},
    setHistory:{trickResults:['player','enemy','draw']},history:{cardsDrawn:2},animating:false,ended:false,...overrides
  };
}
function makeRoot(b,runOverrides={}){
  const calls={effects:[],draw:0,nextEnemy:0,render:0,showdown:0,lose:0,win:0,consume:0,locks:0};
  const run={hp:30,maxHp:50,...runOverrides};
  const root={
    battle:b,run,
    BattleCore:{createSetHistory(){return{trickResults:[],wins:0,losses:0,draws:0}}},
    CardEffects:{newHistory(){return{fresh:true}}},
    ShowdownAdvantage:{consumeAdvantage(){calls.consume++}},
    ShowdownSlotManipulation:{clearSetLocks(){calls.locks++}},
    runCardEffects(trigger,c,extra){calls.effects.push({trigger,uid:c?.uid,extra})},
    drawSetTrump(){return'H'},
    drawP(){calls.draw++},
    nextEnemy(){calls.nextEnemy++},
    renderBattle(){calls.render++},
    showdown(){calls.showdown++},
    loseRun(){calls.lose++},
    async winBattle(){calls.win++},
    sfx(){},flash(){},console:{error(){}}
  };
  return{root,run,calls};
}

test('8-E 폴드는 정확히 3장을 낸 뒤 4번째 트릭부터, 5번째 카드를 내기 전까지만 가능하다',()=>{
  assert.equal(Fold.canFold(battle(2)),false);
  assert.equal(Fold.foldAvailability(battle(2)).reason,'too_early');
  assert.equal(Fold.canFold(battle(3)),true);
  assert.equal(Fold.canFold(battle(4)),true);
  assert.equal(Fold.canFold(battle(5,{trick:5})),false);
  assert.equal(Fold.foldAvailability(battle(5,{trick:5})).reason,'showdown_locked');
});

test('쇼다운/종료/애니메이션 중에는 폴드할 수 없다',()=>{
  assert.equal(Fold.foldAvailability(battle(3,{phase:'showdown'})).reason,'not_trick_phase');
  assert.equal(Fold.foldAvailability(battle(3,{ended:true})).reason,'battle_ended');
  assert.equal(Fold.foldAvailability(battle(3,{animating:true})).reason,'battle_busy');
});

test('기본 폴드 페널티는 보호막과 무관한 고정 체력 손실 8이다',()=>{
  const run={hp:30,statuses:{player:{shield:99}}};
  const loss=Fold.applyFixedHpLoss(run);
  assert.deepEqual(loss,{requested:8,lost:8,hpBefore:30,hpAfter:22,defeated:false});
  assert.equal(run.hp,22);assert.equal(run.statuses.player.shield,99);
});

test('폴드는 양측 쇼다운 공격을 실행하지 않고 현재 슬롯 카드만 버림 더미로 보낸다',async()=>{
  const b=battle(3),{root,run,calls}=makeRoot(b),handBefore=[...b.hand],deckBefore=[...b.deck];
  const result=await Fold.resolveFold(root);
  assert.equal(result.ok,true);assert.equal(result.record.showdownSkipped,true);
  assert.equal(result.record.playerShowdownAttackSkipped,true);assert.equal(result.record.enemyShowdownAttackSkipped,true);
  assert.equal(calls.showdown,0);assert.deepEqual(b.discard.slice(-3).map(c=>c.uid),['a','b','c']);
  assert.equal(b.slots.length,0);assert.equal(b.enemySlots.length,0);
  assert.deepEqual(b.hand,handBefore);assert.deepEqual(b.deck,deckBefore);assert.equal(run.hp,22);
});

test('폴드 세트 종료는 쇼다운 전/점수/결과 trigger 없이 on_set_end만 호출한다',async()=>{
  const b=battle(3),{root,calls}=makeRoot(b);
  await Fold.resolveFold(root);
  assert.deepEqual(calls.effects.slice(0,3).map(x=>x.trigger),['on_set_end','on_set_end','on_set_end']);
  assert.ok(calls.effects.slice(0,3).every(x=>x.extra.folded===true&&x.extra.showdownSkipped===true));
  assert.equal(calls.effects.some(x=>['before_showdown','on_showdown_score','after_showdown_result'].includes(x.trigger)),false);
});

test('4장 상태에서 폴드해도 리버 스냅샷은 적중 판정하지 않고 폐기한다',async()=>{
  const b=battle(4),{root}=makeRoot(b);
  const result=await Fold.resolveFold(root);
  assert.equal(result.record.riverSnapshotDiscarded,true);assert.equal(b.riverSnapshot,null);assert.equal(b.riverHit,null);
  assert.equal(b.lastSetResolution.type,'fold');assert.equal(b.lastSetResolution.record.showdownSkipped,true);
});

test('폴드 뒤 손패/드로우 덱/칩은 유지하고 새 세트와 새 트럼프만 시작한다',async()=>{
  const b=battle(3,{chip:4,maxChip:5}),handBefore=[...b.hand],deckBefore=[...b.deck],{root,calls}=makeRoot(b);
  await Fold.resolveFold(root);
  assert.equal(b.setIndex,2);assert.equal(b.trick,1);assert.equal(b.phase,'trick');assert.equal(b.trump,'H');
  assert.equal(b.chip,4);assert.deepEqual(b.hand,handBefore);assert.deepEqual(b.deck,deckBefore);assert.equal(calls.draw,0);
  assert.equal(calls.nextEnemy,1);assert.deepEqual(b.setHistory,{trickResults:[],wins:0,losses:0,draws:0});assert.deepEqual(b.history,{fresh:true});
});

test('폴드는 세트 범위 효과·우세·족쇄를 정리하고 전투 범위 효과는 유지한다',async()=>{
  const b=battle(3),{root,calls}=makeRoot(b);
  await Fold.resolveFold(root);
  assert.deepEqual(b.effects,[{duration:'battle',id:'battle-effect'}]);assert.equal(b.advantage,null);
  assert.equal(calls.consume,1);assert.equal(calls.locks,1);
  assert.equal(b.contractTabooLastResolution,null);assert.equal(b.contractTabooResolvedSet,null);
});

test('폴드 페널티로 체력이 0이 되면 다음 세트를 시작하지 않고 패배 처리한다',async()=>{
  const b=battle(3),{root,run,calls}=makeRoot(b,{hp:6});
  const result=await Fold.resolveFold(root);
  assert.equal(result.playerDefeated,true);assert.equal(result.nextSet,false);assert.equal(run.hp,0);
  assert.equal(calls.lose,1);assert.equal(calls.nextEnemy,0);assert.equal(b.setIndex,1);assert.equal(b.phase,'fold');
});

test('취소한 폴드는 전투 상태와 체력을 전혀 바꾸지 않는다',async()=>{
  const b=battle(3),{root,run,calls}=makeRoot(b);root.confirm=()=>false;
  const before={hp:run.hp,slots:b.slots.map(x=>x.card.uid),discard:b.discard.length,setIndex:b.setIndex};
  const result=await Fold.requestFold(root);
  assert.equal(result.ok,false);assert.equal(result.reason,'cancelled');
  assert.equal(run.hp,before.hp);assert.deepEqual(b.slots.map(x=>x.card.uid),before.slots);assert.equal(b.discard.length,before.discard);assert.equal(b.setIndex,before.setIndex);
  assert.equal(calls.nextEnemy,0);
});

test('폴드 기록은 전투/런 통계에 세트·슬롯 수·실제 체력 손실을 별도로 남긴다',async()=>{
  const b=battle(4),{root,run}=makeRoot(b,{hp:5});
  const result=await Fold.resolveFold(root,{penalty:3});
  assert.equal(result.record.slotCount,4);assert.equal(result.record.penaltyRequested,3);assert.equal(result.record.penaltyLost,3);
  assert.equal(b.foldHistory.length,1);assert.equal(b.lastFold.setIndex,1);
  assert.deepEqual(run.foldStats,{count:1,hpLost:3,bySlotCount:{3:0,4:1}});
});

test('8-E 런타임은 8-D 뒤, 최종 전투 레이아웃 전에 로드되며 기존 index에 폴드 쇼다운 우회 코드를 박지 않는다',()=>{
  const loader=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(loader,/function finishShowdownSlotManipulation\(\)\{\s*loadFoldExperiment\(\);\s*\}/);
  assert.match(loader,/fold-experiment\.js/);
  assert.match(loader,/function finishFoldExperiment\(\)[\s\S]*loadBattleLayoutFinal\(\)/);
  assert.doesNotMatch(index,/function\s+(foldCurrentSet|resolveFold|requestFold)\s*\(/);
});
