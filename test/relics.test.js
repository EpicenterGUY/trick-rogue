const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardEffects=require('../effects.js');
const CombatEffects=require('../combat-effects.js');
const BattleEvents=require('../battle-events.js');
const RelicSystem=require('../relics.js');

function battleState(){
  return{
    type:'elite',setIndex:1,trick:1,phase:'trick',hand:[],slots:[],bossRules:[],field:null,chip:3,history:CardEffects.newHistory(),
    statuses:{player:{shield:0,bleed:0,regen:0,vulnerable:0,poison:0},enemy:{shield:0,bleed:0,regen:0,vulnerable:0,poison:0}},reservations:[],setHistory:{wins:0,losses:0,draws:0}
  };
}

test('6-2B 유물 8종은 공통 효과 엔진에서 전부 유효한 run 지속 효과다',()=>{
  const defs=Object.values(RelicSystem.RELIC_DEFINITIONS);
  assert.equal(defs.length,8);
  assert.deepEqual(RelicSystem.validateRelicRegistry(),[]);
  for(const relic of defs){
    assert.equal(relic.effectOwnerType,'relic');
    assert(relic.effects.length>0);
    assert(relic.effects.every(effect=>effect.duration==='run'));
  }
});

test('런 유물 상태는 중복 ID를 정리하고 같은 유물을 두 번 획득하지 않는다',()=>{
  const run={relics:['reinforced_buckle','reinforced_buckle']};
  const state=RelicSystem.ensureRelicState(run);
  assert.equal(state.version,'6-2B');
  assert.deepEqual(RelicSystem.ownedRelicIds(run),['reinforced_buckle']);
  const duplicate=RelicSystem.acquireRelic(run,'reinforced_buckle',{source:'test'});
  assert.equal(duplicate.added,false);
  const added=RelicSystem.acquireRelic(run,'cracked_abacus',{source:'test'});
  assert.equal(added.added,true);
  assert.deepEqual(RelicSystem.ownedRelicIds(run),['reinforced_buckle','cracked_abacus']);
  assert.equal(run.relicState.history.length,1);
});

test('유물 보상 풀은 이미 가진 유물을 제외하고 선택지 세 장을 중복 없이 만든다',()=>{
  const run={};
  RelicSystem.acquireRelic(run,'reinforced_buckle');
  const pool=RelicSystem.rewardPool(run);
  assert(!pool.includes('reinforced_buckle'));
  assert(pool.includes('sprout_brooch'));
  assert(pool.includes('cracked_target'));
  const options=RelicSystem.rewardOptions(run,3,()=>0.42);
  assert.equal(options.length,3);
  assert.equal(new Set(options).size,3);
  assert(options.every(id=>pool.includes(id)));
});

test('보유 유물은 기존 CombatEffects 비카드 소유자 경로에 relic 타입으로 들어간다',()=>{
  const run={};RelicSystem.acquireRelic(run,'reinforced_buckle');
  const owners=CombatEffects.activeEffectOwners(battleState(),run);
  const relic=owners.find(owner=>owner.ownerType==='relic');
  assert(relic);
  assert.equal(relic.ownerId,'reinforced_buckle');
  assert.equal(relic.source.name,'보강 버클');
});

test('세트 시작 유물은 기존 전투 이벤트 dispatcher에서 보호막과 출혈을 한 번씩 적용한다',()=>{
  const run={};
  RelicSystem.acquireRelic(run,'reinforced_buckle');
  RelicSystem.acquireRelic(run,'rusty_needle');
  const state=battleState();
  const first=BattleEvents.dispatchNonCardOwnersOnce('on_set_start',{state,runState:run});
  const second=BattleEvents.dispatchNonCardOwnersOnce('on_set_start',{state,runState:run});
  assert.equal(first,2);
  assert.equal(second,0);
  assert.equal(CombatEffects.getStatusValue(state.statuses,'player','shield'),4);
  assert.equal(CombatEffects.getStatusValue(state.statuses,'enemy','bleed'),1);
});

