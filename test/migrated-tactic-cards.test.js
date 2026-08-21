const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Migrated=require('../migrated-tactic-cards.js');

function runCard(card,trigger,overrides={}){
  const calls=[];
  const context={
    card,
    enemyCard:{suit:'H',rank:8},
    history:Effects.newHistory(),
    mods:{paint:false,plus:0,reverse:false,double:false},
    printedRank:card.rank,
    printedSuit:card.suit,
    trickRank:card.rank,
    trickSuit:card.suit,
    effectiveRank:card.rank,
    effectiveSuit:card.suit,
    advantage:{playerAdvantageCount:0,enemyAdvantageCount:0,playerAdvantages:[],enemyAdvantages:[]},
    perform:(...args)=>calls.push(args),
    ...overrides
  };
  const executed=Effects.run(trigger,card,context);
  return{calls,executed};
}

test('3-2B에서 전술 출신 12종이 모두 일반 카드 정의로 활성화된다',()=>{
  assert.deepEqual(Migrated.validateDefinitions(),[]);
  assert.equal(Migrated.ACTIVE_CARD_DEFINITIONS.length,12);
  assert.equal(Migrated.DIRECT_CARD_DEFINITIONS.length,6);
  assert.deepEqual(Migrated.ACTIVE_CARD_DEFINITIONS.map(card=>card.legacyTacticId).sort(),['paint','plus2','draw','scout','double','barrier','burn','reverse','pureboost','clean','recolor','fakeid'].sort());
  assert(Migrated.ACTIVE_CARD_DEFINITIONS.every(card=>card.category==='general'&&card.implemented===true&&card.migrationStage));
});

test('12장 인쇄 숫자/무늬는 3-0 설계값을 그대로 사용한다',()=>{
  const slots=Object.fromEntries(Migrated.ACTIVE_CARD_DEFINITIONS.map(card=>[card.legacyTacticId,`${card.suit}${card.rank}`]));
  assert.deepEqual(slots,{paint:'D4',plus2:'S3',draw:'C6',scout:'D9',double:'H2',barrier:'S6',burn:'C2',reverse:'H3',pureboost:'D5',clean:'S4',recolor:'C9',fakeid:'H10'});
});

test('일반 효과 카드는 named gameplay alias 없이 definition/effects로 생성된다',()=>{
  for(const definition of Migrated.ACTIVE_CARD_DEFINITIONS){
    const card=Cards.createDefinitionCard(definition.id,{uid:`test-${definition.legacyTacticId}`});
    assert.equal(card.named,null,definition.id);
    assert.equal(card.definition.id,definition.id);
    assert.equal(card.name,definition.name);
    assert.equal(card.effects.length,definition.effects.length);
    assert(card.effects.length>0,definition.id);
  }
});

test('드로우는 다음 트릭 한정 손패 증가 액션을 실행한다',()=>{
  const card=Cards.createDefinitionCard('core.draw',{uid:'draw'}),result=runCard(card,'on_play');
  assert.equal(result.executed,1);
  assert.deepEqual(result.calls[0].slice(0,2),['grant_next_trick_hand_capacity',1]);
});

test('정찰은 현재 적이 아니라 다음 적 카드 선공개 액션을 실행한다',()=>{
  const card=Cards.createDefinitionCard('core.scout',{uid:'scout'}),result=runCard(card,'on_play');
  assert.equal(result.executed,1);
  assert.equal(result.calls[0][0],'reveal_next_enemy_card');
});

test('더블다운은 우세 무늬가 2개 이상일 때만 쇼다운 위력 +6을 준다',()=>{
  const card=Cards.createDefinitionCard('core.double',{uid:'double'});
  const blocked=runCard(card,'on_showdown_score',{advantage:{playerAdvantageCount:1,playerAdvantages:['S'],enemyAdvantageCount:0,enemyAdvantages:[]}});
  const active=runCard(card,'on_showdown_score',{advantage:{playerAdvantageCount:2,playerAdvantages:['S','H'],enemyAdvantageCount:0,enemyAdvantages:[]}});
  assert.equal(blocked.executed,0);
  assert.equal(active.executed,1);
  assert.deepEqual(active.calls[0].slice(0,2),['showdown_power',6]);
});

test('번은 다른 손패 1장을 요구하고 버림→칩→드로우 순서로 실행한다',()=>{
  const card=Cards.createDefinitionCard('core.burn',{uid:'burn'});
  assert.deepEqual(card.definition.targeting,{zone:'hand',count:1,excludeSelf:true});
  const result=runCard(card,'on_play',{secondaryTargetCard:{uid:'other',suit:'H',rank:7}});
  assert.equal(result.executed,3);
  assert.deepEqual(result.calls.map(call=>call.slice(0,2)),[['discard_secondary_target',undefined],['gain_chips',1],['draw_cards',1]]);
});

test('기본에 충실은 다른 트릭 보정이 없을 때만 자기 트릭 숫자 +2를 실행한다',()=>{
  const card=Cards.createDefinitionCard('core.pureboost',{uid:'pureboost'});
  const active=runCard(card,'on_play');
  const blocked=runCard(card,'on_play',{trickRank:card.rank+1,effectiveRank:card.rank+1});
  assert.equal(active.executed,1);
  assert.deepEqual(active.calls[0].slice(0,2),['increase_next_trick_rank',2]);
  assert.equal(blocked.executed,0);
});

test('무첨가는 인쇄값과 트릭값이 같은 상태로 승리할 때 칩 +2를 준다',()=>{
  const card=Cards.createDefinitionCard('core.clean',{uid:'clean'});
  const active=runCard(card,'on_trick_win');
  const blocked=runCard(card,'on_trick_win',{trickSuit:'H',effectiveSuit:'H'});
  assert.equal(active.executed,1);
  assert.deepEqual(active.calls[0].slice(0,2),['gain_chips',2]);
  assert.equal(blocked.executed,0);
});

test('기존 pack01 네임드 레지스트리와 보상 풀은 일반 효과 카드 12장 때문에 늘어나지 않는다',()=>{
  assert.equal(Cards.CARD_DEFINITIONS.length,10);
  assert.equal(Cards.GENERAL_EFFECT_CARD_DEFINITIONS.length,12);
  assert(Cards.rewardCardIds().every(id=>id.startsWith('pack01.')));
});

