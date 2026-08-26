const test=require('node:test');
const assert=require('node:assert/strict');
const RunStart=require('../run-start-v2.js');
const RunFields=require('../run-fields.js');
const EncounterRules=require('../encounter-rules.js');
const BattleCore=require('../battle-core.js');

const CASES=Object.freeze([
  {id:'C1',starter:'common',trait:'foresight',field:'narrow_table'},
  {id:'C2',starter:'gambler',trait:'stubborn_loss',field:'inversion_zone'},
  {id:'C3',starter:'trickster',trait:'suit_collector',field:'outlaw_zone'},
  {id:'C4',starter:'survivor',trait:'empty_pocket',field:'thin_signal'},
  {id:'C5',starter:'common',trait:'imperfect',field:'wide_table'},
  {id:'C6',starter:'gambler',trait:'comeback',field:'loaded_table'},
  {id:'C7',starter:'trickster',trait:'advantage_hunter',field:'resonance_floor'},
  {id:'C8',starter:'survivor',trait:'pure_mind',field:'royal_signal'}
]);

function battleState(){return{type:'battle',setIndex:1,trick:1,enemy:{hp:30,maxHp:30},hand:[],slots:[],bossRules:[],field:null,statuses:{player:{},enemy:{}},reservations:[],setHistory:{wins:0,losses:0,draws:0}}}

test('P1-3 대표 8조합은 노출 스타터 4종·특성 8종·필드 8종을 모두 최소 한 번 포함한다',()=>{
  const starters=new Set(CASES.map(item=>item.starter));
  const traits=new Set(CASES.map(item=>item.trait));
  const fields=new Set(CASES.map(item=>item.field));
  assert.deepEqual(starters,new Set(RunStart.STARTERS.map(item=>item.id)));
  assert.deepEqual(traits,new Set(RunStart.RUN_TRAITS.map(item=>item.id)));
  assert.deepEqual(fields,new Set([...RunFields.EVENT_FIELD_IDS,...RunFields.SHOP_FIELD_IDS]));
});

test('P1-3 대표 조합의 모든 ID는 현재 런 정의에 실제로 존재한다',()=>{
  for(const item of CASES){
    assert.ok(RunStart.starterDefinition(item.starter),`${item.id}: starter ${item.starter}`);
    assert.ok(RunStart.traitDefinition(item.trait),`${item.id}: trait ${item.trait}`);
    assert.ok(RunFields.fieldDefinition(item.field),`${item.id}: field ${item.field}`);
  }
});

test('P1-3 스타터는 현재 기준 12장 = 순수 8 + 공용 효과 4를 유지한다',()=>{
  for(const starter of RunStart.STARTERS){
    assert.equal(starter.pureSlots.length,8,`${starter.id}: pure count`);
    assert.equal(starter.effectCardIds.length,4,`${starter.id}: effect count`);
    assert.equal(RunStart.starterCardCount(starter),12,`${starter.id}: total count`);
  }
});

test('P1-3 손패 -1 대표 필드는 정확히 -1만 적용하고 다른 필드는 -2 이하로 줄이지 않는다',()=>{
  assert.equal(RunFields.fieldDefinition('narrow_table').rulesOverride.maxHandModifier,-1);
  assert.equal(RunFields.fieldDefinition('loaded_table').rulesOverride.maxHandModifier,-1);
  for(const id of [...RunFields.EVENT_FIELD_IDS,...RunFields.SHOP_FIELD_IDS]){
    const modifier=RunFields.fieldDefinition(id).rulesOverride.maxHandModifier??0;
    assert.ok(modifier>=-1,`${id}: unexpected hand modifier ${modifier}`);
  }
});

test('P1-3 낮은 값 승리 필드는 트럼프 여부와 관계없이 최종 비교 결과 전체를 반전한다',()=>{
  const state=battleState();
  EncounterRules.initializeBattle(state);
  EncounterRules.setFieldFromSource(state,'inversion_zone',{type:'event',id:'p1-3'});
  const low={suit:'H',rank:2},high={suit:'C',rank:10};
  assert.equal(BattleCore.compareTrick(low,high,'S'),-1);
  assert.equal(EncounterRules.compareTrickWithRules(low,high,'S',state),1);
});

test('P1-3 필드 트럼프 보너스 변형은 0/1/2/4/5/6을 포함하고 기본 +3과 구분된다',()=>{
  const bonuses=new Set([...RunFields.EVENT_FIELD_IDS,...RunFields.SHOP_FIELD_IDS]
    .map(id=>RunFields.fieldDefinition(id).rulesOverride.trumpBonus)
    .filter(value=>value!==undefined));
  assert.deepEqual(bonuses,new Set([0,1,2,4,5,6]));
  assert.equal(BattleCore.DEFAULT_TRUMP_BONUS,3);
  assert.equal(bonuses.has(BattleCore.DEFAULT_TRUMP_BONUS),false);
});