test('새싹 브로치와 금 간 표적은 세트 시작 시 재생과 취약을 적용한다',()=>{
  const run={};
  RelicSystem.acquireRelic(run,'sprout_brooch');
  RelicSystem.acquireRelic(run,'cracked_target');
  const state=battleState();
  const executed=BattleEvents.dispatchNonCardOwnersOnce('on_set_start',{state,runState:run});
  assert.equal(executed,2);
  assert.equal(CombatEffects.getStatusValue(state.statuses,'player','regen'),2);
  assert.equal(CombatEffects.getStatusValue(state.statuses,'enemy','vulnerable'),2);
});

test('금 간 주판은 기존 쇼다운 점수 단계에서 위력 +3을 적용한다',()=>{
  const run={};RelicSystem.acquireRelic(run,'cracked_abacus');
  const state=battleState(),score={value:11};
  const executed=BattleEvents.dispatchNonCardOwnersOnce('on_showdown_score',{state,runState:run,extra:{score}});
  assert.equal(executed,1);
  assert.equal(score.value,14);
});

test('유물 보상은 일반전이 아니라 엘리트와 보스 노드에서만 발생한다',()=>{
  assert.equal(RelicSystem.isRelicRewardNode({type:'battle'}),false);
  assert.equal(RelicSystem.isRelicRewardNode({type:'elite'}),true);
  assert.equal(RelicSystem.isRelicRewardNode({type:'boss'}),true);
});

test('엘리트 보상은 유물 선택을 먼저 띄우고 획득 뒤 기존 카드 보상으로 이어진다',()=>{
  const node={id:'n5',type:'elite'};
  const root={
    run:{map:[node]},legacyRewards:0,modals:[],
    showReward(){this.legacyRewards++},
    showModal(html){this.modals.push(html)},
    renderMap(){},renderBattle(){},beginRun(){},sfx(){}
  };
  RelicSystem.wrapShowReward(root);
  const options=root.showReward(node);
  assert.equal(root.legacyRewards,0);
  assert.equal(options.length,3);
  assert.match(root.modals.at(-1),/유물 보상/);
  const picked=RelicSystem.takeRelicReward(root,options[0],node.id);
  assert.equal(picked.ok,true);
  assert.equal(root.legacyRewards,1);
  assert.equal(root.run.relics.length,1);
  assert.equal(RelicSystem.rewardClaimed(root.run,node.id),true);
  const repeated=RelicSystem.takeRelicReward(root,options[1],node.id);
  assert.deepEqual(repeated,{ok:false,reason:'claimed'});
  assert.equal(root.legacyRewards,1);
});

test('일반 전투의 기존 카드 보상 흐름은 유물 시스템이 가로채지 않는다',()=>{
  const node={id:'n0',type:'battle'};
  const root={run:{map:[node]},legacyRewards:0,showReward(){this.legacyRewards++;return'card'},renderMap(){},renderBattle(){},beginRun(){}};
  RelicSystem.wrapShowReward(root);
  assert.equal(root.showReward(node),'card');
  assert.equal(root.legacyRewards,1);
  assert.deepEqual(root.run.relics||[],[]);
});

test('beginRun 어댑터는 새 런에 빈 유물 상태를 만들고 맵을 다시 그린다',()=>{
  const root={run:null,mapRenders:0,beginRun(){this.run={gold:60}},renderMap(){this.mapRenders++}};
  RelicSystem.wrapBeginRun(root);
  root.beginRun();
  assert.deepEqual(root.run.relics,[]);
  assert.equal(root.run.relicState.version,'6-2B');
  assert.equal(root.mapRenders,1);
});

test('브라우저 부트스트랩은 run-fields 로드 완료 뒤 유물 런타임을 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/loadScript\('run-fields\.js','trick-run-fields-runtime'\)/);
  assert.match(source,/addEventListener\?\.\('load',loadRelics,\{once:true\}\)/);
  assert.match(source,/loadScript\('relics\.js','trick-relic-system-runtime'\)/);
});
