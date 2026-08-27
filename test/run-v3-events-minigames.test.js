const test=require('node:test');
const assert=require('node:assert/strict');
const RunStructure=require('../run-structure.js');
const RunFlow=require('../run-flow-v2.js');
const RunEvents=require('../run-events.js');
const RunMinigames=require('../run-minigames.js');
const Persistence=require('../run-persistence.js');

function runtime(){
  return{
    RunStructure,
    RunEvents,
    RunMinigames,
    RunPaths:{ensurePathState(run){run.routeState={actId:run.actId,skippedNodeIds:[],pathNodeIds:[]};return run.routeState}},
    RunMapGeneration:{applyGeneratedActMap(run,actId){run.mapGenerationState={actId,generated:false};return run.mapGenerationState}}
  };
}
function card(uid,suit,rank){return{uid,suit,rank,printedSuit:suit,printedRank:rank}}
function seedRun(seed=123){
  const root=runtime(),run={runSeed:seed,deck:[card('a','S',5),card('b','H',9),card('c','D',12)],hp:40,maxHp:50,gold:0};
  RunFlow.initializeRunFlow(run,{runtimeRoot:root});return{root,run};
}
function chooseFirstBranch(run,root){
  const branch=run.map.find(node=>node.branchEntry);assert.ok(branch);return RunFlow.recordBranchSelection(run,branch,{runtimeRoot:root});
}
function completeCurrentRegionBoss(run,root){
  const boss=run.map.find(node=>node.type==='boss');run.available=new Set([boss.id]);run.currentNodeId=boss.id;return RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});
}

test('RUN V3은 새 런부터 최종 보스까지 1~8 스테이지를 정확히 진행하고 8을 넘지 않는다',()=>{
  const {root,run}=seedRun(11);
  assert.equal(run.runStage,1);
  RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});assert.equal(run.runStage,2);
  chooseFirstBranch(run,root);assert.equal(run.runStage,3);
  RunFlow.setRunStage(run,4,{reason:'test_first_boss'});assert.equal(run.runStage,4);
  let result=completeCurrentRegionBoss(run,root);assert.equal(result.next,'region_choice');
  RunFlow.chooseRegion(run,'region_observatory',{runtimeRoot:root});assert.equal(run.runStage,5);
  chooseFirstBranch(run,root);assert.equal(run.runStage,6);
  result=completeCurrentRegionBoss(run,root);assert.equal(result.next,'gateway');assert.equal(run.actId,'gateway');assert.equal(run.runStage,7);
  result=RunFlow.completeGateway(run,{runtimeRoot:root});assert.equal(result.next,'final');assert.equal(run.actId,'final');assert.equal(run.runStage,8);
  assert.equal(RunFlow.setRunStage(run,99),8);
});

test('첫 방문 지역은 두 번째 선택에서 제외되고 남은 네 지역과 분기/journey history가 저장된다',()=>{
  const {root,run}=seedRun(12);RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_frontier',{runtimeRoot:root});
  const selected=RunFlow.recordBranchSelection(run,run.map.find(node=>node.branchId==='supply_route'),{runtimeRoot:root});
  assert.equal(selected.ok,true);assert.deepEqual(run.runFlow.visitedRegionBranches.map(({regionId,branchId})=>({regionId,branchId})),[{regionId:'region_frontier',branchId:'supply_route'}]);
  assert.equal(run.runFlow.journeyHistory[0].branchLabel,'보급로');
  completeCurrentRegionBoss(run,root);
  assert.equal(run.runFlow.pendingRegionOfferIds.includes('region_frontier'),false);assert.equal(run.runFlow.pendingRegionOfferIds.length,4);assert.ok(run.runFlow.pendingRegionOfferIds.includes('region_casino'));assert.ok(run.runFlow.pendingRegionOfferIds.includes('region_red_ward'));
});

test('두 지역 방문 뒤 최종 관문은 두 지역 태그와 journey history에 접근할 수 있다',()=>{
  const {root,run}=seedRun(13);RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});chooseFirstBranch(run,root);completeCurrentRegionBoss(run,root);
  RunFlow.chooseRegion(run,'region_frontier',{runtimeRoot:root});chooseFirstBranch(run,root);completeCurrentRegionBoss(run,root);
  const plan=RunFlow.gatewayPlan(run);assert.deepEqual(plan.sourceRegionIds,['region_theater','region_frontier']);assert.equal(plan.journeyHistory.length,2);
  assert.ok(run.map.every(node=>node.regionPlan?.sourceRegionIds?.length===2));
  assert.ok(run.map.some(node=>node.type==='event'&&node.regionPlan.eventTags.length===2));
});

test('eventTag는 실제 지역 이벤트 가중치에 연결되고 공용 이벤트는 모든 지역에서 후보가 된다',()=>{
  const {root,run}=seedRun(21);RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});
  const node={id:'event-x',type:'event',regionPlan:{regionId:'region_theater',regionIds:['region_theater'],eventTag:'performance',eventTags:['performance']}};
  const candidates=RunEvents.eventCandidates(run,node),byId=Object.fromEntries(candidates.map(item=>[item.definition.id,item.weight]));
  assert.ok(byId.stage_layout>byId.lost_and_found);assert.ok(byId.old_map>0);assert.equal(byId.observation_exam,undefined);
  const frontier={id:'event-y',type:'event',regionPlan:{regionId:'region_frontier',regionIds:['region_frontier'],eventTag:'supply',eventTags:['supply']}};
  assert.ok(RunEvents.eventCandidates(run,frontier).some(item=>item.definition.id==='old_map'));
});

