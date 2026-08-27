const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const SystemTags=require('../card-system-tags.js');
const Cards=require('../cards.js');
const Economy=require('../run-economy-v2.js');

test('M6 공식 시스템 태그는 정확히 14종으로 고정된다',()=>{
  assert.equal(SystemTags.VERSION,'M6-1');
  assert.deepEqual(SystemTags.TAGS,[
    '직접 피해','회복','보호막','칩','예측','적용값 증가','적용값 감소',
    '우세 개입','쇼다운 개입','예약','계약','상태','손패','족보'
  ]);
  assert.equal(new Set(SystemTags.TAGS).size,14);
});

test('모든 일반/네임드 효과 카드 정의는 대표 시스템 태그 1~3개를 데이터로 가진다',()=>{
  assert.ok(Cards.ALL_CARD_DEFINITIONS.length>0);
  const failures=[];
  for(const definition of Cards.ALL_CARD_DEFINITIONS){
    const issues=SystemTags.validateDefinition(definition);
    if(issues.length)failures.push(`${definition.id}: ${issues.join(', ')}`);
  }
  assert.deepEqual(failures,[]);
});

test('대표 카드의 태그는 실제 핵심 시스템과 일치한다',()=>{
  const byId=Cards.CARD_DEFINITION_BY_ID;
  const expects={
    'pack01.black_bullet':['직접 피해','쇼다운 개입'],
    'pack01.phoenix':['회복'],
    'pack01.golden_hand':['칩'],
    'pack01.scheduled_delivery':['예약','직접 피해'],
    'pack01.sharp_glass':['직접 피해','상태'],
    'pack01.ambush_observer':['예측'],
    'core.reverse':['적용값 감소'],
    'core.recolor':['쇼다운 개입'],
    'pack02.advantage_settlement':['우세 개입'],
    'pack04.seat_swap':['족보']
  };
  for(const [id,expected] of Object.entries(expects)){
    const tags=byId[id]?.systemTags;
    assert.ok(Array.isArray(tags),`${id}: systemTags`);
    assert.ok(tags.length>=1&&tags.length<=3,`${id}: 1~3 tags`);
    for(const tag of expected)assert.ok(tags.includes(tag),`${id}: ${tag}`);
  }
});

test('지역 보상 프로필과 카드 후보는 같은 공식 태그 집합만 사용한다',()=>{
  for(const tags of Object.values(SystemTags.REGION_REWARD_TAGS)){
    assert.ok(tags.length>0);
    assert.ok(tags.every(tag=>SystemTags.TAGS.includes(tag)));
  }
  assert.deepEqual(SystemTags.REGION_REWARD_TAGS.region_red_ward,['회복','보호막','상태','직접 피해','예약']);
  const catalog=Economy.candidateCatalog(Cards);
  for(const candidate of catalog){
    assert.ok(Array.isArray(candidate.systemTags));
    assert.ok(candidate.systemTags.length>=1&&candidate.systemTags.length<=3);
    assert.ok(candidate.systemTags.every(tag=>SystemTags.TAGS.includes(tag)));
  }
  assert.deepEqual(catalog.find(candidate=>candidate.kind==='pure').systemTags,['족보']);
});

test('지역 친화도는 systemTags만으로 계산되어 임시 옛 태그에 의존하지 않는다',()=>{
  const frontier={systemTags:['직접 피해'],gameplayTags:['information']};
  const observatory={systemTags:['예측'],gameplayTags:['damage']};
  const ward={systemTags:['회복','상태'],gameplayTags:['medical']};
  assert.ok(Economy.candidateAffinity(frontier,'region_frontier')>0);
  assert.equal(Economy.candidateAffinity(frontier,'region_observatory'),0);
  assert.ok(Economy.candidateAffinity(observatory,'region_observatory')>0);
  assert.equal(Economy.candidateAffinity(observatory,'region_frontier'),0);
  assert.ok(Economy.candidateAffinity(ward,'region_red_ward')>0);
});

test('브라우저 카드 레지스트리는 카드 정의 생성 전에 M6 태그 런타임을 부트스트랩한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-packs','index.js'),'utf8');
  const tagIndex=source.indexOf('card-system-tags.js');
  const registryIndex=source.indexOf('const EFFECT_CARD_DEFINITIONS');
  assert.ok(tagIndex>=0);
  assert.ok(registryIndex>tagIndex);
  assert.match(source,/trick-system-tags-runtime/);
});
