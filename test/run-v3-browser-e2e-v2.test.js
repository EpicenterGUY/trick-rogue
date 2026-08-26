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
  assert.ok(id,`${label} node id should exist`);
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

async function winBattleNode(cdp,id){
  await clickNode(cdp,id,`${id} 전투`);
  await waitFor(cdp,`document.getElementById('battleScreen').classList.contains('active')&&battle?.node?.id===${JSON.stringify(id)}`,{label:`${id} battle screen`});
  const beforeAct=await evaluate(cdp,'run.actId');
  await evaluate(cdp,'winBattle()');
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')",{timeout:6000,label:`${id} reward overlay`});
  await settleReward(cdp,id,beforeAct);
}

async function finishEventNode(cdp,id){
  await clickNode(cdp,id,`${id} 이벤트`);
  await waitFor(cdp,`document.getElementById('overlay').classList.contains('show')&&RunEvents.ensureEventState(run).activeEvent?.nodeId===${JSON.stringify(id)}`,{label:`${id} event modal`});
  const result=await evaluate(cdp,`(()=>{
    const active=RunEvents.ensureEventState(run).activeEvent;
    const node=run.map.find(n=>n.id===active.nodeId);
    const def=RunEvents.eventDefinition(active.eventId);
    return RunEvents.finishEvent(run,node,def,{runtimeRoot:globalThis,result:{source:'run-v3-browser-e2e'}});
  })()`);
  assert.equal(result?.ok,true,`${id} event should complete`);
  await waitFor(cdp,"run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')",{label:`${id} event completion`});
}

