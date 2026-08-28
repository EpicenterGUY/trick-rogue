(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.RunResults=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='7-4';
  const RESULT_VERSION='7-4';
  const OUTCOMES=Object.freeze(['clear','defeat']);
  let installed=false;

  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function toArray(value){if(value instanceof Set)return[...value];return Array.isArray(value)?value:[]}
  function normalizeOutcome(outcome){if(!OUTCOMES.includes(outcome))throw new TypeError(`Unknown run outcome: ${String(outcome)}`);return outcome}
  function cardEffects(card){return card?.effects||card?.definition?.effects||card?.named?.effects||[]}
  function completedNodeCount(runState){
    if(!runState)return 0;
    const previous=(Array.isArray(runState.actHistory)?runState.actHistory:[]).reduce((sum,entry)=>sum+toArray(entry?.completed).length,0);
    return previous+toArray(runState.completed).length;
  }
  function buildCounts(runState,runtimeRoot=root){
    const relics=Array.isArray(runState?.relics)?runState.relics.length:0;
    const contracts=Array.isArray(runState?.contracts)?runState.contracts.length:0;
    const taboos=Array.isArray(runState?.taboos)?runState.taboos.length:0;
    let synergies=0;
    try{synergies=Number(runtimeRoot?.BuildSynergySystem?.synergySummary?.(runState)?.count)||0}catch(_error){}
    const fieldId=runState?.fieldLoadout?.activeFieldId||null;
    let fieldLabel=fieldId;
    try{fieldLabel=runtimeRoot?.RunFields?.fieldDefinition?.(fieldId)?.label||runtimeRoot?.RunFields?.fieldDefinition?.(fieldId)?.name||fieldId}catch(_error){}
    return{relics,contracts,taboos,synergies,fieldId,fieldLabel:fieldLabel||null};
  }
  function actMapSummary(runState){
    return(Array.isArray(runState?.actMapHistory)?runState.actMapHistory:[]).map(entry=>({actId:entry.actId||null,variantId:entry.variantId||null,actSeed:Number.isFinite(entry.actSeed)?entry.actSeed:null}));
  }
  function buildRunSummary(runState,{outcome='clear',runtimeRoot=root}={}){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    normalizeOutcome(outcome);
    const deck=Array.isArray(runState.deck)?runState.deck:[],actHistory=Array.isArray(runState.actHistory)?runState.actHistory:[],build=buildCounts(runState,runtimeRoot);
    const clearedCurrent=outcome==='clear'&&runState.runComplete===true;
    return{
      version:RESULT_VERSION,outcome,cleared:outcome==='clear',victory:outcome==='clear',runSeed:Number.isFinite(runState.runSeed)?runState.runSeed:null,
      actId:runState.actId||null,actIndex:Number(runState.actIndex)||null,actName:runState.actName||'',
      actsCompleted:actHistory.length+(clearedCurrent?1:0),nodesCompleted:completedNodeCount(runState),routeLength:Array.isArray(runState.routeHistory)?runState.routeHistory.length:0,
      hp:Number(runState.hp)||0,maxHp:Number(runState.maxHp)||0,gold:Number(runState.gold)||0,
      deckSize:deck.length,namedCards:deck.filter(card=>!!card?.named).length,effectCards:deck.filter(card=>cardEffects(card).length>0).length,
      relics:build.relics,contracts:build.contracts,taboos:build.taboos,synergies:build.synergies,activeFieldId:build.fieldId,activeFieldLabel:build.fieldLabel,
      mapHistory:actMapSummary(runState)
    };
  }
  function ensureResultHistory(runState){if(!Array.isArray(runState.runResultHistory))runState.runResultHistory=[];return runState.runResultHistory}
  function recordRunResult(runState,outcome='clear',{runtimeRoot=root}={}){
    normalizeOutcome(outcome);
    if(runState?.runResult?.version===RESULT_VERSION&&runState.runResult.outcome===outcome)return runState.runResult;
    const summary=buildRunSummary(runState,{outcome,runtimeRoot}),history=ensureResultHistory(runState),result={...summary,step:history.length+1};
    runState.runResult=result;history.push({...result,mapHistory:result.mapHistory.map(entry=>({...entry}))});return result;
  }
  function summaryRows(summary){
    const build=`유물 ${summary.relics} · 계약 ${summary.contracts} · 금기 ${summary.taboos} · 시너지 ${summary.synergies}`;
    const field=summary.activeFieldLabel?`활성 필드 · ${summary.activeFieldLabel}`:'활성 필드 없음';
    const seed=summary.runSeed===null?'시드 없음':`시드 ${summary.runSeed}`;
    return[
      `체력 ${summary.hp}/${summary.maxHp} · 골드 ${summary.gold}`,
      `덱 ${summary.deckSize}장 · 네임드 ${summary.namedCards}장 · 효과 카드 ${summary.effectCards}장`,
      build,field,
      `완료 액트 ${summary.actsCompleted} · 완료 노드 ${summary.nodesCompleted} · 실제 경로 ${summary.routeLength}`,
      `${seed} · 생성 맵 ${summary.mapHistory.length}개`
    ];
  }
  function runResultHtml(summary){
    const clear=summary.outcome==='clear',title=clear?'런 클리어':'런 종료',tone=clear?'cyan':'red';
    const lead=clear?'마지막 보스를 쓰러뜨렸다. 이번 런의 빌드와 경로를 정리한다.':'체력이 모두 소진되었다. 이번 런의 빌드와 경로를 정리한다.';
    const rows=summaryRows(summary).map(text=>`<div class="choice"><b>${escapeHtml(text)}</b></div>`).join('');
    return`<h2 class="${tone}">${title}</h2><p>${lead}</p><div class="choiceList">${rows}<button class="choice" onclick="location.reload()"><b>새 런</b><span>현재 런을 끝내고 처음부터 시작한다.</span></button></div>`;
  }
  function transitionModel(runState,result){
    if(!result?.transitioned)return null;
    const history=Array.isArray(runState?.actHistory)?runState.actHistory:[],previous=history[history.length-1]||{};
    return{version:RESULT_VERSION,fromActId:result.fromActId||previous.actId||null,fromActIndex:Number(previous.actIndex)||null,fromCompletedNodes:toArray(previous.completed).length,nextActId:result.nextActId||runState?.actId||null,nextActIndex:Number(runState?.actIndex)||null,nextActName:runState?.actName||'',hp:Number(runState?.hp)||0,maxHp:Number(runState?.maxHp)||0,gold:Number(runState?.gold)||0};
  }
  function transitionHtml(model){
    if(!model)return'';
    const from=model.fromActIndex?`액트 ${model.fromActIndex}`:(model.fromActId||'이전 액트'),next=model.nextActName||(`액트 ${model.nextActIndex||'?'}`);
    return`<h2 class="cyan">${escapeHtml(from)} 클리어</h2><p>경로 ${model.fromCompletedNodes}개를 완료했다.<br>체력 ${model.hp}/${model.maxHp} · 골드 ${model.gold}</p><div class="choiceList"><button class="choice" onclick="closeOverlay()"><b>다음 · ${escapeHtml(next)}</b><span>새 액트의 지도를 확인한다.</span></button></div>`;
  }
  function showModal(runtimeRoot,html){
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}
    const doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null),modal=doc?.getElementById?.('modal'),overlay=doc?.getElementById?.('overlay');if(!modal||!overlay)return false;modal.innerHTML=html;overlay.classList.add('show');return true;
  }
  function showRunResult(runtimeRoot=root,outcome='clear'){
    const runState=activeRun(runtimeRoot);if(!runState)return null;const result=recordRunResult(runState,outcome,{runtimeRoot});showModal(runtimeRoot,runResultHtml(result));return result;
  }
  function showActTransition(runtimeRoot=root,result){
    const runState=activeRun(runtimeRoot),model=transitionModel(runState,result);if(!model)return null;showModal(runtimeRoot,transitionHtml(model));return model;
  }
  function wrapBeginRun(runtimeRoot=root){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runResultsAdapter)return true;
    const wrapped=function(...args){const result=original.apply(this,args),runState=activeRun(runtimeRoot);if(runState){runState.runResult=null;runState.runResultHistory=[]}return result};
    wrapped.__runResultsAdapter=true;wrapped.__runResultsOriginal=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapFinishRun(runtimeRoot=root){
    const original=runtimeRoot?.finishRun;if(typeof original!=='function')return false;if(original.__runResultsAdapter)return true;
    const wrapped=function(..._args){return showRunResult(runtimeRoot,'clear')};
    wrapped.__runResultsAdapter=true;wrapped.__legacyFinishRun=original;runtimeRoot.finishRun=wrapped;return true;
  }
  function wrapLoseRun(runtimeRoot=root){
    const original=runtimeRoot?.loseRun;if(typeof original!=='function')return false;if(original.__runResultsAdapter)return true;
    const wrapped=function(...args){const legacy=original.apply(this,args);const result=showRunResult(runtimeRoot,'defeat');return result||legacy};
    wrapped.__runResultsAdapter=true;wrapped.__legacyLoseRun=original;runtimeRoot.loseRun=wrapped;return true;
  }
  function wrapCompleteNode(runtimeRoot=root){
    const original=runtimeRoot?.completeNode;if(typeof original!=='function')return false;if(original.__runResultsAdapter)return true;
    const wrapped=function(node,...args){const result=original.call(this,node,...args);if(result?.transitioned)showActTransition(runtimeRoot,result);return result};
    wrapped.__runResultsAdapter=true;wrapped.__runResultsOriginal=original;runtimeRoot.completeNode=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(!runtimeRoot?.RunMapGeneration||typeof runtimeRoot?.beginRun!=='function'||typeof runtimeRoot?.completeNode!=='function'||typeof runtimeRoot?.finishRun!=='function')return false;
    if(!runtimeRoot.beginRun.__runMapGenerationAdapter||!runtimeRoot.completeNode.__runMapGenerationAdapter)return false;
    wrapBeginRun(runtimeRoot);wrapFinishRun(runtimeRoot);wrapLoseRun(runtimeRoot);wrapCompleteNode(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<60)setTimeout(attempt,25);else console.warn('[run-results] 런 구조 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,RESULT_VERSION,OUTCOMES,activeRun,escapeHtml,toArray,normalizeOutcome,cardEffects,completedNodeCount,buildCounts,actMapSummary,buildRunSummary,ensureResultHistory,recordRunResult,summaryRows,runResultHtml,transitionModel,transitionHtml,showModal,showRunResult,showActTransition,wrapBeginRun,wrapFinishRun,wrapLoseRun,wrapCompleteNode,installBrowserRuntime,installWhenReady};
});
