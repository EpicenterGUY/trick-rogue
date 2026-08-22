const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const RunStructure=require('../run-structure.js');
const RunPaths=require('../run-paths.js');
const RunMapGeneration=require('../run-map-generation.js');

test('7-3은 액트 1에 네 가지 유효한 맵 변형을 제공한다',()=>{
  assert.equal(RunMapGeneration.STAGE,'7-3');
  assert.deepEqual(RunMapGeneration.validateProfiles(),[]);
  const profile=RunMapGeneration.ACT_MAP_PROFILES.act1;
  assert.equal(profile.variants.length,4);
  assert.deepEqual([...profile.mutableNodeIds],['n1','n2','n3','n4']);
  assert.deepEqual(profile.requiredCounts,{battle:2,event:1,camp:1,shop:1,elite:1,boss:1});
});

test('같은 런 시드는 같은 액트 맵을 만들고 생성 결과는 재현 가능하다',()=>{
  const a=RunMapGeneration.generateActMap('act1',{runSeed:123456});
  const b=RunMapGeneration.generateActMap('act1',{runSeed:123456});
  assert.equal(a.variantId,b.variantId);
  assert.equal(a.actSeed,b.actSeed);
  assert.deepEqual(a.map,b.map);
});

test('시드 공간에서는 액트 1의 네 맵 변형이 모두 선택될 수 있다',()=>{
  const ids=new Set();
  for(let seed=0;seed<256;seed++)ids.add(RunMapGeneration.generateActMap('act1',{runSeed:seed}).variantId);
  assert.deepEqual(ids,new Set(RunMapGeneration.ACT_MAP_PROFILES.act1.variants.map(variant=>variant.id)));
});

test('생성 맵은 기존 그래프와 위치를 보존하고 노드 구성만 규칙 안에서 바꾼다',()=>{
  const base=RunStructure.createActMap('act1');
  for(let seed=0;seed<16;seed++){
    const generated=RunMapGeneration.generateActMap('act1',{runSeed:seed});
    assert.deepEqual(RunMapGeneration.validateGeneratedMap('act1',generated.map),[]);
    assert.equal(generated.map.length,7);
    assert.deepEqual(generated.map.map(node=>[node.id,node.lane,node.row,node.next]),base.map(node=>[node.id,node.lane,node.row,node.next]));
    assert.deepEqual(RunMapGeneration.typeCounts(generated.map),{battle:2,event:1,camp:1,shop:1,elite:1,boss:1});
    assert.equal(generated.map.find(node=>node.id==='n0').type,'battle');
    assert.equal(generated.map.find(node=>node.id==='n5').type,'elite');
    assert.equal(generated.map.find(node=>node.id==='n6').type,'boss');
  }
});

test('각 생성 맵은 첫 분기에 이벤트와 전투를 하나씩, 다음 줄에 캠프와 상점을 하나씩 둔다',()=>{
  for(const variant of RunMapGeneration.ACT_MAP_PROFILES.act1.variants){
    const types=variant.assignments;
    assert.deepEqual(new Set([types.n1,types.n2]),new Set(['event','battle']));
    assert.deepEqual(new Set([types.n3,types.n4]),new Set(['camp','shop']));
  }
});

test('런에 생성 맵을 적용하면 시드와 변형 이력을 기록하되 기존 빌드 상태는 보존한다',()=>{
  const run={actId:'act1',actIndex:1,actName:'액트 1',map:RunStructure.createActMap('act1'),available:new Set(['n0']),completed:new Set(),gold:77,relics:['keep'],routeHistory:[{step:1}]};
  const state=RunMapGeneration.applyGeneratedActMap(run,'act1',{seed:'same-run'});
  assert.equal(run.runSeed,RunMapGeneration.hashSeed('same-run'));
  assert.equal(state.version,'7-3');
  assert.ok(state.variantId);
  assert.equal(run.actMapHistory.length,1);
  assert.equal(run.gold,77);assert.deepEqual(run.relics,['keep']);assert.deepEqual(run.routeHistory,[{step:1}]);
  assert.deepEqual([...run.available],['n0']);assert.deepEqual([...run.completed],[]);
  assert.equal(run.routeState.actId,'act1');assert.deepEqual(run.routeState.skippedNodeIds,[]);
});

