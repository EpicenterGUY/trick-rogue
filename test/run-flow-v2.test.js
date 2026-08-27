const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const RunStructure=require('../run-structure.js');
const RunFlow=require('../run-flow-v2.js');

function runtime(){
  return{
    RunStructure,
    RunPaths:{ensurePathState(run){run.routeState={actId:run.actId,skippedNodeIds:[],pathNodeIds:[]};return run.routeState}},
    RunMapGeneration:{applyGeneratedActMap(run,actId){run.mapGenerationState={actId,generated:false};return run.mapGenerationState}}
  };
}

test('RUN V3 레지스트리는 공통지역·네 지역·최종 관문·최종지역을 유효한 맵으로 가진다',()=>{
  assert.deepEqual(RunStructure.validateActRegistry(),[]);
  const common=RunStructure.ACT_DEFINITIONS.common;assert.equal(common.nodes.length,5);assert.deepEqual(common.nodes.map(node=>node.type),['battle','event','battle','camp','elite']);assert.equal(common.nodes.at(-1).next.length,0);
  for(const id of RunFlow.regionIds()){const act=RunStructure.ACT_DEFINITIONS[id];assert.equal(act.nodes.length,7);assert.equal(act.nodes.at(-1).type,'boss');assert.equal(act.nodes.filter(node=>node.branchEntry).length,2)}
  assert.equal(RunStructure.ACT_DEFINITIONS.gateway.requiresBoss,false);assert.equal(RunStructure.ACT_DEFINITIONS.gateway.nodes.at(-1).next.length,0);
  assert.equal(RunStructure.ACT_DEFINITIONS.final.nodes.at(-1).type,'boss');
});

test('지역 프로필은 4개로 확장되고 공용 60~70% / 지역 30~40% 보상 가중치를 지킨다',()=>{
  assert.equal(RunFlow.regionIds().length,4);assert.ok(RunFlow.regionIds().includes('region_casino'));assert.deepEqual(RunFlow.validateRegionProfiles({RunStructure}),[]);
  for(const profile of Object.values(RunFlow.REGION_PROFILES)){assert.ok(profile.systems);assert.ok(profile.rewardWeights.neutral>=.6&&profile.rewardWeights.neutral<=.7);assert.ok(profile.rewardWeights.theme>=.3&&profile.rewardWeights.theme<=.4);assert.equal(Number(RunFlow.weightTotal(profile.enemyWeights).toFixed(6)),1);assert.equal(Number(RunFlow.weightTotal(profile.eventWeights).toFixed(6)),1)}
});

test('침몰 카지노는 VIP 룸 / 지하 도박장 두 내부 분기와 핵심 시스템 비교 문구를 가진다',()=>{
  const branches=RunFlow.regionBranches('region_casino',{RunStructure});assert.deepEqual(branches.map(branch=>branch.label),['VIP 룸','지하 도박장']);
  const profile=RunFlow.regionProfile('region_casino');assert.equal(profile.systems,'칩 · 낮은 숫자 · 반전');assert.match(RunFlow.regionOptionHtml(profile),/핵심 · 칩 · 낮은 숫자 · 반전/);assert.match(RunFlow.regionOptionHtml(profile),/위험도 고변동/);
});

test('새 런은 공통지역 STAGE 1 / 8에서 시작하고 덱·스타터·특성은 보존한다',()=>{
  const run={runSeed:123,deck:['keep'],starterId:'sniper',traitId:'durable',actId:'act1',map:[{id:'legacy'}],available:new Set(['legacy']),completed:new Set()};RunFlow.initializeRunFlow(run,{runtimeRoot:runtime()});
  assert.equal(run.actId,'common');assert.equal(run.actName,'공통지역');assert.equal(run.actIndex,0);assert.equal(run.runStage,1);assert.equal(run.runProgress.stage,1);assert.equal(run.runProgress.maxStage,8);assert.equal(run.map.length,5);assert.deepEqual([...run.available],['c0']);assert.deepEqual(run.deck,['keep']);assert.equal(run.starterId,'sniper');assert.equal(run.traitId,'durable');assert.equal(run.runFlow.phase,'common');
});

test('구 8-B runFlow 상태는 배열과 방문 이력을 잃지 않고 RUN V3로 마이그레이션된다',()=>{
  const run={actId:'region_theater',runFlow:{version:'8-B',phase:'region',choiceRound:1,pendingRegionOfferIds:[],visitedRegionIds:['region_theater'],completedRegionIds:[],currentRegionId:'region_theater',history:[{type:'old'}]}};const flow=RunFlow.ensureFlowState(run);
  assert.equal(flow.version,'RUN-V3');assert.deepEqual(flow.visitedRegionIds,['region_theater']);assert.equal(flow.history[0].type,'old');assert.deepEqual(flow.visitedRegionBranches,[]);assert.deepEqual(flow.journeyHistory,[]);assert.equal(run.runStage,2);
});

