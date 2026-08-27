const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const Casino=require('../casino-region-m9.js');
const RunFlow=require('../run-flow-v2.js');
const RunStructure=require('../run-structure.js');
const CardSystemTags=require('../card-system-tags.js');

const ROOT=path.join(__dirname,'..');

test('M9 침몰 카지노는 일반 적 3종·엘리트 1종·지역 보스 1종을 가진다',()=>{
  assert.equal(Casino.STAGE,'M9-CASINO-1');
  assert.equal(Casino.REGION_ID,'region_casino');
  assert.deepEqual(Casino.validateContent(),[]);
  const entries=Object.values(Casino.CONTENT);
  assert.equal(entries.filter(entry=>entry.type==='battle').length,3);
  assert.equal(entries.filter(entry=>entry.type==='elite').length,1);
  assert.equal(entries.filter(entry=>entry.type==='boss').length,1);
  assert.deepEqual(entries.filter(entry=>entry.type==='battle').map(entry=>entry.id),['casino_lowroller','casino_bluffer','casino_debt_collector']);
  assert.equal(entries.find(entry=>entry.type==='elite').id,'vault_collector');
  assert.equal(entries.find(entry=>entry.type==='boss').id,'drowned_house');
});

test('카지노 노드 태그는 실제 전용 적·엘리트·보스로 연결된다',()=>{
  const run={actId:'region_casino',runFlow:{currentRegionId:'region_casino'}};
  const battle=tag=>({id:`b-${tag}`,type:'battle',regionPlan:{regionId:'region_casino',enemyTag:tag}});
  assert.equal(Casino.contentIdForNode(battle('standard'),run),'casino_lowroller');
  assert.equal(Casino.contentIdForNode(battle('bluffer'),run),'casino_bluffer');
  assert.equal(Casino.contentIdForNode(battle('reverse'),run),'casino_bluffer');
  assert.equal(Casino.contentIdForNode(battle('debt_collector'),run),'casino_debt_collector');
  assert.equal(Casino.contentIdForNode({id:'elite',type:'elite',regionPlan:{regionId:'region_casino'}},run),'vault_collector');
  assert.equal(Casino.contentIdForNode({id:'boss',type:'boss',regionPlan:{regionId:'region_casino'}},run),'drowned_house');
  assert.equal(Casino.contentIdForNode({id:'outside',type:'battle',regionPlan:{regionId:'region_theater'}},{actId:'region_theater'}),null);
});

test('가라앉은 하우스는 체력에 따라 3단계 하우스 규칙으로 전환된다',()=>{
  const boss=Casino.CONTENT.drowned_house;
  assert.deepEqual(boss.phases.map(phase=>phase.id),['open_tables','high_stakes','house_always_wins']);
  assert.deepEqual(boss.phases.map(phase=>phase.minHpRatio),[.66,.33,0]);
  assert.equal(Casino.phaseFor(boss,.9).id,'open_tables');
  assert.equal(Casino.phaseFor(boss,.5).id,'high_stakes');
  assert.equal(Casino.phaseFor(boss,.2).id,'house_always_wins');
  const state={node:{enemyContentId:'drowned_house'},enemy:{hp:20,maxHp:100},bossRules:[]};
  const synced=Casino.syncContentEncounter(state);
  assert.equal(synced.phase.id,'house_always_wins');
  assert.equal(state.bossRules.length,1);
  assert.equal(state.bossRules[0].casinoM9Managed,true);
  assert.equal(state.bossRules[0].effects.length,2);
});

test('카지노 지역 이벤트는 4종이며 모든 이벤트가 실제 선택지 2개를 가진다',()=>{
  const events=Object.values(Casino.EVENT_DEFINITIONS);
  assert.equal(events.length,4);
  assert.deepEqual(new Set(events.map(event=>event.eventTag)),new Set(['gambling','risk','river','general']));
  assert.deepEqual(events.map(event=>event.id),['sunken_roulette','cracked_vault','lowball_river','vip_comp']);
  for(const event of events){
    assert.equal(event.choices.length,2,event.id);
    assert.ok(event.choices.every(choice=>choice.id&&choice.label&&choice.actions.length>=1),event.id);
    assert.match(Casino.casinoEventHtml(event),new RegExp(`data-casino-m9-event="${event.id}"`));
  }
});

