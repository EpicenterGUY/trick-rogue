const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EncounterRules=require('../encounter-rules.js');
const RunFields=require('../run-fields.js');

function battleState(type='battle',hp=58,maxHp=58){
  return{
    type,setIndex:1,trick:1,phase:'trick',enemy:{hp,maxHp},hand:[],slots:[],bossRules:[],field:null,chip:0,
    statuses:{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}},reservations:[],setHistory:{wins:0,losses:0,draws:0}
  };
}

test('7.5-F 런 필드는 상시 활성 슬롯 대신 보유 목록과 다음 전투 예약을 관리한다',()=>{
  const run={gold:60};const state=RunFields.ensureRunFieldState(run);
  assert.equal(state.version,'7.5-F');assert.deepEqual(state.owned,[]);assert.equal(state.queuedFieldId,null);assert.equal(state.activeFieldId,null);
  const first=RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});
  assert.equal(first.alreadyOwned,false);assert.equal(first.queued,true);assert.equal(run.fieldLoadout.queuedFieldId,'inversion_zone');assert.equal(run.fieldLoadout.activeFieldId,null);
  const second=RunFields.acquireField(run,'resonance_floor',{source:'shop:n4'});
  assert.equal(second.replaced,true);assert.equal(run.fieldLoadout.queuedFieldId,'resonance_floor');assert.deepEqual(run.fieldLoadout.owned,['inversion_zone','resonance_floor']);
  RunFields.queueField(run,'inversion_zone',{source:'manual'});assert.equal(run.fieldLoadout.queuedFieldId,'inversion_zone');
});

test('구버전 activeFieldId는 한 번의 다음 전투 예약으로만 마이그레이션된다',()=>{
  const run={fieldLoadout:{version:'5-3',owned:['inversion_zone'],activeFieldId:'inversion_zone',history:[]}};
  const state=RunFields.ensureRunFieldState(run);
  assert.equal(state.version,'7.5-F');assert.equal(state.queuedFieldId,'inversion_zone');assert.equal(state.activeFieldId,null);
  assert.equal(state.queuedSource.type,'scripted');
});

test('알 수 없는 필드 획득과 보유하지 않은 필드 예약은 거부한다',()=>{
  const run={};assert.throws(()=>RunFields.acquireField(run,'missing_field'),/Unknown run field/);RunFields.ensureRunFieldState(run);assert.throws(()=>RunFields.queueField(run,'resonance_floor'),/does not own field/);
});

test('예약 필드는 다음 전투에 한 번만 생성되고 예약은 즉시 소비된다',()=>{
  const run={};RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});
  const battle=battleState('elite',86,86);EncounterRules.initializeBattle(battle);assert.equal(battle.field,null);
  const applied=RunFields.consumeQueuedFieldForBattle(run,battle);
  assert.equal(applied.applied,true);assert.equal(applied.consumed,true);assert.equal(battle.field.id,'inversion_zone');
  assert.equal(battle.fieldSource.type,'event');assert.equal(battle.fieldSource.id,'event:n1');assert.equal(run.fieldLoadout.queuedFieldId,null);
  assert.equal(battle.runFieldApplied.consumed,true);assert.equal(battle.encounter.runFieldId,'inversion_zone');
  const second=battleState('battle',58,58);EncounterRules.initializeBattle(second);const noRepeat=RunFields.consumeQueuedFieldForBattle(run,second);
  assert.equal(noRepeat.applied,false);assert.equal(noRepeat.reason,'no_queued_field');assert.equal(second.field,null);
});

test('예약 필드가 없으면 엘리트와 보스도 완전한 기본 전투 규칙으로 시작한다',()=>{
  const run={};RunFields.ensureRunFieldState(run);
  for(const [type,hp] of [['elite',86],['boss',130]]){
    const battle=battleState(type,hp,hp);EncounterRules.initializeBattle(battle);const result=RunFields.consumeQueuedFieldForBattle(run,battle);
    assert.equal(result.applied,false);assert.equal(result.reason,'no_queued_field');assert.equal(battle.field,null);assert.equal(battle.fieldSource,null);
  }
});

test('이벤트 필드 선택은 뒤집힌 세계를 획득하고 다음 전투 한 번에 예약한다',()=>{
  const node={id:'n1',type:'event'},root={run:{gold:60,deck:[{id:'keep'}],map:[node]},completed:null,completeNode(value){this.completed=value}};
  const result=RunFields.eventFieldPick(root,'n1');
  assert.equal(result.currentId,'inversion_zone');assert.equal(root.run.fieldLoadout.queuedFieldId,'inversion_zone');assert.equal(root.run.fieldLoadout.activeFieldId,null);assert.equal(root.run.deck.length,1);assert.equal(root.completed,node);
});