test('공통지역 종료 뒤 첫 지역 선택은 현재 등록된 네 지역을 모두 제시한다',()=>{
  const run={runFlow:RunFlow.createFlowState(),actId:'common'};const offers=RunFlow.beginRegionChoice(run,{reason:'common_complete'});assert.equal(offers.length,4);assert.deepEqual(new Set(offers),new Set(RunFlow.regionIds()));assert.equal(run.runFlow.phase,'region_choice');assert.equal(run.runFlow.choiceRound,1);
});

test('침몰 카지노를 첫 지역으로 고르면 STAGE 2가 되고 7노드 맵과 선택 이력이 남는다',()=>{
  const root=runtime(),run={runSeed:777,actId:'common',map:RunStructure.createActMap('common'),available:new Set(['c4']),completed:new Set(),actHistory:[],runFlow:RunFlow.createFlowState()};RunFlow.beginRegionChoice(run);const result=RunFlow.chooseRegion(run,'region_casino',{runtimeRoot:root});
  assert.equal(result.ok,true);assert.equal(run.runStage,2);assert.equal(run.actId,'region_casino');assert.equal(run.actName,'침몰 카지노');assert.equal(run.actIndex,1);assert.deepEqual(run.runFlow.visitedRegionIds,['region_casino']);assert.equal(run.map.length,7);assert.ok(run.map.every(node=>node.regionPlan?.regionId==='region_casino'));assert.ok(run.runFlow.history.some(entry=>entry.type==='region_selected'&&entry.regionId==='region_casino'));
});

test('지역 노드의 적·이벤트 경향은 같은 런 시드에서 결정적으로 고정되고 보상 혼합을 함께 가진다',()=>{
  const root=runtime();function make(){const run={runSeed:404,runFlow:RunFlow.createFlowState()};run.runFlow.visitedRegionIds=['region_observatory'];RunFlow.applyFlowAct(run,'region_observatory',{runtimeRoot:root,recordPrevious:false,phase:'region'});return run}const a=make(),b=make();assert.deepEqual(a.map.map(node=>node.regionPlan),b.map.map(node=>node.regionPlan));const battle=a.map.find(node=>node.type==='battle'),event=a.map.find(node=>node.type==='event');assert.ok(battle.regionPlan.enemyTag);assert.ok(event.regionPlan.eventTag);assert.deepEqual(battle.regionPlan.rewardWeights,{neutral:.65,theme:.35});
});

test('내부 분기 선택은 STAGE 3/6으로 진행하며 방문 분기와 journey history를 기록한다',()=>{
  const root=runtime(),run={runSeed:500,runFlow:RunFlow.createFlowState()};RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_casino',{runtimeRoot:root});
  const vip=run.map.find(node=>node.branchId==='vip_room'&&node.branchEntry),first=RunFlow.recordBranchSelection(run,vip,{runtimeRoot:root});assert.equal(first.ok,true);assert.equal(first.stage,3);assert.equal(run.runStage,3);assert.equal(run.runFlow.visitedRegionBranches[0].branchId,'vip_room');assert.equal(run.runFlow.journeyHistory[0].branchLabel,'VIP 룸');
  const duplicate=RunFlow.recordBranchSelection(run,vip,{runtimeRoot:root});assert.equal(duplicate.duplicate,true);assert.equal(run.runFlow.visitedRegionBranches.length,1);
});

test('카드군이나 시작 지역은 다른 지역 선택을 막는 클래스 게이트가 아니다',()=>{
  const run={starterId:'sniper',runFlow:RunFlow.createFlowState()};RunFlow.beginRegionChoice(run);assert.deepEqual(new Set(run.runFlow.pendingRegionOfferIds),new Set(RunFlow.regionIds()));assert.equal(RunFlow.chooseRegion(run,'region_casino',{runtimeRoot:runtime()}).ok,true);
});

