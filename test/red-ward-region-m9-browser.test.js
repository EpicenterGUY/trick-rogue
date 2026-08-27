const test=require('node:test');
const assert=require('node:assert/strict');
const {
  sleep,findChrome,startStaticServer,launchChrome,createPage,evaluate,waitFor,clickElement,cleanupBrowser
}=require('./helpers/browser-cdp.js');

const ENABLED=process.env.TRICK_RUN_V3_E2E==='1';

function nodeElementExpression(id){
  return `(()=>{const i=run.map.findIndex(n=>n.id===${JSON.stringify(id)});return i<0?null:document.querySelectorAll('#mapGrid .node')[i]})()`;
}
async function clickNode(cdp,id,label=id){
  await waitFor(cdp,`document.getElementById('mapScreen').classList.contains('active')&&run?.available instanceof Set&&run.available.has(${JSON.stringify(id)})`,{label:`${label} available`});
  await clickElement(cdp,nodeElementExpression(id),label,{scroll:false,hitTest:true});
}
async function settleReward(cdp,nodeId,beforeAct){
  const done=`run&&run.currentNodeId===null&&(run.runComplete===true||run.actId!==${JSON.stringify(beforeAct)}||(run.completed instanceof Set&&run.completed.has(${JSON.stringify(nodeId)})))`;
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){
    if(await evaluate(cdp,done))return;
    const kind=await evaluate(cdp,`(()=>{
      if(document.querySelector('#modal [data-relic-reward]'))return'relic';
      if(document.querySelector('#modal .brmLeave'))return'market';
      const bs=[...document.querySelectorAll('#modal button')];
      if(bs.some(b=>(b.textContent||'').includes('자원 보상으로 바꾸기')))return'opening-skip';
      if(bs.some(b=>(b.textContent||'').includes('카드 보상 건너뛰기')))return'card-skip';
      return'';
    })()`);
    if(kind==='relic')await clickElement(cdp,"document.querySelector('#modal [data-relic-reward]')",`${nodeId} 유물 보상`,{hitTest:true});
    else if(kind==='market')await clickElement(cdp,"document.querySelector('#modal .brmLeave')",`${nodeId} 마켓 나가기`,{hitTest:true});
    else if(kind==='opening-skip')await clickElement(cdp,"[...document.querySelectorAll('#modal button')].find(b=>(b.textContent||'').includes('자원 보상으로 바꾸기'))",`${nodeId} 공통 보상 건너뛰기`,{hitTest:true});
    else if(kind==='card-skip')await clickElement(cdp,"[...document.querySelectorAll('#modal button')].find(b=>(b.textContent||'').includes('카드 보상 건너뛰기'))",`${nodeId} 카드 보상 건너뛰기`,{hitTest:true});
    else await sleep(80);
  }
  throw new Error(`reward did not settle: ${nodeId}`);
}
async function winBattleNode(cdp,id,{ward=false,expectedContentId=null}={}){
  await clickNode(cdp,id,`${id} 전투`);
  await waitFor(cdp,`document.getElementById('battleScreen').classList.contains('active')&&battle?.node?.id===${JSON.stringify(id)}`,{label:`${id} battle screen`});
  if(ward){
    await waitFor(cdp,"battle?.encounter?.contentStage==='M9-RED-WARD-1'&&battle?.enemy?.contentStage==='M9-RED-WARD-1'",{label:`${id} M9 red ward content`});
    const state=await evaluate(cdp,"({contentId:battle.node.enemyContentId,encounterId:battle.encounter?.contentId,enemyId:battle.enemy?.contentId,phase:battle.bossPhase?.id||null,managed:(battle.bossRules||[]).filter(r=>r?.redWardM9Managed===true).length,region:document.getElementById('battleScreen')?.dataset?.battleRegion||null})");
    assert.equal(state.contentId,state.encounterId,`${id} encounter content should match node`);
    assert.equal(state.contentId,state.enemyId,`${id} enemy content should match node`);
    assert.equal(state.region,'region_red_ward',`${id} should use red ward battle presentation`);
    if(expectedContentId)assert.equal(state.contentId,expectedContentId,`${id} should use ${expectedContentId}`);
    else assert.ok(['ward_bleeder','ward_orderly','ward_infected'].includes(state.contentId),`${id} should use a regular red ward enemy`);
    assert.ok(state.managed>=1,`${id} should install its red ward encounter rule`);
    if(expectedContentId==='red_director')assert.equal(state.phase,'triage','red ward boss should start in triage phase');
  }
  const beforeAct=await evaluate(cdp,'run.actId');
  await evaluate(cdp,'winBattle()');
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')",{timeout:6000,label:`${id} reward overlay`});
  await settleReward(cdp,id,beforeAct);
}
async function finishCommonEvent(cdp,id){
  await clickNode(cdp,id,`${id} 이벤트`);
  await waitFor(cdp,`document.getElementById('overlay').classList.contains('show')&&RunEvents.ensureEventState(run).activeEvent?.nodeId===${JSON.stringify(id)}`,{label:`${id} event modal`});
  const result=await evaluate(cdp,`(()=>{const active=RunEvents.ensureEventState(run).activeEvent;const node=run.map.find(n=>n.id===active.nodeId);const def=RunEvents.eventDefinition(active.eventId);return RunEvents.finishEvent(run,node,def,{runtimeRoot:globalThis,result:{source:'red-ward-m9-browser-e2e'}})})()`);
  assert.equal(result?.ok,true);
  await waitFor(cdp,"run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')",{label:`${id} event completion`});
}
async function finishRedWardEvent(cdp,id){
  await clickNode(cdp,id,`${id} 병동 이벤트`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&!!document.querySelector('#modal [data-red-ward-m9-event]')&&!!document.querySelector('#modal [data-red-ward-choice]')",{label:`${id} red ward event modal`});
  const before=await evaluate(cdp,"({eventId:document.querySelector('#modal [data-red-ward-m9-event]')?.dataset?.redWardM9Event,history:run.redWardM9?.eventHistory?.length||0})");
  assert.ok(['triage_desk','blood_donation','quarantine_test','sterile_cache'].includes(before.eventId),'red ward event should use an M9 definition');
  await clickElement(cdp,"document.querySelector('#modal [data-red-ward-choice]')",`${id} 병동 첫 선택지`,{hitTest:true});
  await waitFor(cdp,`run.currentNodeId===null&&(run.completed instanceof Set&&run.completed.has(${JSON.stringify(id)}))`,{label:`${id} red ward event completion`});
  const after=await evaluate(cdp,"({history:run.redWardM9?.eventHistory?.length||0,active:run.redWardM9?.activeEvent||null,branch:run.runFlow.visitedRegionBranches.at(-1)?.branchId||null})");
  assert.equal(after.history,before.history+1,'red ward event history should be recorded');
  assert.equal(after.active,null,'red ward event should clear active state');
  assert.equal(after.branch,'emergency_room','left red ward path should record emergency room branch');
}
async function restAtCamp(cdp,id){
  await clickNode(cdp,id,`${id} 캠프`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='캠프'",{label:`${id} camp modal`});
  const rest="[...document.querySelectorAll('#modal .choice')].find(b=>b.querySelector('b')?.textContent.trim()==='휴식')";
  const done="run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')";
  const deadline=Date.now()+3500;
  while(Date.now()<deadline&&!(await evaluate(cdp,done))){
    if(await evaluate(cdp,`!!(${rest})`))await clickElement(cdp,rest,`${id} 휴식`,{hitTest:true,xRatio:.25,yRatio:.25});
    await sleep(150);
  }
  await waitFor(cdp,done,{label:`${id} camp completion`});
}
async function chooseRegion(cdp,regionId,stage){
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='지역 선택'",{label:'region choice'});
  await clickElement(cdp,`[...document.querySelectorAll('#modal .choice')].find(b=>(b.getAttribute('onclick')||'').includes(${JSON.stringify(regionId)}))`,`${regionId} 선택`,{hitTest:true});
  await waitFor(cdp,`run.runStage===${stage}&&run.actId===${JSON.stringify(regionId)}&&document.getElementById('mapScreen').classList.contains('active')&&!document.getElementById('overlay').classList.contains('show')`,{label:`${regionId} stage ${stage}`});
}

if(!ENABLED){
  test('M9 붉은 병동 모바일 지역 E2E',{skip:'TRICK_RUN_V3_E2E=1 전용'},()=>{});
}else test('모바일 브라우저에서 붉은 병동을 선택해 이벤트·엘리트·병동장까지 관통한다',{timeout:60000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required');
  const{server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',p=>runtimeErrors.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page loaded'});
    await waitFor(cdp,"typeof RunFlowV2!=='undefined'&&typeof RedWardRegionM9!=='undefined'&&RedWardRegionM9.STAGE==='M9-RED-WARD-1'",{label:'RUN V3 + red ward ready'});

    await clickElement(cdp,"document.querySelectorAll('#charGrid .option')[0]",'정석 스타터',{hitTest:true});
    await clickElement(cdp,"document.querySelectorAll('#packGrid .option')[0]",'첫 번째 특성',{hitTest:true});
    await clickElement(cdp,"#startScreen .startBottom .primary",'런 시작',{hitTest:true});
    await waitFor(cdp,"run?.runStage===1&&run?.actId==='common'&&document.getElementById('mapScreen').classList.contains('active')",{label:'stage 1 common'});

    await winBattleNode(cdp,'c0');
    await finishCommonEvent(cdp,'c1');
    await winBattleNode(cdp,'c2');
    await restAtCamp(cdp,'c3');
    await winBattleNode(cdp,'c4');

    await chooseRegion(cdp,'region_red_ward',2);
    const map=await evaluate(cdp,"run.map.map(n=>({id:n.id,type:n.type,region:n.regionPlan?.regionId,content:RedWardRegionM9.contentIdForNode(n,run)}))");
    assert.equal(map.length,7);
    assert.deepEqual(map.map(n=>n.id),['r0','r1','r2','r3','r4','r5','r6']);
    assert.ok(map.every(n=>n.region==='region_red_ward'),'all red ward nodes should carry region metadata');
    assert.ok(map.filter(n=>['battle','elite','boss'].includes(n.type)).every(n=>n.content),'red ward combat nodes should resolve M9 content');

    await winBattleNode(cdp,'r0',{ward:true});
    await finishRedWardEvent(cdp,'r1');
    await waitFor(cdp,"run.runStage===3",{label:'red ward branch stage'});
    await restAtCamp(cdp,'r3');
    await winBattleNode(cdp,'r5',{ward:true,expectedContentId:'isolation_keeper'});
    await winBattleNode(cdp,'r6',{ward:true,expectedContentId:'red_director'});

    await waitFor(cdp,"run.runStage===4&&run.runFlow.phase==='region_choice'&&document.getElementById('overlay').classList.contains('show')",{label:'red ward boss completed'});
    const final=await evaluate(cdp,"({visited:[...run.runFlow.visitedRegionIds],completed:[...run.runFlow.completedRegionIds],branches:run.runFlow.visitedRegionBranches.map(x=>x.branchId),wardEvents:run.redWardM9?.eventHistory?.length||0,offers:[...run.runFlow.pendingRegionOfferIds]})");
    assert.equal(final.visited[0],'region_red_ward');
    assert.ok(final.completed.includes('region_red_ward'));
    assert.equal(final.branches[0],'emergency_room');
    assert.ok(final.wardEvents>=1,'at least one red ward event should resolve');
    assert.equal(final.offers.length,4,'four unvisited regions should remain after red ward');
    assert.ok(!final.offers.includes('region_red_ward'));
    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);await new Promise(resolve=>server.close(resolve));
  }
});
