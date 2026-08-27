const test=require('node:test');
const assert=require('node:assert/strict');
const Legacy=require('../legacy-regions-m9.js');
const EnemyContent=require('../enemy-content-9-b.js');
const RunEvents=require('../run-events.js');
const RunFields=require('../run-fields.js');

function node(type,regionId,enemyTag='standard',eventTag='general'){return{id:`${regionId}-${type}-${enemyTag}`,type,regionPlan:{regionId,enemyTag,eventTag}}}
function battleState(regionId,enemyTag,type='battle'){return{node:node(type,regionId,enemyTag),type,enemy:{hp:60,maxHp:60,aiMemory:{}},setIndex:1,trick:1,trump:'H',slots:[],enemySlots:[],setHistory:{wins:0,losses:0,draws:0},bossRules:[{id:'old-9b',content9BManaged:true,effects:[]}],encounterRules:[],rulesOverride:{}}}

test('M9 기존 3지역 보강 콘텐츠는 AI/효과 검증을 통과한다',()=>{
  assert.equal(Legacy.STAGE,'M9-LEGACY-REGIONS-1');
  assert.deepEqual(Legacy.REGION_IDS,['region_theater','region_observatory','region_frontier']);
  assert.deepEqual(Legacy.validateContent(),[]);
  assert.equal(Object.values(Legacy.CONTENT).filter(x=>x.type==='battle').length,6);
  assert.equal(Object.values(Legacy.CONTENT).filter(x=>x.type==='elite').length,2);
});

test('유랑극장은 기존 가면 딜러 + 신규 2일반 + 전용 엘리트 + 기존 3페이즈 보스를 가진다',()=>{
  assert.equal(Legacy.contentIdForNode(node('battle','region_theater','standard')),'theater_stagehand');
  assert.equal(EnemyContent.contentIdForNode(node('battle','region_theater','trickster')),'masked_croupier');
  assert.equal(Legacy.contentIdForNode(node('battle','region_theater','pressure')),'theater_spotlight_duelist');
  assert.equal(Legacy.contentIdForNode(node('elite','region_theater','pressure')),'theater_backstage_director');
  assert.equal(EnemyContent.contentIdForNode(node('boss','region_theater')),'three_face_dealer');
  assert.equal(EnemyContent.CONTENT.three_face_dealer.phases.length,3);
});

test('안개 관측소는 기존 안개 기록관 + 신규 2일반 + 전용 엘리트 + 지역 보스를 가진다',()=>{
  assert.equal(Legacy.contentIdForNode(node('battle','region_observatory','standard')),'observatory_signal_keeper');
  assert.equal(EnemyContent.contentIdForNode(node('battle','region_observatory','observer')),'fog_archivist');
  assert.equal(Legacy.contentIdForNode(node('battle','region_observatory','disruptor')),'observatory_jammer');
  assert.equal(Legacy.contentIdForNode(node('elite','region_observatory')),'observatory_lens_warden');
  assert.equal(EnemyContent.contentIdForNode(node('boss','region_observatory')),'fog_curator');
});

test('황야 전선은 일반 적 3성향 + 기존 전선 집행관 엘리트 + 지역 보스를 가진다',()=>{
  assert.equal(Legacy.contentIdForNode(node('battle','region_frontier','standard')),'frontier_scout');
  assert.equal(Legacy.contentIdForNode(node('battle','region_frontier','aggressive')),'frontier_raider');
  assert.equal(Legacy.contentIdForNode(node('battle','region_frontier','armored')),'frontier_bulwark');
  assert.equal(EnemyContent.contentIdForNode(node('elite','region_frontier')),'frontier_bailiff');
  assert.equal(EnemyContent.contentIdForNode(node('boss','region_frontier')),'frontier_marshal');
});

