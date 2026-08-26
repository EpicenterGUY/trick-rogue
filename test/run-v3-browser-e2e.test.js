const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');

const ENABLED=process.env.TRICK_RUN_V3_E2E==='1';
const ROOT=path.join(__dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function findChrome(){
  const candidates=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
  for(const candidate of candidates)if(fs.existsSync(candidate))return candidate;
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{const found=execFileSync('which',[name],{encoding:'utf8'}).trim();if(found)return found}catch(_error){}
  }
  return null;
}

function contentType(file){
  const ext=path.extname(file).toLowerCase();
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'})[ext]||'application/octet-stream';
}

async function startStaticServer(){
  const server=http.createServer(async(req,res)=>{
    try{
      const parsed=new URL(req.url,'http://127.0.0.1');
      const relative=decodeURIComponent(parsed.pathname==='/'?'/index.html':parsed.pathname).replace(/^\/+/, '');
      const file=path.resolve(ROOT,relative);
      if(!file.startsWith(ROOT+path.sep)&&file!==path.join(ROOT,'index.html')){res.writeHead(403);res.end('forbidden');return}
      const data=await fsp.readFile(file);
      res.writeHead(200,{'content-type':contentType(file),'cache-control':'no-store'});res.end(data);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(String(error.message||error))}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  return{server,url:`http://127.0.0.1:${server.address().port}/index.html`};
}

async function launchChrome(chrome){
  const profile=await fsp.mkdtemp(path.join(os.tmpdir(),'trick-rogue-run-v3-'));
  const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=String(chunk)});
  const activePort=path.join(profile,'DevToolsActivePort'),deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Chrome exited early (${child.exitCode})\n${stderr}`);
    if(fs.existsSync(activePort)){
      const [port]=String(await fsp.readFile(activePort,'utf8')).trim().split(/\r?\n/);
      if(port)return{child,profile,port:Number(port)};
    }
    await sleep(50);
  }
  child.kill('SIGKILL');throw new Error(`Chrome DevTools port timeout\n${stderr}`);
}

class CdpClient{
  constructor(ws){this.ws=ws;this.nextId=1;this.pending=new Map();this.listeners=new Map();ws.addEventListener('message',event=>this.handle(event.data))}
  static async connect(url){
    const ws=new WebSocket(url);
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP websocket timeout')),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',event=>{clearTimeout(timer);reject(event.error||new Error('CDP websocket error'))},{once:true})});
    return new CdpClient(ws);
  }
  handle(raw){
    const msg=JSON.parse(String(raw));
    if(msg.id){const pending=this.pending.get(msg.id);if(!pending)return;this.pending.delete(msg.id);if(msg.error)pending.reject(new Error(`${msg.error.message} (${msg.error.code})`));else pending.resolve(msg.result);return}
    for(const listener of this.listeners.get(msg.method)||[])listener(msg.params||{});
  }
  send(method,params={}){const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  on(method,listener){const list=this.listeners.get(method)||[];list.push(listener);this.listeners.set(method,list)}
  close(){try{this.ws.close()}catch(_error){}}
}

async function createPage(debugPort){
  const target=await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'}).then(response=>{if(!response.ok)throw new Error(`create target ${response.status}`);return response.json()});
  const cdp=await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  return cdp;
}

async function evaluate(cdp,expression){
  const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Runtime.evaluate failed');
  return result.result?.value;
}

async function waitFor(cdp,expression,{timeout=10000,label=expression}={}){
  const deadline=Date.now()+timeout;let lastError=null;
  while(Date.now()<deadline){
    try{if(await evaluate(cdp,expression))return true}catch(error){lastError=error}
    await sleep(60);
  }
  throw new Error(`Timed out waiting for ${label}${lastError?`\n${lastError.message}`:''}`);
}

async function pointFor(cdp,expression){
  return evaluate(cdp,`(()=>{const el=${expression};if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,visible:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none',disabled:!!el.disabled}})()`);
}

async function clickElement(cdp,expression,label,{scroll=true,hitTest=false}={}){
  if(scroll){
    const found=await evaluate(cdp,`(()=>{const el=${expression};if(!el)return false;el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});return true})()`);
    assert.equal(found,true,`${label} element should exist before scroll`);await sleep(70);
  }
  const point=await pointFor(cdp,expression);assert.ok(point,`${label} element should exist`);assert.equal(point.visible,true,`${label} should be visible`);assert.equal(point.disabled,false,`${label} should be enabled`);
  if(hitTest){const receives=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return!!(el&&hit&&(hit===el||el.contains(hit)))})()`);assert.equal(receives,true,`${label} should receive the click`)}
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
}

function nodeExpression(id){
  return `(()=>{const index=run.map.findIndex(node=>node.id===${JSON.stringify(id)});return index<0?null:document.querySelectorAll('#mapGrid .node')[index]})()`;
}

async function clickNode(cdp,id,label=id){
  await waitFor(cdp,`document.getElementById('mapScreen').classList.contains('active') && run?.available instanceof Set && run.available.has(${JSON.stringify(id)})`,{label:`${label} available`});
  await clickElement(cdp,nodeExpression(id),label,{scroll:false,hitTest:true});
}

async function settleBattleReward(cdp,nodeId,beforeAct,{timeout=12000}={}){
  const resolved=`run && run.currentNodeId===null && (run.runComplete===true || run.actId!==${JSON.stringify(beforeAct)} || (run.completed instanceof Set && run.completed.has(${JSON.stringify(nodeId)})))`;
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(await evaluate(cdp,resolved))return true;
    const action=await evaluate(cdp,`(()=>{
      const relic=document.querySelector('#modal [data-relic-reward]');if(relic)return'relic';
      if(document.querySelector('#modal .brmLeave'))return'market';
      const buttons=[...document.querySelectorAll('#modal button')];
      if(buttons.some(button=>(button.textContent||'').includes('카드 보상 건너뛰기')))return'skip';
      return null;
    })()`);
    if(action==='relic')await clickElement(cdp,"document.querySelector('#modal [data-relic-reward]')",`${nodeId} 유물 보상`,{hitTest:true});
    else if(action==='market')await clickElement(cdp,"document.querySelector('#modal .brmLeave')",`${nodeId} 마켓 나가기`,{hitTest:true});
    else if(action==='skip')await clickElement(cdp,"[...document.querySelectorAll('#modal button')].find(button=>(button.textContent||'').includes('카드 보상 건너뛰기'))",`${nodeId} 카드 보상 건너뛰기`,{hitTest:true});
    else await sleep(80);
  }
  throw new Error(`Timed out settling reward for ${nodeId}`);
}

async function completeBattle(cdp,id){
  await clickNode(cdp,id,`${id} 전투`);
  await waitFor(cdp,`document.getElementById('battleScreen').classList.contains('active') && battle?.node?.id===${JSON.stringify(id)}`,{label:`${id} battle screen`});
  const beforeAct=await evaluate(cdp,'run.actId');
  await evaluate(cdp,'winBattle()');
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show')",{timeout:5000,label:`${id} reward overlay`});
  await settleBattleReward(cdp,id,beforeAct);
  return true;
}

async function completeEvent(cdp,id){
  await clickNode(cdp,id,`${id} 이벤트`);
  await waitFor(cdp,`document.getElementById('overlay').classList.contains('show') && RunEvents?.ensureEventState?.(run)?.activeEvent?.nodeId===${JSON.stringify(id)}`,{label:`${id} event modal`});
  const finished=await evaluate(cdp,`(()=>{const active=RunEvents.ensureEventState(run).activeEvent,node=run.map.find(item=>item.id===active.nodeId),definition=RunEvents.eventDefinition(active.eventId);return !!RunEvents.finishEvent(run,node,definition,{runtimeRoot:globalThis,result:{browserE2E:true}})?.ok})()`);
  assert.equal(finished,true,`${id} event should finish through RunEvents`);
  await waitFor(cdp,'run.currentNodeId===null && document.getElementById(\'mapScreen\').classList.contains(\'active\')',{label:`${id} event completion`});
}

async function completeCamp(cdp,id){
  await clickNode(cdp,id,`${id} 캠프`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show') && document.querySelector('#modal h2')?.textContent==='캠프'",{label:`${id} camp modal`});
  await clickElement(cdp,"document.querySelector('#modal .choice')",`${id} 휴식`,{hitTest:true});
  await waitFor(cdp,'run.currentNodeId===null && document.getElementById(\'mapScreen\').classList.contains(\'active\')',{label:`${id} camp completion`});
}

async function completeShop(cdp,id){
  await clickNode(cdp,id,`${id} 상점`);
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show') && document.querySelector('#modal h2')?.textContent==='상점'",{label:`${id} shop modal`});
  await clickElement(cdp,"[...document.querySelectorAll('#modal .choice')].find(button=>button.querySelector('b')?.textContent.trim()==='나가기')",`${id} 상점 나가기`,{hitTest:true});
  await waitFor(cdp,'run.currentNodeId===null && document.getElementById(\'mapScreen\').classList.contains(\'active\')',{label:`${id} shop completion`});
}

async function chooseFirstRegion(cdp,expectedStage){
  await waitFor(cdp,"document.getElementById('overlay').classList.contains('show') && document.querySelector('#modal h2')?.textContent==='지역 선택'",{label:'region choice modal'});
  const offered=await evaluate(cdp,"RunFlowV2.regionChoiceModel(run).offerIds");assert.ok(Array.isArray(offered)&&offered.length>=2,'region choice should offer remaining regions');
  await clickElement(cdp,"document.querySelector('#modal .choice')",'첫 지역 선택',{hitTest:true});
  await waitFor(cdp,`run.runStage===${expectedStage} && document.getElementById('mapScreen').classList.contains('active') && !document.getElementById('overlay').classList.contains('show')`,{label:`stage ${expectedStage} region map`});
  return offered[0];
}

async function closeTransition(cdp,titlePart,stage){
  await waitFor(cdp,`document.getElementById('overlay').classList.contains('show') && document.querySelector('#modal h2')?.textContent.includes(${JSON.stringify(titlePart)})`,{label:`${titlePart} transition`});
  await clickElement(cdp,"document.querySelector('#modal .choice')",`${titlePart} 확인`,{hitTest:true});
  await waitFor(cdp,`run.runStage===${stage} && document.getElementById('mapScreen').classList.contains('active') && !document.getElementById('overlay').classList.contains('show')`,{label:`stage ${stage} map`});
}

async function saveReloadContinue(cdp,url){
  const before=await evaluate(cdp,`(()=>{const saved=saveRunCheckpoint({reason:'run-v3-browser-e2e'});return{ok:saved.ok,fingerprint:RunPersistence.runFingerprint(run),stage:run.runStage,actId:run.actId,branches:run.runFlow.visitedRegionBranches.length}})()`);
  assert.equal(before.ok,true,'mid-run checkpoint should save');assert.equal(before.stage,3,'checkpoint should be at first-region branch stage');
  await cdp.send('Page.navigate',{url});
  await waitFor(cdp,"document.readyState==='complete'",{label:'reload complete'});
  await waitFor(cdp,"typeof RunPersistence!=='undefined' && document.getElementById('continueRunBtn') && !document.getElementById('continueRunBtn').disabled",{label:'continue button after reload'});
  await clickElement(cdp,"document.getElementById('continueRunBtn')",'계속하기',{hitTest:true});
  await waitFor(cdp,"document.getElementById('mapScreen').classList.contains('active') && !!run",{label:'restored map'});
  const after=await evaluate(cdp,"({fingerprint:RunPersistence.runFingerprint(run),stage:run.runStage,actId:run.actId,branches:run.runFlow.visitedRegionBranches.length})");
  assert.deepEqual(after,{fingerprint:before.fingerprint,stage:before.stage,actId:before.actId,branches:before.branches},'save/reload/continue should preserve deterministic run state');
}

function dynamicNodeBy(predicate){return `(()=>{const node=run.map.find(${predicate});return node?.id||null})()`}

if(!ENABLED){
  test('RUN V3 전체 브라우저 E2E',{skip:'TRICK_RUN_V3_E2E=1 전용'},()=>{});
}else test('모바일 브라우저에서 RUN V3 8스테이지를 저장/이어하기 포함 끝까지 관통한다',{timeout:90000},async()=>{
  const chrome=findChrome();assert.ok(chrome,'Chrome/Chromium executable is required for RUN V3 browser E2E');
  const {server,url}=await startStaticServer();let browser=null,cdp=null;const runtimeErrors=[];
  try{
    browser=await launchChrome(chrome);cdp=await createPage(browser.port);
    cdp.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.exception?.description||params.exceptionDetails?.text||'unknown runtime exception'));
    await cdp.send('Page.navigate',{url});
    await waitFor(cdp,"document.readyState==='complete'",{label:'page load'});
    await waitFor(cdp,"typeof RunFlowV2!=='undefined' && typeof RunStartV2!=='undefined' && document.getElementById('startScreen').style.visibility!=='hidden'",{label:'RUN V3 start UI'});

    await clickElement(cdp,"document.querySelectorAll('#charGrid .option')[1]",'승부사 스타터',{hitTest:true});
    await clickElement(cdp,"document.querySelectorAll('#packGrid .option')[1]",'두 번째 특성',{hitTest:true});
    const startSelection=await evaluate(cdp,'RunStartV2.selectionState()');
    assert.equal(startSelection.starterId,'gambler');assert.ok(startSelection.traitId,'trait should be selected');
    await clickElement(cdp,"#startScreen .startBottom .primary",'런 시작',{hitTest:true});
    await waitFor(cdp,"run?.runStage===1 && run?.actId==='common' && document.getElementById('mapScreen').classList.contains('active')",{label:'common stage map'});

    await completeBattle(cdp,'c0');
    await completeEvent(cdp,'c1');
    await completeBattle(cdp,'c2');
    await completeCamp(cdp,'c3');
    await completeBattle(cdp,'c4');

    const firstRegion=await chooseFirstRegion(cdp,2);assert.ok(firstRegion,'first region should be selected');
    let entry=await evaluate(cdp,dynamicNodeBy("node=>node.row===0&&node.type==='battle'"));await completeBattle(cdp,entry);
    let branchBattle=await evaluate(cdp,dynamicNodeBy("node=>node.branchEntry&&node.type==='battle'"));await completeBattle(cdp,branchBattle);
    await waitFor(cdp,'run.runStage===3 && run.runFlow.visitedRegionBranches.length===1',{label:'first region branch recorded'});
    await saveReloadContinue(cdp,url);
    let shop=await evaluate(cdp,dynamicNodeBy("node=>node.type==='shop'&&run.available.has(node.id)"));await completeShop(cdp,shop);
    let elite=await evaluate(cdp,dynamicNodeBy("node=>node.type==='elite'&&run.available.has(node.id)"));await completeBattle(cdp,elite);
    let boss=await evaluate(cdp,dynamicNodeBy("node=>node.type==='boss'&&run.available.has(node.id)"));await completeBattle(cdp,boss);
    await waitFor(cdp,"run.runStage===4 && run.runFlow.phase==='region_choice'",{label:'first region boss -> second region choice'});

    const secondRegion=await chooseFirstRegion(cdp,5);assert.notEqual(secondRegion,firstRegion,'second region must differ from first');
    entry=await evaluate(cdp,dynamicNodeBy("node=>node.row===0&&node.type==='battle'"));await completeBattle(cdp,entry);
    branchBattle=await evaluate(cdp,dynamicNodeBy("node=>node.branchEntry&&node.type==='battle'"));await completeBattle(cdp,branchBattle);
    await waitFor(cdp,'run.runStage===6 && run.runFlow.visitedRegionBranches.length===2',{label:'second region branch recorded'});
    shop=await evaluate(cdp,dynamicNodeBy("node=>node.type==='shop'&&run.available.has(node.id)"));await completeShop(cdp,shop);
    elite=await evaluate(cdp,dynamicNodeBy("node=>node.type==='elite'&&run.available.has(node.id)"));await completeBattle(cdp,elite);
    boss=await evaluate(cdp,dynamicNodeBy("node=>node.type==='boss'&&run.available.has(node.id)"));await completeBattle(cdp,boss);
    await closeTransition(cdp,'최종 관문',7);

    await completeEvent(cdp,'g0');
    await completeBattle(cdp,'g1');
    await completeBattle(cdp,'g3');
    await closeTransition(cdp,'최종지역',8);

    await completeBattle(cdp,'f0');
    await completeBattle(cdp,'f2');
    await completeBattle(cdp,'f3');
    await completeCamp(cdp,'f4');
    await completeBattle(cdp,'f5');

    await waitFor(cdp,"run.runComplete===true && run.runStage===8 && run.runResult?.outcome==='clear' && document.querySelector('#modal h2')?.textContent==='런 클리어'",{timeout:10000,label:'RUN V3 clear result'});
    const finalState=await evaluate(cdp,"({stage:run.runStage,outcome:run.runResult.outcome,visited:run.runFlow.visitedRegionIds.length,completed:run.runFlow.completedRegionIds.length,branches:run.runFlow.visitedRegionBranches.length,journeys:run.runFlow.journeyHistory.length})");
    assert.deepEqual(finalState,{stage:8,outcome:'clear',visited:2,completed:2,branches:2,journeys:2});
    assert.deepEqual(runtimeErrors,[],'RUN V3 browser runtime exceptions should be empty');
  }finally{
    cdp?.close();
    if(browser?.child&&!browser.child.killed)browser.child.kill('SIGKILL');
    if(browser?.profile)await fsp.rm(browser.profile,{recursive:true,force:true}).catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
});
