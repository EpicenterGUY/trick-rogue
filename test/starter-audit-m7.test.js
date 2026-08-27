const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');
const CardSystemTags=require('../card-system-tags.js');
const StarterAudit=require('../starter-audit.js');

test('M7 노출 스타터 4종은 정확히 순수 8 + 공용 효과 4 구조를 유지한다',()=>{
  const report=StarterAudit.auditRegistry(Cards);
  assert.equal(report.version,'M7-1');
  assert.deepEqual(report.baselineRegionIds,['region_theater','region_observatory','region_frontier']);
  assert.deepEqual(RunStart.STARTERS.map(starter=>starter.id),['common','gambler','trickster','survivor']);
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  for(const starter of RunStart.STARTERS){
    const deck=RunStart.buildStarterDeck(starter.id,Cards,{});
    assert.equal(deck.length,12,starter.id);
    assert.equal(deck.filter(Cards.isPureCard).length,8,starter.id);
    assert.equal(deck.filter(card=>card.definition).length,4,starter.id);
    assert.equal(starter.pureSlots.length,8,starter.id);
    assert.equal(starter.effectCardIds.length,4,starter.id);
  }
});

test('각 스타터 효과 4장은 트릭 조작 / 손패·정보 / 자원·생존 연결고리를 최소 하나씩 가진다',()=>{
  for(const starter of RunStart.STARTERS){
    const coverage=StarterAudit.roleCoverage(starter,Cards);
    assert.ok(coverage.trickControl.count>=1,`${starter.id}: 트릭 조작 공백`);
    assert.ok(coverage.handInformation.count>=1,`${starter.id}: 손패·정보 공백`);
    assert.ok(coverage.resourceSurvival.count>=1,`${starter.id}: 자원·생존 공백`);
    const identity=StarterAudit.identityCoverage(starter,Cards);
    assert.ok(identity.matchedTags.length>=1,`${starter.id}: 개성 태그 공백`);
  }
});

test('스타터 효과 카드는 M6 시스템 태그를 사용하고 모두 general/common으로 남는다',()=>{
  for(const starter of RunStart.STARTERS){
    for(const row of StarterAudit.effectRows(starter,Cards)){
      assert.ok(row.definition,`${starter.id}: ${row.id}`);
      assert.equal(row.definition.category,'general',row.id);
      assert.equal(row.definition.rarity,'common',row.id);
      assert.ok(row.systemTags.length>=1&&row.systemTags.length<=3,row.id);
      assert.ok(row.systemTags.every(tag=>CardSystemTags.TAG_SET.has(tag)),row.id);
    }
  }
});

test('M7 기준선 3지역에는 어느 스타터도 효과 카드 4장이 전부 몰리지 않고 각 지역으로 최소 한 장의 다리를 가진다',()=>{
  const regionIds=[...StarterAudit.M7_BASELINE_REGION_IDS];
  assert.deepEqual(regionIds,['region_theater','region_observatory','region_frontier']);
  assert.ok(Object.keys(CardSystemTags.REGION_REWARD_TAGS).includes('region_casino'),'M9 신규 지역은 M7 기준선과 별도 검증한다');
  for(const starter of RunStart.STARTERS){
    const coverage=StarterAudit.regionCoverage(starter,Cards);
    assert.deepEqual(Object.keys(coverage),regionIds);
    for(const regionId of regionIds){
      assert.ok(coverage[regionId].count>=1,`${starter.id}: ${regionId} 연결 카드 없음`);
      assert.ok(coverage[regionId].count<=3,`${starter.id}: ${regionId}에 4/4 몰림`);
    }
  }
});

test('스타터끼리 효과 카드가 3장 이상 겹치지 않아 시작 씨앗이 서로 구분된다',()=>{
  for(const pair of StarterAudit.pairwiseEffectOverlap())assert.ok(pair.count<=2,`${pair.left}/${pair.right}: ${pair.shared.join(', ')}`);
});

test('공통지역 카드 보상 풀은 첫 지역 선택 전 세 역할과 M7 기준선 3지역 연결고리를 모두 제공한다',()=>{
  const audit=StarterAudit.auditOpeningPool(Cards);
  assert.equal(audit.errors.length,0,audit.errors.join('\n'));
  for(const role of Object.keys(StarterAudit.ROLE_TAGS))assert.ok(audit.roles[role].length>=1,role);
  assert.deepEqual(Object.keys(audit.regions),[...StarterAudit.M7_BASELINE_REGION_IDS]);
  for(const regionId of StarterAudit.M7_BASELINE_REGION_IDS)assert.ok(audit.regions[regionId].length>=1,regionId);
});

test('스타터는 클래스 잠금이 아니므로 다른 스타터의 시작 효과 카드도 획득 차단하지 않는다',()=>{
  const ids=[...new Set(RunStart.STARTERS.flatMap(starter=>starter.effectCardIds))];
  for(const starter of RunStart.STARTERS)for(const id of ids)assert.equal(RunStart.canAcquireCard({starterId:starter.id},{cardId:id}),true,`${starter.id} -> ${id}`);
});
