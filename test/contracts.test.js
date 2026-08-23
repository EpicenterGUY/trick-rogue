const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Contracts=require('../contracts.js');

function advantage(player=false,enemy=false){return{mode:'explicit',automaticSuitComparison:false,multiplier:1.25,playerActive:player,enemyActive:enemy,playerSource:player?'test':null,enemySource:enemy?'test':null}}
function battle({wins=0,losses=0,draws=0,playerAdvantage=false,enemyAdvantage=false}={}){
  return{setIndex:1,slots:Array.from({length:5},(_,i)=>({card:{uid:`c${i}`}})),setHistory:{wins,losses,draws},advantage:advantage(playerAdvantage,enemyAdvantage),advantageState:{player:playerAdvantage,enemy:enemyAdvantage,playerSource:playerAdvantage?'test':null,enemySource:enemyAdvantage?'test':null,grantedSet:1}};
}

test('7.5-P는 계약 3종·금기 3종·대응 묶음 3종을 최신 조건으로 유지한다',()=>{
  assert.equal(Contracts.STAGE,'7.5-P');
  assert.equal(Object.keys(Contracts.CONTRACT_DEFINITIONS).length,3);
  assert.equal(Object.keys(Contracts.TABOO_DEFINITIONS).length,3);
  assert.equal(Object.keys(Contracts.OFFERINGS).length,3);
  assert.deepEqual(Contracts.validateRegistry(),[]);
});

test('쇼다운 규칙 순서는 카드 효과 뒤 계약/금기, 상태/예약, 최종 위력, 피해 순이며 별도 우세 단계가 없다',()=>{
  assert.deepEqual(Contracts.SHOWDOWN_RULE_ORDER,['poker','showdown_effects','contract_taboo','status_reservations','final_power','damage']);
});

test('런 계약 상태는 알 수 없는 ID와 중복을 정리한다',()=>{
  const run={contracts:['bad','edge_clause','edge_clause'],taboos:[{id:'enemy_edge'},'bad']};
  const state=Contracts.ensureClauseState(run);
  assert.deepEqual(run.contracts,['edge_clause']);
  assert.deepEqual(run.taboos,['enemy_edge']);
  assert.equal(state.version,'7.5-P');
});

test('계약 묶음은 계약 1개와 대응 금기 1개를 동시에 획득하고 중복 획득하지 않는다',()=>{
  const run={};
  const first=Contracts.acquireOffering(run,'sharp_oath',{source:'test'});
  const second=Contracts.acquireOffering(run,'sharp_oath');
  assert.equal(first.added,true);
  assert.equal(second.added,false);
  assert.deepEqual(run.contracts,['edge_clause']);
  assert.deepEqual(run.taboos,['enemy_edge']);
  assert.equal(run.clauseState.history.length,1);
});

test('날 선 서약은 내 명시적 우세 +5와 적 명시적 우세 -3을 같은 쇼다운에서 각각 판정한다',()=>{
  const run={};Contracts.acquireOffering(run,'sharp_oath');
  const state=battle({playerAdvantage:true,enemyAdvantage:true}),score={value:20};
  const result=Contracts.resolveShowdown(run,{battle:state,score,advantage:state.advantage});
  assert.equal(result.contractDelta,5);
  assert.equal(result.tabooDelta,-3);
  assert.equal(score.value,22);
});

test('세 번째 서명은 3승 이상 +6, 3패 이상 -4를 서로 독립적으로 판정한다',()=>{
  const run={};Contracts.acquireOffering(run,'third_signature');
  let state=battle({wins:3,losses:2}),score={value:10};
  let result=Contracts.resolveShowdown(run,{battle:state,score});
  assert.equal(result.delta,6);
  state=battle({wins:2,losses:3});score={value:10};
  result=Contracts.resolveShowdown(run,{battle:state,score});
  assert.equal(result.delta,-4);
  assert.equal(score.value,6);
});

test('깨끗한 장부는 무승부가 없으면 +4, 하나라도 있으면 -2를 적용한다',()=>{
  const run={};Contracts.acquireOffering(run,'clean_account');
  let state=battle({draws:0}),score={value:10};
  assert.equal(Contracts.resolveShowdown(run,{battle:state,score}).delta,4);
  state=battle({draws:1});score={value:10};
  assert.equal(Contracts.resolveShowdown(run,{battle:state,score}).delta,-2);
});

test('계약/금기 어댑터는 마지막 on_showdown_score 카드 효과 뒤에 한 번만 적용한다',()=>{
  const run={};Contracts.acquireOffering(run,'sharp_oath');
  const state=battle({playerAdvantage:true});
  const root={run,battle:state,runCardEffects(trigger,card,extra){if(trigger==='on_showdown_score')extra.score.value+=2;return 1}};
  Contracts.wrapRunCardEffects(root);
  const score={value:10};
  for(let i=0;i<4;i++)root.runCardEffects('on_showdown_score',{}, {slotIndex:i,score,advantage:state.advantage});
  assert.equal(score.value,18);
  root.runCardEffects('on_showdown_score',{}, {slotIndex:4,score,advantage:state.advantage});
  assert.equal(score.value,25);
  root.runCardEffects('on_showdown_score',{}, {slotIndex:4,score,advantage:state.advantage});
  assert.equal(score.value,27);
});

test('쇼다운 추적 로그는 계약/금기를 카드 효과와 분리해서 기록한다',()=>{
  const state={showdownTrace:['족보: 원페어 10','우세: 플레이어 추가 배율 +25%','카드 효과: +7','최종 위력: 20 : 14']};
  const resolution={activeCount:2,delta:5,summary:'우세 계약 +5 · 열세 금기 미발동'};
  assert.equal(Contracts.patchShowdownTrace(state,resolution),true);
  assert.equal(state.showdownTrace[2],'카드 효과: +2');
  assert.equal(state.showdownTrace[3],'계약/금기: 우세 계약 +5 · 열세 금기 미발동');
});

test('이벤트에서 계약 묶음을 고르면 계약/금기를 얻고 해당 이벤트를 완료한다',()=>{
  const node={id:'event-1',type:'event'};
  const root={run:{map:[node]},completed:null,sfx(){},completeNode(value){this.completed=value}};
  const result=Contracts.takeOfferingFromEvent(root,'clean_account','event-1');
  assert.equal(result.ok,true);
  assert.strictEqual(root.completed,node);
  assert.deepEqual(root.run.contracts,['clean_ledger']);
  assert.deepEqual(root.run.taboos,['any_draw']);
});

test('금기 패널티는 최종 쇼다운 위력을 0 아래로 내리지 않는다',()=>{
  const run={taboos:['three_losses']},state=battle({losses:3}),score={value:2};
  Contracts.ensureClauseState(run);
  const result=Contracts.resolveShowdown(run,{battle:state,score});
  assert.equal(result.delta,-4);
  assert.equal(score.value,0);
});

test('브라우저 부트스트랩은 상태 시스템 뒤 계약·금기를 로드하고 빌드 시너지로 넘긴다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/function loadContracts\(\)/);
  assert.match(source,/loadScript\('contracts\.js','trick-contract-system-runtime'\)/);
  assert.match(source,/if\(root\.StatusSystem\)\{loadContracts\(\);return;\}/);
  assert.match(source,/if\(root\.ContractSystem\)\{loadBuildSynergies\(\);return;\}/);
  assert.match(source,/function loadContracts\(\)\{[\s\S]*?loadScript\('contracts\.js','trick-contract-system-runtime'\)[\s\S]*?loadBuildSynergies\(\)/);
});
