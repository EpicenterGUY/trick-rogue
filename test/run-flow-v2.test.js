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

test('8-B 기본 런 레지스트리는 공통지역 5노드와 세 지역·최종지역을 유효한 맵으로 가진다',()=>{
  assert.deepEqual(RunStructure.validateActRegistry(),[]);
  const common=RunStructure.ACT_DEFINITIONS.common;
  assert.equal(common.nodes.length,5);
  assert.deepEqual(common.nodes.map(node=>node.type),['battle','event','battle','camp','elite']);
  assert.equal(common.nodes.at(-1).next.length,0);
  for(const id of RunFlow.regionIds()){
    const act=RunStructure.ACT_DEFINITIONS[id];
    assert.equal(act.nodes.length,7);
    assert.equal(act.nodes.at(-1).type,'boss');
  }
  assert.ok(RunStructure.ACT_DEFINITIONS.final.nodes.length>=4&&RunStructure.ACT_DEFINITIONS.final.nodes.length<=6);
  assert.equal(RunStructure.ACT_DEFINITIONS.final.nodes.at(-1).type,'boss');
});

test('지역 프로필은 정확히 3개이며 공용 60~70% / 지역 30~40% 보상 가중치를 지킨다',()=>{
  assert.equal(RunFlow.regionIds().length,3);
  assert.deepEqual(RunFlow.validateRegionProfiles({RunStructure}),[]);
  for(const profile of Object.values(RunFlow.REGION_PROFILES)){
    assert.ok(profile.rewardWeights.neutral>=.6&&profile.rewardWeights.neutral<=.7);
    assert.ok(profile.rewardWeights.theme>=.3&&profile.rewardWeights.theme<=.4);
    assert.equal(Number(RunFlow.weightTotal(profile.enemyWeights).toFixed(6)),1);
    assert.equal(Number(RunFlow.weightTotal(profile.eventWeights).toFixed(6)),1);
  }
});

test('새 런은 기존 액트 1이 아니라 공통지역에서 시작하고 덱·스타터·특성은 보존한다',()=>{
  const run={runSeed:123,deck:['keep'],starterId:'sniper',traitId:'durable',actId:'act1',map:[{id:'legacy'}],available:new Set(['legacy']),completed:new Set()};
  RunFlow.initializeRunFlow(run,{runtimeRoot:runtime()});
  assert.equal(run.actId,'common');
  assert.equal(run.actName,'공통지역');
  assert.equal(run.actIndex,0);
  assert.equal(run.map.length,5);
  assert.deepEqual([...run.available],['c0']);
  assert.deepEqual(run.deck,['keep']);
  assert.equal(run.starterId,'sniper');
  assert.equal(run.traitId,'durable');
  assert.equal(run.runFlow.phase,'common');
});

test('공통지역 종료 뒤 첫 지역 선택은 세 지역을 모두 제시한다',()=>{
  const run={runFlow:RunFlow.createFlowState(),actId:'common'};
  const offers=RunFlow.beginRegionChoice(run,{reason:'common_complete'});
  assert.equal(offers.length,3);
  assert.deepEqual(new Set(offers),new Set(RunFlow.regionIds()));
  assert.equal(run.runFlow.phase,'region_choice');
  assert.equal(run.runFlow.choiceRound,1);
});

test('지역을 고르면 런 상태에 선택 이력이 남고 해당 지역 7노드 맵으로 전환된다',()=>{
  const root=runtime(),run={runSeed:777,actId:'common',map:RunStructure.createActMap('common'),available:new Set(['c4']),completed:new Set(),actHistory:[],runFlow:RunFlow.createFlowState()};
  RunFlow.beginRegionChoice(run);
  const result=RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});
  assert.equal(result.ok,true);
  assert.equal(run.actId,'region_theater');
  assert.equal(run.actName,'유랑극장');
  assert.equal(run.actIndex,1);
  assert.deepEqual(run.runFlow.visitedRegionIds,['region_theater']);
  assert.equal(run.map.length,7);
  assert.ok(run.map.every(node=>node.regionPlan?.regionId==='region_theater'));
  assert.ok(run.runFlow.history.some(entry=>entry.type==='region_selected'&&entry.regionId==='region_theater'));
});

