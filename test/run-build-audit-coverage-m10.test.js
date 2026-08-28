const test=require('node:test');
const assert=require('node:assert/strict');
const Audit=require('../run-build-audit.js');
const RunResults=require('../run-results.js');

function memoryStorage(seed={}){
  const data=new Map(Object.entries(seed));
  return{
    getItem(key){return data.has(key)?data.get(key):null},
    setItem(key,value){data.set(key,String(value))},
    removeItem(key){data.delete(key)},
    dump(){return Object.fromEntries(data)}
  };
}

function playtestRun(target,completed=true){
  return{
    deck:[],
    runFlow:{
      visitedRegionIds:[...target.targetRegionIds].reverse(),
      completedRegionIds:completed?[...target.targetRegionIds]:[target.targetRegionIds[0]],
      visitedRegionBranches:[]
    },
    m10Playtest:{
      presetId:target.id,
      label:target.label,
      starterId:target.starterId,
      traitId:target.traitId,
      targetRegionIds:[...target.targetRegionIds],
      targetRegionNames:[...target.targetRegionNames],
      feelNotes:[{type:'build_pivot',label:'빌드 전환',note:'전환',visitedRegionIds:[target.targetRegionIds[0]],deckSize:13,phase:'region'}]
    }
  };
}

test('M10 전체 지역쌍 카탈로그는 6지역에서 정확히 15개 고유 조합을 만든다',()=>{
  assert.equal(Audit.REGION_CATALOG.length,6);
  assert.equal(Audit.REGION_PAIR_TARGETS.length,15);
  assert.equal(new Set(Audit.REGION_PAIR_TARGETS.map(target=>target.pairKey)).size,15);
  assert.equal(new Set(Audit.REGION_PAIR_TARGETS.map(target=>target.id)).size,15);
  for(const target of Audit.REGION_PAIR_TARGETS){
    assert.equal(target.targetRegionIds.length,2);
    assert.equal(target.targetRegionNames.length,2);
    assert.equal(Audit.playtestPreset(target.id),target);
    assert.equal(target.pairKey,Audit.pairKeyForRegionIds(target.targetRegionIds));
  }
});

test('M10 DEV 런처는 15조합 진행도와 전체 조합 시작 버튼을 함께 표시한다',()=>{
  const html=Audit.playtestLauncherHtml();
  assert.match(html,/15조합 커버리지/);
  assert.match(html,/M10 조합 커버리지 0\/15 · 남음 15/);
  assert.match(html,/data-m10-coverage-status/);
  assert.match(html,/data-m10-coverage-list/);
  for(const target of Audit.REGION_PAIR_TARGETS)assert.match(html,new RegExp(`data-m10-playtest-preset="${target.id}"`));
});

test('M10 커버리지 저장소는 손상 데이터와 알 수 없는 조합을 안전하게 버린다',()=>{
  assert.deepEqual(Audit.normalizeCoverage('{broken'),Audit.emptyCoverage());
  const known=Audit.REGION_PAIR_TARGETS[0].pairKey;
  const normalized=Audit.normalizeCoverage({pairs:{
    [known]:{runs:'2',wins:'1',losses:1,totalFeelNotes:'4',lastFeelCount:'3',lastOutcome:'승리'},
    'region_fake+region_other':{runs:99,wins:99}
  }});
  assert.equal(normalized.pairs[known].runs,2);
  assert.equal(normalized.pairs[known].wins,1);
  assert.equal(normalized.pairs[known].totalFeelNotes,4);
  assert.equal(normalized.pairs['region_fake+region_other'],undefined);
});

test('M10 커버리지는 목표 조합을 맞춰도 두 지역을 모두 완료하기 전에는 기록하지 않는다',()=>{
  const target=Audit.REGION_PAIR_TARGETS[0],run=playtestRun(target,false),root={localStorage:memoryStorage(),RunFlowV2:{REGION_PROFILES:{}}};
  const summary=Audit.buildRunAudit(run,root);
  assert.equal(summary.playtest.matchedTargetRegions,true);
  assert.equal(summary.playtest.completedTargetRegions,false);
  const result=Audit.recordCoverage(root,run,summary,{victory:false});
  assert.equal(result.ok,false);
  assert.equal(result.reason,'target_incomplete');
  assert.equal(Audit.coverageSummary(Audit.loadCoverage(root)).completed,0);
});

test('M10 커버리지는 목표 불일치 표본을 진행도에 포함하지 않는다',()=>{
  const target=Audit.REGION_PAIR_TARGETS[0],other=Audit.REGION_PAIR_TARGETS.find(item=>item.pairKey!==target.pairKey),run=playtestRun(target,true),root={localStorage:memoryStorage(),RunFlowV2:{REGION_PROFILES:{}}};
  run.runFlow.visitedRegionIds=[...other.targetRegionIds];
  run.runFlow.completedRegionIds=[...other.targetRegionIds];
  const summary=Audit.buildRunAudit(run,root);
  assert.equal(summary.playtest.matchedTargetRegions,false);
  const result=Audit.recordCoverage(root,run,summary,{victory:true});
  assert.equal(result.ok,false);
  assert.equal(result.reason,'target_mismatch');
  assert.equal(Audit.coverageSummary(Audit.loadCoverage(root)).completed,0);
});

