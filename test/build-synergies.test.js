const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const CardEffects=require('../effects.js');
const CombatEffects=require('../combat-effects.js');
const BattleEvents=require('../battle-events.js');
const Relics=require('../relics.js');
const Contracts=require('../contracts.js');
const Synergies=require('../build-synergies.js');

function runState({relics=[],contracts=[],taboos=[]}={}){
  return{relics:relics.map(id=>Relics.makeRelic(id)),contracts:[...contracts],taboos:[...taboos]};
}
function battleState(){
  return{setIndex:1,trick:1,phase:'trick',hand:[],slots:[],enemySlots:[],chip:0,statuses:{player:{shield:0,regen:0,vulnerable:0,bleed:0},enemy:{shield:0,regen:0,vulnerable:0,bleed:0}},reservations:[],history:CardEffects.newHistory(),setHistory:{wins:0,losses:0,draws:0},advantage:null};
}

test('6-4는 유물과 계약·금기를 교차하는 시너지 4종을 유효한 run 지속 패시브로 가진다',()=>{
  assert.equal(Synergies.STAGE,'6-4');
  assert.deepEqual(Object.keys(Synergies.SYNERGY_DEFINITIONS),['marked_target','edge_accounting','loss_insurance','draw_refund']);
  assert.deepEqual(Synergies.validateSynergyRegistry(),[]);
  for(const definition of Object.values(Synergies.SYNERGY_DEFINITIONS)){
    assert.equal(definition.effectOwnerType,'passive');
    assert.ok(Object.values(definition.requires).flat().length>=2);
    assert.ok(definition.effects.every(effect=>effect.duration==='run'));
  }
});

test('시너지는 필요한 구성요소가 모두 있을 때만 활성화된다',()=>{
  const missing=runState({relics:['rusty_needle']});
  const complete=runState({relics:['rusty_needle','cracked_target']});
  assert.equal(Synergies.isSynergyActive(Synergies.synergyDefinition('marked_target'),missing),false);
  assert.equal(Synergies.isSynergyActive(Synergies.synergyDefinition('marked_target'),complete),true);
  assert.deepEqual(Synergies.activeSynergyIds(complete),['marked_target']);
});

test('피 묻은 표적은 기존 비카드 dispatcher에서 세트 시작 추가 출혈 1을 적용한다',()=>{
  Synergies.installCombatOwnerAdapter();
  const run=runState({relics:['rusty_needle','cracked_target']}),state=battleState();
  const owners=CombatEffects.activeEffectOwners(state,run);
  assert.ok(owners.some(owner=>owner.ownerType==='passive'&&owner.ownerId==='synergy:marked_target'));
  BattleEvents.dispatchNonCardOwnersOnce('on_set_start',{state,runState:run});
  assert.equal(CombatEffects.getStatusValue(state.statuses,'enemy','bleed'),2,'녹슨 바늘 1 + 시너지 1');
  assert.equal(CombatEffects.getStatusValue(state.statuses,'enemy','vulnerable'),2,'금 간 표적 2는 그대로 유지');
});

test('우세 장부는 금 간 주판+우세 계약 조합에서 내 우세가 있을 때만 추가 위력 +2를 준다',()=>{
  Synergies.installCombatOwnerAdapter();
  const run=runState({relics:['cracked_abacus'],contracts:['edge_clause']}),state=battleState();
  state.advantage={playerAdvantageCount:1,enemyAdvantageCount:0,playerAdvantages:['H'],enemyAdvantages:[]};
  const score={value:10};
  BattleEvents.dispatchNonCardOwnersOnce('on_showdown_score',{state,runState:run,extra:{score,advantage:state.advantage},perform:(action,value)=>{if(action==='showdown_power')score.value+=value}});
  assert.equal(score.value,15,'금 간 주판 +3과 시너지 +2가 계약 판정 전 카드효과 단계에서 적용');

  const noEdgeState=battleState();noEdgeState.advantage={playerAdvantageCount:0,enemyAdvantageCount:0,playerAdvantages:[],enemyAdvantages:[]};const noEdgeScore={value:10};
  BattleEvents.dispatchNonCardOwnersOnce('on_showdown_score',{state:noEdgeState,runState:run,extra:{score:noEdgeScore,advantage:noEdgeState.advantage},perform:(action,value)=>{if(action==='showdown_power')noEdgeScore.value+=value}});
  assert.equal(noEdgeScore.value,13,'우세가 없으면 금 간 주판만 적용');
});

test('패배 보험과 동점 환급은 대응 금기를 가진 빌드에서 기존 칩 유물에 각각 +1을 더한다',()=>{
  Synergies.installCombatOwnerAdapter();
  const lossRun=runState({relics:['losers_token'],taboos:['three_losses']}),lossState=battleState();
  BattleEvents.dispatchNonCardOwnersOnce('on_trick_loss',{state:lossState,runState:lossRun});
  assert.equal(lossState.chip,2,'패자의 토큰 +1 + 패배 보험 +1');

  const drawRun=runState({relics:['draw_coin'],taboos:['any_draw']}),drawState=battleState();
  BattleEvents.dispatchNonCardOwnersOnce('on_trick_draw',{state:drawState,runState:drawRun});
  assert.equal(drawState.chip,2,'무승부 동전 +1 + 동점 환급 +1');
});

test('시너지 요약과 브라우저 UI는 활성 수를 맵과 전투에서 확인할 수 있게 한다',()=>{
  const run=runState({relics:['draw_coin'],taboos:['any_draw']});
  assert.deepEqual(Synergies.synergySummary(run),{count:1,ids:['draw_refund'],names:['동점 환급'],total:4});
  const source=fs.readFileSync(path.join(__dirname,'..','build-synergies.js'),'utf8');
  assert.match(source,/mapSynergiesBadge/);
  assert.match(source,/activeSynergyButton/);
  assert.match(source,/showSynergyCollection/);
});

test('브라우저 부트스트랩은 계약·금기 뒤 빌드 시너지를 로드하고 전투 레이아웃으로 이어진다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/function loadBuildSynergies\(\)/);
  assert.match(source,/build-synergies\.js/);
  assert.match(source,/trick-build-synergy-runtime/);
  assert.match(source,/function loadContracts\(\)\{[\s\S]*?loadScript\('contracts\.js','trick-contract-system-runtime'\)[\s\S]*?loadBuildSynergies\(\)/);
  assert.match(source,/function loadBuildSynergies\(\)\{[\s\S]*?loadScript\('build-synergies\.js','trick-build-synergy-runtime'\)[\s\S]*?loadBattleLayout\(\)/);
});
