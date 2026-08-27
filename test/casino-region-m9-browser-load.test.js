const test=require('node:test');
const assert=require('node:assert/strict');
const {
  findChrome,startStaticServer,launchChrome,createPage,evaluate,waitFor,cleanupBrowser
}=require('./helpers/browser-cdp.js');

const ENABLED=process.env.TRICK_RUN_V3_E2E==='1';

if(!ENABLED){
  test('M9 카지노 브라우저 런타임 로드',{skip:'TRICK_RUN_V3_E2E=1 전용'},()=>{});
}else test('RUN V3 브라우저 로더가 침몰 카지노 런타임을 실제로 적재한다',{timeout:20000},async()=>{
  const chrome=findChrome();
  assert.ok(chrome,'Chrome/Chromium executable is required');
  const{server,url}=await startStaticServer();
  let browser=null,cdp=null;
  const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);
    cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',p=>runtimeErrors.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page loaded'});
    await waitFor(cdp,"typeof CasinoRegionM9!=='undefined'&&CasinoRegionM9.STAGE==='M9-CASINO-1'&&CasinoRegionM9.REGION_ID==='region_casino'",{label:'M9 casino runtime'});
    const snapshot=await evaluate(cdp,"({stage:CasinoRegionM9.STAGE,regionId:CasinoRegionM9.REGION_ID,contentErrors:CasinoRegionM9.validateContent(),contentCount:Object.keys(CasinoRegionM9.CONTENT).length,eventCount:Object.keys(CasinoRegionM9.EVENT_DEFINITIONS).length})");
    assert.deepEqual(snapshot,{stage:'M9-CASINO-1',regionId:'region_casino',contentErrors:[],contentCount:5,eventCount:4});
    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);
    await new Promise(resolve=>server.close(resolve));
  }
});