test('같은 seed와 같은 진행 상태에서는 같은 이벤트가 선택된다',()=>{
  function pick(){const {root,run}=seedRun(2026);RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_observatory',{runtimeRoot:root});const node={id:'fixed-event',type:'event',regionPlan:{regionId:'region_observatory',regionIds:['region_observatory'],eventTag:'information',eventTags:['information']}};return RunEvents.selectEvent(run,node,{runtimeRoot:root})?.id}
  assert.equal(pick(),pick());
});

test('eligibility=false와 oneShot 재등장은 이벤트 후보에서 제외된다',()=>{
  const {run}=seedRun(22),node={id:'e',type:'event'};run.deck=[card('solo','S',2)];
  assert.equal(RunEvents.eventCandidates(run,node).some(item=>item.definition.id==='lost_and_found'),false,'카드 한 장뿐이면 보관소 제외');
  run.deck.push(card('extra','H',3));RunEvents.ensureEventState(run).oneShotSeen.push('lost_and_found');
  assert.equal(RunEvents.eventCandidates(run,node).some(item=>item.definition.id==='lost_and_found'),false,'본 oneShot 이벤트는 제외');
});

test('분실물 보관소는 카드를 런 상태에 보관하고 다음 지역 진입 훅에서 +1 강화해 반환한다',()=>{
  const {root,run}=seedRun(23);RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});const before=run.deck.length;
  const stored=RunEvents.storeCard(run,0);assert.equal(stored.ok,true);assert.equal(run.deck.length,before-1);assert.equal(run.eventState.storedCards.length,1);
  run.runFlow.visitedRegionIds.push('region_observatory');const result=RunEvents.handleRunHook(run,'on_region_enter',{regionId:'region_observatory'},root);
  assert.equal(result[0].type,'stored_card_returned');assert.equal(run.eventState.storedCards.length,0);assert.equal(run.deck.length,before);assert.equal(run.deck.at(-1).upgradeLevel,1);
});

test('리버 테이블은 기존 포커 규칙으로 5번째 카드를 판정한다',()=>{
  const state=RunMinigames.createRiverTable({baseCards:[{suit:'S',rank:5},{suit:'H',rank:6},{suit:'D',rank:7},{suit:'C',rank:8}],candidateCards:[{suit:'S',rank:9},{suit:'S',rank:2},{suit:'H',rank:12}]});
  const result=RunMinigames.chooseRiverTable(state,0);assert.equal(result.ok,true);assert.equal(result.hand.id,'straight');assert.equal(state.phase,'resolved');
});

test('보급품 탈취는 계속/철수가 가능하고 철수 시 현재 누적 보상을 확정한다',()=>{
  const state=RunMinigames.createSupplyHeist({riskRolls:[.99,.99,.99]});let result=RunMinigames.chooseSupplyHeist(state,'continue');assert.equal(result.step,1);assert.equal(state.phase,'push');
  result=RunMinigames.chooseSupplyHeist(state,'continue');assert.equal(result.step,2);result=RunMinigames.chooseSupplyHeist(state,'withdraw');assert.equal(result.ok,true);assert.equal(result.step,2);assert.equal(result.reward.tier,'success');assert.equal(state.phase,'resolved');
});

test('사격장은 표적 이상 중 가장 작은 숫자를 최적 카드로 판정한다',()=>{
  const cards=[{suit:'S',rank:7},{suit:'H',rank:10},{suit:'D',rank:13}];assert.equal(RunMinigames.shootingOptimalIndex(9,cards),1);
  const state=RunMinigames.createShootingRange({target:9,cards}),result=RunMinigames.chooseShootingRange(state,1);assert.equal(result.optimal,true);assert.equal(result.reward.tier,'success');
});

test('무대 배치는 중앙 최고 숫자와 같은 무늬 인접 조건을 각각 판정한다',()=>{
  const cards=[{suit:'H',rank:4},{suit:'H',rank:8},{suit:'S',rank:13},{suit:'C',rank:5},{suit:'D',rank:9}],slots=[0,1,2,3,4];const result=RunMinigames.stageLayoutConditions(cards,slots);
  assert.equal(result.complete,true);assert.equal(result.score,2);assert.ok(result.conditions.every(condition=>condition.success));
});

test('미니게임 보상 액션은 골드·회복·피해·카드·강화 공용 API로 적용된다',()=>{
  const {root,run}=seedRun(24),beforeDeck=run.deck.length;run.hp=20;run.gold=5;
  const results=RunEvents.applyActions(run,[{type:'gain_gold',amount:10},{type:'heal',amount:5},{type:'damage_player',amount:2},{type:'add_card',mode:'generated'},{type:'upgrade_card',index:0}],{runtimeRoot:root,salt:'test'});
  assert.ok(results.every(result=>result.ok));assert.equal(run.gold,15);assert.equal(run.hp,23);assert.equal(run.deck.length,beforeDeck+1);assert.equal(run.deck[0].upgradeLevel,1);
});

test('V3 장기 상태는 기존 저장 포맷으로 stage/지역/분기/oneShot/보관 카드를 모두 왕복한다',()=>{
  const {root,run}=seedRun(25);RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});chooseFirstBranch(run,root);RunEvents.ensureEventState(run).oneShotSeen.push('lost_and_found');RunEvents.storeCard(run,0);
  const parsed=Persistence.parseSave(Persistence.stringifySave(run,{now:0,reason:'run-v3-test'}));
  assert.equal(parsed.runState.runStage,3);assert.deepEqual(parsed.runState.runFlow.visitedRegionIds,['region_theater']);assert.equal(parsed.runState.runFlow.visitedRegionBranches[0].branchId,'backstage');assert.deepEqual(parsed.runState.eventState.oneShotSeen,['lost_and_found']);assert.equal(parsed.runState.eventState.storedCards.length,1);
  assert.equal(Persistence.verifyRoundTrip(run).ok,true);
});