test('액트 진행이 시작된 뒤에는 다른 시드 요청으로 현재 맵을 재굴림하지 않는다',()=>{
  const run=RunStructure.createActProgress('act1');run.actId='act1';
  RunMapGeneration.applyGeneratedActMap(run,'act1',{seed:11});
  const before=run.map.map(node=>({...node,next:[...node.next]})),variant=run.mapGenerationState.variantId;
  RunStructure.completeNodeProgress(run,'n0');
  const returned=RunMapGeneration.applyGeneratedActMap(run,'act1',{seed:999});
  assert.equal(returned.variantId,variant);
  assert.deepEqual(run.map,before);
  assert.equal(run.runSeed,11);
});

test('7-2 경로 잠금은 생성된 맵에서도 선택하지 않은 분기만 닫고 공통 합류점을 남긴다',()=>{
  const run=RunStructure.createActProgress('act1');run.actId='act1';run.actIndex=1;run.actName='액트 1';
  RunMapGeneration.applyGeneratedActMap(run,'act1',{seed:42});
  RunPaths.ensurePathState(run);
  RunStructure.completeNodeProgress(run,'n0');
  const choice=RunPaths.commitPathChoice(run,'n1');
  assert.equal(choice.ok,true);
  assert.ok(choice.closedNodeIds.includes('n2'));
  assert.ok(choice.closedNodeIds.includes('n4'));
  assert.equal(choice.closedNodeIds.includes('n5'),false);
  assert.equal(choice.closedNodeIds.includes('n6'),false);
});

test('맵 생성 상태는 액트별 파생 시드를 사용해 런 시드 하나로 재현 가능한 액트 순서를 만든다',()=>{
  const runSeed=98765;
  const act1=RunMapGeneration.deriveActSeed(runSeed,'act1');
  const act2=RunMapGeneration.deriveActSeed(runSeed,'act2');
  assert.equal(act1,RunMapGeneration.deriveActSeed(runSeed,'act1'));
  assert.notEqual(act1,act2);
});

test('브라우저 어댑터는 새 런에 실제 생성 맵을 적용하고 렌더에 변형 메타데이터를 남긴다',()=>{
  const calls=[],grid={dataset:{}},badge={title:'액트 1'},doc={getElementById(id){return id==='mapGrid'?grid:id==='mapActBadge'?badge:null}};
  const root={document:doc,run:null,RunStructure,RunPaths,
    beginRun(){this.run=RunStructure.createActProgress('act1');calls.push('begin')},
    completeNode(){calls.push('complete')},
    renderMap(){calls.push('render')}
  };
  root.beginRun.__runPathAdapter=true;root.completeNode.__runPathAdapter=true;root.renderMap.__runPathAdapter=true;
  RunMapGeneration.wrapRenderMap(root);RunMapGeneration.wrapBeginRun(root);
  root.beginRun();
  assert.equal(root.run.mapGenerationState.version,'7-3');
  assert.equal(root.run.actMapHistory.length,1);
  assert.ok(calls.filter(value=>value==='render').length>=1);
  root.renderMap();
  assert.equal(grid.dataset.mapVariant,root.run.mapGenerationState.variantId);
  assert.equal(grid.dataset.runSeed,String(root.run.runSeed));
});

test('7-3 런타임은 경로 규칙 뒤, 7-4 런 결과 단계 전에 로드된다',()=>{
  const bootstrap=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(bootstrap,/function loadRunMapGeneration\(\)/);
  assert.match(bootstrap,/run-map-generation\.js/);
  assert.match(bootstrap,/trick-run-map-generation-runtime/);
  assert.match(bootstrap,/function loadRunPaths\(\)\{[\s\S]*?loadRunMapGeneration\(\)/);
  assert.match(bootstrap,/function loadRunMapGeneration\(\)\{[\s\S]*?loadRunResults\(\)/);
});
