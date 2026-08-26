const test=require('node:test');
const assert=require('node:assert/strict');
const {
  findChrome,startStaticServer,launchChrome,createPage,evaluate,waitFor,clickElement,cleanupBrowser
}=require('./helpers/browser-cdp.js');

const ENABLED=process.env.TRICK_BROWSER_SMOKE==='1';

if(!ENABLED){
  test('키워드 포함 액션 버튼 모바일 클릭 회귀 테스트',{skip:'TRICK_BROWSER_SMOKE=1 전용'},()=>{});
}else test('390x844 모바일에서 드로우·필드 키워드가 액션 버튼 탭을 가로채지 않는다',{timeout:20000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required');
  const {server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port,{width:390,height:844});
    cdp.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.exception?.description||params.exceptionDetails?.text||'unknown runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page load'});
    await waitFor(cdp,"typeof Compendium8H!=='undefined' && typeof showModal==='function' && showModal.__compendium8H===true",{label:'keyword modal wrapper'});

    await evaluate(cdp,`(()=>{
      globalThis.__keywordActionProbe=0;
      document.getElementById('keywordHelp8H')?.remove();
      showModal('<button id="keyword-action-probe" type="button" onclick="globalThis.__keywordActionProbe++">드로우 · 필드 설치</button><p id="keyword-copy-probe">드로우 · 필드</p>');
      return true;
    })()`);
    await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')",{label:'probe modal'});

    assert.equal(await evaluate(cdp,"document.querySelectorAll('#keyword-action-probe .compKeyword').length"),0,'action button must not contain nested keyword buttons');
    assert.equal(await evaluate(cdp,"document.querySelectorAll('#keyword-copy-probe .compKeyword').length"),2,'normal explanatory copy should still expose keyword help');

    await clickElement(cdp,'#keyword-action-probe','드로우·필드 액션 버튼',{hitTest:true});
    assert.equal(await evaluate(cdp,'globalThis.__keywordActionProbe'),1,'parent action should receive the tap');
    assert.equal(await evaluate(cdp,"!!document.getElementById('keywordHelp8H')"),false,'action tap must not open glossary help');
    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    await cleanupBrowser(browser,cdp);
    await new Promise(resolve=>server.close(resolve));
  }
});
