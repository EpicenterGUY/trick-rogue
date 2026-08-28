const test=require('node:test');
const assert=require('node:assert/strict');
const Audit=require('../run-build-audit.js');
const Cards=require('../cards.js');
const RunStartV2=require('../run-start-v2.js');

function runtime(){
  return{
    CARD_DEFINITION_BY_ID:{
      'core.test':{id:'core.test',systemTags:['칩','손패'],effects:[{trigger:'on_play',action:'gain_chips',value:1}]},
      'core.damage':{id:'core.damage',effects:[{trigger:'on_play',action:'damage_enemy',value:3}]}
    },
    RunFlowV2:{REGION_PROFILES:{
      region_theater:{name:'유랑극장'},region_observatory:{name:'안개 관측소'},region_frontier:{name:'황야 전선'},region_casino:{name:'침몰 카지노'},region_red_ward:{name:'붉은 병동'},region_scrap_market:{name:'폐품 시장'}
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
  assert.equal(summary.topSystemTags[0].count,2);
  assert.deepEqual(new Set(summary.topSystemTags.filter(entry=>entry.count===2).map(entry=>entry.tag)),new Set(['칩','손패']));
  assert.equal(summary.cardCounts['core.test'],2);
});

test('M10 덱 분류는 실제 카드 생성기의 순수 카드 판정과 네 스타터 8+4 구성을 보존한다',()=>{
  for(const starterId of ['common','gambler','trickster','survivor']){
    let uid=0;
    const deck=RunStartV2.buildStarterDeck(starterId,Cards,{newUid(){uid+=1;return`${starterId}-${uid}`}});
    assert.equal(deck.length,12);
    assert.equal(deck.filter(card=>Cards.isPureCard(card)).length,8);
    const summary=Audit.deckSummary({deck},Cards);
    assert.equal(summary.total,12);
    assert.equal(summary.pure,8);
    assert.equal(summary.effect,4);
    assert.equal(summary.pure+summary.effect,summary.total);
  }
});

test('M10 대표 5런 프리셋은 6지역과 4스타터를 분산 커버한다',()=>{
  assert.equal(Audit.PLAYTEST_PRESETS.length,5);
  const regions=new Set(Audit.PLAYTEST_PRESETS.flatMap(preset=>preset.targetRegionIds));
  assert.deepEqual([...regions].sort(),['region_theater','region_observatory','region_frontier','region_casino','region_red_ward','region_scrap_market'].sort());
  assert.deepEqual([...new Set(Audit.PLAYTEST_PRESETS.map(preset=>preset.starterId))].sort(),['common','gambler','trickster','survivor'].sort());
  assert.equal(new Set(Audit.PLAYTEST_PRESETS.map(preset=>preset.traitId)).size,5);
  assert.equal(Audit.playtestPreset('m10-02').starterId,'gambler');
  assert.equal(Audit.playtestPreset('missing'),null);
});

test('M10 DEV 런처는 지역을 직접 선택한다는 조건과 다섯 표본 버튼을 표시한다',()=>{
  const html=Audit.playtestLauncherHtml();
  assert.match(html,/지역 선택은 직접/);
  for(const preset of Audit.PLAYTEST_PRESETS)assert.match(html,new RegExp(`data-m10-playtest-preset="${preset.id}"`));
  assert.equal(Audit.isDeveloperMode({location:{search:'?dev=1'}}),true);
  assert.equal(Audit.isDeveloperMode({location:{search:'?dev=0'}}),false);
});

test('M10 DEV 표본 시작은 스타터와 특성만 고정하고 지역 방문은 강제하지 않는다',()=>{
  let uid=0;
  const root={
    ...Cards,
    RunStartV2,
    beginRun(){this.run={hp:1,maxHp:1,gold:0,deck:[],runFlow:{visitedRegionIds:[],completedRegionIds:[],visitedRegionBranches:[]}};return this.run},
    newUid(){uid+=1;return`dev-${uid}`},
    showScreen(screen){this.screen=screen},
    renderMap(){this.rendered=true}
  };
  const result=Audit.startPlaytestPreset(root,'m10-02');
  assert.equal(result.ok,true);
  assert.equal(root.run.starterId,'gambler');
  assert.equal(root.run.traitId,'empty_pocket');
  assert.equal(root.run.deck.length,12);
  assert.equal(root.run.deck.filter(card=>Cards.isPureCard(card)).length,8);
  assert.deepEqual(root.run.m10Playtest.targetRegionIds,['region_frontier','region_casino']);
  assert.deepEqual(root.run.runFlow.visitedRegionIds,[]);
  assert.equal(root.screen,'mapScreen');
  assert.equal(root.rendered,true);
  const summary=Audit.buildRunAudit(root.run,{...root,RunFlowV2:{REGION_PROFILES:{}}});
  assert.equal(summary.playtest.presetId,'m10-02');
  assert.deepEqual(summary.playtest.targetRegionIds,['region_frontier','region_casino']);
  assert.match(Audit.playtestStatusText(root.run),/방문 0\/2/);
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
  run.m10Playtest={presetId:'m10-04',label:'표본 4 · 변칙',starterId:'trickster',traitId:'suit_collector',targetRegionIds:['region_theater','region_casino'],targetRegionNames:['유랑극장','침몰 카지노']};
  const summary=Audit.enrichResult(run,result,root);
  assert.equal(summary.version,'M10-1');
  assert.equal(summary.identity.starterName,'승부사');
  assert.equal(summary.identity.traitName,'빈손주의');
  assert.equal(summary.regions.pairKey,'region_casino+region_theater');
  assert.equal(summary.deck.total,5);
  assert.equal(summary.playtest.presetId,'m10-04');
  assert.equal(result.buildAudit,summary);
  assert.equal(run.runResult.buildAudit,summary);
  const rows=Audit.auditRows(summary);
  assert.equal(rows.length,3);
  assert(rows[0].includes('wide_table'));
  assert(rows[1].includes('침몰 카지노 → 유랑극장'));
  assert(rows[1].includes('목표 유랑극장 → 침몰 카지노'));
  assert(rows[2].includes('순수 2 / 효과 3'));
});

test('M10 종료 래퍼는 동기/비동기 결과 모두 buildAudit를 남긴다',async()=>{
  Audit.resetBrowserInstallForTests();
  const syncRoot={...runtime(),RunBalanceTelemetry:{},CardSystemTags:{},run:runState(),finishRun(){const result={kind:'win'};this.run.runResult=result;return result},loseRun(){const result={kind:'lose'};this.run.runResult=result;return Promise.resolve(result)},console:{info(){}}};
  assert.equal(Audit.installBrowser(syncRoot),true);
  const win=syncRoot.finishRun();assert.equal(win.buildAudit.version,'M10-1');
  syncRoot.run=runState();const lose=await syncRoot.loseRun();assert.equal(lose.buildAudit.version,'M10-1');
});