test('카지노 이벤트의 다음 전투 칩은 최대 5로 누적되고 한 전투에 한 번만 소비된다',()=>{
  const run={};
  assert.equal(Casino.reserveNextBattleChips(run,3).after,3);
  const capped=Casino.reserveNextBattleChips(run,4);
  assert.equal(capped.after,5);
  assert.equal(capped.gained,2);
  const battle={chips:0};
  const chipApi={grantChips(state,amount){state.chips+=amount;return{ok:true,gained:amount}}};
  const first=Casino.consumePendingChips(run,battle,{chipApi});
  assert.equal(first.gained,5);
  assert.equal(battle.chips,5);
  assert.equal(run.casinoM9.nextBattleChips,0);
  const duplicate=Casino.consumePendingChips(run,battle,{chipApi});
  assert.equal(duplicate.duplicate,true);
  assert.equal(duplicate.gained,0);
  assert.equal(battle.chips,5);
});

test('카지노 이벤트 액션 중에도 런 상태 객체 정체성을 유지하고 완료 시 activeEvent를 비운다',()=>{
  const node={id:'k1',type:'event',regionPlan:{regionId:'region_casino',eventTag:'gambling'}};
  const run={actId:'region_casino',runFlow:{currentRegionId:'region_casino'},casinoM9:{activeEvent:{eventId:'sunken_roulette',nodeId:'k1'},eventHistory:[],nextBattleChips:0}};
  const before=Casino.ensureRunState(run),completed=[];
  const result=Casino.chooseCasinoEvent(run,node,'safe',{runtimeRoot:{completeNode(current){completed.push(current.id)},sfx(){}}});
  assert.equal(result.ok,true);
  assert.equal(run.casinoM9,before,'ensureRunState가 기존 상태 객체를 교체하면 안 된다');
  assert.equal(run.casinoM9.activeEvent,null);
  assert.equal(run.casinoM9.eventHistory.length,1);
  assert.equal(run.casinoM9.nextBattleChips,1);
  assert.deepEqual(completed,['k1']);
});

test('M6 카드 시스템 태그와 M9 지역 보상 성향이 같은 레지스트리를 사용한다',()=>{
  assert.deepEqual(CardSystemTags.REGION_REWARD_TAGS.region_casino,['칩','적용값 감소','적용값 증가','우세 개입','예약']);
  const profile=RunFlow.regionProfile('region_casino');
  assert.ok(profile);
  assert.deepEqual(profile.rewardWeights,{neutral:.65,theme:.35});
  assert.deepEqual(RunStructure.REGION_BRANCHES.region_casino.map(branch=>branch.id),['vip_room','underground_table']);
});

test('브라우저 로더는 9-C → 카지노 → 붉은 병동 → 폐품 시장 → 경제 체인으로 진행한다',()=>{
  const source=fs.readFileSync(path.join(ROOT,'enemy-behavior.js'),'utf8');
  const contentStart=source.indexOf('function loadContentExpansion9C()');
  const casinoStart=source.indexOf('function loadCasinoRegionM9()');
  const redWardStart=source.indexOf('function loadRedWardRegionM9()');
  const scrapStart=source.indexOf('function loadScrapMarketRegionM9()');
  const economyStart=source.indexOf('function loadRunEconomyV2()');
  assert.ok(contentStart>=0&&casinoStart>=0&&redWardStart>=0&&scrapStart>=0&&economyStart>=0);
  const contentLoader=source.slice(contentStart,source.indexOf('function loadRunEvents()'));
  const casinoLoader=source.slice(casinoStart,contentStart);
  const redWardLoader=source.slice(redWardStart,casinoStart);
  const scrapLoader=source.slice(scrapStart,redWardStart);
  assert.match(contentLoader,/loadScript\('content-expansion-9-c\.js','trick-content-expansion-9-c-runtime'\)/);
  assert.match(contentLoader,/loadCasinoRegionM9\(\)/);
  assert.match(casinoLoader,/loadScript\('casino-region-m9\.js','trick-casino-region-m9-runtime'\)/);
  assert.match(casinoLoader,/loadRedWardRegionM9\(\)/);
  assert.match(redWardLoader,/loadScript\('red-ward-region-m9\.js','trick-red-ward-region-m9-runtime'\)/);
  assert.match(redWardLoader,/loadScrapMarketRegionM9\(\)/);
  assert.match(scrapLoader,/loadScript\('scrap-market-region-m9\.js','trick-scrap-market-region-m9-runtime'\)/);
  assert.match(scrapLoader,/loadRunEconomyV2\(\)/);
});