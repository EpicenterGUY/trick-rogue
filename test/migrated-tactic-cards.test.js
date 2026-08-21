const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Migrated=require('../migrated-tactic-cards.js');
const Runtime=require('../migrated-tactic-runtime.js');

test('3-1 직접 이관 6종은 일반 카드 정의로 활성화된다',()=>{
  assert.deepEqual(Migrated.validateDefinitions(),[]);
  assert.equal(Migrated.DIRECT_CARD_DEFINITIONS.length,6);
  assert.deepEqual(Migrated.DIRECT_CARD_DEFINITIONS.map(card=>card.legacyTacticId).sort(),['barrier','fakeid','paint','plus2','recolor','reverse'].sort());
  assert(Migrated.DIRECT_CARD_DEFINITIONS.every(card=>card.category==='general'&&card.migrationStage==='3-1'&&card.implemented===true));
});

test('3-1 카드의 인쇄 숫자/무늬는 3-0 설계값을 그대로 사용한다',()=>{
  const slots=Object.fromEntries(Migrated.DIRECT_CARD_DEFINITIONS.map(card=>[card.legacyTacticId,`${card.suit}${card.rank}`]));
  assert.deepEqual(slots,{paint:'D4',plus2:'S3',barrier:'S6',reverse:'H3',recolor:'C9',fakeid:'H10'});
});

test('일반 효과 카드는 named gameplay alias 없이 definition/effects로 실행된다',()=>{
  for(const definition of Migrated.DIRECT_CARD_DEFINITIONS){
    const card=Cards.createDefinitionCard(definition.id,{uid:`test-${definition.legacyTacticId}`});
    assert.equal(card.named,null,definition.id);
    assert.equal(card.definition.id,definition.id);
    assert.equal(card.name,definition.name);
    assert.equal(card.effects.length,1);
    const calls=[];
    const executed=Effects.run('on_play',card,{perform:(...args)=>calls.push(args)});
    assert.equal(executed,1,definition.id);
    assert.equal(calls.length,1,definition.id);
    assert.equal(calls[0][0],definition.effects[0].action,definition.id);
  }
});

test('차단된 전술 6종은 아직 기본 52장에 효과 카드로 들어오지 않는다',()=>{
  const activeLegacyIds=new Set(Cards.createBaseCardSlots().flatMap(card=>card.definition?.legacyTacticId?[card.definition.legacyTacticId]:[]));
  for(const id of ['draw','scout','double','burn','pureboost','clean'])assert.equal(activeLegacyIds.has(id),false,id);
});

test('기존 pack01 네임드 레지스트리와 보상 풀은 3-1 일반 카드 때문에 늘어나지 않는다',()=>{
  assert.equal(Cards.CARD_DEFINITIONS.length,10);
  assert.equal(Cards.GENERAL_EFFECT_CARD_DEFINITIONS.length,6);
  assert(Cards.rewardCardIds().every(id=>id.startsWith('pack01.')));
});

test('런 시작용 임시 named alias는 순수 제거를 피한 뒤 깨끗하게 제거할 수 있다',()=>{
  const card=Cards.createDefinitionCard('core.plus2');
  const prepared=Runtime.setupDeckCard(card);
  assert.equal(prepared.named,prepared.definition);
  assert.equal(prepared.__migrationSetupAlias,true);
  Runtime.cleanSetupAliases([prepared]);
  assert.equal(prepared.named,null);
  assert.equal('__migrationSetupAlias' in prepared,false);
  assert.equal(prepared.effects[0].action,'increase_next_trick_rank');
});

test('브라우저 카드 레지스트리는 3-1 런타임 어댑터를 자동 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','cards.js'),'utf8');
  assert.match(source,/migrated-tactic-runtime\.js/);
  assert.match(source,/data-migrated-tactic-card-runtime|migratedTacticCardRuntime/);
});

test('3-1 런타임은 트릭/쇼다운 직접 이관 action을 실제 전투 context에 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','migrated-tactic-runtime.js'),'utf8');
  for(const action of ['set_next_trick_suit_to_trump','increase_next_trick_rank','set_reverse_compare','set_last_showdown_suit_to_trump','increase_last_showdown_rank'])assert.match(source,new RegExp(action));
  assert.match(source,/battle\.mods\.paint=true/);
  assert.match(source,/battle\.mods\.plus\+=/);
  assert.match(source,/battle\.mods\.reverse=true/);
  assert.match(source,/showdownSuit=battle\.trump/);
  assert.match(source,/showdownRank=Math\.min\(14/);
});
