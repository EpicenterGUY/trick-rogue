const test=require('node:test');
const assert=require('node:assert/strict');
const RunStructure=require('../run-structure.js');
const RunPaths=require('../run-paths.js');
const RunMapGeneration=require('../run-map-generation.js');
const RunFlow=require('../run-flow-v2.js');

function runtime(){
  return{RunStructure,RunPaths,RunMapGeneration};
}

test('8-B 공통지역은 실제 맵 생성기에서도 보스 없는 고정 5노드 맵으로 검증된다',()=>{
  const result=RunMapGeneration.generateActMap('common',{runSeed:17});
  assert.equal(result.generated,false);
  assert.equal(result.map.length,5);
  assert.deepEqual(result.map.map(node=>node.type),['battle','event','battle','camp','elite']);
  assert.deepEqual(RunMapGeneration.validateGeneratedMap('common',result.map),[]);
});

test('8-B 실제 맵 생성기를 거쳐 지역 선택 시 7노드 지역 계획 메타데이터가 유지된다',()=>{
  const root=runtime();
  const run={runSeed:99,runFlow:RunFlow.createFlowState()};
  RunFlow.beginRegionChoice(run);
  const chosen=RunFlow.chooseRegion(run,'region_theater',{runtimeRoot:root});
  assert.equal(chosen.ok,true);
  assert.equal(run.mapGenerationState.actId,'region_theater');
  assert.equal(run.map.length,7);
  assert.ok(run.map.every(node=>node.regionPlan?.regionId==='region_theater'));
  assert.ok(run.map.filter(node=>['battle','elite','boss'].includes(node.type)).every(node=>node.regionPlan.enemyTag));
  assert.ok(run.map.filter(node=>node.type==='event').every(node=>node.regionPlan.eventTag));
});

test('8-B 공통지역 마지막 관문 완료는 기존 완료 처리를 거친 뒤 지역 3택 모달을 연다',()=>{
  RunFlow.resetForTests();
  const root=runtime();
  root.run={runSeed:5,runFlow:RunFlow.createFlowState()};
  RunFlow.applyFlowAct(root.run,'common',{runtimeRoot:root,recordPrevious:false,phase:'common'});
  const gate=root.run.map.at(-1);
  root.run.available=new Set([gate.id]);
  root.modals=[];
  root.completeNode=function(node){
    this.run.completed.add(node.id);
    this.run.available.delete(node.id);
    this.run.lastCompletedNodeId=node.id;
    this.run.currentNodeId=null;
    return{ok:true,node};
  };
  root.showModal=function(html){this.modals.push(html)};
  root.closeOverlay=function(){};
  root.showScreen=function(){};
  root.renderMap=function(){};
  RunFlow.wrapCompleteNode(root);
  const result=root.completeNode(gate);
  assert.equal(result.ok,true);
  assert.equal(root.run.runFlow.phase,'region_choice');
  assert.equal(root.run.runFlow.pendingRegionOfferIds.length,3);
  assert.equal(root.modals.length,1);
  assert.match(root.modals[0],/지역 선택/);
  assert.match(root.modals[0],/유랑극장/);
  assert.match(root.modals[0],/안개 관측소/);
  assert.match(root.modals[0],/황야 전선/);
});

test('8-B 지역 보스 완료는 구형 completeNode를 호출하지 않고 다음 지역 선택으로 전환한다',()=>{
  RunFlow.resetForTests();
  const root=runtime();
  root.run={runSeed:6,runFlow:RunFlow.createFlowState()};
  RunFlow.beginRegionChoice(root.run);
  RunFlow.chooseRegion(root.run,'region_frontier',{runtimeRoot:root});
  const boss=root.run.map.find(node=>node.type==='boss');
  root.run.available=new Set([boss.id]);
  root.run.currentNodeId=boss.id;
  root.legacyCalls=0;
  root.modals=[];
  root.completeNode=function(){this.legacyCalls++;return{legacy:true}};
  root.showModal=function(html){this.modals.push(html)};
  root.closeOverlay=function(){};
  root.showScreen=function(){};
  root.renderMap=function(){};
  RunFlow.wrapCompleteNode(root);
  const result=root.completeNode(boss);
  assert.equal(result.ok,true);
  assert.equal(result.next,'region_choice');
  assert.equal(root.legacyCalls,0);
  assert.deepEqual(root.run.runFlow.completedRegionIds,['region_frontier']);
  assert.equal(root.run.runFlow.pendingRegionOfferIds.length,2);
  assert.equal(root.modals.length,1);
  assert.match(root.modals[0],/지역 선택/);
});
