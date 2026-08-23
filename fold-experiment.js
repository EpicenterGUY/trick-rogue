(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.FoldExperiment=api;
    api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='8-E';
  const MIN_FOLD_SLOTS=3;
  const MAX_FOLD_SLOTS=4;
  const DEFAULT_FOLD_HP_LOSS=8;
  const HISTORY_LIMIT=20;
  let browserInstalled=false;

  function activeBattle(runtimeRoot=defaultRoot){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function activeRun(runtimeRoot=defaultRoot){
    try{if(typeof run!=='undefined'&&run)return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function cardUid(card){return card?.uid??card?.instanceId??card?.metadata?.uid??null}
  function slotCard(entry){return entry?.card??entry??null}
  function numeric(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}

  function foldAvailability(state){
    if(!state||typeof state!=='object')return{allowed:false,reason:'missing_battle'};
    if(state.ended)return{allowed:false,reason:'battle_ended'};
    if(state.animating)return{allowed:false,reason:'battle_busy'};
    if(state.phase!=='trick')return{allowed:false,reason:'not_trick_phase'};
    if(!Array.isArray(state.slots))return{allowed:false,reason:'missing_slots'};
    const slotCount=state.slots.length;
    if(slotCount<MIN_FOLD_SLOTS)return{allowed:false,reason:'too_early',slotCount};
    if(slotCount>MAX_FOLD_SLOTS)return{allowed:false,reason:'showdown_locked',slotCount};
    const trick=numeric(state.trick,slotCount+1);
    if(trick<4||trick>5)return{allowed:false,reason:'invalid_trick',slotCount,trick};
    if(state.enemy&&numeric(state.enemy.hp,1)<=0)return{allowed:false,reason:'enemy_defeated',slotCount,trick};
    return{allowed:true,reason:'available',slotCount,trick};
  }
  function canFold(state){return foldAvailability(state).allowed}

  function applyFixedHpLoss(runState,amount=DEFAULT_FOLD_HP_LOSS){
    if(!runState||typeof runState!=='object')throw new TypeError('Run state is required');
    const requested=Math.max(0,Math.floor(numeric(amount,DEFAULT_FOLD_HP_LOSS))),before=Math.max(0,numeric(runState.hp));
    const lost=Math.min(before,requested);runState.hp=Math.max(0,before-lost);
    return{requested,lost,hpBefore:before,hpAfter:runState.hp,defeated:runState.hp<=0};
  }
  function createFoldRecord(state,runState,{penalty=DEFAULT_FOLD_HP_LOSS}={}){
    const availability=foldAvailability({...state,animating:false});
    if(!availability.allowed)throw new Error(`Fold is not available: ${availability.reason}`);
    const slots=state.slots||[],hand=state.hand||[];
    return{
      stage:STAGE,type:'fold',setIndex:state.setIndex||1,trick:state.trick||availability.trick,slotCount:slots.length,
      penaltyType:'fixed_hp_loss',penaltyRequested:Math.max(0,Math.floor(numeric(penalty,DEFAULT_FOLD_HP_LOSS))),penaltyLost:0,
      hpBefore:Math.max(0,numeric(runState?.hp)),hpAfter:null,
      foldedCardUids:slots.map(entry=>cardUid(slotCard(entry))),handUidsBefore:hand.map(cardUid),handUidsAfter:null,
      playerShowdownAttackSkipped:true,enemyShowdownAttackSkipped:true,showdownSkipped:true,
      riverSnapshotDiscarded:!!state.riverSnapshot,nextSetIndex:(state.setIndex||1)+1,playerDefeated:false
    };
  }
  function archiveFold(state,runState,record){
    if(!Array.isArray(state.foldHistory))state.foldHistory=[];
    const snapshot=JSON.parse(JSON.stringify(record));
    state.lastFold=snapshot;state.lastSetResolution={type:'fold',stage:STAGE,setIndex:record.setIndex,record:snapshot};state.foldHistory.push(snapshot);
    if(state.foldHistory.length>HISTORY_LIMIT)state.foldHistory.splice(0,state.foldHistory.length-HISTORY_LIMIT);
    if(runState&&typeof runState==='object'){
      if(!runState.foldStats||typeof runState.foldStats!=='object')runState.foldStats={count:0,hpLost:0,bySlotCount:{3:0,4:0}};
      runState.foldStats.count=(runState.foldStats.count||0)+1;runState.foldStats.hpLost=(runState.foldStats.hpLost||0)+record.penaltyLost;
      if(!runState.foldStats.bySlotCount)runState.foldStats.bySlotCount={3:0,4:0};
      runState.foldStats.bySlotCount[record.slotCount]=(runState.foldStats.bySlotCount[record.slotCount]||0)+1;
    }
    return snapshot;
  }
  function clearShowdownUi(runtimeRoot){
    const sequence=runtimeRoot?.document?.getElementById?.('showdownSequence');
    if(sequence){sequence.className='';sequence.innerHTML=''}
  }
  function cleanupFoldedSet(runtimeRoot,state,record){
    const foldedSlots=Array.isArray(state.slots)?state.slots.slice():[];
    foldedSlots.forEach((slot,index)=>runtimeRoot?.runCardEffects?.('on_set_end',slotCard(slot),{slotIndex:index,folded:true,foldRecord:record,showdownSkipped:true}));
    if(!Array.isArray(state.discard))state.discard=[];
    for(const slot of foldedSlots){const card=slotCard(slot);if(card)state.discard.push(card)}
    state.slots=[];state.enemySlots=[];
    state.effects=Array.isArray(state.effects)?state.effects.filter(effect=>effect?.duration!=='set'):[];
    runtimeRoot?.ShowdownAdvantage?.consumeAdvantage?.(state);
    runtimeRoot?.ShowdownSlotManipulation?.clearSetLocks?.(state);
    state.advantage=null;state.showdownVisualStage=null;state.showdownBreakdown=null;
    state.contractTabooLastResolution=null;state.contractTabooResolvedSet=null;state.riverSnapshot=null;state.riverHit=null;
    clearShowdownUi(runtimeRoot);
    return foldedSlots.length;
  }
  function beginNextSet(runtimeRoot,state){
    const core=runtimeRoot?.BattleCore;
    state.trick=1;state.setIndex=(state.setIndex||1)+1;state.phase='trick';
    state.setHistory=core?.createSetHistory?.()||{trickResults:[],wins:0,losses:0,draws:0};
    state.history=runtimeRoot?.CardEffects?.newHistory?.()||{};
    state.playerStage=null;state.selected=null;state.inspectSlot=null;state.inspectStage=null;
    state.mods={paint:false,plus:0,reverse:false,double:false};
    state.trump=runtimeRoot?.drawSetTrump?.(state)??state.trump;
    state.hand?.forEach?.(card=>runtimeRoot?.runCardEffects?.('on_set_start',card,{trump:state.trump,setIndex:state.setIndex,afterFold:true}));
    runtimeRoot?.nextEnemy?.();
    return state;
  }
  async function resolveFold(runtimeRoot=defaultRoot,{penalty=DEFAULT_FOLD_HP_LOSS}={}){
    const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot),availability=foldAvailability(state);
    if(!availability.allowed)return{ok:false,stage:STAGE,reason:availability.reason,slotCount:availability.slotCount??state?.slots?.length??0};
    if(!runState)return{ok:false,stage:STAGE,reason:'missing_run'};
    const record=createFoldRecord(state,runState,{penalty});
    state.phase='fold';state.animating=true;
    const loss=applyFixedHpLoss(runState,record.penaltyRequested);
    record.penaltyLost=loss.lost;record.hpBefore=loss.hpBefore;record.hpAfter=loss.hpAfter;record.playerDefeated=loss.defeated;
    cleanupFoldedSet(runtimeRoot,state,record);
    record.handUidsAfter=(state.hand||[]).map(cardUid);
    const archived=archiveFold(state,runState,record);
    runtimeRoot?.sfx?.('lose');runtimeRoot?.flash?.(`폴드 · 체력 -${loss.lost}`);
    state.animating=false;
    if(loss.defeated){state.phase='fold';runtimeRoot?.renderBattle?.();runtimeRoot?.loseRun?.();return{ok:true,stage:STAGE,record:archived,playerDefeated:true,nextSet:false}}
    beginNextSet(runtimeRoot,state);runtimeRoot?.renderBattle?.();
    return{ok:true,stage:STAGE,record:archived,playerDefeated:false,nextSet:true};
  }
  async function requestFold(runtimeRoot=defaultRoot,{confirm=true,penalty=DEFAULT_FOLD_HP_LOSS}={}){
    const state=activeBattle(runtimeRoot),availability=foldAvailability(state);
    if(!availability.allowed)return{ok:false,stage:STAGE,reason:availability.reason};
    if(confirm&&typeof runtimeRoot?.confirm==='function'){
      const accepted=runtimeRoot.confirm(`이번 세트를 폴드합니다.\n쇼다운 공격은 양쪽 모두 생략되고 체력 ${penalty}을 잃습니다.\n현재 쇼다운 슬롯 ${availability.slotCount}장은 버림 더미로 이동합니다.`);
      if(!accepted)return{ok:false,stage:STAGE,reason:'cancelled'};
    }
    return resolveFold(runtimeRoot,{penalty});
  }

  function ensureFoldButton(runtimeRoot=defaultRoot){
    const doc=runtimeRoot?.document;if(!doc?.getElementById||!doc?.createElement)return null;
    let button=doc.getElementById('foldBtn');if(button)return button;
    const host=doc.querySelector?.('#handPanel .panelTitle');if(!host?.appendChild)return null;
    button=doc.createElement('button');button.id='foldBtn';button.type='button';button.className='pixelBtn';button.textContent=`폴드 · HP -${DEFAULT_FOLD_HP_LOSS}`;
    button.style.padding='4px 7px';button.style.fontSize='10px';button.style.display='none';button.title='4번째 트릭부터 가능 · 양측 쇼다운 공격 생략 · 현재 슬롯 버림 · 손패 유지';
    button.addEventListener('click',()=>{requestFold(runtimeRoot).catch?.(error=>runtimeRoot?.console?.error?.('[fold 8-E]',error))});
    host.appendChild(button);return button;
  }
  function syncFoldButton(runtimeRoot=defaultRoot,state=activeBattle(runtimeRoot)){
    const button=ensureFoldButton(runtimeRoot);if(!button)return false;
    const availability=foldAvailability(state),visible=availability.allowed||availability.reason==='battle_busy'&&(state?.slots?.length>=MIN_FOLD_SLOTS&&state?.slots?.length<=MAX_FOLD_SLOTS&&state?.phase==='trick');
    button.style.display=visible?'':'none';button.disabled=!availability.allowed;button.textContent=`폴드 · HP -${DEFAULT_FOLD_HP_LOSS}`;
    if(visible)button.title=`현재 ${state.slots.length}장 · 쇼다운 공격 생략 · 슬롯 버림 · 손패 유지 · 체력 ${DEFAULT_FOLD_HP_LOSS} 손실`;
    return visible;
  }
  function wrapRenderBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.renderBattle;if(typeof original!=='function'||original.__tricklogFold8E)return false;
    function wrapped(...args){const result=original.apply(this,args);syncFoldButton(runtimeRoot,activeBattle(runtimeRoot));return result}
    wrapped.__tricklogFold8E=true;wrapped.__original=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function wrapStartBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.startBattle;if(typeof original!=='function'||original.__tricklogFold8E)return false;
    function wrapped(...args){const result=original.apply(this,args),state=activeBattle(runtimeRoot);if(state){state.foldHistory=[];state.lastFold=null}syncFoldButton(runtimeRoot,state);return result}
    wrapped.__tricklogFold8E=true;wrapped.__original=original;runtimeRoot.startBattle=wrapped;return true;
  }
  function installBrowser(runtimeRoot=defaultRoot){
    if(browserInstalled){syncFoldButton(runtimeRoot,activeBattle(runtimeRoot));return true}
    if(!runtimeRoot||typeof runtimeRoot.renderBattle!=='function'||typeof runtimeRoot.startBattle!=='function')return false;
    wrapRenderBattle(runtimeRoot);wrapStartBattle(runtimeRoot);ensureFoldButton(runtimeRoot);syncFoldButton(runtimeRoot,activeBattle(runtimeRoot));
    runtimeRoot.foldCurrentSet=(options)=>requestFold(runtimeRoot,options);
    browserInstalled=true;return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25)};
    if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true;
  }
  function resetBrowserInstallForTests(){browserInstalled=false}

  return{STAGE,MIN_FOLD_SLOTS,MAX_FOLD_SLOTS,DEFAULT_FOLD_HP_LOSS,HISTORY_LIMIT,activeBattle,activeRun,cardUid,slotCard,numeric,foldAvailability,canFold,applyFixedHpLoss,createFoldRecord,archiveFold,clearShowdownUi,cleanupFoldedSet,beginNextSet,resolveFold,requestFold,ensureFoldButton,syncFoldButton,wrapRenderBattle,wrapStartBattle,installBrowser,installWhenReady,resetBrowserInstallForTests};
});