test('기존 3지역은 RunEvents 2종 + M9 보강 2종으로 각각 이벤트 4종 카탈로그를 가진다',()=>{
  for(const regionId of Legacy.REGION_IDS){
    const ids=Legacy.combinedEventIds(regionId);
    assert.equal(ids.length,4,regionId);
    assert.equal(new Set(ids).size,4,regionId);
    assert.equal(ids.filter(id=>RunEvents.EVENT_DEFINITIONS[id]).length,2,regionId);
    assert.equal(ids.filter(id=>Legacy.EVENT_DEFINITIONS[id]).length,2,regionId);
  }
});

test('지역 프로필의 부족했던 이벤트 태그는 보강 이벤트로 실제 선택된다',()=>{
  assert.equal(Legacy.eventForNode(node('event','region_theater','standard','field'))?.id,'field_rental');
  assert.equal(Legacy.eventForNode(node('event','region_theater','standard','general'))?.id,'backstage_barter');
  assert.equal(Legacy.eventForNode(node('event','region_observatory','standard','field'))?.id,'false_signal');
  assert.equal(Legacy.eventForNode(node('event','region_observatory','standard','general'))?.id,'star_chart');
  assert.equal(Legacy.eventForNode(node('event','region_frontier','standard','risk'))?.id,'no_mans_land');
  assert.equal(Legacy.eventForNode(node('event','region_frontier','standard','general'))?.id,'supply_cache');
  assert.equal(Legacy.eventForNode(node('event','region_theater','standard','performance')),null,'기존 performance 이벤트는 RunEvents에 위임');
});

test('유랑극장 무대 장치 이벤트는 다음 전투 1회용 필드를 실제 획득·예약한다',()=>{
  const run={runSeed:1,deck:[{rank:2}],gold:0,hp:20,maxHp:30},eventNode=node('event','region_theater','standard','field'),completed=[];
  const event=Legacy.EVENT_DEFINITIONS.field_rental,choice=event.choices[0];
  const action=Legacy.applyEventAction(run,run.eventNode,event,choice,choice.actions[0],{runtimeRoot:{}});
  assert.equal(action.ok,true);
  assert.ok(RunFields.EVENT_FIELD_IDS.includes(action.fieldId));
  assert.equal(run.fieldLoadout.queuedFieldId,action.fieldId);
  assert.ok(run.fieldLoadout.owned.includes(action.fieldId));
});

test('보강 일반 적/엘리트 규칙은 기존 9-B 관리 규칙을 중복하지 않고 교체한다',()=>{
  const state=battleState('region_theater','pressure');
  const applied=Legacy.applyBattleContent(state,{actId:'region_theater'});
  assert.equal(applied.id,'theater_spotlight_duelist');
  assert.equal(state.enemy.name,'스포트라이트 승부사');
  assert.equal(state.encounterProfileId,'legacy-m9:theater_spotlight_duelist');
  assert.equal(state.bossRules.some(rule=>rule.content9BManaged),false);
  assert.deepEqual(state.encounterRules[0].effects.map(e=>[e.value.target,e.value.statusId,e.value.amount]),[['player','vulnerable',1]]);
});

test('보강 이벤트 선택은 이력 기록 후 기존 completeNode 경로로 정상 종료한다',()=>{
  const eventNode=node('event','region_frontier','standard','general'),completed=[];
  const run={gold:0,hp:20,maxHp:30,deck:[{rank:2}],runFlow:{currentRegionId:'region_frontier'},legacyRegionsM9:{activeEvent:{eventId:'supply_cache',nodeId:eventNode.id},eventHistory:[]}};
  const result=Legacy.chooseLegacyEvent(run,eventNode,'salvage',{runtimeRoot:{completeNode(current){completed.push(current.id)},sfx(){}}});
  assert.equal(result.ok,true);assert.equal(run.gold,28);assert.equal(run.legacyRegionsM9.eventHistory.length,1);assert.equal(run.legacyRegionsM9.activeEvent,null);assert.deepEqual(completed,[eventNode.id]);
});
