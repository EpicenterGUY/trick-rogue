const test=require('node:test');
const assert=require('node:assert/strict');
const RunEvents=require('../run-events.js');
const Persistence=require('../run-persistence.js');

function card(uid,suit='S',rank=5){return{uid,suit,rank,printedSuit:suit,printedRank:rank}}
function runWithVisits(visits,{stage=1,actId='common'}={}){
  const ids=['region_theater','region_observatory'].slice(0,visits);
  return{
    runSeed:77,
    runStage:stage,
    actId,
    deck:[card('a','S',5),card('b','H',9),card('c','D',12)],
    hp:40,maxHp:50,gold:0,
    map:[],
    runFlow:{version:'RUN-V3',regionVisitTarget:2,visitedRegionIds:ids,completedRegionIds:[],visitedRegionBranches:[],journeyHistory:[],history:[],hookHistory:[],pendingRegionOfferIds:[],choiceRound:0,currentRegionId:ids.at(-1)||null}
  };
}
function hasLostAndFound(run){return RunEvents.eventCandidates(run,{id:'event',type:'event'}).some(item=>item.definition.id==='lost_and_found')}

test('분실물 보관소는 앞으로 방문할 일반 지역이 있을 때만 이벤트 후보가 된다',()=>{
  const common=runWithVisits(0),first=runWithVisits(1,{stage:3,actId:'region_theater'}),second=runWithVisits(2,{stage:6,actId:'region_observatory'}),gateway=runWithVisits(2,{stage:7,actId:'gateway'}),final=runWithVisits(2,{stage:8,actId:'final'});
  assert.equal(RunEvents.remainingRegionVisits(common),2);
  assert.equal(RunEvents.remainingRegionVisits(first),1);
  assert.equal(hasLostAndFound(common),true);
  assert.equal(hasLostAndFound(first),true);
  assert.equal(hasLostAndFound(second),false);
  assert.equal(hasLostAndFound(gateway),false);
  assert.equal(hasLostAndFound(final),false);
});

test('두 번째 지역 이후에는 직접 보관을 시도해도 카드를 덱에서 제거하지 않는다',()=>{
  const run=runWithVisits(2,{stage:6,actId:'region_observatory'}),before=run.deck.map(card=>card.uid);
  const result=RunEvents.storeCard(run,0);
  assert.deepEqual(result,{ok:false,reason:'no_future_region'});
  assert.deepEqual(run.deck.map(card=>card.uid),before);
  assert.equal(RunEvents.ensureEventState(run).storedCards.length,0);
});

test('구버전 저장에 남은 후반 보관 카드는 최종 관문 진입 훅에서 강화되어 자동 복구된다',()=>{
  const run=runWithVisits(2,{stage:7,actId:'gateway'}),state=RunEvents.ensureEventState(run),lost=run.deck.shift();
  state.storedCards.push({id:'stored:legacy',sourceEventId:'lost_and_found',card:lost,returnAtVisitCount:3,storedAtStage:6});
  const restored=Persistence.parseSave(Persistence.stringifySave(run,{now:0,reason:'lost-found-p0'})).runState,before=restored.deck.length;
  const results=RunEvents.handleRunHook(restored,'on_stage_enter',{stage:7},{});
  assert.equal(results.length,1);
  assert.equal(results[0].type,'stored_card_returned');
  assert.equal(results[0].recovered,true);
  assert.equal(results[0].card.uid,'a');
  assert.equal(restored.eventState.storedCards.length,0);
  assert.equal(restored.deck.length,before+1);
  assert.equal(restored.deck.at(-1).upgradeLevel,1);
  assert.equal(Persistence.verifyRoundTrip(restored).ok,true);
});

test('구세이브에서 후반 분실물 보관소가 이미 열려 있어도 카드를 빼지 않고 이벤트를 종료한다',()=>{
  const run=runWithVisits(2,{stage:8,actId:'final'}),node={id:'late-event',type:'event'},state=RunEvents.ensureEventState(run),before=run.deck.map(card=>card.uid);
  run.map=[node];
  state.activeEvent={eventId:'lost_and_found',nodeId:node.id,type:'special',startedAtStage:8,minigameState:null,context:{regionIds:[],eventTags:[]}};
  const result=RunEvents.chooseEvent(run,node,'0',{runtimeRoot:{}});
  assert.equal(result.ok,true);
  assert.equal(result.skipped,true);
  assert.deepEqual(run.deck.map(card=>card.uid),before);
  assert.equal(run.eventState.storedCards.length,0);
  assert.equal(run.eventState.activeEvent,null);
  assert.ok(run.eventState.oneShotSeen.includes('lost_and_found'));
});
