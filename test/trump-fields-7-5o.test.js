const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BattleCore=require('../battle-core.js');
const EncounterRules=require('../encounter-rules.js');
const TrumpFields=require('../trump-fields.js');
const DeckBoundaries=require('../deck-boundaries.js');
const TacticMigrationSupport=require('../tactic-migration-support.js');

function card(id,suit='C',rank=2){return{id,suit,rank}}
function battleState(){
  return{
    type:'battle',setIndex:1,trick:1,phase:'trick',enemy:{hp:30,maxHp:30},deck:[card('d')],discard:[],hand:[],slots:[],bossRules:[],field:null,maxHandSize:3,
    statuses:{player:{},enemy:{}},reservations:[],setHistory:{wins:0,losses:0,draws:0}
  };
}
function signed(value){return Number(value)>0?`+${Number(value)}`:`${Number(value)}`}

test('7.5-O 필드 8종은 트럼프·손패·최종값 규칙을 가진다',()=>{
  const fields=TrumpFields.FIELD_DEFINITIONS;
  assert.equal(Object.keys(fields).length,8);
  assert.equal(fields.resonance_floor.label,'과충전 구역');
  assert.equal(fields.resonance_floor.rulesOverride.trumpBonus,5);
  assert.equal(fields.thin_signal.label,'감쇠 지대');
  assert.equal(fields.thin_signal.rulesOverride.trumpBonus,1);
  assert.equal(fields.outlaw_zone.label,'무법지대');
  assert.equal(fields.outlaw_zone.rulesOverride.trumpBonus,0);
  assert.equal(fields.narrow_table.label,'좁은 테이블');
  assert.equal(fields.narrow_table.rulesOverride.maxHandModifier,-1);
  assert.equal(fields.inversion_zone.label,'뒤집힌 세계');
  assert.equal(fields.inversion_zone.rulesOverride.lowFinalValueWins,true);
  assert.equal(fields.loaded_table.rulesOverride.trumpBonus,4);
  assert.equal(fields.wide_table.rulesOverride.trumpBonus,2);
  assert.equal(fields.royal_signal.rulesOverride.trumpBonus,6);
  const source=JSON.stringify(fields);
  assert.doesNotMatch(source,/advantageMargin|showdownAdvantagePower|lowRankWinsWhenSameTrumpState/);
  assert.deepEqual(EncounterRules.validateFieldRegistry(),[]);
});

test('필드가 없으면 중앙 기본 트럼프 보너스 +3을 그대로 사용한다',()=>{
  const state=battleState();EncounterRules.initializeBattle(state);
  assert.equal(TrumpFields.trumpBonusForState(state),BattleCore.DEFAULT_TRUMP_BONUS);
  assert.equal(TrumpFields.compareTrickWithRules({suit:'S',rank:3},{suit:'H',rank:7},'S',state),-1);
  assert.equal(BattleCore.resolveTrickValue({suit:'S',rank:3},'S',{trumpBonus:TrumpFields.trumpBonusForState(state)}).finalValue,6);
});

test('과충전 구역은 같은 정식 적용값 파이프라인의 트럼프 보너스를 +5로 덮어쓴다',()=>{
  const state=battleState();EncounterRules.initializeBattle(state);EncounterRules.setFieldFromSource(state,'resonance_floor',{type:'event',id:'test'});
  assert.equal(state.field.label,'과충전 구역');assert.equal(state.trumpBonus,5);
  assert.equal(BattleCore.resolveTrickValue({suit:'S',rank:3},'S',{trumpBonus:state.trumpBonus}).finalValue,8);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:3},{suit:'H',rank:7},'S',state),1);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'H',rank:7},{suit:'S',rank:3},'S',state),-1);
});

test('감쇠 지대는 +1, 무법지대는 0으로 트럼프 숫자 보너스만 바꾼다',()=>{
  const state=battleState();EncounterRules.initializeBattle(state);
  EncounterRules.setFieldFromSource(state,'thin_signal',{type:'scripted',id:'test'});
  assert.equal(TrumpFields.trumpBonusForState(state),1);
  assert.equal(BattleCore.resolveTrickValue({suit:'D',rank:10},'D',{trumpBonus:state.trumpBonus}).finalValue,11);
  EncounterRules.setFieldFromSource(state,'outlaw_zone',{type:'scripted',id:'test'});
  assert.equal(TrumpFields.trumpBonusForState(state),0);
  assert.equal(BattleCore.resolveTrickValue({suit:'D',rank:10},'D',{trumpBonus:state.trumpBonus}).finalValue,10);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'D',rank:10},{suit:'H',rank:10},'D',state),0);
});

test('필드를 교체하거나 해제하면 트럼프 보너스는 새 필드 또는 기본 +3으로 즉시 복원된다',()=>{
  const state=battleState();EncounterRules.initializeBattle(state);
  EncounterRules.setField(state,'resonance_floor');assert.equal(state.trumpBonus,5);
  EncounterRules.setField(state,'thin_signal');assert.equal(state.trumpBonus,1);
  EncounterRules.clearField(state);assert.equal(state.field,null);assert.equal(state.trumpBonus,3);assert.equal(TrumpFields.trumpBonusForState(state),3);
});

