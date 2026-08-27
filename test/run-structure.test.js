const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const RunStructure=require('../run-structure.js');

function customRegistry(){
  return{
    a1:{id:'a1',index:1,name:'테스트 액트 1',entryNodeIds:['a0'],nextActId:'a2',nodes:[
      {id:'a0',type:'battle',lane:0,row:0,next:['a1']},
      {id:'a1',type:'boss',lane:0,row:1,next:[]}
    ]},
    a2:{id:'a2',index:2,name:'테스트 액트 2',entryNodeIds:['b0'],nextActId:null,nodes:[
      {id:'b0',type:'boss',lane:0,row:0,next:[]}
    ]}
  };
}

test('RUN V3은 기존 액트 1 노드를 유지하면서 전체 액트 DAG를 검증한다',()=>{
  assert.equal(RunStructure.STAGE,'RUN-V3');
  assert.deepEqual(RunStructure.validateActRegistry(),[]);
  const act=RunStructure.ACT_DEFINITIONS.act1;
  assert.equal(act.index,1);
  assert.equal(act.name,'액트 1');
  assert.deepEqual(act.entryNodeIds,['n0']);
  assert.equal(act.nextActId,null);
  assert.deepEqual(act.nodes.map(node=>[node.id,node.type,node.lane,node.row,[...node.next]]),[
    ['n0','battle',1,0,['n1','n2']],
    ['n1','event',0,1,['n3']],
    ['n2','battle',2,1,['n4']],
    ['n3','camp',0,2,['n5']],
    ['n4','shop',2,2,['n5']],
    ['n5','elite',1,3,['n6']],
    ['n6','boss',1,4,[]]
  ]);
});

test('액트 맵 생성은 정의를 복제해서 런타임 수정이 원본 데이터에 역류하지 않는다',()=>{
  const first=RunStructure.createActMap('act1'),second=RunStructure.createActMap('act1');
  first[0].next.push('mutated');first[0].lane=99;
  assert.deepEqual(second[0],{id:'n0',type:'battle',lane:1,row:0,next:['n1','n2']});
  assert.equal(RunStructure.ACT_DEFINITIONS.act1.nodes[0].lane,1);
});

test('등록된 네 지역은 각각 두 내부 분기 메타데이터를 가진다',()=>{
  assert.deepEqual(Object.keys(RunStructure.REGION_BRANCHES),['region_theater','region_observatory','region_frontier','region_casino']);
  for(const [regionId,branches] of Object.entries(RunStructure.REGION_BRANCHES)){
    assert.equal(branches.length,2);assert.equal(new Set(branches.map(branch=>branch.id)).size,2);
    const map=RunStructure.createActMap(regionId),entries=map.filter(node=>node.branchEntry);
    assert.equal(entries.length,2);assert.deepEqual(new Set(entries.map(node=>node.branchId)),new Set(branches.map(branch=>branch.id)));
  }
  assert.deepEqual(RunStructure.REGION_BRANCHES.region_casino.map(branch=>branch.label),['VIP 룸','지하 도박장']);
});

test('최종 관문은 별도 지역이 아닌 보스 없는 결산용 분기 액트로 존재한다',()=>{
  const gateway=RunStructure.ACT_DEFINITIONS.gateway;
  assert.equal(gateway.name,'최종 관문');assert.equal(gateway.requiresBoss,false);assert.equal(gateway.nodes.some(node=>node.type==='boss'),false);assert.equal(gateway.nodes.at(-1).next.length,0);
});

test('새 런 진행 상태는 액트 메타데이터와 시작 노드 하나만 연다',()=>{
  const progress=RunStructure.createActProgress('act1');
  assert.equal(progress.actId,'act1');assert.equal(progress.actIndex,1);assert.equal(progress.map.length,7);assert.deepEqual([...progress.available],['n0']);assert.deepEqual([...progress.completed],[]);assert.equal(progress.currentNodeId,null);assert.equal(progress.runComplete,false);
});

test('노드 진입과 완료는 현재 경로 상태를 기록하고 기존 다음 노드 해금 규칙을 보존한다',()=>{
  const run={hp:50,deck:['keep']};RunStructure.applyActToRun(run,'act1',{recordPrevious:false});
  assert.equal(RunStructure.markNodeEntered(run,'n0'),true);assert.equal(run.currentNodeId,'n0');
  let result=RunStructure.completeNodeProgress(run,'n0');assert.equal(result.ok,true);assert.equal(result.actComplete,false);assert.deepEqual([...run.completed],['n0']);assert.deepEqual([...run.available],['n1','n2']);assert.equal(run.lastCompletedNodeId,'n0');assert.equal(run.currentNodeId,null);assert.equal(run.hp,50);assert.deepEqual(run.deck,['keep']);
  RunStructure.markNodeEntered(run,'n1');RunStructure.completeNodeProgress(run,'n1');assert.deepEqual([...run.available],['n2','n3'],'기존처럼 아직 선택 가능한 형제 노드는 강제로 닫지 않는다');
});

