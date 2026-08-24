(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.TrickDevM2=api;
    if(typeof document!=='undefined'&&api.isDeveloperMode(root.location?.search||''))api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='M2-final';
  const NORMAL_SAVE_KEY='tricklog.run.v1';
  const DEV_SAVE_KEY='tricklog.run.dev.v1';
  const STORAGE_ROUTER_MARK='__tricklogDevStorageRouterM2';
  const WRAP_MARK='__tricklogDevRngGuardM2';
  let originalRandom=null;
  let rngSeed=null;
  let rngGenerator=null;

  function isDeveloperMode(search=''){
    try{return new URLSearchParams(String(search||'')).get('dev')==='1'}catch(_error){return false}
  }
  function hashSeed(value){
    const text=String(value??'');let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return hash>>>0;
  }
  function normalizeSeed(value){
    if(typeof value==='number'&&Number.isFinite(value))return value>>>0;
    const text=String(value??'').trim();if(!text)return null;
    if(/^[+-]?\d+$/.test(text)){const number=Number(text);if(Number.isFinite(number))return number>>>0}
    return hashSeed(text);
  }
  function createSeededRandom(seed){
    let state=(Number(seed)>>>0);
    return function(){
      state=(state+0x6D2B79F5)>>>0;
      let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
      return((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function routeStorageKey(key,search=''){
    return isDeveloperMode(search)&&String(key)===NORMAL_SAVE_KEY?DEV_SAVE_KEY:key;
  }
  function browserStorage(runtimeRoot=defaultRoot){try{return runtimeRoot?.localStorage||null}catch(_error){return null}}
  function activeRun(runtimeRoot=defaultRoot){
    try{if(typeof run!=='undefined'&&run)return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function currentSeed(){return rngSeed}
  function rngActive(){return rngSeed!==null&&typeof rngGenerator==='function'}

  function installStorageRouter(runtimeRoot=defaultRoot){
    if(!runtimeRoot||!isDeveloperMode(runtimeRoot.location?.search||''))return false;
    const storage=browserStorage(runtimeRoot);if(!storage)return false;
    const proto=Object.getPrototypeOf(storage);if(!proto)return false;
    if(proto[STORAGE_ROUTER_MARK])return true;
    const originals={};
    try{
      for(const name of ['getItem','setItem','removeItem']){
        const original=proto[name];if(typeof original!=='function')return false;originals[name]=original;
      }
      for(const name of Object.keys(originals)){
        const original=originals[name];
        Object.defineProperty(proto,name,{configurable:true,writable:true,value:function(key,...args){
          const routed=routeStorageKey(key,runtimeRoot.location?.search||'');
          return original.call(this,routed,...args);
        }});
      }
      Object.defineProperty(proto,STORAGE_ROUTER_MARK,{configurable:true,value:{originals,normalKey:NORMAL_SAVE_KEY,devKey:DEV_SAVE_KEY}});
      return true;
    }catch(error){
      try{for(const [name,original] of Object.entries(originals))Object.defineProperty(proto,name,{configurable:true,writable:true,value:original})}catch(_restoreError){}
      console.warn?.('[DEV M2] 저장 키 라우터 설치 실패',error);return false;
    }
  }
  function devSaveExists(runtimeRoot=defaultRoot){const storage=browserStorage(runtimeRoot);return!!storage&&typeof storage.getItem==='function'&&!!storage.getItem(DEV_SAVE_KEY)}
  function clearDevSave(runtimeRoot=defaultRoot){
    const storage=browserStorage(runtimeRoot);if(!storage||typeof storage.removeItem!=='function')return false;
    storage.removeItem(DEV_SAVE_KEY);runtimeRoot?.RunPersistence?.syncContinueButton?.(runtimeRoot);refreshPanel(runtimeRoot);return true;
  }

  function withOriginalRandom(runtimeRoot,callback){
    const math=runtimeRoot?.Math||Math;if(!rngActive()||typeof originalRandom!=='function')return callback();
    const seeded=math.random;math.random=originalRandom;
    try{return callback()}finally{math.random=seeded}
  }
  function wrapOriginalRandomConsumer(runtimeRoot,name){
    const original=runtimeRoot?.[name];if(typeof original!=='function')return false;if(original[WRAP_MARK])return true;
    function wrapped(...args){return withOriginalRandom(runtimeRoot,()=>original.apply(this,args))}
    wrapped[WRAP_MARK]=true;wrapped.__original=original;runtimeRoot[name]=wrapped;return true;
  }
  function progressStarted(runState,runtimeRoot=defaultRoot){
    const api=runtimeRoot?.RunMapGeneration;if(typeof api?.progressStarted==='function')return api.progressStarted(runState);
    const completed=runState?.completed instanceof Set?runState.completed:new Set(Array.isArray(runState?.completed)?runState.completed:[]);
    return completed.size>0||!!runState?.currentNodeId||!!runState?.lastCompletedNodeId;
  }
  function syncStartSelection(runtimeRoot=defaultRoot){
    if(activeRun(runtimeRoot))return false;const start=runtimeRoot?.RunStartV2;if(typeof start?.resetSelection!=='function')return false;
    try{start.resetSelection(runtimeRoot?.Math?.random||Math.random);start.renderStart?.(runtimeRoot);return true}catch(error){console.warn?.('[DEV M2] 시작 선택 시드 동기화 실패',error);return false}
  }
  function syncFreshRunSeed(runtimeRoot=defaultRoot,seed=rngSeed){
    const runState=activeRun(runtimeRoot);if(!runState||seed===null)return{ok:false,reason:'no_run'};
    if(progressStarted(runState,runtimeRoot))return{ok:false,reason:'progress_started',seed};
    runState.runSeed=seed>>>0;
    const mapApi=runtimeRoot?.RunMapGeneration;
    if(runState.actId&&typeof mapApi?.applyGeneratedActMap==='function'){
      try{mapApi.applyGeneratedActMap(runState,runState.actId,{seed:seed>>>0,runtimeRoot,force:true});return{ok:true,reason:'map_regenerated',seed:seed>>>0}}
      catch(error){console.warn?.('[DEV M2] 시드 맵 동기화 실패',error);return{ok:true,reason:'seed_only',seed:seed>>>0,error}}
    }
    return{ok:true,reason:'seed_only',seed:seed>>>0};
  }
  function applySeed(value,{runtimeRoot=defaultRoot,syncRun=true}={}){
    if(!runtimeRoot||!isDeveloperMode(runtimeRoot.location?.search||''))return{ok:false,message:'dev=1에서만 RNG 시드를 고정할 수 있음'};
    const seed=normalizeSeed(value);if(seed===null)return{ok:false,message:'시드를 입력해야 함'};
    const math=runtimeRoot.Math||Math;if(typeof math.random!=='function')return{ok:false,message:'Math.random을 찾을 수 없음'};
    if(typeof originalRandom!=='function')originalRandom=math.random.bind(math);
    rngSeed=seed;rngGenerator=createSeededRandom(seed);
    const seeded=function(){return rngGenerator()};seeded.__tricklogDevSeed=seed;math.random=seeded;
    installRuntimeGuards(runtimeRoot);syncStartSelection(runtimeRoot);
    const sync=syncRun?syncFreshRunSeed(runtimeRoot,seed):{ok:false,reason:'skipped'};
    refreshPanel(runtimeRoot);
    const suffix=sync.reason==='map_regenerated'?' · 현재 미진행 맵도 재생성':sync.reason==='progress_started'?' · 진행 중 맵은 유지':'';
    return{ok:true,seed,sync,message:`RNG 시드 ${seed} 적용${suffix}`};
  }
  function restoreRandom(runtimeRoot=defaultRoot){
    const math=runtimeRoot?.Math||Math;if(typeof originalRandom==='function')math.random=originalRandom;
    rngSeed=null;rngGenerator=null;originalRandom=null;refreshPanel(runtimeRoot);return true;
  }
  function wrapBeginRun(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__tricklogDevSeedBeginM2)return true;
    function after(){if(rngActive())syncFreshRunSeed(runtimeRoot,rngSeed);installRuntimeGuards(runtimeRoot);refreshPanel(runtimeRoot)}
    function wrapped(...args){const result=original.apply(this,args);if(result&&typeof result.then==='function')return result.then(value=>{after();return value});after();return result}
    wrapped.__tricklogDevSeedBeginM2=true;wrapped.__original=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function installRuntimeGuards(runtimeRoot=defaultRoot){
    const installed={newUid:wrapOriginalRandomConsumer(runtimeRoot,'newUid'),burstAt:wrapOriginalRandomConsumer(runtimeRoot,'burstAt'),beginRun:wrapBeginRun(runtimeRoot)};
    return installed;
  }

  function panelHtml(){return `<div id="trickDevM2Final" class="devGroup"><b>재현 / 개발 저장</b><div class="devHint">같은 시드를 다시 적용하면 게임 판정 난수열을 처음부터 재생한다. UID·파티클 난수는 제외한다. DEV 저장은 ${DEV_SAVE_KEY}에 분리된다.</div><div class="devInline"><input id="trickDevSeed" inputmode="text" placeholder="예: 12345 또는 test-a"><button data-dev-m2="seed">시드 적용</button></div><div class="devRow"><button data-dev-m2="random">랜덤 복원</button><button data-dev-m2="clearSave">DEV 저장 삭제</button></div><div id="trickDevM2State" class="devHint" style="margin-top:6px"></div></div>`}
  function panelStateText(runtimeRoot=defaultRoot){
    const runState=activeRun(runtimeRoot),runSeed=Number.isFinite(Number(runState?.runSeed))?Number(runState.runSeed)>>>0:null;
    return `RNG ${rngActive()?`고정 ${rngSeed}`:'기본 랜덤'} · 런 시드 ${runSeed??'-'}\nDEV 저장 ${devSaveExists(runtimeRoot)?'있음':'없음'} · ${DEV_SAVE_KEY}`;
  }
  function refreshPanel(runtimeRoot=defaultRoot){const el=runtimeRoot?.document?.getElementById?.('trickDevM2State');if(!el)return false;el.textContent=panelStateText(runtimeRoot);return true}
  function mountPanel(runtimeRoot=defaultRoot){
    const doc=runtimeRoot?.document;if(!doc?.getElementById)return false;const panel=doc.getElementById('trickDevPanel');if(!panel)return false;if(doc.getElementById('trickDevM2Final')){refreshPanel(runtimeRoot);return true}
    const host=doc.createElement?.('div');if(!host)return false;host.innerHTML=panelHtml();const group=host.firstElementChild;if(!group)return false;panel.appendChild(group);
    group.addEventListener?.('click',event=>{const button=event.target?.closest?.('[data-dev-m2]');if(!button)return;const action=button.dataset.devM2;if(action==='seed'){const input=group.querySelector?.('#trickDevSeed');const result=applySeed(input?.value||'',{runtimeRoot});runtimeRoot?.flash?.(result.message);return}if(action==='random'){restoreRandom(runtimeRoot);runtimeRoot?.flash?.('DEV RNG 고정 해제');return}if(action==='clearSave'){clearDevSave(runtimeRoot);runtimeRoot?.flash?.('DEV 저장 삭제')}});
    refreshPanel(runtimeRoot);return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    if(!runtimeRoot||!isDeveloperMode(runtimeRoot.location?.search||''))return false;
    installStorageRouter(runtimeRoot);let attempts=0;
    const attempt=()=>{installStorageRouter(runtimeRoot);installRuntimeGuards(runtimeRoot);mountPanel(runtimeRoot);if(attempts++<120&&(typeof runtimeRoot.beginRun!=='function'||!runtimeRoot.document?.getElementById?.('trickDevM2Final')))setTimeout(attempt,25)};
    if(runtimeRoot.document?.readyState==='loading')runtimeRoot.document.addEventListener?.('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true;
  }

  return{STAGE,NORMAL_SAVE_KEY,DEV_SAVE_KEY,isDeveloperMode,hashSeed,normalizeSeed,createSeededRandom,routeStorageKey,browserStorage,activeRun,currentSeed,rngActive,installStorageRouter,devSaveExists,clearDevSave,withOriginalRandom,wrapOriginalRandomConsumer,progressStarted,syncStartSelection,syncFreshRunSeed,applySeed,restoreRandom,wrapBeginRun,installRuntimeGuards,panelHtml,panelStateText,refreshPanel,mountPanel,installWhenReady};
});
