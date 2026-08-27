const test=require('node:test');
const assert=require('node:assert/strict');
const RunStructure=require('../run-structure.js');
const RunFlow=require('../run-flow-v2.js');
const SystemTags=require('../card-system-tags.js');

function runtime(){
  return{
    RunStructure,
    RunPaths:{ensurePathState(run){run.routeState={actId:run.actId};return run.routeState}},
    RunMapGeneration:{applyGeneratedActMap(run,actId){run.map=RunStructure.createActMap(actId);return{actId,generated:false}}},
    RunEvents:{handleRunHook(){return[]}}
  };
}

test('M9 폐품 시장 추가 후 일반지역은 6종이고 한 런 방문 목표는 여전히 2곳이다',()=>{
  assert.equal(RunFlow.regionIds().length,6);
  assert.ok(RunFlow.regionIds().includes('region_scrap_market'));
  assert.equal(RunFlow.REGION_VISIT_TARGET,2);
});

test('폐품 시장은 해체장 / 재조립소 두 내부 분기를 가진다',()=>{
  const branches=RunStructure.REGION_BRANCHES.region_scrap_market;
  assert.ok(Array.isArray(branches));
  assert.deepEqual(branches.map(branch=>branch.id),['dismantling_yard','reassembly_shop']);
  assert.deepEqual(branches.map(branch=>branch.label),['해체장','재조립소']);
});

test('폐품 시장 액트는 s0~s6 7노드와 터미널 보스를 가진다',()=>{
  const act=RunStructure.ACT_DEFINITIONS.region_scrap_market;
  assert.ok(act);
  assert.deepEqual(act.nodes.map(node=>node.id),['s0','s1','s2','s3','s4','s5','s6']);
  assert.equal(act.nodes.length,7);
  assert.equal(act.nodes.at(-1).type,'boss');
  assert.deepEqual(act.nodes.at(-1).next,[]);
  assert.equal(act.nodes.filter(node=>node.branchEntry).length,2);
  assert.deepEqual(RunStructure.validateActDefinition(act,'region_scrap_market'),[]);
});

test('폐품 시장 프로필은 공용 65 / 테마 35 보상과 유효한 적·이벤트 가중치를 가진다',()=>{
  const profile=RunFlow.REGION_PROFILES.region_scrap_market;
  assert.ok(profile);
  assert.equal(profile.name,'폐품 시장');
  assert.equal(profile.systems,'순수 · 손패 · 변환 · 덱 재구성');
  assert.deepEqual(profile.rewardWeights,{neutral:.65,theme:.35});
  assert.equal(Number(RunFlow.weightTotal(profile.enemyWeights).toFixed(6)),1);
  assert.equal(Number(RunFlow.weightTotal(profile.eventWeights).toFixed(6)),1);
  assert.match(RunFlow.regionOptionHtml(profile),/폐품 시장/);
  assert.match(RunFlow.regionOptionHtml(profile),/공용 65% \/ 지역 35%/);
});

test('폐품 시장 보상은 새 태그 없이 기존 M6 14태그만 사용한다',()=>{
  assert.equal(SystemTags.TAGS.length,14);
  assert.equal(new Set(SystemTags.TAGS).size,14);
  assert.deepEqual(SystemTags.REGION_REWARD_TAGS.region_scrap_market,['족보','손패','쇼다운 개입','적용값 증가','적용값 감소']);
  assert.ok(SystemTags.REGION_REWARD_TAGS.region_scrap_market.every(tag=>SystemTags.TAGS.includes(tag)));
});

test('공통지역 뒤 첫 지역 선택은 6곳을 모두 제시하고 첫 방문 뒤 두 번째 선택은 5곳을 제시한다',()=>{
  const root=runtime(),run={runSeed:606,runFlow:RunFlow.createFlowState()};
  let offers=RunFlow.beginRegionChoice(run,{reason:'test'});
  assert.equal(offers.length,6);
  assert.deepEqual(new Set(offers),new Set(RunFlow.regionIds()));
  const chosen=RunFlow.chooseRegion(run,'region_scrap_market',{runtimeRoot:root});
  assert.equal(chosen.ok,true);
  assert.equal(run.actId,'region_scrap_market');
  assert.equal(run.runStage,2);
  const boss=run.map.find(node=>node.type==='boss');
  run.available=new Set([boss.id]);
  run.currentNodeId=boss.id;
  const result=RunFlow.completeRegionBoss(run,boss,{runtimeRoot:root});
  assert.equal(result.next,'region_choice');
  offers=run.runFlow.pendingRegionOfferIds;
  assert.equal(offers.length,5);
  assert.ok(!offers.includes('region_scrap_market'));
});
