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
    type,setIndex:1,trick:1,phase:'trick',enemy:{hp,maxHp},hand:[],slots:[],bossRules:[],field:null,chip:0,
    statuses:{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}},reservations:[],history:CardEffects.newHistory(),setHistory:{wins:0,losses:0,draws:0}
  };
}

test('7.5-F 모든 조우 프로필은 자동 기본 필드를 가지지 않는다',()=>{
  assert.equal(EncounterRules.FIELD_SLOT_COUNT,1);
  assert.deepEqual(EncounterRules.validateFieldRegistry(),[]);
  assert.deepEqual(EncounterRules.validateEncounterProfiles(),[]);
  assert.deepEqual(Object.values(EncounterRules.ENCOUNTER_PROFILES).map(profile=>profile.defaultField),[null,null,null]);
  assert(EncounterRules.FIELD_SOURCE_TYPES.includes('card'));
  assert(EncounterRules.FIELD_SOURCE_TYPES.includes('boss'));
  assert(EncounterRules.FIELD_SOURCE_TYPES.includes('elite'));
  assert(EncounterRules.FIELD_SOURCE_TYPES.includes('event'));
});

test('일반/엘리트/보스 모두 필드 없음이 정상 시작 상태다',()=>{
  for(const [type,hp] of [['battle',58],['elite',86],['boss',130]]){
    const battle=state(type,hp,hp);EncounterRules.initializeBattle(battle);
    assert.equal(battle.field,null,type);
    assert.equal(battle.fieldSource,null,type);
    assert.equal(battle.encounter.fieldPolicy,'special_only');
    assert.deepEqual(battle.fieldHistory,[]);
  }
});

test('자동 필드를 다시 프로필에 넣으면 7.5-F 검증이 거부한다',()=>{
  const bad={...EncounterRules.ENCOUNTER_PROFILES,battle:{...EncounterRules.ENCOUNTER_PROFILES.battle,defaultField:'inversion_zone'}};
  assert(EncounterRules.validateEncounterProfiles(bad).some(error=>error.includes('automatic defaultField is disabled')));
});

test('철갑 사냥꾼 고유 규칙은 필드 없이도 세트 시작 보호막 3을 준다',()=>{
  const battle=state('elite',86,86);EncounterRules.initializeBattle(battle);
  assert.equal(battle.field,null);assert.equal(battle.encounterProfileId,'armored_hunter');
  const rule=battle.bossRules.find(item=>item.id==='armored_shell');assert(rule);
  const owners=CombatEffects.activeEffectOwners(battle,{}).filter(owner=>owner.ownerType!=='card');
  assert(owners.some(owner=>owner.ownerId==='armored_shell'));
  BattleEvents.dispatchNonCardOwnersOnce('on_set_start',{state:battle,runState:{}});
  assert.equal(CombatEffects.getStatusValue(battle.statuses,'enemy','shield'),3);
});

test('탑의 감시자 페이즈는 필드와 독립적으로 HP 70%와 40% 경계를 사용한다',()=>{
  const profile=EncounterRules.ENCOUNTER_PROFILES.boss;
  assert.equal(EncounterRules.resolveBossPhase(profile,130,130).id,'phase_1');
  assert.equal(EncounterRules.resolveBossPhase(profile,90,130).id,'phase_2');
  assert.equal(EncounterRules.resolveBossPhase(profile,51,130).id,'phase_3');
});

test('보스 페이즈가 바뀌면 외부 규칙은 보존하고 관리 규칙만 교체한다',()=>{
  const battle=state('boss',130,130);battle.bossRules=[{id:'external-rule',effects:[]}];EncounterRules.initializeBattle(battle);
  assert.equal(battle.field,null);assert.equal(battle.bossPhase.id,'phase_1');
  battle.enemy.hp=90;EncounterRules.syncEncounterRules(battle);
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule','watcher-phase-2']);
  assert.equal(battle.rulesOverride.lowFinalValueWins,true);
  battle.enemy.hp=51;EncounterRules.syncEncounterRules(battle);
  assert.deepEqual(battle.bossRules.map(rule=>rule.id),['external-rule','watcher-phase-3']);
  assert.deepEqual(battle.rulesOverride,{lowFinalValueWins:true});
});

test('2·3페이즈의 보스 규칙은 다음 세트 시작부터 각각 보호막 2·4를 적용한다',()=>{
  for(const [hp,expected,ruleId] of [[90,2,'watcher-phase-2'],[51,4,'watcher-phase-3']]){
    const battle=state('boss',hp,130);EncounterRules.initializeBattle(battle);
    const rule=battle.bossRules.find(item=>item.id===ruleId);assert(rule);
    CardEffects.runOwner('on_set_start',rule,{statuses:battle.statuses,reservations:battle.reservations,ownerType:'boss_rule',ownerId:rule.id});
    assert.equal(CombatEffects.getStatusValue(battle.statuses,'enemy','shield'),expected);
  }
});

