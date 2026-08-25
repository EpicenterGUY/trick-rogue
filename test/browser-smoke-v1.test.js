async function clickElement(cdp,expression,label,{scroll=false,hitTest=false}={}){
  if(scroll){
    const found=await evaluate(cdp,`(()=>{const el=${expression};if(!el)return false;el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});return true})()`);
    assert.equal(found,true,`${label} element should exist before scroll`);await sleep(80);
  }
  const point=await pointFor(cdp,expression);assert.ok(point,`${label} element should exist`);assert.equal(point.visible,true,`${label} should be visible`);assert.equal(point.disabled,false,`${label} should be enabled`);
  if(scroll)assert.ok(point.x>=0&&point.x<=390&&point.y>=0&&point.y<=844,`${label} should be inside mobile viewport after scroll`);
  if(hitTest){
    const receives=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return !!(el&&hit&&(hit===el||el.contains(hit)))})()`);
    assert.equal(receives,true,`${label} should be the topmost click target`);
  }
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
}

if(!ENABLED){
  test('모바일 브라우저 핵심 클릭 동선 스모크 테스트',{skip:'TRICK_BROWSER_SMOKE=1 전용'},()=>{});
}else test('모바일 브라우저에서 런 시작 → 전투 → 카드 사용 → 전투 덱 확인이 실제 클릭으로 동작한다',{timeout:30000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required for browser smoke test');
  const {server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port);
    cdp.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.exception?.description||params.exceptionDetails?.text||'unknown runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page load'});
    await waitFor(cdp,"typeof RunStartV2!=='undefined' && document.getElementById('startScreen').style.visibility!=='hidden'",{label:'new start UI'});
    assert.equal(await evaluate(cdp,"document.querySelector('#startScreen .sectionTitle')?.textContent"),'공용 시작 덱');

    await clickElement(cdp,"document.querySelector('#startScreen .startBottom button')",'런 시작');
    await waitFor(cdp,"document.getElementById('mapScreen').classList.contains('active') && typeof run!=='undefined' && !!run",{label:'map screen after run start'});

    await clickElement(cdp,"[...document.querySelectorAll('#mapGrid .node')].find(el=>!el.classList.contains('lock')&&!el.classList.contains('done'))",'첫 맵 노드');
    await waitFor(cdp,"document.getElementById('battleScreen').classList.contains('active') && typeof battle!=='undefined' && !!battle",{label:'battle screen'});
    await waitFor(cdp,"document.querySelectorAll('#handRow .card').length>0 && !!document.getElementById('battleDeckPile')",{label:'hand and pile HUD'});

    await clickElement(cdp,"document.querySelector('#handRow .card')",'첫 손패 카드');
    await waitFor(cdp,"!document.getElementById('playBtn').disabled",{label:'enabled play button'});
    const trickBefore=await evaluate(cdp,'battle.trick');
    await clickElement(cdp,"document.getElementById('playBtn')",'내기',{hitTest:true});
    await waitFor(cdp,`battle.trick>${Number(trickBefore)} || battle.slots.length>0`,{timeout:8000,label:'played trick'});
    await waitFor(cdp,"battle.animating===false && !document.getElementById('battleScreen').classList.contains('inputLocked')",{timeout:8000,label:'battle input unlock'});

    await clickElement(cdp,"document.getElementById('battleDeckPile')",'전투 덱',{scroll:true,hitTest:true});
    await waitFor(cdp,"document.getElementById('overlay').classList.contains('show') && document.querySelector('#modal h2')",{label:'battle deck modal'});
    const modalTitle=await evaluate(cdp,"document.querySelector('#modal h2').textContent");
    assert.match(modalTitle,/남은 전투 덱/);
    assert.deepEqual(runtimeErrors,[],'browser runtime exceptions should be empty');
  }finally{
    cdp?.close();
    if(browser?.child&&!browser.child.killed)browser.child.kill('SIGKILL');
    if(browser?.profile)await fsp.rm(browser.profile,{recursive:true,force:true}).catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
});