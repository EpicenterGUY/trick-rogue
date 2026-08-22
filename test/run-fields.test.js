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

test('5-3 런 필드 상태는 보유 목록과 활성 필드 하나를 별도로 관리한다',()=>{
  const run={gold:60};
  const state=RunFields.ensureRunFieldState(run);
  assert.equal(state.version,'5-3');
  assert.deepEqual(state.owned,[]);
  assert.equal(state.activeFieldId,null);
  const first=RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});
  assert.equal(first.alreadyOwned,false);
  assert.equal(run.fieldLoadout.activeFieldId,'inversion_zone');
  assert.deepEqual(run.fieldLoadout.owned,['inversion_zone']);
  const second=RunFields.acquireField(run,'resonance_floor',{source:'shop:n4'});
  assert.equal(second.replaced,true);
  assert.equal(run.fieldLoadout.activeFieldId,'resonance_floor');
  assert.deepEqual(run.fieldLoadout.owned,['inversion_zone','resonance_floor']);
  const switched=RunFields.activateField(run,'inversion_zone',{source:'manual'});
  assert.equal(switched.replaced,true);
  assert.equal(run.fieldLoadout.activeFieldId,'inversion_zone');
  assert.deepEqual(run.fieldLoadout.history.map(entry=>entry.action),['acquire','acquire','activate']);
});

test('알 수 없는 필드 획득과 보유하지 않은 필드 활성화는 거부한다',()=>{
  const run={};
  assert.throws(()=>RunFields.acquireField(run,'missing_field'),/Unknown run field/);
  RunFields.ensureRunFieldState(run);
  assert.throws(()=>RunFields.activateField(run,'resonance_floor'),/does not own field/);
});

test('런에서 활성화한 필드는 조우 기본 필드를 1칸에서 교체한다',()=>{
  const run={};
  RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});
  const battle=battleState('elite',86,86);
  EncounterRules.initializeBattle(battle);
  assert.equal(battle.field.id,'resonance_floor');
  const applied=RunFields.applyRunFieldToBattle(run,battle);
  assert.equal(applied.applied,true);
  assert.equal(applied.replaced,true);
  assert.equal(battle.field.id,'inversion_zone');
  assert.equal(battle.runFieldApplied.previousFieldId,'resonance_floor');
  assert.equal(battle.encounter.runFieldId,'inversion_zone');
  assert.equal(battle.fieldHistory.at(-1).to,'inversion_zone');
});

test('활성 런 필드가 없으면 적의 기본 필드를 그대로 둔다',()=>{
  const run={};RunFields.ensureRunFieldState(run);
  const battle=battleState('boss',130,130);EncounterRules.initializeBattle(battle);
  assert.equal(battle.field.id,'thin_signal');
  const result=RunFields.applyRunFieldToBattle(run,battle);
  assert.equal(result.applied,false);
  assert.equal(result.reason,'no_active_field');
  assert.equal(battle.field.id,'thin_signal');
});

test('이벤트 필드 선택은 카드 대신 역상 구역을 획득·활성화하고 노드를 완료한다',()=>{
  const node={id:'n1',type:'event'},root={run:{gold:60,deck:[{id:'keep'}],map:[node]},completed:null,completeNode(value){this.completed=value}};
  const result=RunFields.eventFieldPick(root,'n1');
  assert.equal(result.currentId,'inversion_zone');
  assert.equal(root.run.fieldLoadout.activeFieldId,'inversion_zone');
  assert.equal(root.run.deck.length,1);
  assert.equal(root.completed,node);
});