test('M10 커버리지는 완주한 목표 조합의 결과와 체감 기록을 브라우저 저장소에 누적한다',()=>{
  const target=Audit.REGION_PAIR_TARGETS[3],storage=memoryStorage(),root={localStorage:storage,RunFlowV2:{REGION_PROFILES:{}}},run=playtestRun(target,true),summary=Audit.buildRunAudit(run,root);
  const first=Audit.recordCoverage(root,run,summary,{victory:true});
  assert.equal(first.ok,true);
  assert.equal(first.coverage.completed,1);
  assert.equal(first.coverage.total,15);
  assert.equal(summary.playtest.coverage.recorded,true);
  const loaded=Audit.loadCoverage(root),entry=loaded.pairs[target.pairKey];
  assert.equal(entry.runs,1);
  assert.equal(entry.wins,1);
  assert.equal(entry.losses,0);
  assert.equal(entry.totalFeelNotes,1);
  assert.equal(entry.lastFeelCount,1);
  assert.equal(entry.lastOutcome,'승리');
  assert.equal(entry.lastStarterId,target.starterId);
  assert.equal(entry.lastTraitId,target.traitId);
  assert.equal(entry.lastPresetId,target.id);
  assert.match(Audit.coverageStatusText(loaded),/1\/15 · 남음 14/);
  assert.match(Audit.coverageDetailHtml(loaded),/✓/);
  assert.match(Audit.coverageDetailHtml(loaded),/체감 1/);
  assert(storage.dump()[Audit.COVERAGE_STORAGE_KEY]);
});

test('M10 같은 런의 종료 처리가 중복 호출되어도 커버리지는 한 번만 증가한다',()=>{
  const target=Audit.REGION_PAIR_TARGETS[7],root={localStorage:memoryStorage(),RunFlowV2:{REGION_PROFILES:{}}},run=playtestRun(target,true),summary=Audit.buildRunAudit(run,root);
  assert.equal(Audit.recordCoverage(root,run,summary,{kind:'win'}).ok,true);
  const duplicate=Audit.recordCoverage(root,run,summary,{kind:'win'});
  assert.equal(duplicate.ok,false);
  assert.equal(duplicate.reason,'already_recorded');
  assert.equal(Audit.loadCoverage(root).pairs[target.pairKey].runs,1);
});

test('M10 커버리지 요약은 15개 조합별 최근 결과와 누적 체감 수를 유지한다',()=>{
  const first=Audit.REGION_PAIR_TARGETS[0],second=Audit.REGION_PAIR_TARGETS[1],coverage={version:1,pairs:{
    [first.pairKey]:{runs:2,wins:1,losses:1,totalFeelNotes:5,lastFeelCount:2,lastOutcome:'패배'},
    [second.pairKey]:{runs:1,wins:1,losses:0,totalFeelNotes:3,lastFeelCount:3,lastOutcome:'승리'}
  }};
  const summary=Audit.coverageSummary(coverage);
  assert.equal(summary.total,15);
  assert.equal(summary.completed,2);
  assert.equal(summary.remaining,13);
  const row=summary.rows.find(item=>item.pairKey===first.pairKey);
  assert.equal(row.runs,2);
  assert.equal(row.wins,1);
  assert.equal(row.losses,1);
  assert.equal(row.totalFeelNotes,5);
  assert.equal(row.lastOutcome,'패배');
});

test('M10 커버리지는 RunResults의 clear/defeat 결과를 실제 승리/패배로 누적한다',()=>{
  const target=Audit.REGION_PAIR_TARGETS[10],storage=memoryStorage(),root={localStorage:storage,RunFlowV2:{REGION_PROFILES:{}}};
  const clearRun=playtestRun(target,true),clearSummary=Audit.buildRunAudit(clearRun,root),clearResult=RunResults.recordRunResult(clearRun,'clear',{runtimeRoot:root});
  assert.equal(clearResult.victory,true);
  assert.equal(Audit.recordCoverage(root,clearRun,clearSummary,clearResult).ok,true);
  const defeatRun=playtestRun(target,true),defeatSummary=Audit.buildRunAudit(defeatRun,root),defeatResult=RunResults.recordRunResult(defeatRun,'defeat',{runtimeRoot:root});
  assert.equal(defeatResult.victory,false);
  assert.equal(Audit.recordCoverage(root,defeatRun,defeatSummary,defeatResult).ok,true);
  const entry=Audit.loadCoverage(root).pairs[target.pairKey];
  assert.equal(entry.runs,2);
  assert.equal(entry.wins,1);
  assert.equal(entry.losses,1);
  assert.equal(entry.lastOutcome,'패배');
});
