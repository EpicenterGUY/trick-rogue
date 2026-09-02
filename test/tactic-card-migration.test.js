const test=require('node:test');
const assert=require('node:assert/strict');
const Migration=require('../tactic-card-migration.js');
const Migrated=require('../migrated-tactic-cards.js');
const CardEffects=require('../effects.js');
const Cards=require('../cards.js');

test('기존 12종 카드 이관 계획은 빠짐없이 유지된다',()=>{const planned=Migration.PLAN.map(entry=>entry.legacyId).sort(),migrated=Migrated.ACTIVE_CARD_DEFINITIONS.map(card=>card.legacyTacticId).sort();assert.deepEqual(planned,migrated);assert.equal(Migration.PLAN.length,12);assert.deepEqual(Migration.validatePlan(),[])});
test('후보 인쇄 슬롯은 12장 모두 유효하고 서로 겹치지 않는다',()=>{const slots=Migration.PLAN.map(entry=>`${entry.printedSuit}:${entry.printedRank}`);assert.equal(new Set(slots).size,12);for(const entry of Migration.PLAN){assert.ok(Migration.SUITS.includes(entry.printedSuit));assert.ok(Migration.RANKS.includes(entry.printedRank))}});
test('후보는 네 수트에 3장씩 균등 배치한다',()=>{const counts=Object.fromEntries(Migration.SUITS.map(suit=>[suit,0]));Migration.PLAN.forEach(entry=>counts[entry.printedSuit]++);assert.deepEqual(counts,{S:3,H:3,D:3,C:3})});
test('공용/추가 효과 카드는 같은 인쇄 슬롯에서도 ID 기반으로 공존한다',()=>{
  const idsAt=key=>(Cards.CARD_DEFINITIONS_BY_BASE[key]||[]).map(card=>card.id);
  assert.ok(idsAt('D4').includes('core.paint'));
  assert.ok(idsAt('D4').includes('effect70.reverse_table'));
  assert.ok(idsAt('C9').includes('core.recolor'));
  assert.ok(idsAt('C9').includes('effect70.observation_record'));
  assert.equal(Cards.CARD_DEFINITION_BY_ID['core.paint'].name,'트럼프 페인트');
  assert.equal(Cards.CARD_DEFINITION_BY_ID['effect70.reverse_table'].name,'역산표');
});
test('기존 직접 이관 6종 분류와 ID는 유지한다',()=>{assert.deepEqual([...Migration.DIRECT_IDS].sort(),['barrier','fakeid','paint','plus2','recolor','reverse'].sort());for(const id of Migration.DIRECT_IDS)assert.equal(Migration.BY_ID[id].activationStage,'3-1')});
test('12종 모두 현재 효과 엔진이 아는 trigger/action/condition만 사용한다',()=>{assert.equal(Migration.RUNTIME_ACTIVE,true);assert.equal(Migration.ACTIVE_IDS.length,12);assert.deepEqual(Migration.BLOCKED_IDS,[]);for(const id of Migration.ACTIVE_IDS){const entry=Migration.BY_ID[id];assert.deepEqual(Migration.unsupportedRequirements(entry),[],`${id}: requirements`);for(const effect of entry.proposedEffects){assert.ok(CardEffects.TRIGGERS.includes(effect.trigger),`${id}: trigger`);assert.ok(CardEffects.ACTIONS.includes(effect.action),`${id}: action`);if(effect.condition)assert.equal(typeof CardEffects.conditions[effect.condition],'function',`${id}: condition`)}}});
test('현재 표시명은 그대로 유지한다',()=>{const names=Object.fromEntries(Migration.PLAN.map(entry=>[entry.legacyId,entry.name]));assert.deepEqual(names,{paint:'트럼프 페인트',plus2:'랭크 부스트',draw:'드로우',scout:'정찰',double:'더블다운',barrier:'세이프가드',burn:'패갈이',reverse:'리버스',pureboost:'정공법',clean:'무첨가',recolor:'재도색',fakeid:'가짜 신분증'})});

test('드로우와 패갈이는 기존 손패 지원 액션을 유지한다',()=>{
  assert.deepEqual(Migration.BY_ID.draw.proposedEffects,[{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}]);
  assert.deepEqual(Migration.BY_ID.burn.proposedEffects.map(effect=>effect.action),['discard_secondary_target','gain_chips','draw_cards']);
  assert.deepEqual(Migration.BY_ID.burn.targeting,{zone:'hand',count:1,excludeSelf:true});
});

test('정찰은 정확 공개와 다음 트릭 인쇄 숫자 역전 보상을 함께 예약한다',()=>{
  assert.deepEqual(Migration.BY_ID.scout.proposedEffects,[
    {trigger:'on_play',action:'reveal_next_enemy_card',duration:'trick'},
    {trigger:'on_play',action:'reserve_next_trick_comparison_reward',value:1,rewardAction:'gain_chips',duration:'battle'}
  ]);
});

test('트럼프 페인트는 원래 무늬에 따라 트럼프화 또는 +4 중 하나만 사용한다',()=>{
  assert.deepEqual(Migration.BY_ID.paint.proposedEffects,[
    {trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'printed_suit_is_not_trump',duration:'trick'},
    {trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'printed_suit_is_trump',duration:'trick'}
  ]);
});

test('더블다운은 칩을 실제 소비한 카드 인스턴스만 +5와 승리 칩 +2를 얻는다',()=>{
  assert.deepEqual(Migration.BY_ID.double.proposedEffects,[
    {trigger:'on_play',action:'spend_chips',value:1,condition:'chips_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'},
    {trigger:'on_play',action:'increase_next_trick_rank',value:5,condition:'card_memory_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'},
    {trigger:'on_trick_win',action:'gain_chips',value:2,condition:'card_memory_at_least',conditionValue:1,memoryKey:'double_paid',duration:'trick'}
  ]);
});

test('정공법은 바로 이전 순수 슬롯 +4, 무첨가는 기존 순수 슬롯 승리 칩 +2다',()=>{
  assert.deepEqual(Migration.BY_ID.pureboost.proposedEffects,[{trigger:'on_play',action:'increase_next_trick_rank',value:4,condition:'previous_showdown_slot_is_pure',duration:'trick'}]);
  assert.equal(Migration.BY_ID.clean.proposedEffects[0].condition,'pure_card_in_showdown');assert.equal(Migration.BY_ID.clean.proposedEffects[0].value,2);
});

test('가짜 신분증은 단순 +1 대신 이전 쇼다운 숫자 복사 액션을 사용한다',()=>{
  assert.deepEqual(Migration.BY_ID.fakeid.proposedEffects,[{trigger:'on_play',action:'copy_previous_showdown_rank',condition:'previous_showdown_slot_exists',duration:'set'}]);
});

test('마이그레이션 요약은 12장 활성화와 차단 0장을 보고한다',()=>{const summary=Migration.summary();assert.equal(summary.supportStage,'7.5-P');assert.equal(summary.activationStage,'7.5-P');assert.equal(summary.active,12);assert.equal(summary.blocked,0);assert.equal(summary.engineSupported,12)});
