const test=require('node:test');
const assert=require('node:assert/strict');
const {
  findChrome,startStaticServer,launchChrome,createPage,evaluate,waitFor,clickElement,cleanupBrowser
}=require('./helpers/browser-cdp.js');

const ENABLED=process.env.TRICK_BROWSER_SMOKE==='1';

if(!ENABLED){
  test('M10 DEV 플레이테스트 모바일 브라우저 스모크',{skip:'TRICK_BROWSER_SMOKE=1 전용'},()=>{});
}else test('M10 DEV 패널에서 대표런·체감 메모·15조합·결과 커버리지가 실제 브라우저 체인으로 동작한다',{timeout:30000},async()=>{
  const chrome=findChrome();
  assert.ok(chrome,'Chrome/Chromium executable is required for M10 DEV browser smoke');
  const {server,url}=await startStaticServer();
  let browser=null,cdp=null;
  const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);
    cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.exception?.description||params.exceptionDetails?.text||'unknown runtime exception'));

    await cdp.send('Page.navigate',{url:`${url}?dev=1`});
    await waitFor(cdp,"document.readyState==='complete'",{label:'M10 DEV page load'});
    await waitFor(cdp,"typeof RunBuildAudit!=='undefined' && typeof TrickDevTools!=='undefined' && !!document.getElementById('trickDevToggle')",{label:'M10 DEV runtime'});
    await waitFor(cdp,"!!document.querySelector('#trickDevPanel [data-m10-playtest-launcher]')",{label:'M10 launcher mount'});

    assert.equal(await evaluate(cdp,"document.getElementById('trickDevPanel').hidden"),true,'DEV panel starts closed');
    await clickElement(cdp,'#trickDevToggle','DEV 패널 열기',{hitTest:true});
    await waitFor(cdp,"document.getElementById('trickDevPanel').hidden===false",{label:'open DEV panel'});

    const counts=await evaluate(cdp,"(()=>{const root=document.querySelector('[data-m10-playtest-launcher]');return{all:root?.querySelectorAll('[data-m10-playtest-preset]').length||0,representative:[...root?.querySelectorAll('[data-m10-playtest-preset]')||[]].filter(el=>/^m10-0[1-5]$/.test(el.dataset.m10PlaytestPreset)).length,pairs:[...root?.querySelectorAll('[data-m10-playtest-preset]')||[]].filter(el=>el.dataset.m10PlaytestPreset.startsWith('m10-pair-')).length,feel:root?.querySelectorAll('[data-m10-feel-type]').length||0}})()");
    assert.deepEqual(counts,{all:20,representative:5,pairs:15,feel:6});
    assert.match(await evaluate(cdp,"document.querySelector('[data-m10-coverage-status]')?.textContent||''"),/0\/15/);

    await clickElement(cdp,'[data-m10-playtest-preset="m10-02"]','M10 대표런 m10-02',{scroll:true,hitTest:true});
    await waitFor(cdp,"typeof run!=='undefined' && run?.m10Playtest?.presetId==='m10-02'",{label:'m10-02 run start'});
    const representative=await evaluate(cdp,"({starterId:run.starterId,traitId:run.traitId,target:[...run.m10Playtest.targetRegionIds],visited:[...(run.runFlow?.visitedRegionIds||[])],deckSize:run.deck?.length||0,pure:(run.deck||[]).filter(card=>typeof isPureCard==='function'&&isPureCard(card)).length,map:document.getElementById('mapScreen')?.classList.contains('active')})");
    assert.equal(representative.starterId,'gambler');
    assert.equal(representative.traitId,'empty_pocket');
    assert.deepEqual(representative.target,['region_frontier','region_casino']);
    assert.deepEqual(representative.visited,[],'DEV preset must not force region visits');
    assert.equal(representative.deckSize,12);
    assert.equal(representative.pure,8);
    assert.equal(representative.map,true);

    await evaluate(cdp,"document.querySelector('[data-m10-feel-note]').value='  두 번째   보상에서 방향 전환  '");
    await clickElement(cdp,'[data-m10-feel-type="build_pivot"]','M10 체감 빌드 전환',{scroll:true,hitTest:true});
    await waitFor(cdp,"run?.m10Playtest?.feelNotes?.length===1",{label:'feel note recorded'});
    const note=await evaluate(cdp,"run.m10Playtest.feelNotes[0]");
    assert.equal(note.type,'build_pivot');
    assert.equal(note.note,'두 번째 보상에서 방향 전환');
    assert.deepEqual(note.visitedRegionIds,[]);
    assert.equal(note.deckSize,12);

    await clickElement(cdp,"document.querySelector('[data-m10-playtest-launcher] details summary')",'전체 15조합 펼치기',{scroll:true,hitTest:true});
    await waitFor(cdp,"document.querySelector('[data-m10-playtest-launcher] details')?.open===true",{label:'15-pair details open'});
    await clickElement(cdp,'[data-m10-playtest-preset="m10-pair-15"]','M10 전체조합 15번',{scroll:true,hitTest:true});
    await waitFor(cdp,"run?.m10Playtest?.presetId==='m10-pair-15'",{label:'m10 pair 15 run start'});
    const pair=await evaluate(cdp,"({target:[...run.m10Playtest.targetRegionIds],visited:[...(run.runFlow?.visitedRegionIds||[])],feelCount:run.m10Playtest.feelNotes?.length||0})");
    assert.deepEqual(pair.target,['region_red_ward','region_scrap_market']);
    assert.deepEqual(pair.visited,[],'15-pair launcher must also preserve manual region choice');
    assert.equal(pair.feelCount,0,'new sample run starts with a fresh feel-note list');

    const finalized=await evaluate(cdp,"(()=>{const ids=[...run.m10Playtest.targetRegionIds];run.runFlow.visitedRegionIds=[...ids];run.runFlow.completedRegionIds=[...ids];run.runComplete=true;run.runStage=8;run.actId='final';const result=finishRun();const audit=run.runResult?.buildAudit?.playtest||null;const coverage=RunBuildAudit.loadCoverage(globalThis);const entry=coverage.pairs?.[RunBuildAudit.pairKeyForRegionIds(ids)]||null;return{outcome:result?.outcome||null,victory:result?.victory,matched:audit?.matchedTargetRegions,completed:audit?.completedTargetRegions,coverageRecorded:audit?.coverage?.recorded===true,coverageCompleted:audit?.coverage?.completed||0,coverageTotal:audit?.coverage?.total||0,runs:entry?.runs||0,wins:entry?.wins||0,losses:entry?.losses||0,lastOutcome:entry?.lastOutcome||null,m10Rows:document.querySelectorAll('#modal [data-m10-build-audit]').length,title:document.querySelector('#modal h2')?.textContent||''};})()");
    assert.equal(finalized.outcome,'clear');
    assert.equal(finalized.victory,true);
    assert.equal(finalized.matched,true);
    assert.equal(finalized.completed,true);
    assert.equal(finalized.coverageRecorded,true);
    assert.equal(finalized.coverageCompleted,1);
    assert.equal(finalized.coverageTotal,15);
    assert.equal(finalized.runs,1);
    assert.equal(finalized.wins,1);
    assert.equal(finalized.losses,0);
    assert.equal(finalized.lastOutcome,'승리');
    assert.ok(finalized.m10Rows>=4,'result modal should render M10 audit rows');
    assert.equal(finalized.title,'런 클리어');
    assert.match(await evaluate(cdp,"document.querySelector('[data-m10-coverage-status]')?.textContent||''"),/1\/15/);

    assert.deepEqual(runtimeErrors,[],'M10 DEV browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);
    await new Promise(resolve=>server.close(resolve));
  }
});
