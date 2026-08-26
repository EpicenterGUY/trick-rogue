const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');

const ENABLED=process.env.TRICK_BROWSER_SMOKE==='1';
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
      const url=new URL(req.url,'http://127.0.0.1');
      const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname).replace(/^\/+/, '');
      const file=path.resolve(ROOT,relative);
      if(!file.startsWith(ROOT+path.sep)&&file!==path.join(ROOT,'index.html')){res.writeHead(403);res.end('forbidden');return}
      const data=await fsp.readFile(file);
      res.writeHead(200,{'content-type':contentType(file),'cache-control':'no-store'});res.end(data);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(String(error.message||error))}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const {port}=server.address();
  return{server,url:`http://127.0.0.1:${port}/index.html`};
}

async function launchChrome(chrome){
  const profile=await fsp.mkdtemp(path.join(os.tmpdir(),'trick-rogue-smoke-'));
  const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=String(chunk)});
  const activePort=path.join(profile,'DevToolsActivePort');
  const deadline=Date.now()+10000;
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
  constructor(ws){this.ws=ws;this.nextId=1;this.pending=new Map();this.listeners=new Map();ws.addEventListener('message',event=>this.handle(event.data));}
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
  return evaluate(cdp,`(()=>{const el=${expression};if(!el)return null;const r=el.getBoundingClientRect();const s=getComputedStyle(el);return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,visible:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none',disabled:!!el.disabled}})()`);
}

async function clickElement(cdp,expression,label,{scroll=false,hitTest=false}={}){
  if(scroll){
    const found=await evaluate(cdp,`(()=>{const el=${expression};if(!el)return false;el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});return true})()`);
    assert.equal(found,true,`${label} element should exist before scroll`);await sleep(80);
  }
  const point=await pointFor(cdp,expression);assert.ok(point,`${label} element should exist`);assert.equal(point.visible,true,`${label} should be visible`);assert.equal(point.disabled,false,`${label} should be enabled`);
  if(scroll)assert.ok(point.x>=0&&point.x<=390&&point.y>=0&&point.y<=844,`${label} should be inside mobile viewport after scroll`);
  if(hitTest){
    const hitInfo=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return{receives:!!(el&&hit&&(hit===el||el.contains(hit))),target:el?{tag:el.tagName,id:el.id,cls:el.className,rect:(()=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()}:null,hit:hit?{tag:hit.tagName,id:hit.id,cls:hit.className,text:(hit.textContent||'').trim().slice(0,80),pointer:getComputedStyle(hit).pointerEvents,z:getComputedStyle(hit).zIndex,position:getComputedStyle(hit).position}:null}})()`);
    if(!hitInfo.receives)console.error('HITTEST_DIAG',JSON.stringify({label,point,hitInfo}));
    assert.equal(hitInfo.receives,true,`${label} should be the topmost click target`);
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
    assert.equal(await evaluate(cdp,"document.querySelector('#startScreen .sectionTitle')?.textContent"),'스타터 덱');

    await clickElement(cdp,"document.querySelector('#startScreen .startBottom button')",'런 시작');
    await waitFor(cdp,"document.getElementById('mapScreen').classList.contains('active') && typeof run!=='undefined' && !!run",{label:'map screen after run start'});

    await clickElement(cdp,"[...document.querySelectorAll('#mapGrid .node')].find(el=>!el.classList.contains('lock')&&!el.classList.contains('done'))",'첫 맵 노드');
    await waitFor(cdp,"document.getElementById('battleScreen').classList.contains('active') && typeof battle!=='undefined' && !!battle",{label:'battle screen'});
    await waitFor(cdp,"document.querySelectorAll('#handRow .card').length>0 && !!document.getElementById('battleDeckPile')",{label:'hand and pile HUD'});

    const playableCardExpr=`(()=>{const els=[...document.querySelectorAll('#handRow .card')];return els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid);return card&&!card.named&&!card.definition&&!card.cardId})||els.find(el=>{const card=battle.hand.find(c=>c.uid===el.dataset.uid),def=card?.definition||card?.named;return card&&!def?.targeting})||els[0]})()`;
    await clickElement(cdp,playableCardExpr,'바로 낼 수 있는 손패 카드',{hitTest:true});
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
