const test=require('node:test');
const assert=require('node:assert/strict');
const {findChrome,startStaticServer,launchChrome,createPage,evaluate,waitFor,clickElement,cleanupBrowser}=require('./helpers/browser-cdp.js');

const ENABLED=process.env.TRICK_FIELD_UX_BROWSER==='1';

function nodeElementExpression(id){
  return `(()=>{const i=run.map.findIndex(n=>n.id===${JSON.stringify(id)});return i<0?null:document.querySelectorAll('#mapGrid .node')[i]})()`;
}

if(!ENABLED){
  test('M8 필드 예약/설치 모바일 브라우저 회귀',{skip:'TRICK_FIELD_UX_BROWSER=1 전용'},()=>{});
}else test('모바일에서 보유 필드를 실제 클릭으로 교체 예약하고 다음 전투에 설치한다',{timeout:30000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required');
  const{server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',p=>runtimeErrors.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page loaded'});
    await waitFor(cdp,"typeof RunFieldUX!=='undefined'&&RunFieldUX.VERSION==='M8-1'&&typeof RunFields!=='undefined'",{label:'M8 field UX runtime'});
    await clickElement(cdp,"#startScreen .startBottom .primary",'런 시작',{hitTest:true});
    await waitFor(cdp,"!!run&&document.getElementById('mapScreen').classList.contains('active')&&!!document.querySelector('[data-m8-field-panel]')",{label:'map field panel'});

    await evaluate(cdp,"(()=>{RunFields.acquireField(run,'inversion_zone',{activate:true,source:'event:test'});RunFields.acquireField(run,'resonance_floor',{activate:false,source:'shop:test'});renderMap();return true})()");
    await waitFor(cdp,"document.querySelector('[data-run-field-slot]')?.dataset.runFieldSlot==='inversion_zone'&&!!document.querySelector('[data-run-field-queue=\"resonance_floor\"]')",{label:'owned field replacement button'});
    const before=await evaluate(cdp,"({queued:run.fieldLoadout.queuedFieldId,text:document.querySelector('[data-run-field-queue=\"resonance_floor\"]')?.textContent})");
    assert.equal(before.queued,'inversion_zone');assert.match(before.text,/교체 예약/);

    await clickElement(cdp,"[data-run-field-queue=\"resonance_floor\"]",'과충전 구역 교체 예약',{hitTest:true});
    await waitFor(cdp,"run.fieldLoadout.queuedFieldId==='resonance_floor'&&document.querySelector('[data-run-field-slot]')?.dataset.runFieldSlot==='resonance_floor'",{label:'field replacement applied'});
    const selected=await evaluate(cdp,"({queued:run.fieldLoadout.queuedFieldId,pressed:document.querySelector('[data-run-field-queue=\"resonance_floor\"]')?.getAttribute('aria-pressed'),slot:document.querySelector('[data-run-field-slot]')?.textContent})");
    assert.equal(selected.queued,'resonance_floor');assert.equal(selected.pressed,'true');assert.match(selected.slot,/과충전 구역/);

    await waitFor(cdp,"run.available instanceof Set&&run.available.has('c0')",{label:'first battle available'});
    await clickElement(cdp,nodeElementExpression('c0'),'첫 전투 노드',{scroll:false,hitTest:true});
    await waitFor(cdp,"document.getElementById('battleScreen').classList.contains('active')&&battle?.field?.id==='resonance_floor'&&run.fieldLoadout.queuedFieldId===null",{label:'reserved field installed'});
    await waitFor(cdp,"document.querySelector('[data-run-field-installation=\"resonance_floor\"]')?.textContent.includes('플레이어 필드 설치')",{label:'field installation banner'});
    const installed=await evaluate(cdp,"({field:battle.field.id,source:battle.fieldSource?.type,bonus:battle.rulesOverride?.trumpBonus,banner:document.querySelector('[data-run-field-installation=\"resonance_floor\"]')?.textContent||''})");
    assert.equal(installed.field,'resonance_floor');assert.equal(installed.source,'scripted');assert.equal(installed.bonus,5);assert.match(installed.banner,/과충전 구역/);
    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);await new Promise(resolve=>server.close(resolve));
  }
});
