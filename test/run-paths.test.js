const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const RunStructure=require('../run-structure.js');
global.RunStructure=RunStructure;
const RunPaths=require('../run-paths.js');

function branchingRegistry(){
  return{
    a1:{id:'a1',index:1,name:'분기 액트',entryNodeIds:['a0'],nextActId:'a2',nodes:[
      {id:'a0',type:'battle',lane:1,row:0,next:['a1','a2']},
      {id:'a1',type:'event',lane:0,row:1,next:['a3']},
      {id:'a2',type:'shop',lane:2,row:1,next:['a3']},
      {id:'a3',type:'boss',lane:1,row:2,next:[]}
    ]},
    a2:{id:'a2',index:2,name:'다음 액트',entryNodeIds:['b0'],nextActId:null,nodes:[
      {id:'b0',type:'boss',lane:1,row:0,next:[]}
    ]}
  };
}

test('7-2는 노드 진입 순간 분기를 확정하는 경로 정책을 사용한다',()=>{
  assert.equal(RunPaths.STAGE,'7-2');
  assert.equal(RunPaths.PATH_POLICY,'commit_on_enter');
  const run=RunStructure.createActProgress('act1');
  const state=RunPaths.ensurePathState(run);
  assert.equal(state.policy,'commit_on_enter');
  assert.deepEqual(state.skippedNodeIds,[]);
  assert.deepEqual(state.pathNodeIds,[]);
  assert.deepEqual(run.routeHistory,[]);
});

test('왼쪽 분기를 고르면 형제 노드와 그 전용 후속 노드가 잠기고 합류점은 남는다',()=>{
  const run=RunStructure.createActProgress('act1');
  RunPaths.completePathNode(run,'n0');
  assert.deepEqual([...run.available],['n1','n2']);
  const preview=RunPaths.previewPathChoice(run,'n1');
  assert.deepEqual(preview.peerNodeIds,['n2']);
  assert.deepEqual(preview.closedNodeIds,['n2','n4']);
  const result=RunPaths.completePathNode(run,'n1');
  assert.equal(result.ok,true);
  assert.deepEqual([...run.available],['n3']);
  assert.deepEqual(RunPaths.ensurePathState(run).skippedNodeIds,['n2','n4']);
  assert.equal(RunPaths.ensurePathState(run).skippedNodeIds.includes('n5'),false,'공통 합류 엘리트는 잠그지 않는다');
  assert.equal(RunPaths.ensurePathState(run).skippedNodeIds.includes('n6'),false,'공통 보스는 잠그지 않는다');
});

test('오른쪽 분기를 고르면 반대편 이벤트·캠프 경로가 영구 잠긴다',()=>{
  const run=RunStructure.createActProgress('act1');
  RunPaths.completePathNode(run,'n0');
  RunPaths.completePathNode(run,'n2');
  assert.deepEqual([...run.available],['n4']);
  assert.deepEqual(RunPaths.ensurePathState(run).skippedNodeIds,['n1','n3']);
  assert.equal(RunStructure.canEnterNode(run,'n1'),false);
  assert.equal(RunStructure.completeNodeProgress(run,'n1').reason,'node_locked');
});

test('경로 선택 기록은 실제 진행 순서와 닫힌 분기를 남긴다',()=>{
  const run=RunStructure.createActProgress('act1');
  RunPaths.completePathNode(run,'n0');
  RunPaths.completePathNode(run,'n1');
  RunPaths.completePathNode(run,'n3');
  const summary=RunPaths.pathSummary(run);
  assert.deepEqual(summary.pathNodeIds,['n0','n1','n3']);
  assert.equal(summary.pathLength,3);
  assert.deepEqual(summary.skippedNodeIds,['n2','n4']);
  assert.deepEqual(run.routeHistory.map(entry=>entry.nodeId),['n0','n1','n3']);
  assert.deepEqual(run.routeHistory[1].closedNodeIds,['n2','n4']);
});