test('상점 필드는 처음 살 때만 45G를 내고 이미 보유하면 무료로 다시 활성화한다',()=>{
  const node={id:'n4',type:'shop'},root={run:{gold:44,map:[node]},loseCount:0,showCount:0,sfx(name){if(name==='lose')this.loseCount++},showShop(){this.showCount++}};
  const fail=RunFields.shopFieldPick(root,'n4');
  assert.equal(fail.ok,false);assert.equal(root.run.gold,44);assert.equal(root.loseCount,1);
  root.run.gold=45;
  const bought=RunFields.shopFieldPick(root,'n4');
  assert.equal(bought.ok,true);assert.equal(bought.paid,45);assert.equal(root.run.gold,0);
  assert.equal(root.run.fieldLoadout.activeFieldId,'resonance_floor');
  RunFields.acquireField(root.run,'inversion_zone',{source:'test'});
  assert.equal(root.run.fieldLoadout.activeFieldId,'inversion_zone');
  const activated=RunFields.shopFieldPick(root,'n4');
  assert.equal(activated.ok,true);assert.equal(activated.paid,0);assert.equal(root.run.gold,0);
  assert.equal(root.run.fieldLoadout.activeFieldId,'resonance_floor');
});

test('startBattle 어댑터는 첫 on_set_start 전에 런 필드로 조우 기본 필드를 교체한다',()=>{
  const observed=[];
  const root={
    run:{},battle:null,
    runCardEffects(){observed.push(this.battle?.field?.id||null)},
    nextEnemy(){observed.push(this.battle?.field?.id||null)},
    startBattle(node){this.battle=battleState(node.type,86,86);this.runCardEffects('on_set_start',{});this.nextEnemy()},
    damageEnemy(){return 0},renderBattle(){}
  };
  RunFields.acquireField(root.run,'inversion_zone',{source:'test'});
  EncounterRules.wrapStartBattle(root);
  RunFields.wrapStartBattle(root);
  root.startBattle({type:'elite'});
  assert.deepEqual(observed,['inversion_zone','inversion_zone']);
  assert.equal(root.battle.runFieldApplied.previousFieldId,'resonance_floor');
});

test('보스 HP가 경계를 넘으면 2·3페이즈 전환 모델이 피해 직후 기록된다',()=>{
  const root={
    battle:battleState('boss',130,130),
    damageEnemy(amount){this.battle.enemy.hp=Math.max(0,this.battle.enemy.hp-amount);return amount},
    renderBattle(){}
  };
  EncounterRules.initializeBattle(root.battle);
  EncounterRules.wrapDamageEnemy(root);
  RunFields.wrapDamageEnemy(root);
  root.damageEnemy(40);
  assert.equal(root.battle.bossPhase.id,'phase_2');
  assert.equal(root.battle.lastPhaseTransition.currentId,'phase_2');
  assert.equal(root.battle.lastPhaseTransition.ruleLabel,'감시 역전');
  root.damageEnemy(39);
  assert.equal(root.battle.bossPhase.id,'phase_3');
  assert.equal(root.battle.lastPhaseTransition.currentId,'phase_3');
  assert.equal(root.battle.lastPhaseTransition.ruleLabel,'규칙 재작성');
});

test('전투 규칙 설명 모델은 현재 필드·보스 페이즈·고유 규칙을 설명한다',()=>{
  const battle=battleState('boss',90,130);EncounterRules.initializeBattle(battle);
  const run={};RunFields.acquireField(run,'inversion_zone',{source:'event:n1'});RunFields.applyRunFieldToBattle(run,battle);
  const entries=RunFields.ruleInfoEntries(battle);
  assert(entries.some(entry=>entry.kind==='field'&&entry.label.includes('역상 구역')&&entry.description.includes('희박 신호')));
  assert(entries.some(entry=>entry.kind==='phase'&&entry.label.includes('2페이즈')&&entry.description.includes('낮은 트릭 숫자')));
});

test('적 행동 부트스트랩은 전투 규칙 이후 5-3 런 필드 런타임을 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/encounter-rules\.js/);
  assert.match(source,/run-fields\.js/);
  assert(source.indexOf('encounter-rules.js')<source.indexOf('run-fields.js'));
});