test('잠긴 노드와 이미 끝난 노드는 다시 진행할 수 없다',()=>{
  const run=RunStructure.createActProgress('act1');assert.equal(RunStructure.markNodeEntered(run,'n3'),false);assert.equal(RunStructure.completeNodeProgress(run,'n3').reason,'node_locked');RunStructure.completeNodeProgress(run,'n0');assert.equal(RunStructure.completeNodeProgress(run,'n0').reason,'already_completed');
});

test('마지막 보스는 현재 액트에 다음 액트가 없을 때만 런 완료를 보고한다',()=>{
  const run=RunStructure.createActProgress('act1');for(const id of ['n0','n1','n3','n5']){run.available.add(id);RunStructure.completeNodeProgress(run,id)}run.available.add('n6');const result=RunStructure.completeNodeProgress(run,'n6');assert.equal(result.actComplete,true);assert.equal(result.runComplete,true);assert.equal(result.transitioned,false);assert.equal(run.runComplete,true);assert.equal(run.actId,'act1');
});

test('보스가 아닌 최종 관문 마지막 노드도 액트 완료 상태를 보고하되 런을 끝내지 않는다',()=>{
  const run=RunStructure.createActProgress('gateway');const last=run.map.at(-1);run.available=new Set([last.id]);const result=RunStructure.completeNodeProgress(run,last);assert.equal(result.ok,true);assert.equal(result.actComplete,true);assert.equal(result.runComplete,false);assert.equal(run.runComplete,false);
});

test('다음 액트가 데이터에 추가되면 보스 완료만으로 새 액트 상태로 전환할 수 있다',()=>{
  const registry=customRegistry();assert.deepEqual(RunStructure.validateActRegistry(registry),[]);const run={gold:77};RunStructure.applyActToRun(run,'a1',{registry,recordPrevious:false});RunStructure.completeNodeProgress(run,'a0',{registry});const result=RunStructure.completeNodeProgress(run,'a1',{registry});assert.equal(result.transitioned,true);assert.equal(result.runComplete,false);assert.equal(result.nextActId,'a2');assert.equal(run.actId,'a2');assert.equal(run.actIndex,2);assert.deepEqual([...run.available],['b0']);assert.deepEqual([...run.completed],[]);assert.equal(run.gold,77);assert.equal(run.actHistory.length,1);assert.equal(run.actHistory[0].actId,'a1');
});

test('브라우저 어댑터는 beginRun의 레거시 맵을 액트 데이터로 교체하고 완료/렌더 흐름을 연결한다',()=>{
  const calls=[];const root={run:null,beginRun(){this.run={hp:9,map:[{id:'legacy'}],available:new Set(['legacy']),completed:new Set()};calls.push('begin')},enterNode(node){calls.push(`enter:${node.id}`)},completeNode(node){calls.push(`legacy-complete:${node.id}`)},renderMap(){calls.push('render')},closeOverlay(){calls.push('close')},showScreen(id){calls.push(`screen:${id}`)},finishRun(){calls.push('finish')}};
  RunStructure.wrapRenderMap(root);RunStructure.wrapBeginRun(root);RunStructure.wrapEnterNode(root);RunStructure.wrapCompleteNode(root);root.beginRun();assert.equal(root.run.actId,'act1');assert.equal(root.run.map[0].id,'n0');assert.ok(calls.filter(value=>value==='render').length>=1);root.enterNode(root.run.map[0]);assert.equal(root.run.currentNodeId,'n0');root.completeNode(root.run.map[0]);assert.ok(calls.includes('close'));assert.ok(calls.includes('screen:mapScreen'));assert.equal(calls.some(value=>value.startsWith('legacy-complete')),false);
});

test('런 구조 런타임은 맵 HUD 액트 표시를 유지하고 동적 로더에 연결된다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','run-structure.js'),'utf8'),bootstrap=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');assert.match(source,/mapActBadge/);assert.match(source,/wrapBeginRun/);assert.match(source,/wrapCompleteNode/);assert.match(bootstrap,/run-structure\.js/);assert.match(bootstrap,/trick-run-structure-runtime/);
});