test('상점 필드는 처음 설계할 때만 45G를 내고 이후 방문에서는 다음 전투 재예약만 한다',()=>{
  const node={id:'n4',type:'shop'},root={run:{gold:44,map:[node]},loseCount:0,showCount:0,sfx(name){if(name==='lose')this.loseCount++},showShop(){this.showCount++}};
  const fail=RunFields.shopFieldPick(root,'n4');assert.equal(fail.ok,false);assert.equal(root.run.gold,44);assert.equal(root.loseCount,1);
  root.run.gold=45;const bought=RunFields.shopFieldPick(root,'n4');assert.equal(bought.ok,true);assert.equal(bought.paid,45);assert.equal(root.run.gold,0);assert.equal(root.run.fieldLoadout.queuedFieldId,'resonance_floor');
  const firstBattle=battleState();EncounterRules.initializeBattle(firstBattle);RunFields.consumeQueuedFieldForBattle(root.run,firstBattle);assert.equal(root.run.fieldLoadout.queuedFieldId,null);
  const queuedAgain=RunFields.shopFieldPick(root,'n4');assert.equal(queuedAgain.ok,true);assert.equal(queuedAgain.paid,0);assert.equal(root.run.gold,0);assert.equal(root.run.fieldLoadout.queuedFieldId,'resonance_floor');
});

test('startBattle 어댑터는 첫 on_set_start 전에 예약 필드를 생성하고 예약을 소비한다',()=>{
  const observed=[];
  const root={run:{},battle:null,runCardEffects(){observed.push([this.battle?.field?.id||null,this.run.fieldLoadout?.queuedFieldId||null])},nextEnemy(){observed.push([this.battle?.field?.id||null,this.run.fieldLoadout?.queuedFieldId||null])},startBattle(node){this.battle=battleState(node.type,86,86);this.runCardEffects('on_set_start',{});this.nextEnemy()},damageEnemy(){return 0},renderBattle(){}};
  RunFields.acquireField(root.run,'inversion_zone',{source:'event:n1'});EncounterRules.wrapStartBattle(root);RunFields.wrapStartBattle(root);root.startBattle({type:'elite'});
  assert.deepEqual(observed,[['inversion_zone',null],['inversion_zone',null]]);assert.equal(root.battle.fieldSource.type,'event');assert.equal(root.battle.runFieldApplied.previousFieldId,null);assert.equal(root.run.fieldLoadout.queuedFieldId,null);
});

test('같은 전투에서 시작 어댑터가 여러 번 적용을 시도해도 필드는 한 번만 소비한다',()=>{
  const run={};RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});const battle=battleState();
  const first=RunFields.consumeQueuedFieldForBattle(run,battle);const second=RunFields.consumeQueuedFieldForBattle(run,battle);
  assert.equal(first.consumed,true);assert.equal(second.unchanged,true);assert.equal(battle.fieldHistory.length,1);assert.equal(run.fieldLoadout.history.filter(entry=>entry.action==='consume').length,1);
});

test('보스 HP가 경계를 넘으면 필드 유무와 관계없이 2·3페이즈 전환 모델이 기록된다',()=>{
  const root={battle:battleState('boss',130,130),damageEnemy(amount){this.battle.enemy.hp=Math.max(0,this.battle.enemy.hp-amount);return amount},renderBattle(){}};
  EncounterRules.initializeBattle(root.battle);EncounterRules.wrapDamageEnemy(root);RunFields.wrapDamageEnemy(root);root.damageEnemy(40);assert.equal(root.battle.bossPhase.id,'phase_2');assert.equal(root.battle.lastPhaseTransition.currentId,'phase_2');root.damageEnemy(39);assert.equal(root.battle.bossPhase.id,'phase_3');assert.equal(root.battle.lastPhaseTransition.currentId,'phase_3');
});

test('전투 규칙 설명은 필드가 없을 때 적 규칙만 보이고 필드가 생기면 출처를 함께 설명한다',()=>{
  const battle=battleState('boss',90,130);EncounterRules.initializeBattle(battle);let entries=RunFields.ruleInfoEntries(battle);
  assert.equal(entries.some(entry=>entry.kind==='field'),false);assert(entries.some(entry=>entry.kind==='phase'));
  const run={};RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});RunFields.consumeQueuedFieldForBattle(run,battle);entries=RunFields.ruleInfoEntries(battle);
  assert(entries.some(entry=>entry.kind==='field'&&entry.label.includes('뒤집힌 세계')&&entry.description.includes('event')));
});

test('맵 요약은 상시 장착 필드가 아니라 다음 전투 예약 필드만 반환한다',()=>{
  const run={};RunFields.ensureRunFieldState(run);assert.equal(RunFields.runFieldSummary(run),null);RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});const summary=RunFields.runFieldSummary(run);assert.equal(summary.queued,true);assert.equal(summary.id,'inversion_zone');
  const battle=battleState();RunFields.consumeQueuedFieldForBattle(run,battle);assert.equal(RunFields.runFieldSummary(run),null);
});

test('적 행동 부트스트랩은 전투 규칙 로드 완료 뒤 필드 특수 출처 런타임을 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');assert.match(source,/function loadRunFields\(\)/);assert.match(source,/loadScript\('run-fields\.js','trick-run-fields-runtime'\)/);assert.match(source,/loadScript\('encounter-rules\.js','trick-encounter-rules-runtime',loadRunFields\)/);assert.match(source,/if\(root\.EncounterRules\)\{loadRunFields\(\);return;\}/);
});