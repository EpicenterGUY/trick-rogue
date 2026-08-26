const test=require('node:test');
const assert=require('node:assert/strict');
const RunStructure=require('../run-structure.js');
const RunFlow=require('../run-flow-v2.js');

function runtime(){
  return{
    RunStructure,
    RunPaths:{ensurePathState(run){run.routeState={actId:run.actId};return run.routeState}},
    RunMapGeneration:{applyGeneratedActMap(){return null}},
    RunEvents:{handleRunHook(){return[]}}
  };
}

function stuckCommonRun(){
  const map=RunStructure.createActMap('common');
  return{
    actId:'common',actIndex:0,actName:'공통지역',runStage:1,
    map,available:new Set(),completed:new Set(map.map(node=>node.id)),
    currentNodeId:null,runFlow:RunFlow.createFlowState()
  };
}

function stuckRegionRun(regionId='region_theater',{rewardOnly=false,visited=null,completedRegions=[]}={}){
  const map=RunStructure.createActMap(regionId),boss=map.find(node=>node.type==='boss'),flow=RunFlow.createFlowState();
  flow.phase='region';flow.currentRegionId=regionId;flow.visitedRegionIds=visited||[regionId];flow.completedRegionIds=[...completedRegions];
  const completed=new Set(map.filter(node=>!rewardOnly||node.id!==boss.id).map(node=>node.id));
  return{
    actId:regionId,actIndex:flow.visitedRegionIds.length,actName:RunFlow.regionProfile(regionId).name,runStage:flow.visitedRegionIds.length===1?4:6,
    map,available:rewardOnly?new Set([boss.id]):new Set(),completed,currentNodeId:boss.id,lastCompletedNodeId:rewardOnly?map.at(-2)?.id:boss.id,runComplete:true,runFlow:flow,
    economyState:{rewardClaims:rewardOnly?{[boss.id]:{market:true,skipped:true}}:{}}
  };
}

test('완료된 공통지역 종점이 phase=common에 남으면 지역 선택으로 1회 복구한다',()=>{
  const run=stuckCommonRun();
  const first=RunFlow.recoverCommonTerminalChoice(run);
  assert.equal(first.recovered,true);
  assert.equal(first.next,'region_choice');
  assert.equal(run.runFlow.phase,'region_choice');
  assert.equal(run.runFlow.choiceRound,1);
  assert.deepEqual(new Set(run.runFlow.pendingRegionOfferIds),new Set(RunFlow.regionIds()));
  assert.ok(run.runFlow.history.some(entry=>entry.type==='region_offer'&&entry.reason==='common_terminal_recovery'));

  const second=RunFlow.recoverCommonTerminalChoice(run);
  assert.equal(second.recovered,false);
  assert.equal(run.runFlow.choiceRound,1,'맵 재렌더로 지역 선택 라운드가 중복 증가하면 안 된다');
});

test('공통지역 마지막 엘리트가 미완료면 복구하지 않는다',()=>{
  const run=stuckCommonRun();
  const terminal=run.map.find(node=>node.next.length===0);
  run.completed.delete(terminal.id);
  run.available.add(terminal.id);
  const result=RunFlow.recoverCommonTerminalChoice(run);
  assert.equal(result.recovered,false);
  assert.equal(run.runFlow.phase,'common');
  assert.equal(run.runFlow.choiceRound,0);
});

test('renderMap 래퍼는 막힌 공통지역 저장을 그리는 순간 지역 선택 모달을 다시 연다',()=>{
  const run=stuckCommonRun(),calls=[];
  const root={
    run,
    renderMap(){calls.push('render')},
    showModal(html){calls.push(html)},
    document:{getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}}
  };
  assert.equal(RunFlow.wrapRenderMap(root),true);
  root.renderMap();
  assert.equal(run.runFlow.phase,'region_choice');
  assert.equal(calls[0],'render');
  assert.ok(calls.some(value=>typeof value==='string'&&value.includes('지역 선택')));
});