test('지역 노드의 적·이벤트 경향은 같은 런 시드에서 결정적으로 고정되고 보상 혼합을 함께 가진다',()=>{
  const root=runtime();
  function make(){const run={runSeed:404,runFlow:RunFlow.createFlowState()};run.runFlow.visitedRegionIds=['region_observatory'];RunFlow.applyFlowAct(run,'region_observatory',{runtimeRoot:root,recordPrevious:false,phase:'region'});return run}
  const a=make(),b=make();
  assert.deepEqual(a.map.map(node=>node.regionPlan),b.map.map(node=>node.regionPlan));
  const battle=a.map.find(node=>node.type==='battle'),event=a.map.find(node=>node.type==='event');
  assert.ok(battle.regionPlan.enemyTag);
  assert.ok(event.regionPlan.eventTag);
  assert.deepEqual(battle.regionPlan.rewardWeights,{neutral:.65,theme:.35});
});

test('카드군이나 시작 지역은 다른 지역 선택을 막는 클래스 게이트가 아니다',()=>{
  const run={starterId:'sniper',runFlow:RunFlow.createFlowState()};
  RunFlow.beginRegionChoice(run);
  assert.deepEqual(new Set(run.runFlow.pendingRegionOfferIds),new Set(RunFlow.regionIds()));
  assert.equal(RunFlow.chooseRegion(run,'region_observatory',{runtimeRoot:runtime()}).ok,true);
});

test('첫 지역 보스를 끝내면 이미 방문한 지역을 제외한 다음 지역 선택으로 이어진다',()=>{
  const root=runtime(),run={runSeed:1,runFlow:RunFlow.createFlowState()};
  RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_frontier',{runtimeRoot:root});
  const boss=run.map.find(node=>node.type==='boss');run.available=new Set([boss.id]);run.currentNodeId=boss.id;
  const result=RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});
  assert.equal(result.next,'region_choice');
  assert.equal(run.runFlow.phase,'region_choice');
  assert.equal(run.runFlow.pendingRegionOfferIds.length,2);
  assert.ok(!run.runFlow.pendingRegionOfferIds.includes('region_frontier'));
  assert.deepEqual(run.runFlow.completedRegionIds,['region_frontier']);
});

test('두 번째 지역 보스까지 끝내면 최종지역으로 전환되고 최종 보스는 일반 런 종료 경로에 남긴다',()=>{
  const root=runtime(),run={runSeed:2,runFlow:RunFlow.createFlowState()};
  RunFlow.beginRegionChoice(run);RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});
  let boss=run.map.find(node=>node.type==='boss');run.available=new Set([boss.id]);run.currentNodeId=boss.id;RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});
  RunFlow.chooseRegion(run,'region_observatory',{runtimeRoot:root});boss=run.map.find(node=>node.type==='boss');run.available=new Set([boss.id]);run.currentNodeId=boss.id;
  const result=RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});
  assert.equal(result.next,'final');
  assert.equal(run.actId,'final');
  assert.equal(run.actIndex,3);
  assert.equal(run.runFlow.phase,'final');
  assert.equal(run.map.at(-1).type,'boss');
  assert.equal(run.runComplete,false);
});

test('지역 선택 중에는 맵 노드 진입을 막고 선택 완료 후 다시 기존 enterNode로 넘긴다',()=>{
  RunFlow.resetForTests();
  const root=runtime();root.run={runFlow:RunFlow.createFlowState(),actId:'common'};root.run.runFlow.phase='region_choice';root.calls=[];root.enterNode(node){this.calls.push(node.id);return true};
  RunFlow.wrapEnterNode(root);
  assert.equal(root.enterNode({id:'c0'}),false);
  assert.deepEqual(root.calls,[]);
  root.run.runFlow.phase='common';assert.equal(root.enterNode({id:'c0'}),true);assert.deepEqual(root.calls,['c0']);
});

test('8-B 브라우저 로더는 시작 정체성 뒤 최신 런 흐름을 붙이고 마지막에 전투 레이아웃으로 간다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  const flowStart=source.indexOf('function loadRunFlowV2()');
  const startStart=source.indexOf('function loadRunStartV2()');
  const intelStart=source.indexOf('function loadEnemyInformation()');
  assert.ok(flowStart>=0&&startStart>flowStart&&intelStart>startStart);
  const flowBlock=source.slice(flowStart,startStart),startBlock=source.slice(startStart,intelStart);
  assert.match(flowBlock,/run-flow-v2\.js/);
  assert.match(flowBlock,/if\(root\.RunFlowV2\)\{loadBattleLayoutFinal\(\);return;\}/);
  assert.match(startBlock,/if\(root\.RunStartV2\)\{loadRunFlowV2\(\);return;\}/);
  assert.match(startBlock,/addEventListener\?\.\('load',loadRunFlowV2/);
});
