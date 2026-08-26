const test=require('node:test');
const assert=require('node:assert/strict');
const RunEvents=require('../run-events.js');
const Persistence=require('../run-persistence.js');

function card(uid,suit,rank){return{uid,suit,rank,printedSuit:suit,printedRank:rank}}
function seedRun(seed=1,hp=3){
  return{
    runSeed:seed,
    runStage:3,
    actId:'region_theater',
    hp,
    maxHp:40,
    gold:0,
    deck:[card('a','S',5),card('b','H',9),card('c','D',12),card('d','C',13)],
    eventState:{history:[],oneShotSeen:[],storedCards:[],routeReveals:[],pendingEffects:[],activeEvent:null}
  };
}

test('P1-4 이벤트 피해는 비치명이며 HP 1/2/3 경계에서 최소 HP 1을 지킨다',()=>{
  assert.equal(RunEvents.EVENT_DAMAGE_MIN_HP,1);
  for(const hp of [1,2,3]){
    const run=seedRun(1,hp);
    const result=RunEvents.applyAction(run,{type:'damage_player',amount:2});
    assert.equal(run.hp,1,`HP ${hp}에서 이벤트 피해 후 1이어야 한다`);
    assert.equal(result.ok,true);
    assert.equal(result.nonLethal,true);
    assert.equal(result.minHp,1);
  }
});

test('P1-4 위험 신호 UI는 체력 소모와 비치명 최소 HP를 함께 명시한다',()=>{
  const run=seedRun();
  RunEvents.ensureEventState(run).activeEvent={eventId:'signal_scan',dynamic:{extraHint:false}};
  const html=RunEvents.choiceHtml(RunEvents.eventDefinition('signal_scan'),run);
  assert.match(html,/체력 2 소모/);
  assert.match(html,/비치명/);
  assert.match(html,/최소 HP 1/);
});

test('P2-1 마술 상자 힌트는 같은 seed와 같은 진행 상태에서 재현된다',()=>{
  const first=RunEvents.magicBoxModel(seedRun(2026));
  const second=RunEvents.magicBoxModel(seedRun(2026));
  assert.deepEqual(first,second);
});

test('P2-1 마술 상자 힌트는 덱 첫 장 고정이 아니며 seed에 따라 달라질 수 있다',()=>{
  const seen=new Set();
  for(let seed=1;seed<=48;seed++)seen.add(RunEvents.magicBoxModel(seedRun(seed)).hintCard.uid);
  assert.ok(seen.size>1,'여러 seed에서 힌트 카드가 하나로 고정되면 안 된다');
  assert.ok([...seen].some(uid=>uid!=='a'),'덱 첫 장 외 카드가 힌트로 등장해야 한다');
});

test('P2-1 마술 상자에서 이미 공개된 힌트는 저장/불러오기 뒤에도 동일하다',()=>{
  const run=seedRun(77);
  run.eventState.activeEvent={
    eventId:'magic_box',
    nodeId:'event-test',
    type:'special',
    startedAtStage:run.runStage,
    minigameState:null,
    context:{regionIds:['region_theater'],eventTags:['performance']},
    dynamic:RunEvents.magicBoxModel(run)
  };
  const before=run.eventState.activeEvent.dynamic;
  const parsed=Persistence.parseSave(Persistence.stringifySave(run,{now:0,reason:'magic-box-policy-test'}));
  assert.deepEqual(parsed.runState.eventState.activeEvent.dynamic,before);
});
