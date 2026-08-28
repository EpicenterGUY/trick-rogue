const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Telemetry=require('../run-balance-telemetry.js');

function battle({type='battle',chip=0}={}){
  return{
    type,phase:'trick',setIndex:1,trick:1,chip,
    chipEconomy:{balance:chip,exchanges:0},
    playerStage:null,
    setHistory:{trickResults:[]}
  };
}

test('M5-1 런 텔레메트리는 실제 진입 노드를 유형별로 중복 없이 센다',()=>{
  const run={actId:'common'};
  assert.equal(Telemetry.VERSION,'M5-1');
  assert.equal(Telemetry.recordNodeEntry(run,{id:'c0',type:'battle'}),true);
  assert.equal(Telemetry.recordNodeEntry(run,{id:'c0',type:'battle'}),false);
  assert.equal(Telemetry.recordNodeEntry(run,{id:'c1',type:'event'}),true);
  run.actId='region_theater';
  assert.equal(Telemetry.recordNodeEntry(run,{id:'t0',type:'battle'}),true);
  assert.deepEqual(run.balanceTelemetry.nodes,{total:3,battle:2,event:1,camp:0,shop:0,elite:0,boss:0});
});

test('M5-1 전투 기록은 트릭 승패와 순수/효과 카드 사용을 함께 센다',()=>{
  const state=battle({chip:1});
  Telemetry.beginBattleRecord(state,{now:100});
  state.playerStage={suit:'S',rank:4};
  Telemetry.recordTrick(state,'player');
  state.playerStage={definition:{effects:[{trigger:'on_play'}]},suit:'H',rank:7};
  Telemetry.recordTrick(state,'enemy');
  Telemetry.recordTrick(state,'draw');
  assert.deepEqual({tricks:state.balanceTelemetry.tricks,wins:state.balanceTelemetry.trickWins,losses:state.balanceTelemetry.trickLosses,draws:state.balanceTelemetry.trickDraws,pure:state.balanceTelemetry.pureCardsPlayed,effect:state.balanceTelemetry.effectCardsPlayed},{tricks:3,wins:1,losses:1,draws:1,pure:1,effect:2});
});

test('쇼다운 최종 위력은 세트당 한 번만 차이 통계에 반영된다',()=>{
  const state=battle();
  Telemetry.beginBattleRecord(state,{now:0});
  assert.deepEqual(Telemetry.parseShowdownPower('22 : 10'),{player:22,enemy:10});
  assert.equal(Telemetry.recordShowdown(state,22,10).diff,12);
  assert.equal(Telemetry.recordShowdown(state,30,2),null);
  state.setIndex=2;
  assert.equal(Telemetry.recordShowdown(state,8,11).diff,3);
  assert.deepEqual({count:state.balanceTelemetry.showdowns,total:state.balanceTelemetry.showdownDiffTotal,max:state.balanceTelemetry.showdownDiffMax},{count:2,total:15,max:12});
});

test('전투 종료 직전 칩 교환·최대 잔액을 런 단위로 보존하고 중복 아카이브하지 않는다',()=>{
  const run={};
  const state=battle({type:'elite',chip:3});
  state.chipEconomy.exchanges=2;
  Telemetry.beginBattleRecord(state,{now:1000});
  state.chipEconomy.balance=5;Telemetry.sampleChip(state);
  state.chipEconomy.balance=3;
  Telemetry.recordTrick(state,'player');
  Telemetry.recordShowdown(state,18,11);
  const archived=Telemetry.archiveBattle(run,state,{outcome:'win',now:4000,exchangeCost:2});
  assert.deepEqual({type:archived.type,duration:archived.durationMs,exchanges:archived.exchanges,max:archived.maxChipSeen},{type:'elite',duration:3000,exchanges:2,max:5});
  assert.equal(Telemetry.archiveBattle(run,state,{outcome:'win',now:5000,exchangeCost:2}),null);
  assert.deepEqual(run.balanceTelemetry.chip,{exchanges:2,spentOnExchanges:4,maxBalanceSeen:5,endingBalanceTotal:3});
  assert.equal(run.balanceTelemetry.battles.count,1);
  assert.equal(run.balanceTelemetry.battles.byType.elite,1);
});

test('M5 종료 요약은 경로·전투·칩·폴드·지역 지표를 한 객체로 만든다',()=>{
  const run={
    runFlow:{visitedRegionIds:['region_theater','region_frontier'],completedRegionIds:['region_theater'],visitedRegionBranches:[{id:'backstage'},{id:'outpost'}],journeyHistory:[{},{}]},
    foldStats:{count:2,hpLost:16}
  };
  const stats=Telemetry.ensureStats(run,{now:0});
  Object.assign(stats.nodes,{total:7,battle:2,event:1,camp:1,shop:1,elite:1,boss:1});
  Object.assign(stats.battles,{count:4,wins:4,totalDurationMs:80000,totalTricks:31,trickWins:18,trickLosses:10,trickDraws:3,totalShowdowns:6,showdownDiffTotal:45,showdownDiffMax:14,pureCardsPlayed:12,effectCardsPlayed:19,byType:{battle:2,elite:1,boss:1}});
  Object.assign(stats.chip,{exchanges:5,spentOnExchanges:10,maxBalanceSeen:5,endingBalanceTotal:6});
  const summary=Telemetry.buildBalanceSummary(run);
  assert.equal(summary.averageBattleMs,20000);
  assert.equal(summary.averageShowdownDiff,7.5);
  assert.equal(summary.chipExchanges,5);
  assert.equal(summary.folds,2);
  assert.equal(summary.regionsVisited,2);
  assert.equal(summary.branchesVisited,2);
  assert.match(Telemetry.balanceRows(summary).join('\n'),/순수 12 \/ 효과 19/);
});

test('winBattle 바깥 래퍼는 기존 칩 리셋보다 먼저 통계를 아카이브한다',()=>{
  let time=100;
  const root={
    performance:{now(){return time}},
    run:{},battle:battle({chip:4}),ChipEconomy:{HAND_EXCHANGE_COST:2},
    winBattle(){this.battle.chipEconomy.balance=0;this.battle.chipEconomy.exchanges=0;this.battle.chip=0;return'legacy-win'}
  };
  root.battle.chipEconomy.exchanges=2;
  Telemetry.beginBattleRecord(root.battle,{now:0});
  Telemetry.wrapWinBattle(root);time=900;
  assert.equal(root.winBattle(),'legacy-win');
  assert.equal(root.run.balanceTelemetry.chip.exchanges,2);
  assert.equal(root.run.balanceTelemetry.chip.spentOnExchanges,4);
});

test('M5 텔레메트리는 배틀 레이아웃 뒤에 로드되고 기존 지역 M9 보강 뒤 GameUI로 이어진다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/run-balance-telemetry\.js/);
  assert.match(source,/trick-run-balance-telemetry-runtime/);
  assert.match(source,/legacy-regions-m9\.js/);
  assert.match(source,/trick-legacy-regions-m9-runtime/);
  assert.match(source,/function loadBattleLayoutFinal\(\)[\s\S]*?loadRunBalanceTelemetry/);
  assert.match(source,/function loadRunBalanceTelemetry\(\)\{[\s\S]*?loadLegacyRegionsM9/);
  assert.match(source,/function loadLegacyRegionsM9\(\)\{[\s\S]*?loadGameUi/);
});