const test=require('node:test');
const assert=require('node:assert/strict');
const Migration=require('../tactic-card-migration.js');
const TacticEffects=require('../tactic-effects.js');
const CardEffects=require('../effects.js');
const Cards=require('../cards.js');

test('3-0 전술 마이그레이션 계획은 기존 12종 전술을 빠짐없이 포함한다',()=>{
  const planned=Migration.PLAN.map(entry=>entry.legacyId).sort();
  const legacy=Object.keys(TacticEffects.TACTIC_EFFECTS).sort();
  assert.deepEqual(planned,legacy);
  assert.equal(Migration.PLAN.length,12);
  assert.deepEqual(Migration.validatePlan(),[]);
});

test('후보 인쇄 슬롯은 12장 모두 유효하고 서로 겹치지 않는다',()=>{
  const slots=Migration.PLAN.map(entry=>`${entry.printedSuit}:${entry.printedRank}`);
  assert.equal(new Set(slots).size,12);
  for(const entry of Migration.PLAN){
    assert.ok(Migration.SUITS.includes(entry.printedSuit));
    assert.ok(Migration.RANKS.includes(entry.printedRank));
  }
});

test('3-0 후보는 네 수트에 3장씩 균등 배치한다',()=>{
  const counts=Object.fromEntries(Migration.SUITS.map(suit=>[suit,0]));
  Migration.PLAN.forEach(entry=>counts[entry.printedSuit]++);
  assert.deepEqual(counts,{S:3,H:3,D:3,C:3});
});

test('후보 인쇄 슬롯은 현재 pack01 네임드 슬롯과 겹치지 않는다',()=>{
  const namedSlots=new Set(Cards.CARD_DEFINITIONS.map(card=>`${card.suit}:${card.rank}`));
  const collisions=Migration.PLAN.filter(entry=>namedSlots.has(`${entry.printedSuit}:${entry.printedRank}`));
  assert.deepEqual(collisions,[]);
});

test('직접 이관 6종은 현재 공통 action만 사용하고 trigger/duration을 명시한다',()=>{
  assert.deepEqual([...Migration.DIRECT_IDS].sort(),['barrier','fakeid','paint','plus2','recolor','reverse'].sort());
  for(const id of Migration.DIRECT_IDS){
    const entry=Migration.BY_ID[id];
    assert.ok(entry.proposedEffects.length>0,`${id}: proposedEffects`);
    for(const effect of entry.proposedEffects){
      assert.ok(effect.trigger,`${id}: trigger`);
      assert.ok(effect.duration,`${id}: duration`);
      assert.ok(CardEffects.TRIGGERS.includes(effect.trigger),`${id}: known trigger`);
      assert.ok(CardEffects.ACTIONS.includes(effect.action),`${id}: known action`);
      assert.ok(TacticEffects.TACTIC_EFFECTS[id],`${id}: legacy definition`);
    }
  }
});

test('새 규칙과 충돌하는 전술은 런타임 활성화 전에 명시적으로 차단한다',()=>{
  assert.equal(Migration.RUNTIME_ACTIVE,false);
  assert.deepEqual([...Migration.BLOCKED_IDS].sort(),['burn','clean','double','draw','pureboost','scout'].sort());
  for(const id of Migration.BLOCKED_IDS){
    const entry=Migration.BY_ID[id];
    assert.notEqual(entry.status,'direct');
    assert.ok(Array.isArray(entry.requires)&&entry.requires.length>0,`${id}: requires`);
  }
});

test('드로우/정찰/순수 의존 효과를 예전 의미 그대로 활성화하지 않는다',()=>{
  assert.equal(Migration.BY_ID.draw.status,'engine_support');
  assert.match(Migration.BY_ID.draw.note,/최대 손패 3/);
  assert.equal(Migration.BY_ID.scout.status,'redesign');
  assert.match(Migration.BY_ID.scout.note,/완전 공개/);
  assert.equal(Migration.BY_ID.pureboost.status,'redesign');
  assert.equal(Migration.BY_ID.clean.status,'redesign');
});
