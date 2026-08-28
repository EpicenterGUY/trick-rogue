const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const RunResults=require('../run-results.js');

function sampleRun(){
  return{
    runSeed:1234,runComplete:true,actId:'act2',actIndex:2,actName:'액트 2',
    actHistory:[{actId:'act1',actIndex:1,completed:['a','b']}],completed:new Set(['c','d','e']),
    routeHistory:[{},{},{},{},{}],hp:17,maxHp:60,gold:91,
    deck:[{named:{name:'네임드'},effects:[{trigger:'on_play'}]},{definition:{effects:[{trigger:'on_play'}]}},{suit:'S',rank:2}],
    relics:[{id:'r1'},{id:'r2'}],contracts:['c1'],taboos:['t1','t2'],fieldLoadout:{activeFieldId:'f1'},
    actMapHistory:[{actId:'act1',variantId:'v1',actSeed:11},{actId:'act2',variantId:'v2',actSeed:22}]
  };
}

const runtime={
  BuildSynergySystem:{synergySummary(){return{count:2}}},
  RunFields:{fieldDefinition(id){return id==='f1'?{id,label:'공명 바닥'}:null}}
};

test('7-4 런 결과 요약은 진행·덱·빌드·시드 정보를 한 모델로 모은다',()=>{
  assert.equal(RunResults.STAGE,'7-4');
  const summary=RunResults.buildRunSummary(sampleRun(),{outcome:'clear',runtimeRoot:runtime});
  assert.equal(summary.version,'7-4');
  assert.equal(summary.outcome,'clear');
  assert.equal(summary.victory,true);
  assert.equal(summary.actsCompleted,2);
  assert.equal(summary.nodesCompleted,5);
  assert.equal(summary.routeLength,5);
  assert.deepEqual([summary.deckSize,summary.namedCards,summary.effectCards],[3,1,2]);
  assert.deepEqual([summary.relics,summary.contracts,summary.taboos,summary.synergies],[2,1,2,2]);
  assert.equal(summary.activeFieldLabel,'공명 바닥');
  assert.equal(summary.runSeed,1234);
  assert.deepEqual(summary.mapHistory.map(entry=>entry.variantId),['v1','v2']);
});

test('런 결과 기록은 같은 결과를 중복 적재하지 않는다',()=>{
  const run=sampleRun();
  const first=RunResults.recordRunResult(run,'clear',{runtimeRoot:runtime});
  const second=RunResults.recordRunResult(run,'clear',{runtimeRoot:runtime});
  assert.equal(first,second);
  assert.equal(run.runResultHistory.length,1);
  assert.equal(run.runResult.step,1);
});

test('패배 요약은 현재 미완료 액트를 완료 액트 수에 더하지 않는다',()=>{
  const run=sampleRun();run.runComplete=false;
  const summary=RunResults.buildRunSummary(run,{outcome:'defeat',runtimeRoot:runtime});
  assert.equal(summary.cleared,false);
  assert.equal(summary.victory,false);
  assert.equal(summary.actsCompleted,1);
  assert.equal(summary.nodesCompleted,5);
});

test('액트 전환 모델은 이전 액트 완료량과 다음 액트 상태를 보존한다',()=>{
  const run={actId:'act2',actIndex:2,actName:'액트 2',hp:40,maxHp:60,gold:77,actHistory:[{actId:'act1',actIndex:1,completed:['n0','n1','n5','n6']}]};
  const model=RunResults.transitionModel(run,{transitioned:true,fromActId:'act1',nextActId:'act2'});
  assert.deepEqual(model,{version:'7-4',fromActId:'act1',fromActIndex:1,fromCompletedNodes:4,nextActId:'act2',nextActIndex:2,nextActName:'액트 2',hp:40,maxHp:60,gold:77});
  const html=RunResults.transitionHtml(model);
  assert.match(html,/액트 1 클리어/);
  assert.match(html,/다음 · 액트 2/);
  assert.match(html,/경로 4개/);
});

test('finishRun 어댑터는 기존 프로토타입 종료창 대신 공통 런 결과를 표시한다',()=>{
  const calls=[];const root={run:sampleRun(),BuildSynergySystem:runtime.BuildSynergySystem,RunFields:runtime.RunFields,finishRun(){calls.push('legacy')},showModal(html){calls.push(html)}};
  RunResults.wrapFinishRun(root);
  const result=root.finishRun();
  assert.equal(result.outcome,'clear');
  assert.equal(result.victory,true);
  assert.equal(calls.includes('legacy'),false);
  assert.match(calls.at(-1),/런 클리어/);
  assert.equal(root.run.runResultHistory.length,1);
});

test('loseRun 어댑터는 기존 패배 처리를 유지한 뒤 같은 결과 요약으로 교체한다',()=>{
  const calls=[];const run=sampleRun();run.runComplete=false;
  const root={run,BuildSynergySystem:runtime.BuildSynergySystem,RunFields:runtime.RunFields,loseRun(){calls.push('legacy-defeat')},showModal(html){calls.push(html)}};
  RunResults.wrapLoseRun(root);
  const result=root.loseRun();
  assert.equal(calls[0],'legacy-defeat');
  assert.equal(result.outcome,'defeat');
  assert.equal(result.victory,false);
  assert.match(calls.at(-1),/런 종료/);
  assert.equal(run.runResult.outcome,'defeat');
  assert.equal(run.runResult.victory,false);
});

test('completeNode 어댑터는 실제 액트 전환 뒤 다음 액트 안내창을 띄운다',()=>{
  const calls=[];const root={run:{actId:'act1',actIndex:1,actName:'액트 1',hp:30,maxHp:50,gold:20,actHistory:[]},showModal(html){calls.push(html)},completeNode(){this.run.actHistory.push({actId:'act1',actIndex:1,completed:['a','b']});this.run.actId='act2';this.run.actIndex=2;this.run.actName='액트 2';return{ok:true,transitioned:true,fromActId:'act1',nextActId:'act2'}}};
  RunResults.wrapCompleteNode(root);
  const result=root.completeNode({id:'boss'});
  assert.equal(result.transitioned,true);
  assert.match(calls.at(-1),/액트 1 클리어/);
  assert.match(calls.at(-1),/다음 · 액트 2/);
});

test('beginRun 어댑터는 새 런의 이전 결과 기록을 비운다',()=>{
  const root={run:null,beginRun(){this.run={runResult:{old:true},runResultHistory:[{old:true}]}}};
  RunResults.wrapBeginRun(root);root.beginRun();
  assert.equal(root.run.runResult,null);
  assert.deepEqual(root.run.runResultHistory,[]);
});

test('7-4 런타임은 맵 생성 뒤, 전투 레이아웃 전에 로드된다',()=>{
  const bootstrap=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(bootstrap,/function loadRunResults\(\)/);
  assert.match(bootstrap,/run-results\.js/);
  assert.match(bootstrap,/trick-run-results-runtime/);
  assert.match(bootstrap,/function loadRunMapGeneration\(\)\{[\s\S]*?loadRunResults\(\)/);
  assert.match(bootstrap,/function loadRunResults\(\)\{[\s\S]*?loadBattleLayout\(\)/);
});