test('현재 노드를 처리하는 동안 다른 노드로 갈아타는 것은 거부한다',()=>{
  const run=RunStructure.createActProgress('act1');
  RunPaths.completePathNode(run,'n0');
  const commit=RunPaths.commitPathChoice(run,'n1');
  assert.equal(commit.ok,true);
  RunStructure.markNodeEntered(run,'n1');
  const other=RunPaths.commitPathChoice(run,'n2');
  assert.equal(other.ok,false);
  assert.ok(['node_locked','node_in_progress'].includes(other.reason));
});

test('다음 액트로 넘어가면 현재 액트의 스킵 상태는 초기화되고 전체 경로 이력은 유지된다',()=>{
  const registry=branchingRegistry();
  assert.deepEqual(RunStructure.validateActRegistry(registry),[]);
  const run={gold:10};RunStructure.applyActToRun(run,'a1',{registry,recordPrevious:false});
  RunPaths.completePathNode(run,'a0',{registry});
  RunPaths.completePathNode(run,'a1',{registry});
  assert.deepEqual(RunPaths.ensurePathState(run).skippedNodeIds,['a2']);
  const transition=RunPaths.completePathNode(run,'a3',{registry});
  assert.equal(transition.transitioned,true);
  assert.equal(run.actId,'a2');
  assert.deepEqual(RunPaths.ensurePathState(run).skippedNodeIds,[]);
  assert.deepEqual(RunPaths.ensurePathState(run).pathNodeIds,[]);
  assert.deepEqual(run.routeHistory.map(entry=>entry.actId),['a1','a1','a1']);
});

test('브라우저 어댑터는 실제 노드 진입 전에 분기를 잠그고 기존 런 구조 완료 흐름을 보존한다',()=>{
  const calls=[];
  const root={
    RunStructure,run:null,
    beginRun(){this.run={hp:9,map:[{id:'legacy'}],available:new Set(['legacy']),completed:new Set()};calls.push('begin')},
    enterNode(node){calls.push(`enter:${node.id}`)},
    completeNode(node){calls.push(`legacy-complete:${node.id}`)},
    renderMap(){calls.push('render')},
    closeOverlay(){calls.push('close')},showScreen(id){calls.push(`screen:${id}`)},finishRun(){calls.push('finish')}
  };
  RunStructure.wrapRenderMap(root);RunStructure.wrapBeginRun(root);RunStructure.wrapEnterNode(root);RunStructure.wrapCompleteNode(root);
  RunPaths.wrapRenderMap(root);RunPaths.wrapBeginRun(root);RunPaths.wrapEnterNode(root);RunPaths.wrapCompleteNode(root);
  root.beginRun();
  root.enterNode(root.run.map.find(node=>node.id==='n0'));root.completeNode(root.run.map.find(node=>node.id==='n0'));
  root.enterNode(root.run.map.find(node=>node.id==='n1'));
  assert.deepEqual(RunPaths.ensurePathState(root.run).skippedNodeIds,['n2','n4']);
  assert.equal(root.run.available.has('n2'),false);
  assert.equal(root.run.currentNodeId,'n1');
  assert.ok(calls.includes('enter:n1'));
});

test('7-2 런타임은 잠긴 경로 표시를 제공하고 런 구조 뒤 맵 생성 단계 전에 로드된다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','run-paths.js'),'utf8');
  const bootstrap=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/routeSkipped/);
  assert.match(source,/선택하지 않은 경로/);
  assert.match(source,/분기 선택 시 다른 경로 잠금/);
  assert.match(bootstrap,/run-paths\.js/);
  assert.match(bootstrap,/trick-run-paths-runtime/);
  assert.match(bootstrap,/function loadRunStructure\(\)[\s\S]*?loadRunPaths\(\)/);
  assert.match(bootstrap,/function loadRunPaths\(\)[\s\S]*?loadRunMapGeneration\(\)/);
  assert.match(bootstrap,/function loadRunMapGeneration\(\)[\s\S]*?loadBattleLayout\(\)/);
});