test('첫 지역 보스를 끝내면 이미 방문한 지역을 제외한 다음 세 지역 선택으로 이어진다',()=>{
  const root=runtime(),run={runSeed:1,runFlow:RunFlow.createFlowState()};RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_casino',{runtimeRoot:root});const boss=run.map.find(node=>node.type==='boss');run.available=new Set([boss.id]);run.currentNodeId=boss.id;RunFlow.setRunStage(run,4);const result=RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});assert.equal(result.next,'region_choice');assert.equal(run.runFlow.phase,'region_choice');assert.equal(run.runFlow.pendingRegionOfferIds.length,3);assert.ok(!run.runFlow.pendingRegionOfferIds.includes('region_casino'));assert.deepEqual(run.runFlow.completedRegionIds,['region_casino']);
});

test('두 번째 지역 보스 뒤에는 두 지역 흔적을 섞은 STAGE 7 최종 관문으로 전환한다',()=>{
  const root=runtime(),run={runSeed:2,runFlow:RunFlow.createFlowState()};RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_casino',{runtimeRoot:root});let branch=run.map.find(node=>node.branchEntry);RunFlow.recordBranchSelection(run,branch,{runtimeRoot:root});let boss=run.map.find(node=>node.type==='boss');run.available=new Set([boss.id]);run.currentNodeId=boss.id;RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});RunFlow.chooseRegion(run,'region_observatory',{runtimeRoot:root});branch=run.map.find(node=>node.branchEntry);RunFlow.recordBranchSelection(run,branch,{runtimeRoot:root});boss=run.map.find(node=>node.type==='boss');run.available=new Set([boss.id]);run.currentNodeId=boss.id;const result=RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});
  assert.equal(result.next,'gateway');assert.equal(run.actId,'gateway');assert.equal(run.runStage,7);assert.equal(run.runFlow.phase,'gateway');assert.deepEqual(RunFlow.gatewayPlan(run).sourceRegionIds,['region_casino','region_observatory']);assert.ok(run.map.every(node=>node.regionPlan.sourceRegionIds.length===2));assert.equal(run.runComplete,false);
});

test('최종 관문 완료 뒤 STAGE 8 최종지역으로 전환되고 최종 보스는 기존 런 종료 경로에 남는다',()=>{
  const root=runtime(),run={runSeed:3,runFlow:RunFlow.createFlowState()};run.runFlow.visitedRegionIds=['region_casino','region_frontier'];RunFlow.applyFlowAct(run,'gateway',{runtimeRoot:root,recordPrevious:false,phase:'gateway'});RunFlow.setRunStage(run,7);const result=RunFlow.completeGateway(run,{runtimeRoot:root});assert.equal(result.next,'final');assert.equal(run.actId,'final');assert.equal(run.runStage,8);assert.equal(run.runFlow.phase,'final');assert.equal(run.map.at(-1).type,'boss');assert.equal(run.runComplete,false);assert.equal(RunFlow.setRunStage(run,9),8);
});

test('지역 선택 중에는 맵 노드 진입을 막고 선택 완료 후 다시 기존 enterNode로 넘긴다',()=>{
  RunFlow.resetForTests();const root=runtime();root.run={runFlow:RunFlow.createFlowState(),actId:'common'};root.run.runFlow.phase='region_choice';root.calls=[];root.enterNode=function(node){this.calls.push(node.id);return true};RunFlow.wrapEnterNode(root);assert.equal(root.enterNode({id:'c0'}),false);assert.deepEqual(root.calls,[]);root.run.runFlow.phase='common';assert.equal(root.enterNode({id:'c0'}),true);assert.deepEqual(root.calls,['c0']);
});

test('런타임 로더는 런 흐름 뒤 미니게임 → 이벤트 → 경제 계층 순서로 붙인다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');const flowStart=source.indexOf('function loadRunFlowV2()'),miniStart=source.indexOf('function loadRunMinigames()'),eventStart=source.indexOf('function loadRunEvents()'),economyStart=source.indexOf('function loadRunEconomyV2()'),startStart=source.indexOf('function loadRunStartV2()');
  assert.ok(economyStart>=0&&eventStart>economyStart&&miniStart>eventStart&&flowStart>miniStart&&startStart>flowStart,'함수 선언 순서는 체인 역순이어도 호출 체인은 flow→minigame→event→economy여야 한다');
  const flowBlock=source.slice(flowStart,startStart),miniBlock=source.slice(miniStart,flowStart),eventBlock=source.slice(eventStart,miniStart);assert.match(flowBlock,/run-flow-v2\.js/);assert.match(flowBlock,/loadRunMinigames/);assert.match(miniBlock,/run-minigames\.js/);assert.match(miniBlock,/loadRunEvents/);assert.match(eventBlock,/run-events\.js/);assert.match(eventBlock,/loadRunEconomyV2/);
});