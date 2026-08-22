const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardEffects=require('../effects.js');
const CombatEffects=require('../combat-effects.js');
const BattleCore=require('../battle-core.js');
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

function showdownCards(){
  return{
    player:[{suit:'S',rank:2},{suit:'S',rank:3},{suit:'S',rank:4},{suit:'H',rank:5},{suit:'D',rank:6}],
    enemy:[{suit:'S',rank:7},{suit:'H',rank:8},{suit:'H',rank:9},{suit:'D',rank:10},{suit:'C',rank:11}]
  };
}

test('5-2 전투 프로필은 실제 필드 3종과 일반/엘리트/보스 규칙을 데이터로 가진다',()=>{
  assert.equal(EncounterRules.FIELD_SLOT_COUNT,1);
  assert.deepEqual(Object.keys(EncounterRules.ENCOUNTER_PROFILES).sort(),['battle','boss','elite']);
  assert.deepEqual(EncounterRules.validateFieldRegistry(),[]);
  assert.deepEqual(EncounterRules.validateEncounterProfiles(),[]);
  assert.equal(EncounterRules.ENCOUNTER_PROFILES.battle.eliteModifier,null);
  assert.equal(EncounterRules.ENCOUNTER_PROFILES.elite.eliteModifier.id,'armored_shell');
  assert.deepEqual(EncounterRules.ENCOUNTER_PROFILES.boss.bossPhases.map(phase=>phase.minHpRatio),[.70,.40,0]);
  assert.deepEqual(Object.keys(EncounterRules.FIELD_DEFINITIONS).sort(),['inversion_zone','resonance_floor','thin_signal']);
});

test('엘리트와 보스는 시작 시 각자의 기본 필드를 한 칸에 배치한다',()=>{
  const elite=state('elite',86,86),boss=state('boss',130,130);
  EncounterRules.initializeBattle(elite);EncounterRules.initializeBattle(boss);
  assert.equal(elite.field.id,'resonance_floor');
  assert.equal(elite.rulesOverride.showdownAdvantagePower,4);
  assert.equal(boss.field.id,'thin_signal');
  assert.equal(boss.rulesOverride.advantageMargin,3);
  assert.deepEqual(elite.fieldHistory.map(entry=>[entry.from,entry.to]),[[null,'resonance_floor']]);
  assert.deepEqual(boss.fieldHistory.map(entry=>[entry.from,entry.to]),[[null,'thin_signal']]);
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

test('보스 페이즈가 바뀌면 기존 외부 규칙은 보존하고 관리 규칙과 rule override만 교체한다',()=>{
  const battle=state('boss',130,130);
  battle.bossRules=[{id:'external-rule',effects:[{trigger:'on_trick_start',action:'gain_chips',value:1,duration:'battle'}]}];
  EncounterRules.initializeBattle(battle);
  assert.equal(battle.bossPhase.id,'phase_1');
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule']);
  assert.equal(battle.rulesOverride.lowRankWinsWhenSameTrumpState,undefined);
  battle.enemy.hp=90;
  const second=EncounterRules.syncEncounterRules(battle);
  assert.equal(second.changed,true);
  assert.equal(battle.bossPhase.id,'phase_2');
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule','watcher-phase-2']);
  assert.equal(battle.rulesOverride.lowRankWinsWhenSameTrumpState,true);
  battle.enemy.hp=51;
  EncounterRules.syncEncounterRules(battle);
  assert.equal(battle.bossPhase.id,'phase_3');
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule','watcher-phase-3']);
  assert.equal(battle.rulesOverride.enemyAdvantagePower,5);
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

test('역상 구역과 보스 2페이즈는 트럼프 우선권을 보존하면서 같은 트럼프 상태에서 낮은 숫자를 승자로 만든다',()=>{
  const fieldBattle=state('battle',58,58);EncounterRules.initializeBattle(fieldBattle);EncounterRules.setField(fieldBattle,'inversion_zone');
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:2},{suit:'C',rank:10},'H',fieldBattle),1);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:10},{suit:'C',rank:2},'H',fieldBattle),-1);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'H',rank:2},{suit:'C',rank:10},'H',fieldBattle),1);
  const boss=state('boss',90,130);EncounterRules.initializeBattle(boss);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:2},{suit:'C',rank:10},'H',boss),1);
});

test('희박 신호는 쇼다운 무늬 우세 문턱을 장수 차이 2에서 3으로 올린다',()=>{
  const battle=state('battle',58,58);EncounterRules.initializeBattle(battle);EncounterRules.setField(battle,'thin_signal');
  const cards=showdownCards();
  const normal=BattleCore.resolveShowdownAdvantage({playerCards:cards.player,enemyCards:cards.enemy});
  const field=EncounterRules.resolveShowdownAdvantageWithRules({playerCards:cards.player,enemyCards:cards.enemy},battle);
  assert.deepEqual(normal.playerAdvantages,['S']);
  assert.deepEqual(field.playerAdvantages,[]);
  assert.equal(field.playerAdvantageCount,0);
});

