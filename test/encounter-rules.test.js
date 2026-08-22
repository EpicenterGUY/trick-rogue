const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardEffects=require('../effects.js');
const CombatEffects=require('../combat-effects.js');
const BattleEvents=require('../battle-events.js');
const EncounterRules=require('../encounter-rules.js');

function state(type='battle',hp=100,maxHp=100){
  return{
    type,setIndex:1,trick:1,phase:'trick',enemy:{hp,maxHp},
    hand:[],slots:[],bossRules:[],field:null,chip:0,
    statuses:{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}},
    reservations:[],history:CardEffects.newHistory(),setHistory:{wins:0,losses:0,draws:0}
  };
}

test('5-1 전투 프로필은 일반/엘리트/보스와 1칸 필드 규칙을 데이터로 가진다',()=>{
  assert.equal(EncounterRules.FIELD_SLOT_COUNT,1);
  assert.deepEqual(Object.keys(EncounterRules.ENCOUNTER_PROFILES).sort(),['battle','boss','elite']);
  assert.deepEqual(EncounterRules.validateEncounterProfiles(),[]);
  assert.equal(EncounterRules.ENCOUNTER_PROFILES.battle.eliteModifier,null);
  assert.equal(EncounterRules.ENCOUNTER_PROFILES.elite.eliteModifier.id,'armored_shell');
  assert.deepEqual(EncounterRules.ENCOUNTER_PROFILES.boss.bossPhases.map(phase=>phase.minHpRatio),[.70,.40,0]);
  assert.deepEqual(Object.keys(EncounterRules.FIELD_DEFINITIONS),[]);
});

test('철갑 사냥꾼 고유 규칙은 기존 비카드 효과 dispatcher를 통해 세트 시작 보호막 3을 준다',()=>{
  const battle=state('elite',86,86);
  EncounterRules.initializeBattle(battle);
  assert.equal(battle.encounterProfileId,'armored_hunter');
  assert.equal(battle.bossRules.length,1);
  assert.equal(battle.bossRules[0].encounterRuleKind,'elite_modifier');
  const owners=CombatEffects.activeEffectOwners(battle,{}).filter(owner=>owner.ownerType!=='card');
  assert(owners.some(owner=>owner.ownerId==='armored_shell'));
  BattleEvents.dispatchNonCardOwnersOnce('on_set_start',{state:battle,runState:{}});
  assert.equal(CombatEffects.getStatusValue(battle.statuses,'enemy','shield'),3);
});

test('탑의 감시자 페이즈는 HP 70%와 40% 경계를 순서대로 사용한다',()=>{
  const profile=EncounterRules.ENCOUNTER_PROFILES.boss;
  assert.equal(EncounterRules.resolveBossPhase(profile,130,130).id,'phase_1');
  assert.equal(EncounterRules.resolveBossPhase(profile,91,130).id,'phase_1');
  assert.equal(EncounterRules.resolveBossPhase(profile,90,130).id,'phase_2');
  assert.equal(EncounterRules.resolveBossPhase(profile,52,130).id,'phase_2');
  assert.equal(EncounterRules.resolveBossPhase(profile,51,130).id,'phase_3');
  assert.equal(EncounterRules.resolveBossPhase(profile,0,130).id,'phase_3');
});

test('보스 페이즈가 바뀌면 기존 외부 규칙은 보존하고 관리 규칙만 교체한다',()=>{
  const battle=state('boss',130,130);
  battle.bossRules=[{id:'external-rule',effects:[{trigger:'on_trick_start',action:'gain_chips',value:1,duration:'battle'}]}];
  EncounterRules.initializeBattle(battle);
  assert.equal(battle.bossPhase.id,'phase_1');
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule']);
  battle.enemy.hp=90;
  const second=EncounterRules.syncEncounterRules(battle);
  assert.equal(second.changed,true);
  assert.equal(battle.bossPhase.id,'phase_2');
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule','watcher-phase-2']);
  battle.enemy.hp=51;
  EncounterRules.syncEncounterRules(battle);
  assert.equal(battle.bossPhase.id,'phase_3');
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule','watcher-phase-3']);
});

test('2·3페이즈의 보스 규칙은 다음 세트 시작부터 각각 보호막 2·4를 적용한다',()=>{
  for(const [hp,expected,ruleId] of [[90,2,'watcher-phase-2'],[51,4,'watcher-phase-3']]){
    const battle=state('boss',hp,130);
    EncounterRules.initializeBattle(battle);
    const rule=battle.bossRules.find(item=>item.id===ruleId);
    assert(rule,ruleId);
    CardEffects.runOwner('on_set_start',rule,{statuses:battle.statuses,reservations:battle.reservations,ownerType:'boss_rule',ownerId:rule.id});
    assert.equal(CombatEffects.getStatusValue(battle.statuses,'enemy','shield'),expected);
  }
});