test('특정 출처가 필드를 만들 때만 한 칸 필드와 출처 메타데이터가 생긴다',()=>{
  const battle=state('battle',58,58);EncounterRules.initializeBattle(battle);
  const result=EncounterRules.setFieldFromSource(battle,'inversion_zone',{type:'event',id:'event:n1'});
  assert.equal(result.current.id,'inversion_zone');
  assert.deepEqual(battle.fieldSource,{type:'event',id:'event:n1',label:null,consume:'battle'});
  assert.deepEqual(battle.fieldHistory.map(entry=>[entry.from,entry.to,entry.sourceType,entry.sourceId]),[[null,'inversion_zone','event','event:n1']]);
  EncounterRules.clearField(battle);assert.equal(battle.field,null);assert.equal(battle.fieldSource,null);
});

test('뒤집힌 세계는 명시적으로 생성된 경우에만 최종 적용 숫자 비교를 뒤집는다',()=>{
  const normal=state('battle',58,58);EncounterRules.initializeBattle(normal);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:2},{suit:'C',rank:10},'H',normal),-1);
  EncounterRules.setFieldFromSource(normal,'inversion_zone',{type:'card',id:'test-card'});
  assert.equal(EncounterRules.compareTrickWithRules({suit:'S',rank:2},{suit:'C',rank:10},'H',normal),1);
  assert.equal(EncounterRules.compareTrickWithRules({suit:'H',rank:2},{suit:'C',rank:10},'H',normal),1);
});

test('7.5-R 조우 기본 필드 정의도 최신 트럼프·손패·최종값 규칙만 가진다',()=>{
  assert.deepEqual(EncounterRules.RULE_OVERRIDE_KEYS,['trumpBonus','maxHandModifier','lowFinalValueWins']);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.resonance_floor.rulesOverride.trumpBonus,5);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.thin_signal.rulesOverride.trumpBonus,1);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.outlaw_zone.rulesOverride.trumpBonus,0);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.narrow_table.rulesOverride.maxHandModifier,-1);
  assert.equal(EncounterRules.FIELD_DEFINITIONS.inversion_zone.rulesOverride.lowFinalValueWins,true);
  assert(EncounterRules.validateRulesOverride({advantageMargin:2}).some(error=>error.includes('unsupported rule override')));
});

test('필드 효과는 출처가 있을 때 기존 field 효과 소유자 경로에서 한 번만 실행된다',()=>{
  const battle=state('battle',58,58);EncounterRules.initializeBattle(battle);
  EncounterRules.setFieldFromSource(battle,{id:'chip-field',label:'칩 필드',rulesOverride:{},effects:[{trigger:'on_trick_start',action:'gain_chips',value:2,duration:'battle'}]},{type:'elite',id:'test-elite'});
  const owners=CombatEffects.activeEffectOwners(battle,{});assert(owners.some(owner=>owner.ownerType==='field'&&owner.ownerId==='chip-field'));
  BattleEvents.dispatchNonCardOwnersOnce('on_trick_start',{state:battle,runState:{}});BattleEvents.dispatchNonCardOwnersOnce('on_trick_start',{state:battle,runState:{}});
  assert.equal(battle.chip,2);
});

test('전투 HUD 라벨은 필드가 없으면 적 규칙만, 필드가 생기면 필드도 표시한다',()=>{
  const battle=state('boss',90,130);EncounterRules.initializeBattle(battle);
  assert.deepEqual(EncounterRules.encounterRuleLabels(battle),['2페이즈','규칙 감시 역전']);
  EncounterRules.setFieldFromSource(battle,'inversion_zone',{type:'boss',id:'special-phase'});
  assert.deepEqual(EncounterRules.encounterRuleLabels(battle),['필드 뒤집힌 세계','2페이즈','규칙 감시 역전']);
});

test('startBattle 어댑터는 첫 on_set_start 전에 규칙을 초기화하되 필드를 자동 생성하지 않는다',()=>{
  const observed=[];
  const root={battle:null,runCardEffects(){observed.push([this.battle?.encounterRulesInitialized===true,this.battle?.field?.id||null])},nextEnemy(){observed.push([this.battle?.encounterRulesInitialized===true,this.battle?.field?.id||null])},damageEnemy(){return 0},startBattle(node){this.battle=state(node.type,86,86);this.runCardEffects('on_set_start',{});this.nextEnemy()}};
  assert.equal(EncounterRules.wrapStartBattle(root),true);root.startBattle({type:'elite'});
  assert.deepEqual(observed,[[true,null],[true,null]]);assert.equal(root.battle.encounterProfileId,'armored_hunter');
});

test('damageEnemy 어댑터는 보스 HP 감소 직후 현재 페이즈를 동기화한다',()=>{
  const root={battle:state('boss',130,130),damageEnemy(amount){this.battle.enemy.hp=Math.max(0,this.battle.enemy.hp-amount);return amount},renderBattle(){this.rendered=(this.rendered||0)+1}};
  EncounterRules.initializeBattle(root.battle);EncounterRules.wrapDamageEnemy(root);root.damageEnemy(40);assert.equal(root.battle.bossPhase.id,'phase_2');root.damageEnemy(39);assert.equal(root.battle.bossPhase.id,'phase_3');assert.equal(root.rendered,2);
});

test('적 행동 부트스트랩은 기존 AI와 전투 규칙 런타임을 순서대로 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/loadScript\('enemy-behavior-core\.js','trick-enemy-behavior-core',loadEncounterRules\)/);
  assert.match(source,/loadScript\('encounter-rules\.js','trick-encounter-rules-runtime',loadRunFields\)/);
});