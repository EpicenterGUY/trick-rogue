const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BattleCore=require('../battle-core.js');
const Effects=require('../effects.js');
const Cards=require('../cards.js');
const DeckBoundaries=require('../deck-boundaries.js');
const Advantage=require('../showdown-advantage.js');
const Resolution=require('../showdown-resolution.js');
const Contracts=require('../contracts.js');
const Migration=require('../tactic-card-migration.js');

function source(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8')}
function hand(ranks,suits=['S','H','D','C','S']){return ranks.map((rank,index)=>({rank,suit:suits[index]}))}

test('7.5-P BattleCore에는 자동 무늬 우세와 기본 우세 위력 +3이 없다',()=>{
  assert.equal('SHOWDOWN_ADVANTAGE_POWER' in BattleCore,false);
  const resolved=BattleCore.resolveShowdownAdvantage({playerCards:hand([2,3,4,8,9]),enemyCards:hand([10,11,12,13,14])});
  assert.equal(resolved.automaticSuitComparison,false);
  assert.equal(resolved.playerActive,false);
  assert.equal(resolved.enemyActive,false);
  assert.equal('playerAdvantageCount' in resolved,false);
  assert.equal('playerAdvantages' in resolved,false);
});

test('7.5-P 공통 효과/콘텐츠에는 우세 개수 조건과 별도 우세 점수 트리거가 없다',()=>{
  assert.equal(Effects.conditions.advantage_count_at_least,undefined);
  assert.equal(Effects.TRIGGERS.includes('on_showdown_advantage'),false);
  const content=JSON.stringify({contracts:Contracts.CONTRACT_DEFINITIONS,taboos:Contracts.TABOO_DEFINITIONS,plan:Migration.PLAN});
  assert.doesNotMatch(content,/advantage_count_at_least|playerAdvantageCount|enemyAdvantageCount|playerAdvantages|enemyAdvantages/);
  assert.match(content,/player_has_advantage/);
  assert.match(content,/enemy_has_advantage/);
});

test('7.5-P 순수 카드 분류는 Cards/Effects/DeckBoundaries에서 동일하다',()=>{
  const pure=Cards.createCardRecord({suit:'S',rank:8});
  const effect=Cards.createDefinitionCard('core.plus2',{uid:'effect'});
  const named=Cards.createDefinitionCard('pack01.black_bullet',{uid:'named'});
  for(const classifier of [Cards.isPureCard,Effects.isPureCard,DeckBoundaries.isPureCard]){
    assert.equal(classifier(pure),true);
    assert.equal(classifier(effect),false);
    assert.equal(classifier(named),false);
  }
});

test('7.5-P 기본 12장 시작 덱은 최소 2장의 순수 카드를 보존한다',()=>{
  const sourceDeck=Cards.createBaseCardSlots();
  const selected=DeckBoundaries.selectStartingDeck(sourceDeck,{targetSize:12});
  assert.equal(selected.length,12);
  assert.ok(selected.filter(DeckBoundaries.isPureCard).length>=DeckBoundaries.MIN_STARTING_PURE_CARDS);
  assert.equal(DeckBoundaries.MIN_STARTING_PURE_CARDS,2);
});

test('7.5-P 명시적 우세는 N 일반 배율 풀에 +25% 한 번만 등록된다',()=>{
  const state={setIndex:1};Advantage.grantAdvantage(state,'player',{source:'test'});
  const snapshot=Advantage.snapshot(state);
  const playerHand=Resolution.evaluatePoker(hand([2,3,4,5,6]));
  const enemyHand=Resolution.evaluatePoker(hand([2,5,8,11,13]));
  const model=Resolution.createBreakdown({playerHand,enemyHand});
  Resolution.addActiveAdvantageMultipliers(null,state,model,snapshot);
  Resolution.finalizeBreakdown(model);
  assert.equal(model.player.multipliers.length,1);
  assert.equal(model.player.multipliers[0].id,'advantage');
  assert.equal(model.player.multipliers[0].bonus,0.25);
  assert.equal(model.player.finalMultiplier,1.25);
  assert.equal(model.enemy.finalMultiplier,1);
});

test('7.5-P 카드 재설계는 더블다운=3승, 기본에 충실/무첨가=순수 카드 조건을 고정한다',()=>{
  assert.equal(Migration.BY_ID.double.proposedEffects[0].condition,'set_wins_at_least');
  assert.equal(Migration.BY_ID.double.proposedEffects[0].conditionValue,3);
  assert.equal(Migration.BY_ID.pureboost.proposedEffects[0].condition,'pure_card_in_hand');
  assert.equal(Migration.BY_ID.clean.proposedEffects[0].condition,'pure_card_in_showdown');
});

test('7.5-P 활성 계산 파일에는 복수 우세 무늬 런타임 식별자가 남지 않는다',()=>{
  for(const file of ['battle-core.js','effects.js','contracts.js','build-synergies.js','showdown-resolution.js','tactic-card-migration.js','migrated-tactic-cards.js']){
    const text=source(file);
    assert.doesNotMatch(text,/advantage_count_at_least|playerAdvantageCount|enemyAdvantageCount|playerAdvantages|enemyAdvantages/,file);
  }
});
