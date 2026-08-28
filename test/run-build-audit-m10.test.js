const test=require('node:test');
const assert=require('node:assert/strict');
const Audit=require('../run-build-audit.js');

function runtime(){
  return{
    CARD_DEFINITION_BY_ID:{
      'core.test':{id:'core.test',systemTags:['칩','손패'],effects:[{trigger:'on_play',action:'gain_chips',value:1}]},
      'core.damage':{id:'core.damage',effects:[{trigger:'on_play',action:'damage_enemy',value:3}]}
    },
    RunFlowV2:{REGION_PROFILES:{
      region_theater:{name:'유랑극장'},region_casino:{name:'침몰 카지노'}
    }}
  };
}

function runState(){
  return{
    starterId:'gambler',starter:{name:'승부사'},traitId:'empty_pocket',trait:{name:'빈손주의'},
    deck:[
      {suit:'S',rank:2},{suit:'H',rank:6},
      {cardId:'core.test'},{cardId:'core.test'},{cardId:'core.damage'}
    ],
    fieldLoadout:{owned:['wide_table','loaded_table'],queuedFieldId:'loaded_table',history:[
      {action:'consume',from:'wide_table',to:null},{action:'consume',from:'wide_table',to:null},{action:'consume',from:'loaded_table',to:null}
    ]},
    runFlow:{visitedRegionIds:['region_casino','region_theater'],completedRegionIds:['region_casino'],visitedRegionBranches:[
      {regionId:'region_casino',branchId:'vip_room',branchLabel:'VIP 룸',tags:['chip','risk']},
      {regionId:'region_theater',branchId:'grand_stage',branchLabel:'대극장',tags:['field','showdown']}
    ]}
  };
}

test('M10 덱 요약은 순수/효과와 시스템 태그 분포를 함께 기록한다',()=>{
  const summary=Audit.deckSummary(runState(),runtime());
  assert.equal(summary.total,5);
  assert.equal(summary.pure,2);
  assert.equal(summary.effect,3);
  assert.equal(summary.systemTagCounts['칩'],2);
  assert.equal(summary.systemTagCounts['손패'],2);
  assert.equal(summary.systemTagCounts['직접 피해'],1);
  assert.deepEqual(summary.topSystemTags[0],{tag:'손패',count:2});
  assert.equal(summary.cardCounts['core.test'],2);
});

test('M10 지역 요약은 두 지역 조합 키와 선택 분기를 보존한다',()=>{
  const source=runState(),summary=Audit.regionSummary(source,runtime());
  assert.deepEqual(summary.regionNames,['침몰 카지노','유랑극장']);
  assert.equal(summary.pairKey,'region_casino+region_theater');
  assert.equal(summary.visitedRegionBranches[0].branchLabel,'VIP 룸');
  assert.notEqual(summary.visitedRegionBranches[0].tags,source.runFlow.visitedRegionBranches[0].tags);
});

test('M10 필드 요약은 보유/대기/실제 사용 필드를 구분하고 중복 사용은 합친다',()=>{
  const summary=Audit.fieldSummary(runState());
  assert.deepEqual(summary.ownedFieldIds,['wide_table','loaded_table']);
  assert.equal(summary.queuedFieldId,'loaded_table');
  assert.deepEqual(summary.usedFieldIds,['wide_table','loaded_table']);
});

test('M10 런 감사 결과는 정체성·필드·지역·덱을 한 객체로 묶고 결과에 저장한다',()=>{
  const run=runState(),root=runtime(),result={victory:true};run.runResult=result;
  const summary=Audit.enrichResult(run,result,root);
  assert.equal(summary.version,'M10-1');
  assert.equal(summary.identity.starterName,'승부사');
  assert.equal(summary.identity.traitName,'빈손주의');
  assert.equal(summary.regions.pairKey,'region_casino+region_theater');
  assert.equal(summary.deck.total,5);
  assert.equal(result.buildAudit,summary);
  assert.equal(run.runResult.buildAudit,summary);
  const rows=Audit.auditRows(summary);
  assert.equal(rows.length,3);
  assert(rows[0].includes('wide_table'));
  assert(rows[1].includes('침몰 카지노 → 유랑극장'));
  assert(rows[2].includes('순수 2 / 효과 3'));
});

test('M10 종료 래퍼는 동기/비동기 결과 모두 buildAudit를 남긴다',async()=>{
  Audit.resetBrowserInstallForTests();
  const syncRoot={...runtime(),RunBalanceTelemetry:{},CardSystemTags:{},run:runState(),finishRun(){const result={kind:'win'};this.run.runResult=result;return result},loseRun(){const result={kind:'lose'};this.run.runResult=result;return Promise.resolve(result)},console:{info(){}}};
  assert.equal(Audit.installBrowser(syncRoot),true);
  const win=syncRoot.finishRun();assert.equal(win.buildAudit.version,'M10-1');
  syncRoot.run=runState();const lose=await syncRoot.loseRun();assert.equal(lose.buildAudit.version,'M10-1');
});
