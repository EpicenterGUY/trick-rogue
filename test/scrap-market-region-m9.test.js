const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const RunStructure=require('../run-structure.js');
const RunFlow=require('../run-flow-v2.js');
const SystemTags=require('../card-system-tags.js');
const Scrap=require('../scrap-market-region-m9.js');

const ROOT=path.join(__dirname,'..');
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

test('폐품 시장 전투 콘텐츠는 일반 적 3종·엘리트 1종·지역 보스 1종이며 규칙 검증을 통과한다',()=>{
  assert.equal(Scrap.STAGE,'M9-SCRAP-MARKET-1');
  assert.equal(Scrap.REGION_ID,'region_scrap_market');
  assert.deepEqual(Scrap.validateContent(),[]);
  const entries=Object.values(Scrap.CONTENT);
  assert.equal(entries.filter(entry=>entry.type==='battle').length,3);
  assert.equal(entries.filter(entry=>entry.type==='elite').length,1);
  assert.equal(entries.filter(entry=>entry.type==='boss').length,1);
  assert.deepEqual(entries.filter(entry=>entry.type==='battle').map(entry=>entry.id),['scrap_scavenger','patchwork_mechanic','scrap_hoarder']);
  assert.equal(entries.find(entry=>entry.type==='elite').id,'dismantling_foreman');
  assert.equal(entries.find(entry=>entry.type==='boss').id,'junkyard_engine');
});

test('폐품 시장 적 태그는 해체·개조·수집 적과 엘리트·보스로 연결된다',()=>{
  const run={actId:'region_scrap_market',runFlow:{currentRegionId:'region_scrap_market'}};
  const battle=tag=>({id:`s-${tag}`,type:'battle',regionPlan:{regionId:'region_scrap_market',enemyTag:tag}});
  assert.equal(Scrap.contentIdForNode(battle('salvager'),run),'scrap_scavenger');
  assert.equal(Scrap.contentIdForNode(battle('modifier'),run),'patchwork_mechanic');
  assert.equal(Scrap.contentIdForNode(battle('hoarder'),run),'scrap_hoarder');
  assert.equal(Scrap.contentIdForNode(battle('standard'),run),'patchwork_mechanic');
  assert.equal(Scrap.contentIdForNode({id:'s5',type:'elite',regionPlan:{regionId:'region_scrap_market'}},run),'dismantling_foreman');
  assert.equal(Scrap.contentIdForNode({id:'s6',type:'boss',regionPlan:{regionId:'region_scrap_market'}},run),'junkyard_engine');
});

test('폐품 압축 코어는 분류 → 압축 → 과열 3단계로 전환한다',()=>{
  const boss=Scrap.CONTENT.junkyard_engine;
  assert.deepEqual(boss.phases.map(phase=>phase.id),['sorting','compression','overheat']);
  assert.deepEqual(boss.phases.map(phase=>phase.minHpRatio),[.66,.33,0]);
  assert.equal(Scrap.phaseFor(boss,.9).id,'sorting');
  assert.equal(Scrap.phaseFor(boss,.5).id,'compression');
  assert.equal(Scrap.phaseFor(boss,.2).id,'overheat');
  const state={node:{enemyContentId:'junkyard_engine'},enemy:{hp:20,maxHp:100},bossRules:[]};
  const synced=Scrap.syncContentEncounter(state);
  assert.equal(synced.phase.id,'overheat');
  assert.equal(state.bossRules.length,1);
  assert.equal(state.bossRules[0].scrapMarketM9Managed,true);
  assert.deepEqual(state.bossRules[0].effects.map(effect=>effect.value.statusId),['vulnerable','bleed']);
});

test('폐품 시장 이벤트 4종은 해체·재조립·위험·공용 성향을 각각 가진다',()=>{
  const events=Object.values(Scrap.EVENT_DEFINITIONS);
  assert.equal(events.length,4);
  assert.deepEqual(new Set(events.map(event=>event.eventTag)),new Set(['salvage','rebuild','risk','general']));
  assert.deepEqual(events.map(event=>event.id),['salvage_line','reassembly_bench','unstable_compactor','spare_parts_bin']);
  for(const event of events){assert.equal(event.choices.length,2,event.id);assert.match(Scrap.scrapMarketEventHtml(event),new RegExp(`data-scrap-market-m9-event=\\"${event.id}\\"`))}
});

test('해체 이벤트는 가장 낮은 카드만 제거하고 덱 한 장은 보호한다',()=>{
  const node={id:'s1',type:'event',regionPlan:{regionId:'region_scrap_market',eventTag:'salvage'}},completed=[];
  const run={actId:'region_scrap_market',runFlow:{currentRegionId:'region_scrap_market'},gold:0,deck:[{uid:'high',rank:12},{uid:'low',rank:3},{uid:'mid',rank:7}],scrapMarketM9:{activeEvent:{eventId:'salvage_line',nodeId:'s1'},eventHistory:[]}};
  const result=Scrap.chooseScrapMarketEvent(run,node,'dismantle',{runtimeRoot:{completeNode(current){completed.push(current.id)},sfx(){}}});
  assert.equal(result.ok,true);assert.deepEqual(run.deck.map(card=>card.uid),['high','mid']);assert.equal(run.gold,22);assert.deepEqual(completed,['s1']);
  const protectedRun={deck:[{uid:'only',rank:2}]};const action=Scrap.applyEventAction(protectedRun,node,Scrap.EVENT_DEFINITIONS.salvage_line,Scrap.EVENT_DEFINITIONS.salvage_line.choices[0],{type:'remove_lowest'});
  assert.equal(action.ok,false);assert.equal(action.reason,'deck_minimum');assert.equal(protectedRun.deck.length,1);
});

test('재조립 이벤트는 가장 낮은 카드 한 장만 강화한다',()=>{
  const node={id:'s1',type:'event',regionPlan:{regionId:'region_scrap_market',eventTag:'rebuild'}},completed=[];
  const run={actId:'region_scrap_market',runFlow:{currentRegionId:'region_scrap_market'},deck:[{uid:'high',rank:11},{uid:'low',rank:2},{uid:'mid',rank:6}],scrapMarketM9:{activeEvent:{eventId:'reassembly_bench',nodeId:'s1'},eventHistory:[]}};
  const result=Scrap.chooseScrapMarketEvent(run,node,'reinforce',{runtimeRoot:{completeNode(current){completed.push(current.id)},sfx(){}}});
  assert.equal(result.ok,true);assert.equal(run.deck[1].upgradeLevel,1);assert.equal(run.deck[0].upgradeLevel,undefined);assert.deepEqual(completed,['s1']);
});

test('브라우저 로더는 붉은 병동 뒤 폐품 시장을 적재한 다음 경제 체인으로 진행한다',()=>{
  const source=fs.readFileSync(path.join(ROOT,'enemy-behavior.js'),'utf8');
  const scrapStart=source.indexOf('function loadScrapMarketRegionM9()'),redWardStart=source.indexOf('function loadRedWardRegionM9()'),economyStart=source.indexOf('function loadRunEconomyV2()');
  assert.ok(economyStart>=0&&scrapStart>economyStart&&redWardStart>scrapStart);
  const scrapLoader=source.slice(scrapStart,redWardStart),redWardLoader=source.slice(redWardStart,source.indexOf('function loadCasinoRegionM9()'));
  assert.match(scrapLoader,/loadScript\('scrap-market-region-m9\.js','trick-scrap-market-region-m9-runtime'\)/);
  assert.match(scrapLoader,/loadRunEconomyV2\(\)/);
  assert.match(redWardLoader,/loadScrapMarketRegionM9\(\)/);
});