test('뒤집힌 세계는 트럼프 우선권을 만들지 않고 모든 보정 후 최종 적용 숫자 비교만 뒤집는다',()=>{
  const state=battleState();EncounterRules.initializeBattle(state);EncounterRules.setField(state,'inversion_zone');
  const options={player:{otherNumberModifier:4},enemy:{statusModifier:-1}};
  const player=BattleCore.resolveTrickValue({suit:'S',rank:2},'S',{trumpBonus:3,otherNumberModifier:4});
  const enemy=BattleCore.resolveTrickValue({suit:'H',rank:10},'S',{trumpBonus:3,statusModifier:-1});
  assert.equal(player.finalValue,9);assert.equal(enemy.finalValue,9);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:2},{suit:'H',rank:10},'S',state,null,options),0);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:2},{suit:'H',rank:13},'S',state),1);
});

test('좁은 테이블은 기본 최대 손패를 3에서 2로 줄이고 초과 손패를 드로우 덱 위로 돌려보낸다',()=>{
  const state=battleState();state.hand=[card('a'),card('b'),card('c')];state.deck=[card('d')];EncounterRules.initializeBattle(state);
  EncounterRules.setFieldFromSource(state,'narrow_table',{type:'event',id:'test'});
  assert.equal(state.baseMaxHandSize,3);assert.equal(state.maxHandSize,2);assert.deepEqual(state.hand.map(c=>c.id),['a','b']);assert.deepEqual(state.deck.map(c=>c.id),['d','c']);
  EncounterRules.clearField(state);assert.equal(state.maxHandSize,3);assert.equal(state.hand.length,2);
  DeckBoundaries.drawToMaxHand(state);assert.deepEqual(state.hand.map(c=>c.id),['a','b','c']);
});

test('좁은 테이블에서도 다음 트릭 한정 손패 +1은 필드 기본치 2를 기준으로 3이 된다',()=>{
  const state=battleState();EncounterRules.initializeBattle(state);EncounterRules.setField(state,'narrow_table');
  assert.equal(TacticMigrationSupport.effectiveHandCapacity(state,{set:1,trick:1}),2);
  TacticMigrationSupport.grantNextTrickHandCapacity(state,1,{set:1,trick:1});
  assert.equal(TacticMigrationSupport.effectiveHandCapacity(state,{set:1,trick:2}),3);
});

test('브라우저 판정·HUD·카드 상세·트럼프 설명은 활성 필드의 0~+6 값을 같은 값으로 표시한다',()=>{
  BattleCore.resetBrowserTrumpAdapterForTests();
  const modalParagraph={textContent:''},termSpan={textContent:''};
  const termButton={querySelector(selector){if(selector==='b')return{textContent:'트럼프'};if(selector==='span')return termSpan;return null}};
  const elements={trumpText:{textContent:'♠'},inspectApply:{textContent:''}};
  const document={
    getElementById(id){return elements[id]||null},
    querySelector(selector){return selector==='#modal p'?modalParagraph:null},
    querySelectorAll(selector){return selector==='#modal .choice'?[termButton]:[]}
  };
  const root={
    document,BattleCore,battle:battleState(),
    effective(card){return BattleCore.effectiveCard(card)},compare(){return 0},
    renderBattle(){elements.trumpText.textContent='♠'},
    inspectCard(){elements.inspectApply.textContent='인쇄 ♠3 · 트럼프'},
    showTerm(){modalParagraph.textContent='구버전 트럼프 설명'},showTerms(){termSpan.textContent='구버전 요약'},damageEnemy(){return 0}
  };
  root.battle.trump='S';EncounterRules.initializeBattle(root.battle);
  BattleCore.installBrowserTrumpAdapter(root);TrumpFields.installBrowserRuntime(root);

  const cases=[
    [null,3],
    ['outlaw_zone',0],
    ['thin_signal',1],
    ['wide_table',2],
    ['loaded_table',4],
    ['resonance_floor',5],
    ['royal_signal',6]
  ];
  for(const [fieldId,bonus] of cases){
    if(fieldId)EncounterRules.setField(root.battle,fieldId);else EncounterRules.clearField(root.battle);
    const label=signed(bonus);
    assert.equal(TrumpFields.trumpBonusForState(root.battle),bonus);
    assert.equal(BattleCore.resolveTrickValue({suit:'S',rank:3},'S',{trumpBonus:bonus}).finalValue,3+bonus);
    root.renderBattle();assert.equal(elements.trumpText.textContent,`♠ ${label}`);
    root.inspectCard({suit:'S',rank:3},false);assert.ok(elements.inspectApply.textContent.includes(`트럼프 ${label}`));assert.ok(elements.inspectApply.textContent.includes(`최종 ${3+bonus}`));
    root.showTerm('트럼프');assert.ok(modalParagraph.textContent.includes(`현재 전투에서는 트릭 적용 숫자 ${label}`));
    root.showTerms();assert.ok(termSpan.textContent.includes(`현재 ${label}`));
  }
});

test('브라우저 로더는 조우 규칙 뒤 7.5-O 필드 규칙을 먼저 연결하고 기존 런 필드로 이어진다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/loadScript\('trump-fields\.js','trick-trump-fields-runtime'\)/);
  assert.match(source,/function loadRunFieldsRuntime\(\)/);
  assert.match(source,/if\(root\.TrumpFields\)\{loadRunFieldsRuntime\(\);return;\}/);
  assert.match(source,/loadScript\('encounter-rules\.js','trick-encounter-rules-runtime',loadRunFields\)/);
});
