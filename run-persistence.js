(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunPersistence=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='8-F';
  const SAVE_FORMAT='tricklog-run-save';
  const SAVE_VERSION=1;
  const SAVE_KEY='tricklog.run.v1';
  const DEBUG_QUERY_KEY='debug';
  const TYPE_KEY='__tricklogType';
  let browserInstalled=false;

  function activeRun(runtimeRoot=defaultRoot){
    try{if(typeof run!=='undefined'&&run)return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function activeBattle(runtimeRoot=defaultRoot){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function numeric(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
  function nowIso(now=Date.now()){const date=now instanceof Date?now:new Date(now);return date.toISOString()}
  function isPlainObject(value){if(!value||typeof value!=='object')return false;const proto=Object.getPrototypeOf(value);return proto===Object.prototype||proto===null}

  function encodeData(value,seen=new WeakSet()){
    if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number')return Number.isFinite(value)?value:{[TYPE_KEY]:'Number',value:String(value)};
    if(typeof value==='bigint')return{[TYPE_KEY]:'BigInt',value:String(value)};
    if(typeof value==='undefined'||typeof value==='function'||typeof value==='symbol')return undefined;
    if(value instanceof Date)return{[TYPE_KEY]:'Date',value:value.toISOString()};
    if(seen.has(value))throw new TypeError('Run save cannot contain circular references');
    seen.add(value);
    let encoded;
    if(value instanceof Set){
      encoded={[TYPE_KEY]:'Set',values:[...value].map(item=>{const next=encodeData(item,seen);return next===undefined?null:next})};
    }else if(value instanceof Map){
      encoded={[TYPE_KEY]:'Map',entries:[...value.entries()].map(([key,item])=>[encodeData(key,seen),encodeData(item,seen)])};
    }else if(Array.isArray(value)){
      encoded=value.map(item=>{const next=encodeData(item,seen);return next===undefined?null:next});
    }else{
      encoded={};
      for(const key of Object.keys(value).sort()){
        const next=encodeData(value[key],seen);if(next!==undefined)encoded[key]=next;
      }
    }
    seen.delete(value);return encoded;
  }
  function decodeData(value){
    if(value===null||typeof value!=='object')return value;
    if(Array.isArray(value))return value.map(decodeData);
    const type=value[TYPE_KEY];
    if(type==='Set')return new Set((value.values||[]).map(decodeData));
    if(type==='Map')return new Map((value.entries||[]).map(([key,item])=>[decodeData(key),decodeData(item)]));
    if(type==='Date')return new Date(value.value);
    if(type==='BigInt')return BigInt(value.value);
    if(type==='Number')return value.value==='NaN'?NaN:value.value==='Infinity'?Infinity:value.value==='-Infinity'?-Infinity:Number(value.value);
    const decoded={};for(const [key,item] of Object.entries(value))decoded[key]=decodeData(item);return decoded;
  }
  function sortForStableJson(value){
    if(value===null||typeof value!=='object')return value;
    if(Array.isArray(value))return value.map(sortForStableJson);
    const sorted={};for(const key of Object.keys(value).sort())sorted[key]=sortForStableJson(value[key]);return sorted;
  }
  function stableStringify(value){return JSON.stringify(sortForStableJson(value))}
  function fnv1a(text){let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}return hash>>>0}
  function checksumForPayload(payload){return`fnv1a:${fnv1a(stableStringify(payload)).toString(16).padStart(8,'0')}`}

  function saveAvailability(runState,battleState){
    if(!runState||typeof runState!=='object')return{allowed:false,reason:'no_run'};
    if(runState.runComplete)return{allowed:false,reason:'run_complete'};
    if(battleState&&!battleState.ended)return{allowed:false,reason:'battle_active'};
    if(runState.currentNodeId)return{allowed:false,reason:'node_in_progress',nodeId:runState.currentNodeId};
    return{allowed:true,reason:'checkpoint'};
  }
  function checkpointMeta(runState,{reason='manual',screenId='mapScreen'}={}){
    return{
      screenId,reason,
      runSeed:Number.isFinite(Number(runState?.runSeed))?Number(runState.runSeed)>>>0:null,
      actId:runState?.actId||null,
      actIndex:Number.isFinite(Number(runState?.actIndex))?Number(runState.actIndex):null,
      flowPhase:runState?.runFlow?.phase||null,
      deckSize:Array.isArray(runState?.deck)?runState.deck.length:0
    };
  }
  function createSaveEnvelope(runState,{reason='manual',screenId='mapScreen',now=Date.now()}={}){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    const payload={run:encodeData(runState),checkpoint:checkpointMeta(runState,{reason,screenId})};
    return{format:SAVE_FORMAT,version:SAVE_VERSION,stage:STAGE,savedAt:nowIso(now),checksum:checksumForPayload(payload),payload};
  }
  function legacyToV1(raw){
    const source=raw?.payload?.run??raw?.run??raw;
    if(!source||typeof source!=='object')throw new TypeError('Legacy save does not contain a run');
    const alreadyEncoded=source?.[TYPE_KEY]||Object.values(source).some?.(value=>value&&typeof value==='object'&&value[TYPE_KEY]);
    const runData=alreadyEncoded?source:encodeData(source);
    const checkpoint={screenId:'mapScreen',reason:'migration',runSeed:numeric(raw?.runSeed??source?.runSeed,0)>>>0,actId:source?.actId||null,actIndex:Number.isFinite(Number(source?.actIndex))?Number(source.actIndex):null,flowPhase:source?.runFlow?.phase||null,deckSize:Array.isArray(source?.deck)?source.deck.length:0};
    const payload={run:runData,checkpoint};
    return{format:SAVE_FORMAT,version:1,stage:STAGE,savedAt:raw?.savedAt||nowIso(0),checksum:checksumForPayload(payload),payload,migratedFrom:0};
  }
  function migrateEnvelope(raw){
    if(!raw||typeof raw!=='object')throw new TypeError('Save must be a JSON object');
    if(raw.format===SAVE_FORMAT&&Number(raw.version)>SAVE_VERSION)throw new RangeError(`Save version ${raw.version} is newer than supported version ${SAVE_VERSION}`);
    if(raw.format===SAVE_FORMAT&&Number(raw.version)===SAVE_VERSION)return raw;
    if(raw.format===SAVE_FORMAT&&Number(raw.version)===0)return legacyToV1(raw);
    if(!raw.format&&(raw.run||raw.deck||raw.map))return legacyToV1(raw);
    throw new TypeError('Unknown Tricklog save format');
  }
  function validateEnvelope(envelope){
    const errors=[];
    if(envelope?.format!==SAVE_FORMAT)errors.push('format');
    if(Number(envelope?.version)!==SAVE_VERSION)errors.push('version');
    if(!envelope?.payload?.run||typeof envelope.payload.run!=='object')errors.push('payload.run');
    if(!envelope?.payload?.checkpoint||typeof envelope.payload.checkpoint!=='object')errors.push('payload.checkpoint');
    if(typeof envelope?.checksum!=='string')errors.push('checksum');
    else if(envelope.checksum!==checksumForPayload(envelope.payload))errors.push('checksum_mismatch');
    return errors;
  }
  function ensureRestoredRunShape(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('Restored run must be an object');
    if(!(runState.available instanceof Set))runState.available=new Set(Array.isArray(runState.available)?runState.available:[]);
    if(!(runState.completed instanceof Set))runState.completed=new Set(Array.isArray(runState.completed)?runState.completed:[]);
    if(!Array.isArray(runState.deck))runState.deck=[];
    if(!Array.isArray(runState.map))runState.map=[];
    return runState;
  }
  function definitionById(runtimeRoot,id){
    if(!id)return null;
    if(runtimeRoot?.CARD_DEFINITION_BY_ID?.[id])return runtimeRoot.CARD_DEFINITION_BY_ID[id];
    if(typeof runtimeRoot?.cardDefinition==='function')try{return runtimeRoot.cardDefinition(id)}catch(_error){}
    return null;
  }
  function rehydrateCard(card,runtimeRoot=defaultRoot){
    if(!card||typeof card!=='object')return card;
    const id=card.cardId||card.definition?.id||card.named?.id||null,definition=definitionById(runtimeRoot,id);
    if(definition){if(card.named)card.named=definition;if(card.definition)card.definition=definition}
    return card;
  }
  function rehydrateRun(runState,runtimeRoot=defaultRoot){
    ensureRestoredRunShape(runState);
    for(const card of runState.deck)rehydrateCard(card,runtimeRoot);
    const start=runtimeRoot?.RunStartV2;
    if(runState.starterId&&typeof start?.starterDefinition==='function'){const starter=start.starterDefinition(runState.starterId);if(starter)runState.starter=starter}
    if(runState.traitId&&typeof start?.traitDefinition==='function'){const trait=start.traitDefinition(runState.traitId);if(trait)runState.trait=trait}
    return runState;
  }
  function stringifySave(runState,options={}){return stableStringify(createSaveEnvelope(runState,options))}
  function parseSave(text,{runtimeRoot=defaultRoot}={}){
    if(typeof text!=='string'||!text.trim())throw new TypeError('Save text is empty');
    let raw;try{raw=JSON.parse(text)}catch(error){throw new SyntaxError(`Invalid save JSON: ${error.message}`)}
    const envelope=migrateEnvelope(raw),errors=validateEnvelope(envelope);if(errors.length)throw new TypeError(`Invalid save: ${errors.join(', ')}`);
    const runState=rehydrateRun(decodeData(envelope.payload.run),runtimeRoot);
    return{envelope,runState,checkpoint:{...envelope.payload.checkpoint},migrated:envelope.migratedFrom!==undefined};
  }

  function storageAvailable(storage){return!!storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function'&&typeof storage.removeItem==='function'}
  function saveToStorage(storage,runState,options={}){
    if(!storageAvailable(storage))return{ok:false,reason:'storage_unavailable'};
    try{const text=stringifySave(runState,options);storage.setItem(options.key||SAVE_KEY,text);return{ok:true,key:options.key||SAVE_KEY,text,bytes:text.length,envelope:JSON.parse(text)}}catch(error){return{ok:false,reason:'save_failed',error}}
  }
  function loadFromStorage(storage,{key=SAVE_KEY,runtimeRoot=defaultRoot}={}){
    if(!storageAvailable(storage))return{ok:false,reason:'storage_unavailable'};
    const text=storage.getItem(key);if(!text)return{ok:false,reason:'missing_save'};
    try{return{ok:true,key,text,...parseSave(text,{runtimeRoot})}}catch(error){return{ok:false,reason:'invalid_save',error}}
  }
  function clearStorage(storage,{key=SAVE_KEY}={}){if(!storageAvailable(storage))return false;storage.removeItem(key);return true}
  function hasStorageSave(storage,{key=SAVE_KEY}={}){return storageAvailable(storage)&&typeof storage.getItem(key)==='string'&&storage.getItem(key).length>0}
  function browserStorage(runtimeRoot=defaultRoot){try{return runtimeRoot?.localStorage||null}catch(_error){return null}}

  function cardFingerprint(card){return{uid:card?.uid??card?.metadata?.uid??null,suit:card?.printedSuit??card?.suit??null,rank:card?.printedRank??card?.rank??null,cardId:card?.cardId||card?.definition?.id||card?.named?.id||null,upgradeLevel:numeric(card?.upgradeLevel??card?.upgrade,0)}}
  function deterministicRunData(runState){
    if(!runState)return null;
    return{
      runSeed:Number.isFinite(Number(runState.runSeed))?Number(runState.runSeed)>>>0:null,
      actId:runState.actId||null,actIndex:numeric(runState.actIndex,0),
      flow:runState.runFlow?{phase:runState.runFlow.phase||null,choiceRound:numeric(runState.runFlow.choiceRound,0),visited:[...(runState.runFlow.visitedRegionIds||[])],completed:[...(runState.runFlow.completedRegionIds||[])],current:runState.runFlow.currentRegionId||null,pending:[...(runState.runFlow.pendingRegionOfferIds||[])]}:null,
      map:(runState.map||[]).map(node=>({id:node.id,type:node.type,lane:node.lane,row:node.row,next:[...(node.next||[])],regionPlan:node.regionPlan?encodeData(node.regionPlan):null})),
      available:[...(runState.available instanceof Set?runState.available:new Set(runState.available||[]))].sort(),
      completed:[...(runState.completed instanceof Set?runState.completed:new Set(runState.completed||[]))].sort(),
      deck:(runState.deck||[]).map(cardFingerprint),
      hp:numeric(runState.hp,0),maxHp:numeric(runState.maxHp,0),gold:numeric(runState.gold,0)
    };
  }
  function runFingerprint(runState){const data=deterministicRunData(runState);return data?`run:${fnv1a(stableStringify(data)).toString(16).padStart(8,'0')}`:null}
  function verifyRoundTrip(runState,{runtimeRoot=defaultRoot}={}){
    const before=runFingerprint(runState),parsed=parseSave(stringifySave(runState,{now:0,reason:'verify'}),{runtimeRoot}),after=runFingerprint(parsed.runState);
    return{ok:before===after,before,after,runState:parsed.runState};
  }
  function debugSnapshot(runtimeRoot=defaultRoot){
    const runState=activeRun(runtimeRoot),battleState=activeBattle(runtimeRoot),storage=browserStorage(runtimeRoot),availability=saveAvailability(runState,battleState);
    return{
      stage:STAGE,saveVersion:SAVE_VERSION,hasSave:hasStorageSave(storage),saveAvailability:availability,
      run:runState?{fingerprint:runFingerprint(runState),runSeed:Number.isFinite(Number(runState.runSeed))?Number(runState.runSeed)>>>0:null,actId:runState.actId||null,actIndex:numeric(runState.actIndex,0),flowPhase:runState.runFlow?.phase||null,hp:numeric(runState.hp,0),maxHp:numeric(runState.maxHp,0),gold:numeric(runState.gold,0),deckSize:Array.isArray(runState.deck)?runState.deck.length:0,currentNodeId:runState.currentNodeId||null,available:[...(runState.available instanceof Set?runState.available:new Set(runState.available||[]))],completed:[...(runState.completed instanceof Set?runState.completed:new Set(runState.completed||[]))]}:null,
      battle:battleState?{type:battleState.type||null,phase:battleState.phase||null,setIndex:numeric(battleState.setIndex,0),trick:numeric(battleState.trick,0),trump:battleState.trump||null,chip:numeric(battleState.chip,0),handSize:Array.isArray(battleState.hand)?battleState.hand.length:0,deckSize:Array.isArray(battleState.deck)?battleState.deck.length:0,discardSize:Array.isArray(battleState.discard)?battleState.discard.length:0,slotCount:Array.isArray(battleState.slots)?battleState.slots.length:0,enemyHp:numeric(battleState.enemy?.hp,0),enemyMaxHp:numeric(battleState.enemy?.maxHp,0),riverSnapshotId:battleState.riverSnapshot?.id||null,foldCount:Array.isArray(battleState.foldHistory)?battleState.foldHistory.length:0}:null
    };
  }
  function debugBundle(runtimeRoot=defaultRoot){const snapshot=debugSnapshot(runtimeRoot),runState=activeRun(runtimeRoot);return{stage:STAGE,capturedAt:nowIso(),snapshot,replay:runState?{runSeed:snapshot.run?.runSeed,fingerprint:snapshot.run?.fingerprint,actId:snapshot.run?.actId,flowPhase:snapshot.run?.flowPhase}:null}}

  function assignRuntimeRun(runtimeRoot,runState){
    if(!runtimeRoot)return false;
    runtimeRoot.run=runState;runtimeRoot.battle=null;
    if(runtimeRoot.document&&typeof runtimeRoot.eval==='function'){
      const key='__tricklogRestoreState8F';runtimeRoot[key]={run:runState};
      try{runtimeRoot.eval(`run=globalThis.${key}.run; battle=null;`)}catch(_error){}
      try{delete runtimeRoot[key]}catch(_error){runtimeRoot[key]=null}
    }
    return true;
  }
  function restoreBrowserRun(runtimeRoot,runState,checkpoint={}){
    assignRuntimeRun(runtimeRoot,rehydrateRun(runState,runtimeRoot));
    runtimeRoot?.closeOverlay?.();runtimeRoot?.showScreen?.(checkpoint.screenId||'mapScreen');runtimeRoot?.renderMap?.();
    if(runState?.runFlow?.phase==='region_choice'){
      const show=()=>runtimeRoot?.RunFlowV2?.showRegionChoice?.(runtimeRoot);(runtimeRoot?.setTimeout||setTimeout)(show,0);
    }
    return runState;
  }
  function saveBrowserCheckpoint(runtimeRoot=defaultRoot,{reason='manual'}={}){
    const runState=activeRun(runtimeRoot),battleState=activeBattle(runtimeRoot),availability=saveAvailability(runState,battleState);
    if(!availability.allowed)return{ok:false,stage:STAGE,reason:availability.reason};
    const result=saveToStorage(browserStorage(runtimeRoot),runState,{reason,screenId:'mapScreen'});
    if(result.ok)runtimeRoot?.flash?.('런 체크포인트 저장');
    syncContinueButton(runtimeRoot);return{stage:STAGE,...result};
  }
  function loadBrowserCheckpoint(runtimeRoot=defaultRoot){
    const result=loadFromStorage(browserStorage(runtimeRoot),{runtimeRoot});if(!result.ok)return{stage:STAGE,...result};
    restoreBrowserRun(runtimeRoot,result.runState,result.checkpoint);runtimeRoot?.flash?.(result.migrated?'저장 데이터 변환 후 불러오기':'런 체크포인트 불러오기');syncContinueButton(runtimeRoot);return{stage:STAGE,...result};
  }
  function clearBrowserCheckpoint(runtimeRoot=defaultRoot){const cleared=clearStorage(browserStorage(runtimeRoot));syncContinueButton(runtimeRoot);if(cleared)runtimeRoot?.flash?.('런 저장 삭제');return cleared}
  function autoSave(runtimeRoot=defaultRoot,reason='auto'){const result=saveBrowserCheckpoint(runtimeRoot,{reason});return result.ok?result:null}

  function afterMaybePromise(value,callback){if(value&&typeof value.then==='function')return value.then(result=>{callback(result);return result});callback(value);return value}
  function wrapBeginRun(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function'||original.__tricklogPersistence8F)return false;
    function wrapped(...args){return afterMaybePromise(original.apply(this,args),()=>autoSave(runtimeRoot,'run_start'))}
    wrapped.__tricklogPersistence8F=true;wrapped.__original=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapCompleteNode(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.completeNode;if(typeof original!=='function'||original.__tricklogPersistence8F)return false;
    function wrapped(...args){return afterMaybePromise(original.apply(this,args),()=>autoSave(runtimeRoot,'node_complete'))}
    wrapped.__tricklogPersistence8F=true;wrapped.__original=original;runtimeRoot.completeNode=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.renderMap;if(typeof original!=='function'||original.__tricklogPersistence8F)return false;
    function wrapped(...args){const result=original.apply(this,args);autoSave(runtimeRoot,'map_checkpoint');syncContinueButton(runtimeRoot);refreshDebugPanel(runtimeRoot);return result}
    wrapped.__tricklogPersistence8F=true;wrapped.__original=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function wrapRunEnd(runtimeRoot=defaultRoot,name){
    const original=runtimeRoot?.[name];if(typeof original!=='function'||original.__tricklogPersistence8F)return false;
    function wrapped(...args){clearStorage(browserStorage(runtimeRoot));syncContinueButton(runtimeRoot);return original.apply(this,args)}
    wrapped.__tricklogPersistence8F=true;wrapped.__original=original;runtimeRoot[name]=wrapped;return true;
  }

  function ensureContinueButton(runtimeRoot=defaultRoot){
    const doc=runtimeRoot?.document;if(!doc?.querySelector||!doc?.createElement)return null;
    let button=doc.getElementById?.('continueRunBtn');if(button)return button;
    const host=doc.querySelector('#startScreen .startBottom');if(!host?.appendChild)return null;
    button=doc.createElement('button');button.id='continueRunBtn';button.type='button';button.className='pixelBtn';button.textContent='계속하기';button.style.width='100%';button.style.marginTop='7px';button.addEventListener('click',()=>loadBrowserCheckpoint(runtimeRoot));host.appendChild(button);return button;
  }
  function syncContinueButton(runtimeRoot=defaultRoot){const button=ensureContinueButton(runtimeRoot);if(!button)return false;const visible=hasStorageSave(browserStorage(runtimeRoot));button.style.display=visible?'':'none';button.disabled=!visible;button.title=visible?'마지막 안전 체크포인트에서 런 계속하기':'저장된 런 없음';return visible}
  function debugEnabled(runtimeRoot=defaultRoot){
    if(runtimeRoot?.TRICKLOG_DEBUG===true)return true;
    try{const params=new URLSearchParams(runtimeRoot?.location?.search||'');return params.get(DEBUG_QUERY_KEY)==='1'}catch(_error){return false}
  }
  function debugText(runtimeRoot=defaultRoot){try{return JSON.stringify(debugBundle(runtimeRoot),null,2)}catch(error){return JSON.stringify({stage:STAGE,error:error.message},null,2)}}
  function ensureDebugPanel(runtimeRoot=defaultRoot){
    if(!debugEnabled(runtimeRoot))return null;const doc=runtimeRoot?.document;if(!doc?.createElement||!doc?.body)return null;
    let panel=doc.getElementById?.('trickDebugPanel');if(panel)return panel;
    const toggle=doc.createElement('button');toggle.id='trickDebugToggle';toggle.type='button';toggle.textContent='DEBUG';toggle.style.cssText='position:fixed;right:8px;bottom:8px;z-index:9999;font:11px monospace;padding:6px;background:#111;color:#8ff;border:1px solid #8ff';
    panel=doc.createElement('div');panel.id='trickDebugPanel';panel.style.cssText='display:none;position:fixed;left:8px;right:8px;bottom:42px;max-height:55vh;overflow:auto;z-index:9999;background:#080b10ee;color:#d8e3f0;border:1px solid #5d7790;padding:8px;font:10px/1.35 monospace';
    const actions=doc.createElement('div');actions.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px';
    const makeButton=(label,handler)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.style.cssText='font:10px monospace;padding:4px 6px';b.addEventListener('click',handler);actions.appendChild(b);return b};
    const pre=doc.createElement('pre');pre.id='trickDebugText';pre.style.cssText='margin:0;white-space:pre-wrap;word-break:break-word';panel.appendChild(actions);panel.appendChild(pre);
    makeButton('새로고침',()=>refreshDebugPanel(runtimeRoot));makeButton('저장',()=>{saveBrowserCheckpoint(runtimeRoot,{reason:'debug'});refreshDebugPanel(runtimeRoot)});makeButton('불러오기',()=>{loadBrowserCheckpoint(runtimeRoot);refreshDebugPanel(runtimeRoot)});makeButton('저장 삭제',()=>{clearBrowserCheckpoint(runtimeRoot);refreshDebugPanel(runtimeRoot)});makeButton('복사',async()=>{const text=debugText(runtimeRoot);try{await runtimeRoot?.navigator?.clipboard?.writeText?.(text);runtimeRoot?.flash?.('디버그 스냅샷 복사')}catch(_error){}});
    toggle.addEventListener('click',()=>{panel.style.display=panel.style.display==='none'?'block':'none';refreshDebugPanel(runtimeRoot)});doc.body.appendChild(toggle);doc.body.appendChild(panel);refreshDebugPanel(runtimeRoot);return panel;
  }
  function refreshDebugPanel(runtimeRoot=defaultRoot){const pre=runtimeRoot?.document?.getElementById?.('trickDebugText');if(!pre)return false;pre.textContent=debugText(runtimeRoot);return true}

  function installBrowser(runtimeRoot=defaultRoot){
    if(browserInstalled){syncContinueButton(runtimeRoot);ensureDebugPanel(runtimeRoot);return true}
    if(!runtimeRoot||typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.renderMap!=='function'||typeof runtimeRoot.completeNode!=='function')return false;
    wrapBeginRun(runtimeRoot);wrapCompleteNode(runtimeRoot);wrapRenderMap(runtimeRoot);wrapRunEnd(runtimeRoot,'finishRun');wrapRunEnd(runtimeRoot,'loseRun');
    runtimeRoot.saveRunCheckpoint=(options)=>saveBrowserCheckpoint(runtimeRoot,options);runtimeRoot.loadRunCheckpoint=()=>loadBrowserCheckpoint(runtimeRoot);runtimeRoot.clearRunCheckpoint=()=>clearBrowserCheckpoint(runtimeRoot);runtimeRoot.trickDebugSnapshot=()=>debugBundle(runtimeRoot);
    ensureContinueButton(runtimeRoot);syncContinueButton(runtimeRoot);ensureDebugPanel(runtimeRoot);browserInstalled=true;return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25)};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true;
  }
  function resetBrowserInstallForTests(){browserInstalled=false}

  return{STAGE,SAVE_FORMAT,SAVE_VERSION,SAVE_KEY,DEBUG_QUERY_KEY,TYPE_KEY,activeRun,activeBattle,numeric,nowIso,isPlainObject,encodeData,decodeData,sortForStableJson,stableStringify,fnv1a,checksumForPayload,saveAvailability,checkpointMeta,createSaveEnvelope,legacyToV1,migrateEnvelope,validateEnvelope,ensureRestoredRunShape,definitionById,rehydrateCard,rehydrateRun,stringifySave,parseSave,storageAvailable,saveToStorage,loadFromStorage,clearStorage,hasStorageSave,browserStorage,cardFingerprint,deterministicRunData,runFingerprint,verifyRoundTrip,debugSnapshot,debugBundle,assignRuntimeRun,restoreBrowserRun,saveBrowserCheckpoint,loadBrowserCheckpoint,clearBrowserCheckpoint,autoSave,afterMaybePromise,wrapBeginRun,wrapCompleteNode,wrapRenderMap,wrapRunEnd,ensureContinueButton,syncContinueButton,debugEnabled,debugText,ensureDebugPanel,refreshDebugPanel,installBrowser,installWhenReady,resetBrowserInstallForTests};
});