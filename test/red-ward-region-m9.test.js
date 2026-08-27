const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const Ward=require('../red-ward-region-m9.js');
const RunFlow=require('../run-flow-v2.js');
const RunStructure=require('../run-structure.js');
const CardSystemTags=require('../card-system-tags.js');

const ROOT=path.join(__dirname,'..');

test('M9 붉은 병동은 일반 적 3종·엘리트 1종·지역 보스 1종을 가진다',()=>{
  assert.equal(Ward.STAGE,'M9-RED-WARD-1');
  assert.equal(Ward.REGION_ID,'region_red_ward');
  assert.deepEqual(Ward.validateContent(),[]);
  const entries=Object.values(Ward.CONTENT);
  assert.equal(entries.filter(entry=>entry.type==='battle').length,3);
  assert.equal(entries.filter(entry=>entry.type==='elite').length,1);
  assert.equal(entries.filter(entry=>entry.type==='boss').length,1);
  assert.deepEqual(entries.filter(entry=>entry.type==='battle').map(entry=>entry.id),['ward_bleeder','ward_orderly','ward_infected']);
  assert.equal(entries.find(entry=>entry.type==='elite').id,'isolation_keeper');
  assert.equal(entries.find(entry=>entry.type==='boss').id,'red_director');
});

test('병동 노드 태그는 출혈·보호·감염 적과 엘리트·보스로 연결된다',()=>{
  const run={actId:'region_red_ward',runFlow:{currentRegionId:'region_red_ward'}};
  const battle=tag=>({id:`r-${tag}`,type:'battle',regionPlan:{regionId:'region_red_ward',enemyTag:tag}});
  assert.equal(Ward.contentIdForNode(battle('bleeder'),run),'ward_bleeder');
  assert.equal(Ward.contentIdForNode(battle('armored'),run),'ward_orderly');
  assert.equal(Ward.contentIdForNode(battle('infected'),run),'ward_infected');
  assert.equal(Ward.contentIdForNode(battle('standard'),run),'ward_orderly');
  assert.equal(Ward.contentIdForNode({id:'elite',type:'elite',regionPlan:{regionId:'region_red_ward'}},run),'isolation_keeper');
  assert.equal(Ward.contentIdForNode({id:'boss',type:'boss',regionPlan:{regionId:'region_red_ward'}},run),'red_director');
  assert.equal(Ward.contentIdForNode({id:'outside',type:'battle',regionPlan:{regionId:'region_casino'}},{actId:'region_casino'}),null);
});

test('붉은 병동장은 재생 → 출혈/보호막 → 출혈/흉터 3단계로 압박을 높인다',()=>{
  const boss=Ward.CONTENT.red_director;
  assert.deepEqual(boss.phases.map(phase=>phase.id),['triage','hemorrhage','red_alert']);
  assert.deepEqual(boss.phases.map(phase=>phase.minHpRatio),[.66,.33,0]);
  assert.equal(Ward.phaseFor(boss,.9).id,'triage');
  assert.equal(Ward.phaseFor(boss,.5).id,'hemorrhage');
  assert.equal(Ward.phaseFor(boss,.2).id,'red_alert');
  const state={node:{enemyContentId:'red_director'},enemy:{hp:20,maxHp:100},bossRules:[]};
  const synced=Ward.syncContentEncounter(state);
  assert.equal(synced.phase.id,'red_alert');
  assert.equal(state.bossRules.length,1);
  assert.equal(state.bossRules[0].redWardM9Managed,true);
  assert.deepEqual(state.bossRules[0].effects.map(effect=>effect.value.statusId),['bleed','scar']);
});

test('붉은 병동 이벤트는 의료·위험·상태·공용 4종이며 모두 2개 선택지를 가진다',()=>{
  const events=Object.values(Ward.EVENT_DEFINITIONS);
  assert.equal(events.length,4);
  assert.deepEqual(new Set(events.map(event=>event.eventTag)),new Set(['medical','risk','status','general']));
  assert.deepEqual(events.map(event=>event.id),['triage_desk','blood_donation','quarantine_test','sterile_cache']);
  for(const event of events){
    assert.equal(event.choices.length,2,event.id);
    assert.ok(event.choices.every(choice=>choice.id&&choice.label&&choice.actions.length>=1),event.id);
    assert.match(Ward.redWardEventHtml(event),new RegExp(`data-red-ward-m9-event=\\"${event.id}\\"`));
  }
});

test('병동 이벤트는 기존 비살상 HP 정책을 재사용하고 완료 후 activeEvent를 비운다',()=>{
  const node={id:'r1',type:'event',regionPlan:{regionId:'region_red_ward',eventTag:'risk'}};
  const run={actId:'region_red_ward',runFlow:{currentRegionId:'region_red_ward'},hp:2,maxHp:50,gold:0,deck:[],redWardM9:{activeEvent:{eventId:'blood_donation',nodeId:'r1'},eventHistory:[]}};
  const before=Ward.ensureRunState(run),completed=[];
  const result=Ward.chooseRedWardEvent(run,node,'donate',{runtimeRoot:{completeNode(current){completed.push(current.id)},sfx(){}}});
  assert.equal(result.ok,true);
  assert.equal(run.redWardM9,before);
  assert.equal(run.hp,1,'이벤트 피해는 플레이어를 죽이면 안 된다');
  assert.equal(run.gold,25);
  assert.equal(run.redWardM9.activeEvent,null);
  assert.equal(run.redWardM9.eventHistory.length,1);
  assert.deepEqual(completed,['r1']);
});

test('M6 보상 태그와 병동 지역 프로필/분기가 같은 지역 ID를 사용한다',()=>{
  assert.deepEqual(CardSystemTags.REGION_REWARD_TAGS.region_red_ward,['회복','보호막','상태','직접 피해','예약']);
  const profile=RunFlow.regionProfile('region_red_ward');
  assert.ok(profile);
  assert.deepEqual(profile.rewardWeights,{neutral:.65,theme:.35});
  assert.deepEqual(RunStructure.REGION_BRANCHES.region_red_ward.map(branch=>branch.id),['emergency_room','isolation_ward']);
});

test('브라우저 로더는 카지노 뒤 붉은 병동을 적재한 다음 경제 체인으로 진행한다',()=>{
  const source=fs.readFileSync(path.join(ROOT,'enemy-behavior.js'),'utf8');
  const redWardStart=source.indexOf('function loadRedWardRegionM9()');
  const casinoStart=source.indexOf('function loadCasinoRegionM9()');
  const economyStart=source.indexOf('function loadRunEconomyV2()');
  assert.ok(economyStart>=0&&redWardStart>economyStart&&casinoStart>redWardStart);
  const redWardLoader=source.slice(redWardStart,casinoStart);
  const casinoLoader=source.slice(casinoStart,source.indexOf('function loadContentExpansion9C()'));
  assert.match(redWardLoader,/loadScript\('red-ward-region-m9\.js','trick-red-ward-region-m9-runtime'\)/);
  assert.match(redWardLoader,/loadRunEconomyV2\(\)/);
  assert.match(casinoLoader,/loadRedWardRegionM9\(\)/);
});