test('첫 일반지역 보스가 완료됐는데 phase=region에 남으면 두 번째 지역 선택으로 복구한다',()=>{
  const run=stuckRegionRun('region_theater'),result=RunFlow.recoverRegionTerminalTransition(run,{runtimeRoot:runtime()});
  assert.equal(result.recovered,true);
  assert.equal(result.next,'region_choice');
  assert.equal(run.runFlow.phase,'region_choice');
  assert.deepEqual(run.runFlow.completedRegionIds,['region_theater']);
  assert.equal(run.runFlow.pendingRegionOfferIds.length,2);
  assert.ok(!run.runFlow.pendingRegionOfferIds.includes('region_theater'));
  assert.equal(run.currentNodeId,null);
  assert.equal(run.runComplete,false);
});

test('보상 마켓 종료 기록만 남고 보스 완료 플래그가 누락돼도 지역 완료를 복원한다',()=>{
  const run=stuckRegionRun('region_theater',{rewardOnly:true}),boss=run.map.find(node=>node.type==='boss');
  assert.equal(run.completed.has(boss.id),false);
  const result=RunFlow.recoverRegionTerminalTransition(run,{runtimeRoot:runtime()});
  assert.equal(result.recovered,true);
  assert.equal(result.rewardRecovered,true);
  assert.equal(run.completed.has(boss.id),true);
  assert.equal(run.available.has(boss.id),false);
  assert.equal(run.runFlow.phase,'region_choice');
});

test('두 번째 일반지역 보스의 끊긴 완료 상태는 STAGE 7 최종 관문으로 복구한다',()=>{
  const run=stuckRegionRun('region_observatory',{visited:['region_theater','region_observatory'],completedRegions:['region_theater']}),result=RunFlow.recoverRegionTerminalTransition(run,{runtimeRoot:runtime()});
  assert.equal(result.recovered,true);
  assert.equal(result.next,'gateway');
  assert.equal(run.actId,'gateway');
  assert.equal(run.runStage,7);
  assert.equal(run.runFlow.phase,'gateway');
  assert.deepEqual(run.runFlow.completedRegionIds,['region_theater','region_observatory']);
  assert.equal(run.runComplete,false);
});

test('맵 상단 고정 잔광 구역 제목은 실제 현재 지역 이름으로 동기화한다',()=>{
  const run=stuckRegionRun('region_theater'),logo={innerHTML:''},badge={innerHTML:'',title:''},grid={dataset:{}},doc={
    getElementById(id){if(id==='mapActBadge')return badge;if(id==='mapGrid')return grid;return null},
    querySelector(selector){return selector==='#mapScreen .topbar .logo'?logo:null},
    querySelectorAll(){return[]}
  };
  RunFlow.decorateMap({run,document:doc});
  assert.match(logo.innerHTML,/유랑극장/);
  assert.doesNotMatch(logo.innerHTML,/잔광 구역/);
});

test('지역 선택 상태는 이전 actId보다 우선해 맵 상단에 지역 선택으로 표시한다',()=>{
  const run=stuckRegionRun('region_theater'),logo={innerHTML:''},badge={innerHTML:'',title:''},grid={dataset:{}},doc={
    getElementById(id){if(id==='mapActBadge')return badge;if(id==='mapGrid')return grid;return null},
    querySelector(selector){return selector==='#mapScreen .topbar .logo'?logo:null},
    querySelectorAll(){return[]}
  };
  run.runFlow.phase='region_choice';run.runFlow.pendingRegionOfferIds=['region_observatory','region_frontier'];
  RunFlow.decorateMap({run,document:doc});
  assert.match(logo.innerHTML,/지역 선택/);
  assert.doesNotMatch(logo.innerHTML,/유랑극장/);
  assert.equal(badge.innerHTML,'지역 선택');
});

test('renderMap 래퍼는 첫 지역 보스가 막힌 저장을 그리면 두 번째 지역 선택 모달을 연다',()=>{
  const run=stuckRegionRun('region_theater',{rewardOnly:true}),calls=[],root={...runtime(),run,renderMap(){calls.push('render')},showModal(html){calls.push(html)},document:{getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}}};
  assert.equal(RunFlow.wrapRenderMap(root),true);
  root.renderMap();
  assert.equal(run.runFlow.phase,'region_choice');
  assert.ok(calls.some(value=>typeof value==='string'&&value.includes('지역 선택')));
});
