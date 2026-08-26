const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Pack01=require('../card-packs/pack01.js');
const Migrated=require('../migrated-tactic-cards.js');
const BuildTags=require('../card-build-tags.js');
const SystemTags=require('../card-system-tags.js');
const Economy=require('../run-economy-v2.js');

function definitionById(id){
  return Cards.CARD_DEFINITION_BY_ID?.[id]
    || Cards.ALL_CARD_DEFINITIONS?.find(definition=>definition.id===id)
    || Migrated.ACTIVE_CARD_BY_ID?.[id]
    || Pack01.find(definition=>definition.id===id)
    || null;
}

function currentDefinitions(){
  const seen=new Set();
  return[
    ...(Cards.ALL_CARD_DEFINITIONS||[]),
    ...(Migrated.ACTIVE_CARD_DEFINITIONS||[]),
    ...Pack01
  ].filter(definition=>definition?.id&&!seen.has(definition.id)&&(seen.add(definition.id),true));
}

test('시스템 태그는 빌드 계열과 분리된 단일 레지스트리를 가진다',()=>{
  const ids=SystemTags.tagIds();
  assert.equal(ids.length,new Set(ids).size);
  for(const id of ['damage','chip','information','reservation','field','slot','pure','copy','risk'])assert.equal(SystemTags.isKnownTag(id),true,id);
  assert.equal(SystemTags.isKnownTag('승부 조작'),false,'빌드 계열 이름은 시스템 태그가 아니다');
  assert.ok(BuildTags.BUILD_TAGS.includes('승부 조작'));
});

test('현재 3지역 보상 프로필은 등록된 시스템 태그만 사용한다',()=>{
  for(const [regionId,tags] of Object.entries(Economy.REGION_REWARD_TAGS)){
    assert.ok(tags.length>0,regionId);
    for(const tag of tags)assert.equal(SystemTags.isKnownTag(tag),true,`${regionId}:${tag}`);
  }
  assert.deepEqual(Economy.REGION_REWARD_TAGS.region_theater,['field','variant','trick_rule','trump','showdown_value','copy','risk','advantage']);
  assert.deepEqual(Economy.REGION_REWARD_TAGS.region_observatory,['information','hand_control','draw','reservation','slot','river']);
  assert.deepEqual(Economy.REGION_REWARD_TAGS.region_frontier,['chip','damage','status','defense','trick_win','low_rank','sustain']);
});

test('기존 카드 자동 추론 결과는 시스템 태그 레지스트리를 거쳐 그대로 유지된다',()=>{
  const cases={
    'core.scout':['information'],
    'core.emergency_draw':['draw'],
    'core.reverse':['trick_rule','variant'],
    'pack01.sharp_glass':['damage','status'],
    'pack01.recursive_function':['copy','variant'],
    'pack01.scheduled_delivery':['damage','reservation']
  };
  for(const [id,required] of Object.entries(cases)){
    const definition=definitionById(id);
    assert.ok(definition,`${id}: definition missing`);
    const direct=SystemTags.inferDefinitionTags(definition),economy=Economy.gameplayTagsForDefinition(definition);
    assert.deepEqual(economy,direct,id);
    for(const tag of required)assert.ok(direct.includes(tag),`${id}:${tag}`);
  }
});

test('새 카드가 systemTags를 명시하면 자동 추론과 합쳐지고 미등록 태그는 검증에서 거부한다',()=>{
  const definition={
    id:'test.system-tags',name:'테스트',suit:'S',rank:2,
    systemTags:['memory','copy'],
    effects:[{trigger:'on_play',action:'gain_chips',value:1}],
    terms:[]
  };
  assert.deepEqual(SystemTags.inferDefinitionTags(definition),['chip','copy','memory']);
  assert.deepEqual(SystemTags.validateDefinition(definition),[]);

  const invalid={...definition,id:'test.invalid',systemTags:['memory','not_a_real_tag']};
  assert.deepEqual(SystemTags.unknownExplicitTags(invalid),['not_a_real_tag']);
  assert.match(SystemTags.validateDefinition(invalid)[0],/unknown system tag not_a_real_tag/);
  assert.equal(SystemTags.inferDefinitionTags(invalid).includes('not_a_real_tag'),false);
});

test('장기 확장용 RNG·부채·생성·변환·메모리 태그는 미리 등록하되 기존 카드에 자동 주입하지 않는다',()=>{
  for(const id of ['rng','debt','generation','transform','memory','hp_cost']){
    assert.equal(SystemTags.isKnownTag(id),true,id);
    assert.equal(SystemTags.tagDefinition(id).reserved,true,id);
  }
  const current=currentDefinitions().flatMap(SystemTags.inferDefinitionTags);
  assert.equal(current.includes('debt'),false,'기존 효과를 이름만 보고 부채로 재분류하지 않는다');
  assert.equal(current.includes('generation'),false,'기존 효과를 임의로 생성 태그로 재분류하지 않는다');
});

test('순수 카드와 지역 친화도는 기존 보상 규칙을 유지한다',()=>{
  const pure=Economy.candidateFromPure({suit:'S',rank:7});
  assert.deepEqual(pure.gameplayTags,['pure']);
  assert.equal(Economy.candidateAffinity(pure,'region_theater'),0);
  const reverse=Economy.candidateFromDefinition(definitionById('core.reverse'));
  const scout=Economy.candidateFromDefinition(definitionById('core.scout'));
  assert.ok(Economy.candidateAffinity(reverse,'region_theater')>0);
  assert.equal(Economy.candidateAffinity(reverse,'region_observatory'),0);
  assert.ok(Economy.candidateAffinity(scout,'region_observatory')>0);
});

test('run economy는 더 이상 자체 태그 switch를 소유하지 않고 CardSystemTags에 위임한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','run-economy-v2.js'),'utf8');
  assert.match(source,/require\('\.\/card-system-tags\.js'\)/);
  assert.match(source,/systemTagApi/);
  assert.match(source,/inferDefinitionTags/);
  assert.doesNotMatch(source,/case'damage_enemy':tags\.add\('damage'\)/);
});
