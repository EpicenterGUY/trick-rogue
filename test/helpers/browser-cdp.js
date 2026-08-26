const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');

const ROOT=path.join(__dirname,'..','..');
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
  return({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'})[ext]||'application/octet-stream';
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
  const profile=await fsp.mkdtemp(path.join(os.tmpdir(),'trick-rogue-e2e-'));
  const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=String(chunk)});
  const activePort=path.join(profile,'DevToolsActivePort'),deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Chrome exited early (${child.exitCode})\n${stderr}`);
    if(fs.existsSync(activePort)){
      const[port]=String(await fsp.readFile(activePort,'utf8')).trim().split(/\r?\n/);
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
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('CDP websocket timeout')),5000);
      ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});
      ws.addEventListener('error',event=>{clearTimeout(timer);reject(event.error||new Error('CDP websocket error'))},{once:true});
    });
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

async function createPage(debugPort,{width=390,height=844}={}){
  const target=await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'}).then(response=>{if(!response.ok)throw new Error(`create target ${response.status}`);return response.json()});
  const cdp=await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
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

function selectorExpression(selector){return`document.querySelector(${JSON.stringify(selector)})`}
function targetExpression(target){
  const text=String(target||'').trim();
  if(text.startsWith('#')||text.startsWith('.')||(text.startsWith('[')&&!text.startsWith('[...')))return selectorExpression(text);
  return text;
}

function clampRatio(value,fallback=.5){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):fallback}
async function pointFor(cdp,target,{xRatio=.5,yRatio=.5}={}){
  const expression=targetExpression(target),x=clampRatio(xRatio),y=clampRatio(yRatio);
  return evaluate(cdp,`(()=>{const el=${expression};if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{x:r.left+r.width*${x},y:r.top+r.height*${y},width:r.width,height:r.height,visible:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none',disabled:!!el.disabled}})()`);
}

async function clickElement(cdp,target,label,{scroll=true,hitTest=false,xRatio=.5,yRatio=.5}={}){
  const expression=targetExpression(target);
  if(scroll){
    const found=await evaluate(cdp,`(()=>{const el=${expression};if(!el)return false;el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});return true})()`);
    assert.equal(found,true,`${label} element should exist before scroll`);await sleep(70);
  }
  const point=await pointFor(cdp,expression,{xRatio,yRatio});
  assert.ok(point,`${label} element should exist`);assert.equal(point.visible,true,`${label} should be visible`);assert.equal(point.disabled,false,`${label} should be enabled`);
  if(hitTest){const receives=await evaluate(cdp,`(()=>{const el=${expression},hit=document.elementFromPoint(${point.x},${point.y});return!!(el&&hit&&(hit===el||el.contains(hit)))})()`);assert.equal(receives,true,`${label} should receive the click`)}
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
}

async function cleanupBrowser(browser,cdp){
  cdp?.close();
  if(browser?.child&&!browser.child.killed)browser.child.kill('SIGKILL');
  if(browser?.profile)await fsp.rm(browser.profile,{recursive:true,force:true}).catch(()=>{});
}

module.exports={ROOT,sleep,findChrome,startStaticServer,launchChrome,createPage,evaluate,waitFor,selectorExpression,targetExpression,clickElement,cleanupBrowser};