test('필드는 정확히 한 칸이며 교체·해제와 override 우선순위를 기록한다',()=>{
  const battle=state('boss',90,130);
  EncounterRules.initializeBattle(battle);
  const fieldA={id:'test-a',label:'테스트 A',rulesOverride:{testRule:'A'},effects:[{trigger:'on_trick_start',action:'gain_chips',value:1,duration:'battle'}]};
  const fieldB={id:'test-b',label:'테스트 B',rulesOverride:{testRule:'B'},effects:[{trigger:'on_trick_start',action:'gain_chips',value:2,duration:'battle'}]};
  const first=EncounterRules.setField(battle,fieldA);
  assert.equal(first.previous,null);
  assert.equal(battle.field.id,'test-a');
  assert.equal(battle.rulesOverride.testRule,'A');
  const second=EncounterRules.setField(battle,fieldB);
  assert.equal(second.replaced,true);
  assert.equal(battle.field.id,'test-b');
  assert.equal(battle.rulesOverride.testRule,'B');
  assert.deepEqual(battle.fieldHistory.map(entry=>[entry.from,entry.to]),[[null,'test-a'],['test-a','test-b']]);
  const cleared=EncounterRules.clearField(battle);
  assert.equal(cleared.cleared,true);
  assert.equal(battle.field,null);
  assert.equal('testRule' in battle.rulesOverride,false);
});

test('필드 효과는 기존 field 효과 소유자 경로에서 한 번만 실행된다',()=>{
  const battle=state('battle',58,58);
  EncounterRules.initializeBattle(battle);
  EncounterRules.setField(battle,{id:'chip-field',label:'칩 필드',effects:[{trigger:'on_trick_start',action:'gain_chips',value:2,duration:'battle'}]});
  const owners=CombatEffects.activeEffectOwners(battle,{});
  assert(owners.some(owner=>owner.ownerType==='field'&&owner.ownerId==='chip-field'));
  BattleEvents.dispatchNonCardOwnersOnce('on_trick_start',{state:battle,runState:{}});
  BattleEvents.dispatchNonCardOwnersOnce('on_trick_start',{state:battle,runState:{}});
  assert.equal(battle.chip,2);
});

test('startBattle 어댑터는 첫 on_set_start보다 먼저 전투 규칙을 초기화한다',()=>{
  const observed=[];
  const root={
    battle:null,
    runCardEffects(){observed.push(this.battle?.encounterRulesInitialized===true)},
    nextEnemy(){observed.push(this.battle?.encounterRulesInitialized===true)},
    damageEnemy(){return 0},
    startBattle(node){
      this.battle=state(node.type,node.type==='elite'?86:58,node.type==='elite'?86:58);
      this.runCardEffects('on_set_start',{});
      this.nextEnemy();
    }
  };
  assert.equal(EncounterRules.wrapStartBattle(root),true);
  root.startBattle({type:'elite'});
  assert.deepEqual(observed,[true,true]);
  assert.equal(root.battle.encounterProfileId,'armored_hunter');
});

test('damageEnemy 어댑터는 보스 HP 감소 직후 현재 페이즈를 동기화한다',()=>{
  const root={
    battle:state('boss',130,130),
    damageEnemy(amount){this.battle.enemy.hp=Math.max(0,this.battle.enemy.hp-amount);return amount},
    renderBattle(){this.rendered=(this.rendered||0)+1}
  };
  EncounterRules.initializeBattle(root.battle);
  assert.equal(root.battle.bossPhase.id,'phase_1');
  assert.equal(EncounterRules.wrapDamageEnemy(root),true);
  root.damageEnemy(40);
  assert.equal(root.battle.bossPhase.id,'phase_2');
  root.damageEnemy(39);
  assert.equal(root.battle.bossPhase.id,'phase_3');
  assert.equal(root.rendered,2);
});

test('적 행동 부트스트랩은 기존 AI와 5-1 전투 규칙 런타임을 순서대로 로드한다',()=>{
  const bootstrap=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  const core=fs.readFileSync(path.join(__dirname,'..','enemy-behavior-core.js'),'utf8');
  assert.match(bootstrap,/enemy-behavior-core\.js/);
  assert.match(bootstrap,/encounter-rules\.js/);
  assert.match(core,/root\.EnemyBehavior=api/);
  const EnemyBehavior=require('../enemy-behavior.js');
  assert.equal(typeof EnemyBehavior.chooseEnemyPlay,'function');
});
