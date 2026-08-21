const test=require('node:test');
const assert=require('node:assert/strict');
const Migration=require('../tactic-card-migration.js');
const Migrated=require('../migrated-tactic-cards.js');
const CardEffects=require('../effects.js');
const Cards=require('../cards.js');

test('3-0 전술 마이그레이션 계획은 기존 12종 전술을 빠짐없이 포함한다',()=>{
  const planned=Migration.PLAN.map(entry=>entry.legacyId).sort();
  const migrated=Migrated.ACTIVE_CARD_DEFINITIONS.map(card=>card.legacyTacticId).sort();
  assert.deepEqual(planned,migrated);
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

test('3-1 직접 이관 6종 분류는 유지한다',()=>{
  assert.deepEqual([...Migration.DIRECT_IDS].sort(),['barrier','fakeid','paint','plus2','recolor','reverse'].sort());
  for(const id of Migration.DIRECT_IDS)assert.equal(Migration.BY_ID[id].activationStage,'3-1');
});

test('3-2B에서 기존 전술 12종이 모두 일반 카드 효과 정의를 가진다',()=>{
  assert.equal(Migration.RUNTIME_ACTIVE,true);
  assert.equal(Migration.ACTIVATION_STAGE,'3-2B');
  assert.equal(Migration.ACTIVE_IDS.length,12);
  assert.deepEqual(Migration.BLOCKED_IDS,[]);
  for(const id of Migration.ACTIVE_IDS){
    const entry=Migration.BY_ID[id];
    assert.ok(entry.proposedEffects.length>0,`${id}: proposedEffects`);
    assert.deepEqual(Migration.unsupportedRequirements(entry),[],`${id}: requirements`);
    for(const effect of entry.proposedEffects){
      assert.ok(effect.trigger,`${id}: trigger`);
      assert.ok(effect.duration,`${id}: duration`);
      assert.ok(CardEffects.TRIGGERS.includes(effect.trigger),`${id}: known trigger`);
      assert.ok(CardEffects.ACTIONS.includes(effect.action),`${id}: known action`);
      if(effect.condition)assert.equal(typeof CardEffects.conditions[effect.condition],'function',`${id}: known condition`);
    }
  }
});

test('3-2B 드로우/번/정찰은 3-2A 지원 액션을 사용한다',()=>{
  assert.deepEqual(Migration.BY_ID.draw.proposedEffects,[{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}]);
  assert.deepEqual(Migration.BY_ID.scout.proposedEffects,[{trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'}]);
  assert.deepEqual(Migration.BY_ID.burn.proposedEffects.map(effect=>effect.action),['discard_secondary_target','gain_chips','draw_cards']);
  assert.deepEqual(Migration.BY_ID.burn.targeting,{zone:'hand',count:1,excludeSelf:true});
});

test('더블다운은 복수 우세 2개 이상에서 쇼다운 위력 +6으로 확정한다',()=>{
  assert.deepEqual(Migration.BY_ID.double.proposedEffects,[{trigger:'on_showdown_score',action:'showdown_power',value:6,condition:'advantage_count_at_least',conditionValue:2,duration:'set'}]);
});

test('기본에 충실/무첨가는 순수 카드 분류 없이 인쇄값과 트릭값 조건을 사용한다',()=>{
  assert.equal(Migration.BY_ID.pureboost.proposedEffects[0].condition,'unmodified_trick_value');
  assert.equal(Migration.BY_ID.clean.proposedEffects[0].condition,'printed_equals_trick');
  assert.equal(Migration.BY_ID.clean.proposedEffects[0].value,2);
});

test('마이그레이션 요약은 12장 활성화와 차단 0장을 보고한다',()=>{
  const summary=Migration.summary();
  assert.equal(summary.supportStage,'3-2A');
  assert.equal(summary.activationStage,'3-2B');
  assert.equal(summary.active,12);
  assert.equal(summary.blocked,0);
  assert.equal(summary.engineSupported,12);
});