async function restAtCamp(cdp,id){
  await clickNode(cdp,id,`${id} 캠프`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='캠프'",{label:`${id} camp modal`});
  const restSelector="[...document.querySelectorAll('#modal .choice')].find(b=>b.querySelector('b')?.textContent.trim()==='휴식')";
  const done=`run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')`;
  await sleep(180);
  const deadline=Date.now()+3500;
  while(Date.now()<deadline&&!(await evaluate(cdp,done))){
    const exists=await evaluate(cdp,`!!(${restSelector})`);
    if(exists)await clickElement(cdp,restSelector,`${id} 캠프 휴식`,{hitTest:true,xRatio:.25,yRatio:.25});
    await sleep(180);
  }
  await waitFor(cdp,done,{label:`${id} camp completion`});
}

async function leaveShop(cdp,id){
  await clickNode(cdp,id,`${id} 상점`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='상점'",{label:`${id} shop modal`});
  await clickElement(cdp,"[...document.querySelectorAll('#modal .choice')].find(b=>b.querySelector('b')?.textContent.trim()==='나가기')",`${id} 상점 나가기`,{hitTest:true});
  await waitFor(cdp,"run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')",{label:`${id} shop completion`});
}

async function selectFirstRegion(cdp,expectedStage){
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='지역 선택'",{label:'region choice'});
  const offers=await evaluate(cdp,'RunFlowV2.regionChoiceModel(run).offerIds');
  assert.ok(Array.isArray(offers)&&offers.length>=2,'region choice should expose at least two regions');
  await clickElement(cdp,"document.querySelector('#modal .choice')",'첫 지역 선택',{hitTest:true});
  await waitFor(cdp,`run.runStage===${expectedStage}&&document.getElementById('mapScreen').classList.contains('active')&&!document.getElementById('overlay').classList.contains('show')`,{label:`stage ${expectedStage} region map`});
  return offers[0];
}

async function acceptTransition(cdp,text,stage){
  await waitFor(cdp,`document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent.includes(${JSON.stringify(text)})`,{label:`${text} transition`});
  await clickElement(cdp,"document.querySelector('#modal .choice')",`${text} 이동`,{hitTest:true});
  await waitFor(cdp,`run.runStage===${stage}&&document.getElementById('mapScreen').classList.contains('active')&&!document.getElementById('overlay').classList.contains('show')`,{label:`stage ${stage} map`});
}

async function saveReloadContinue(cdp,url){
  const before=await evaluate(cdp,`(()=>{
    const saved=saveRunCheckpoint({reason:'run-v3-browser-e2e'});
    return{ok:saved.ok,fp:RunPersistence.runFingerprint(run),stage:run.runStage,actId:run.actId,branches:run.runFlow.visitedRegionBranches.length};
  })()`);
  assert.equal(before.ok,true,'checkpoint should save');
  assert.equal(before.stage,3,'checkpoint should be after first branch selection');
  await cdp.send('Page.navigate',{url});
  await waitFor(cdp,"document.readyState==='complete'",{label:'reload'});
  await waitFor(cdp,"document.getElementById('continueRunBtn')&&!document.getElementById('continueRunBtn').disabled",{label:'continue enabled'});
  await clickElement(cdp,"#continueRunBtn",'계속하기',{hitTest:true});
  await waitFor(cdp,"!!run&&document.getElementById('mapScreen').classList.contains('active')",{label:'continued map'});
  const after=await evaluate(cdp,"({fp:RunPersistence.runFingerprint(run),stage:run.runStage,actId:run.actId,branches:run.runFlow.visitedRegionBranches.length})");
  assert.deepEqual(after,{fp:before.fp,stage:before.stage,actId:before.actId,branches:before.branches},'reload should preserve checkpoint state');
}

async function availableNodeId(cdp,predicate){
  return evaluate(cdp,`(()=>run.map.find(n=>run.available.has(n.id)&&(${predicate})(n))?.id||null)()`);
}

async function clearRegionRightPath(cdp,{saveAfterBranch=false,url=null}={}){
  const entry=await availableNodeId(cdp,'n=>n.row===0&&n.type===\'battle\'');assert.ok(entry,'region entry battle');await winBattleNode(cdp,entry);
  const branch=await availableNodeId(cdp,'n=>n.branchEntry===true&&n.type===\'battle\'');assert.ok(branch,'right branch battle');await winBattleNode(cdp,branch);
  if(saveAfterBranch)await saveReloadContinue(cdp,url);
  const shop=await availableNodeId(cdp,'n=>n.type===\'shop\'');assert.ok(shop,'branch shop');await leaveShop(cdp,shop);
  const elite=await availableNodeId(cdp,'n=>n.type===\'elite\'');assert.ok(elite,'region elite');await winBattleNode(cdp,elite);
  const boss=await availableNodeId(cdp,'n=>n.type===\'boss\'');assert.ok(boss,'region boss');await winBattleNode(cdp,boss);
}

if(!ENABLED){
  test('RUN V3 전체 브라우저 E2E v2',{skip:'TRICK_RUN_V3_E2E=1 전용'},()=>{});
}else test('모바일 브라우저에서 RUN V3 8스테이지를 저장/이어하기 포함 끝까지 관통한다',{timeout:90000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required');
  const{server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',p=>runtimeErrors.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page loaded'});
    await waitFor(cdp,"typeof RunFlowV2!=='undefined'&&typeof RunStartV2!=='undefined'&&document.getElementById('startScreen').style.visibility!=='hidden'",{label:'start UI ready'});

    await clickElement(cdp,"document.querySelectorAll('#charGrid .option')[1]",'승부사 스타터',{hitTest:true});
    await clickElement(cdp,"document.querySelectorAll('#packGrid .option')[1]",'두 번째 특성',{hitTest:true});
    const selected=await evaluate(cdp,"({starter:document.querySelector('#charGrid .option.sel h3')?.textContent,trait:document.querySelector('#packGrid .option.sel h3')?.textContent})");
    assert.equal(selected.starter,'승부사');assert.ok(selected.trait);
    await clickElement(cdp,"#startScreen .startBottom .primary",'런 시작',{hitTest:true});
    await waitFor(cdp,"run?.runStage===1&&run?.actId==='common'&&run?.starterId==='gambler'&&!!run?.traitId&&document.getElementById('mapScreen').classList.contains('active')",{label:'stage 1 common'});

    await winBattleNode(cdp,'c0');
    await finishEventNode(cdp,'c1');
    await winBattleNode(cdp,'c2');
    await restAtCamp(cdp,'c3');
    await winBattleNode(cdp,'c4');

    const firstRegion=await selectFirstRegion(cdp,2);
    await clearRegionRightPath(cdp,{saveAfterBranch:true,url});
    await waitFor(cdp,"run.runStage===4&&run.runFlow.phase==='region_choice'",{label:'stage 4 second region choice'});

    const secondRegion=await selectFirstRegion(cdp,5);
    assert.notEqual(secondRegion,firstRegion,'two region visits must differ');
    await clearRegionRightPath(cdp);
    await acceptTransition(cdp,'최종 관문',7);

    await finishEventNode(cdp,'g0');
    await winBattleNode(cdp,'g1');
    await winBattleNode(cdp,'g3');
    await acceptTransition(cdp,'최종지역',8);

    await winBattleNode(cdp,'f0');
    await winBattleNode(cdp,'f2');
    await winBattleNode(cdp,'f3');
    await restAtCamp(cdp,'f4');
    await winBattleNode(cdp,'f5');

    await waitFor(cdp,"run.runComplete===true&&run.runStage===8&&run.runResult?.outcome==='clear'&&document.querySelector('#modal h2')?.textContent==='런 클리어'",{timeout:10000,label:'run clear result'});
    const final=await evaluate(cdp,"({stage:run.runStage,outcome:run.runResult.outcome,visited:run.runFlow.visitedRegionIds.length,completed:run.runFlow.completedRegionIds.length,branches:run.runFlow.visitedRegionBranches.length,journeys:run.runFlow.journeyHistory.length})");
    assert.deepEqual(final,{stage:8,outcome:'clear',visited:2,completed:2,branches:2,journeys:2});
    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);
    await new Promise(resolve=>server.close(resolve));
  }
});