test('공명 바닥은 우세 무늬 수와 무관하게 기존처럼 한 번만 +4를 적용한다',()=>{
  const battle=state('elite',86,86);EncounterRules.initializeBattle(battle);
  const one=EncounterRules.applyShowdownAdvantageWithRules(10,10,{playerAdvantages:['S'],enemyAdvantages:[]},battle);
  const many=EncounterRules.applyShowdownAdvantageWithRules(10,10,{playerAdvantages:['S','H'],enemyAdvantages:[]},battle);
  assert.deepEqual(one,{playerPower:14,enemyPower:10});
  assert.deepEqual(many,{playerPower:14,enemyPower:10});
});

test('보스 3페이즈는 플레이어 우세 +3을 유지하고 적 우세만 +5로 재작성한다',()=>{
  const battle=state('boss',51,130);EncounterRules.initializeBattle(battle);
  assert.equal(battle.bossPhase.id,'phase_3');
  const powers=EncounterRules.applyShowdownAdvantageWithRules(10,10,{playerAdvantages:['S'],enemyAdvantages:['H']},battle);
  assert.deepEqual(powers,{playerPower:13,enemyPower:15});
});

test('필드는 정확히 한 칸이며 교체·해제와 override 우선순위를 기록한다',()=>{
  const battle=state('battle',58,58);
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

test('BattleCore 브라우저 어댑터는 트릭 비교·우세 판정·우세 위력에 현재 전장 규칙을 연결한다',()=>{
  const root={BattleCore:{...BattleCore},battle:state('boss',90,130)};
  EncounterRules.initializeBattle(root.battle);
  assert.equal(EncounterRules.wrapBattleCore(root),true);
  assert.equal(root.BattleCore.compareTrick({suit:'S',rank:2},{suit:'C',rank:10},'H'),1);
  const cards=showdownCards();
  assert.deepEqual(root.BattleCore.resolveShowdownAdvantage({playerCards:cards.player,enemyCards:cards.enemy}).playerAdvantages,[]);
  root.battle.enemy.hp=51;EncounterRules.syncEncounterRules(root.battle);
  assert.deepEqual(root.BattleCore.applyShowdownAdvantage(10,10,{playerAdvantages:[],enemyAdvantages:['S']}),{playerPower:10,enemyPower:15});
});

test('전투 HUD용 라벨은 필드·보스 페이즈·고유 규칙을 함께 제공한다',()=>{
  const battle=state('boss',90,130);EncounterRules.initializeBattle(battle);
  assert.deepEqual(EncounterRules.encounterRuleLabels(battle),['필드 희박 신호','2페이즈','규칙 감시 역전']);
});

test('startBattle 어댑터는 첫 on_set_start보다 먼저 전투 규칙과 기본 필드를 초기화한다',()=>{
  const observed=[];
  const root={
    battle:null,
    runCardEffects(){observed.push([this.battle?.encounterRulesInitialized===true,this.battle?.field?.id||null])},
    nextEnemy(){observed.push([this.battle?.encounterRulesInitialized===true,this.battle?.field?.id||null])},
    damageEnemy(){return 0},
    startBattle(node){
      this.battle=state(node.type,node.type==='elite'?86:58,node.type==='elite'?86:58);
      this.runCardEffects('on_set_start',{});
      this.nextEnemy();
    }
  };
  assert.equal(EncounterRules.wrapStartBattle(root),true);
  root.startBattle({type:'elite'});
  assert.deepEqual(observed,[[true,'resonance_floor'],[true,'resonance_floor']]);
  assert.equal(root.battle.encounterProfileId,'armored_hunter');
});

test('damageEnemy 어댑터는 보스 HP 감소 직후 현재 페이즈와 규칙 override를 동기화한다',()=>{
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
  assert.equal(root.battle.rulesOverride.lowRankWinsWhenSameTrumpState,true);
  root.damageEnemy(39);
  assert.equal(root.battle.bossPhase.id,'phase_3');
  assert.equal(root.battle.rulesOverride.enemyAdvantagePower,5);
  assert.equal(root.rendered,2);
});

test('적 행동 부트스트랩은 기존 AI와 전투 규칙 런타임을 순서대로 로드한다',()=>{
  const bootstrap=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  const core=fs.readFileSync(path.join(__dirname,'..','enemy-behavior-core.js'),'utf8');
  assert.match(bootstrap,/enemy-behavior-core\.js/);
  assert.match(bootstrap,/encounter-rules\.js/);
  assert.match(core,/root\.EnemyBehavior=api/);
  const EnemyBehavior=require('../enemy-behavior.js');
  assert.equal(typeof EnemyBehavior.chooseEnemyPlay,'function');
});
