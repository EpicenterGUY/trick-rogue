const test=require('node:test');
const assert=require('node:assert/strict');
const {
  findChrome,startStaticServer,launchChrome,createPage,evaluate,waitFor,clickElement,cleanupBrowser
}=require('./helpers/browser-cdp.js');

const ENABLED=process.env.TRICK_RUN_V3_E2E==='1';

async function startRegionBattle(cdp,{id,regionId,type='battle',enemyTag='standard'}){
  await evaluate(cdp,`(()=>{
    run.actId=${JSON.stringify(regionId)};
    run.runFlow.currentRegionId=${JSON.stringify(regionId)};
    const node={id:${JSON.stringify(id)},type:${JSON.stringify(type)},next:[],regionPlan:{regionId:${JSON.stringify(regionId)},enemyTag:${JSON.stringify(enemyTag)}}};
    startBattle(node);
  })()`);
  await waitFor(cdp,`document.getElementById('battleScreen').classList.contains('active')&&battle?.node?.id===${JSON.stringify(id)}`,{label:`${id} battle`});
  return evaluate(cdp,"({enemyName:battle.enemy.name,contentId:battle.node.enemyContentId,profileId:battle.encounterProfileId,enemyCardContentId:battle.enemyCard?.enemyContentId||null,ruleIds:(battle.encounterRules||[]).map(r=>r.id),region:document.getElementById('battleScreen').dataset.legacyRegionM9||null})");
}

if(!ENABLED){
  test('M9 기존 3지역 브라우저 통합',{skip:'TRICK_RUN_V3_E2E=1 전용'},()=>{});
}else test('브라우저에서 기존 3지역 보강 적·엘리트·이벤트가 실제 런타임에 적용된다',{timeout:30000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required');
  const{server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',p=>runtimeErrors.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page loaded'});
    await waitFor(cdp,"typeof LegacyRegionsM9!=='undefined'&&LegacyRegionsM9.STAGE==='M9-LEGACY-REGIONS-1'&&typeof startBattle==='function'&&typeof showEvent==='function'",{label:'legacy region runtime'});

    const catalog=await evaluate(cdp,"({errors:LegacyRegionsM9.validateContent(),regions:LegacyRegionsM9.REGION_IDS,normal:Object.values(LegacyRegionsM9.CONTENT).filter(x=>x.type==='battle').length,elite:Object.values(LegacyRegionsM9.CONTENT).filter(x=>x.type==='elite').length,eventCounts:Object.fromEntries(LegacyRegionsM9.REGION_IDS.map(id=>[id,LegacyRegionsM9.combinedEventIds(id).length]))})");
    assert.deepEqual(catalog,{errors:[],regions:['region_theater','region_observatory','region_frontier'],normal:7,elite:2,eventCounts:{region_theater:4,region_observatory:4,region_frontier:4}});

    await clickElement(cdp,"document.querySelectorAll('#charGrid .option')[0]",'스타터',{hitTest:true});
    await clickElement(cdp,"document.querySelectorAll('#packGrid .option')[0]",'특성',{hitTest:true});
    await clickElement(cdp,"#startScreen .startBottom .primary",'런 시작',{hitTest:true});
    await waitFor(cdp,"!!run&&run.runFlow&&document.getElementById('mapScreen').classList.contains('active')",{label:'run started'});

    assert.deepEqual(await startRegionBattle(cdp,{id:'m9-theater-standard',regionId:'region_theater',enemyTag:'standard'}),{
      enemyName:'무대 진행요원',contentId:'theater_stagehand',profileId:'legacy-m9:theater_stagehand',enemyCardContentId:'theater_stagehand',ruleIds:['stagehand_setup'],region:'region_theater'
    });
    assert.deepEqual(await startRegionBattle(cdp,{id:'m9-theater-elite',regionId:'region_theater',type:'elite',enemyTag:'pressure'}),{
      enemyName:'백스테이지 연출가',contentId:'theater_backstage_director',profileId:'legacy-m9:theater_backstage_director',enemyCardContentId:'theater_backstage_director',ruleIds:['director_house_rules'],region:'region_theater'
    });
    assert.deepEqual(await startRegionBattle(cdp,{id:'m9-observatory-elite',regionId:'region_observatory',type:'elite',enemyTag:'observer'}),{
      enemyName:'렌즈 감시관',contentId:'observatory_lens_warden',profileId:'legacy-m9:observatory_lens_warden',enemyCardContentId:'observatory_lens_warden',ruleIds:['warden_lens_lock'],region:'region_observatory'
    });
    assert.deepEqual(await startRegionBattle(cdp,{id:'m9-frontier-armored',regionId:'region_frontier',enemyTag:'armored'}),{
      enemyName:'철갑 보급병',contentId:'frontier_bulwark',profileId:'legacy-m9:frontier_bulwark',enemyCardContentId:'frontier_bulwark',ruleIds:['bulwark_armor'],region:'region_frontier'
    });

    await evaluate(cdp,"(()=>{battle=null;showScreen('mapScreen');run.actId='region_theater';run.runFlow.currentRegionId='region_theater';const node={id:'m9-theater-event',type:'event',next:[],regionPlan:{regionId:'region_theater',eventTag:'field'}};run.map.push(node);run.available.add(node.id);enterNode(node)})()");
    await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')&&!!document.querySelector('[data-legacy-m9-event=\"field_rental\"]')",{label:'theater field event'});
    await clickElement(cdp,"document.querySelector('[data-legacy-m9-choice]')",'필드 대여 선택',{hitTest:true});
    await waitFor(cdp,"run.legacyRegionsM9?.eventHistory?.length===1",{label:'legacy event complete'});
    const eventResult=await evaluate(cdp,"({eventId:run.legacyRegionsM9.eventHistory[0].eventId,owned:run.fieldLoadout?.owned?.length||0,queued:run.fieldLoadout?.queuedFieldId||null,completed:run.completed.has('m9-theater-event')})");
    assert.equal(eventResult.eventId,'field_rental');assert.ok(eventResult.owned>0);assert.ok(eventResult.queued);assert.equal(eventResult.completed,true);

    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);
    await new Promise(resolve=>server.close(resolve));
  }
});