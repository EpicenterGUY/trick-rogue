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
async function winBattleNode(cdp,id,{casino=false,expectedContentId=null}={}){
  await clickNode(cdp,id,`${id} 전투`);
  await waitFor(cdp,`document.getElementById('battleScreen').classList.contains('active')&&battle?.node?.id===${JSON.stringify(id)}`,{label:`${id} battle screen`});
  if(casino){
    await waitFor(cdp,"battle?.encounter?.contentStage==='M9-CASINO-1'&&battle?.enemy?.contentStage==='M9-CASINO-1'",{label:`${id} M9 casino content`});
    const state=await evaluate(cdp,"({contentId:battle.node.enemyContentId,encounterId:battle.encounter?.contentId,enemyId:battle.enemy?.contentId,phase:battle.bossPhase?.id||null,managed:(battle.bossRules||[]).filter(r=>r?.casinoM9Managed===true).length,region:document.getElementById('battleScreen')?.dataset?.battleRegion||null})");
    assert.equal(state.contentId,state.encounterId,`${id} encounter content should match node`);
    assert.equal(state.contentId,state.enemyId,`${id} enemy content should match node`);
    assert.equal(state.region,'region_casino',`${id} should use casino battle presentation`);
    if(expectedContentId)assert.equal(state.contentId,expectedContentId,`${id} should use ${expectedContentId}`);
    else assert.ok(['casino_lowroller','casino_bluffer','casino_debt_collector'].includes(state.contentId),`${id} should use a regular casino enemy`);
    if(expectedContentId==='vault_collector')assert.ok(state.managed>=1,'casino elite should install its encounter rule');
    if(expectedContentId==='drowned_house'){
      assert.equal(state.phase,'open_tables','casino boss should start in open_tables phase');
      assert.ok(state.managed>=1,'casino boss should install an M9 phase rule');
    }
  }
  const beforeAct=await evaluate(cdp,'run.actId');
  await evaluate(cdp,'winBattle()');
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')",{timeout:6000,label:`${id} reward overlay`});
  await settleReward(cdp,id,beforeAct);
}
async function finishCommonEvent(cdp,id){
  await clickNode(cdp,id,`${id} 이벤트`);
  await waitFor(cdp,`document.getElementById('overlay').classList.contains('show')&&RunEvents.ensureEventState(run).activeEvent?.nodeId===${JSON.stringify(id)}`,{label:`${id} event modal`});
  const result=await evaluate(cdp,`(()=>{const active=RunEvents.ensureEventState(run).activeEvent;const node=run.map.find(n=>n.id===active.nodeId);const def=RunEvents.eventDefinition(active.eventId);return RunEvents.finishEvent(run,node,def,{runtimeRoot:globalThis,result:{source:'casino-m9-full-run-e2e'}})})()`);
  assert.equal(result?.ok,true);
  await waitFor(cdp,"run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')",{label:`${id} event completion`});
}
async function finishCasinoEvent(cdp,id){
  await clickNode(cdp,id,`${id} 카지노 이벤트`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&!!document.querySelector('#modal [data-casino-m9-event]')&&!!document.querySelector('#modal [data-casino-choice]')",{label:`${id} casino event modal`});
  const before=await evaluate(cdp,"({eventId:document.querySelector('#modal [data-casino-m9-event]')?.dataset?.casinoM9Event,history:run.casinoM9?.eventHistory?.length||0})");
  assert.ok(['sunken_roulette','cracked_vault','lowball_river','vip_comp'].includes(before.eventId),'casino event should use an M9 definition');
  await clickElement(cdp,"document.querySelector('#modal [data-casino-choice]')",`${id} 카지노 첫 선택지`,{hitTest:true});
  await waitFor(cdp,`run.currentNodeId===null&&(run.completed instanceof Set&&run.completed.has(${JSON.stringify(id)}))`,{label:`${id} casino event completion`});
  const after=await evaluate(cdp,"({history:run.casinoM9?.eventHistory?.length||0,active:run.casinoM9?.activeEvent||null,branch:run.runFlow.visitedRegionBranches.at(-1)?.branchId||null})");
  assert.equal(after.history,before.history+1,'casino event history should be recorded');
  assert.equal(after.active,null,'casino event should clear active state');
  assert.equal(after.branch,'vip_room','left casino path should record VIP branch');
}
async function restAtCamp(cdp,id){
  await clickNode(cdp,id,`${id} 캠프`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='캠프'",{label:`${id} camp modal`});
  const rest="[...document.querySelectorAll('#modal .choice')].find(b=>b.querySelector('b')?.textContent.trim()==='휴식')";
  const done="run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')";
  const deadline=Date.now()+3500;
  while(Date.now()<deadline&&!(await evaluate(cdp,done))){if(await evaluate(cdp,`!!(${rest})`))await clickElement(cdp,rest,`${id} 휴식`,{hitTest:true,xRatio:.25,yRatio:.25});await sleep(150)}
  await waitFor(cdp,done,{label:`${id} camp completion`});
}
async function leaveShop(cdp,id){
  await clickNode(cdp,id,`${id} 상점`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='상점'",{label:`${id} shop modal`});
  await clickElement(cdp,"[...document.querySelectorAll('#modal .choice')].find(b=>b.querySelector('b')?.textContent.trim()==='나가기')",`${id} 상점 나가기`,{hitTest:true});
  await waitFor(cdp,"run.currentNodeId===null&&document.getElementById('mapScreen').classList.contains('active')",{label:`${id} shop completion`});
}
async function chooseRegion(cdp,regionId,stage){
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='지역 선택'",{label:'region choice'});
  await clickElement(cdp,`[...document.querySelectorAll('#modal .choice')].find(b=>(b.getAttribute('onclick')||'').includes(${JSON.stringify(regionId)}))`,`${regionId} 선택`,{hitTest:true});
  await waitFor(cdp,`run.runStage===${stage}&&run.actId===${JSON.stringify(regionId)}&&document.getElementById('mapScreen').classList.contains('active')&&!document.getElementById('overlay').classList.contains('show')`,{label:`${regionId} stage ${stage}`});
}
async function chooseFirstRemainingRegion(cdp,stage){
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent==='지역 선택'",{label:'second region choice'});
  const id=await evaluate(cdp,"RunFlowV2.regionChoiceModel(run).offerIds.find(id=>id!=='region_casino')");
  assert.ok(id,'a non-casino second region should remain');
  await chooseRegion(cdp,id,stage);return id;
}
async function acceptTransition(cdp,text,stage){
  await waitFor(cdp,`document.getElementById('overlay').classList.contains('show')&&document.querySelector('#modal h2')?.textContent.includes(${JSON.stringify(text)})`,{label:`${text} transition`});
  await clickElement(cdp,"document.querySelector('#modal .choice')",`${text} 이동`,{hitTest:true});
  await waitFor(cdp,`run.runStage===${stage}&&document.getElementById('mapScreen').classList.contains('active')&&!document.getElementById('overlay').classList.contains('show')`,{label:`stage ${stage} map`});
}
async function availableNodeId(cdp,predicate){return evaluate(cdp,`(()=>run.map.find(n=>run.available.has(n.id)&&(${predicate})(n))?.id||null)()`)}
async function clearGenericRightPath(cdp){
  const entry=await availableNodeId(cdp,"n=>n.row===0&&n.type==='battle'");await winBattleNode(cdp,entry);
  const branch=await availableNodeId(cdp,"n=>n.branchEntry===true&&n.type==='battle'");await winBattleNode(cdp,branch);
  const shop=await availableNodeId(cdp,"n=>n.type==='shop'");await leaveShop(cdp,shop);
  const elite=await availableNodeId(cdp,"n=>n.type==='elite'");await winBattleNode(cdp,elite);
  const boss=await availableNodeId(cdp,"n=>n.type==='boss'");await winBattleNode(cdp,boss);
}

if(!ENABLED){
  test('M9 침몰 카지노 전체 런 브라우저 E2E',{skip:'TRICK_RUN_V3_E2E=1 전용'},()=>{});
}else test('모바일 브라우저에서 침몰 카지노를 첫 지역으로 선택해 최종 보스까지 실제 런을 관통한다',{timeout:90000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required');
  const{server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',p=>runtimeErrors.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page loaded'});
    await waitFor(cdp,"typeof RunFlowV2!=='undefined'&&typeof CasinoRegionM9!=='undefined'&&CasinoRegionM9.STAGE==='M9-CASINO-1'",{label:'RUN V3 + M9 ready'});

    await clickElement(cdp,"document.querySelectorAll('#charGrid .option')[1]",'승부사 스타터',{hitTest:true});
    await clickElement(cdp,"document.querySelectorAll('#packGrid .option')[1]",'두 번째 특성',{hitTest:true});
    await clickElement(cdp,"#startScreen .startBottom .primary",'런 시작',{hitTest:true});
    await waitFor(cdp,"run?.runStage===1&&run?.actId==='common'&&document.getElementById('mapScreen').classList.contains('active')",{label:'stage 1 common'});

    await winBattleNode(cdp,'c0');await finishCommonEvent(cdp,'c1');await winBattleNode(cdp,'c2');await restAtCamp(cdp,'c3');await winBattleNode(cdp,'c4');

    await chooseRegion(cdp,'region_casino',2);
    const casinoMap=await evaluate(cdp,"run.map.map(n=>({id:n.id,type:n.type,region:n.regionPlan?.regionId,content:CasinoRegionM9.contentIdForNode(n,run)}))");
    assert.equal(casinoMap.length,7);assert.ok(casinoMap.every(n=>n.region==='region_casino'),'all casino nodes should carry casino region metadata');
    assert.ok(casinoMap.filter(n=>['battle','elite','boss'].includes(n.type)).every(n=>n.content),'casino combat nodes should resolve M9 content');

    await winBattleNode(cdp,'k0',{casino:true});
    await finishCasinoEvent(cdp,'k1');
    await waitFor(cdp,"run.runStage===3",{label:'casino branch stage'});
    await restAtCamp(cdp,'k3');
    await winBattleNode(cdp,'k5',{casino:true,expectedContentId:'vault_collector'});
    await winBattleNode(cdp,'k6',{casino:true,expectedContentId:'drowned_house'});
    await waitFor(cdp,"run.runStage===4&&run.runFlow.phase==='region_choice'",{label:'casino boss completed'});

    const secondRegion=await chooseFirstRemainingRegion(cdp,5);assert.notEqual(secondRegion,'region_casino');
    await clearGenericRightPath(cdp);
    await acceptTransition(cdp,'최종 관문',7);
    await finishCommonEvent(cdp,'g0');await winBattleNode(cdp,'g1');await winBattleNode(cdp,'g3');
    await acceptTransition(cdp,'최종지역',8);
    await winBattleNode(cdp,'f0');await winBattleNode(cdp,'f2');await winBattleNode(cdp,'f3');await restAtCamp(cdp,'f4');await winBattleNode(cdp,'f5');

    await waitFor(cdp,"run.runComplete===true&&run.runStage===8&&run.runResult?.outcome==='clear'&&document.querySelector('#modal h2')?.textContent==='런 클리어'",{timeout:10000,label:'casino full run clear'});
    const final=await evaluate(cdp,"({visited:[...run.runFlow.visitedRegionIds],completed:[...run.runFlow.completedRegionIds],branches:run.runFlow.visitedRegionBranches.map(x=>x.branchId),casinoEvents:run.casinoM9?.eventHistory?.length||0,nextBattleChips:run.casinoM9?.nextBattleChips??null,outcome:run.runResult?.outcome})");
    assert.equal(final.outcome,'clear');
    assert.equal(final.visited[0],'region_casino');assert.ok(final.completed.includes('region_casino'));
    assert.equal(final.branches[0],'vip_room');assert.ok(final.casinoEvents>=1,'at least one casino event should resolve in the run');
    assert.equal(final.nextBattleChips,0,'casino pending chips should be consumed by the next battle');
    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);await new Promise(resolve=>server.close(resolve));
  }
});
