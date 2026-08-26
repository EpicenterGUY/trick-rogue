const test=require('node:test');
const assert=require('node:assert/strict');
const RunStructure=require('../run-structure.js');
const RunFlow=require('../run-flow-v2.js');

function stuckCommonRun(){
  const map=RunStructure.createActMap('common');
  return{
    actId:'common',actIndex:0,actName:'공통지역',runStage:1,
    map,available:new Set(),completed:new Set(map.map(node=>node.id)),
    currentNodeId:null,runFlow:RunFlow.createFlowState()
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
    document:{getElementById(){return null},querySelectorAll(){return[]}}
  };
  assert.equal(RunFlow.wrapRenderMap(root),true);
  root.renderMap();
  assert.equal(run.runFlow.phase,'region_choice');
  assert.equal(calls[0],'render');
  assert.ok(calls.some(value=>typeof value==='string'&&value.includes('지역 선택')));
});
