(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.RunPaths=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='7-2';
  const PATH_POLICY='commit_on_enter';
  let installed=false;

  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function toSet(value){
    if(root?.RunStructure?.toSet)return root.RunStructure.toSet(value);
    return value instanceof Set?new Set(value):new Set(Array.isArray(value)?value:[]);
  }
  function mapNodeIds(runState){return new Set((runState?.map||[]).map(node=>node.id))}
  function ensurePathState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    const actId=runState.actId||null,validIds=mapNodeIds(runState);
    if(!runState.routeState||typeof runState.routeState!=='object'||runState.routeState.actId!==actId){
      runState.routeState={version:STAGE,policy:PATH_POLICY,actId,skippedNodeIds:[],pathNodeIds:[]};
    }
    runState.routeState.version=STAGE;runState.routeState.policy=PATH_POLICY;runState.routeState.actId=actId;
    runState.routeState.skippedNodeIds=[...new Set((runState.routeState.skippedNodeIds||[]).filter(id=>validIds.has(id)))];
    runState.routeState.pathNodeIds=[...new Set((runState.routeState.pathNodeIds||[]).filter(id=>validIds.has(id)))];
    if(!Array.isArray(runState.routeHistory))runState.routeHistory=[];
    return runState.routeState;
  }
  function skippedSet(runState){return new Set(ensurePathState(runState).skippedNodeIds)}
  function nodeById(runState,nodeOrId){
    if(root?.RunStructure?.nodeById)return root.RunStructure.nodeById(runState,nodeOrId);
    const id=typeof nodeOrId==='string'?nodeOrId:nodeOrId?.id;return(runState?.map||[]).find(node=>node.id===id)||null;
  }
  function reachableNodeIds(runState,startIds){
    const byId=new Map((runState?.map||[]).map(node=>[node.id,node])),seen=new Set(),stack=[...(Array.isArray(startIds)?startIds:[startIds]).filter(Boolean)];
    while(stack.length){const id=stack.pop();if(seen.has(id)||!byId.has(id))continue;seen.add(id);for(const nextId of byId.get(id).next||[])stack.push(nextId)}
    return seen;
  }
  function previewPathChoice(runState,nodeOrId){
    const node=nodeById(runState,nodeOrId);if(!node)return{ok:false,reason:'unknown_node',peerNodeIds:[],closedNodeIds:[]};
    const available=toSet(runState.available),completed=toSet(runState.completed),skipped=skippedSet(runState);
    if(completed.has(node.id))return{ok:false,reason:'already_completed',node,peerNodeIds:[],closedNodeIds:[]};
    if(skipped.has(node.id)||!available.has(node.id))return{ok:false,reason:'node_locked',node,peerNodeIds:[],closedNodeIds:[]};
    if(runState.currentNodeId&&runState.currentNodeId!==node.id)return{ok:false,reason:'node_in_progress',node,peerNodeIds:[],closedNodeIds:[]};
    const peerNodeIds=[...available].filter(id=>id!==node.id&&!completed.has(id)&&!skipped.has(id));
    const chosenReachable=reachableNodeIds(runState,[node.id]),peerReachable=reachableNodeIds(runState,peerNodeIds);
    const closedNodeIds=[...peerReachable].filter(id=>!chosenReachable.has(id)&&!completed.has(id)&&id!==node.id);
    return{ok:true,node,peerNodeIds,closedNodeIds};
  }
  function commitPathChoice(runState,nodeOrId){
    ensurePathState(runState);const preview=previewPathChoice(runState,nodeOrId);if(!preview.ok)return preview;
    const state=runState.routeState,skipped=new Set(state.skippedNodeIds),available=toSet(runState.available);
    for(const peerId of preview.peerNodeIds)available.delete(peerId);
    for(const closedId of preview.closedNodeIds)skipped.add(closedId);
    runState.available=available;state.skippedNodeIds=[...skipped];
    if(!state.pathNodeIds.includes(preview.node.id))state.pathNodeIds.push(preview.node.id);
    const entry={actId:runState.actId||null,actIndex:runState.actIndex||null,nodeId:preview.node.id,fromNodeId:runState.lastCompletedNodeId||null,closedNodeIds:[...preview.closedNodeIds],step:runState.routeHistory.length+1};
    runState.routeHistory.push(entry);
    return{...preview,committed:true,entry};
  }
  function completePathNode(runState,nodeOrId,{registry}={}){
    if(!root?.RunStructure?.completeNodeProgress)throw new TypeError('RunStructure.completeNodeProgress is required');
    ensurePathState(runState);const node=nodeById(runState,nodeOrId);if(!node)return{ok:false,reason:'unknown_node'};
    if(runState.currentNodeId!==node.id){const commit=commitPathChoice(runState,node);if(!commit.ok)return commit}
    const result=root.RunStructure.completeNodeProgress(runState,node,registry?{registry}:undefined);
    ensurePathState(runState);return result;
  }
  function pathSummary(runState){
    if(!runState)return null;const state=ensurePathState(runState);return{policy:state.policy,actId:state.actId,pathLength:state.pathNodeIds.length,pathNodeIds:[...state.pathNodeIds],skippedCount:state.skippedNodeIds.length,skippedNodeIds:[...state.skippedNodeIds],historyCount:runState.routeHistory.length};
  }
  function ensureStyle(doc){
    if(!doc?.head||doc.getElementById?.('runPathStyle'))return;
    const style=doc.createElement('style');style.id='runPathStyle';style.textContent='.node.routeSkipped{opacity:.14!important;filter:grayscale(1) brightness(.68)!important;pointer-events:none}.node.routeSkipped:after{content:"×";position:absolute;right:4px;top:1px;color:#ef6575;font-size:13px;font-weight:900}.node.routeSkipped .icon,.node.routeSkipped .nm{opacity:.65}';doc.head.appendChild(style);
  }
  function decorateMap(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;const state=ensurePathState(runState);ensureStyle(doc);
    const skipped=new Set(state.skippedNodeIds),buttons=[...(doc.querySelectorAll?.('#mapGrid .node')||[])];
    (runState.map||[]).forEach((node,index)=>{const button=buttons[index];if(!button)return;button.classList?.toggle?.('routeSkipped',skipped.has(node.id));button.dataset&&(button.dataset.routeState=skipped.has(node.id)?'skipped':toSet(runState.completed).has(node.id)?'completed':toSet(runState.available).has(node.id)?'available':'locked');if(skipped.has(node.id)){button.title='선택하지 않은 경로';button.setAttribute?.('aria-label',`${node.id} 선택하지 않은 경로`)}});
    const badge=doc.getElementById?.('mapActBadge');if(badge){const completed=toSet(runState.completed).size,total=(runState.map||[]).length;badge.title=`${runState.actName||'액트'} · 진행 ${completed}/${total} · 분기 선택 시 다른 경로 잠금`}
    return pathSummary(runState);
  }
  function wrapBeginRun(runtimeRoot=root){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runPathAdapter)return true;
    const wrapped=function(...args){const result=original.apply(this,args),runState=activeRun(runtimeRoot);if(runState){ensurePathState(runState);if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap()}return result};
    wrapped.__runPathAdapter=true;wrapped.__runPathOriginal=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapEnterNode(runtimeRoot=root){
    const original=runtimeRoot?.enterNode;if(typeof original!=='function')return false;if(original.__runPathAdapter)return true;
    const wrapped=function(node,...args){const runState=activeRun(runtimeRoot);if(runState){const commit=commitPathChoice(runState,node);if(!commit.ok)return false}return original.call(this,node,...args)};
    wrapped.__runPathAdapter=true;wrapped.__runPathOriginal=original;runtimeRoot.enterNode=wrapped;return true;
  }
  function wrapCompleteNode(runtimeRoot=root){
    const original=runtimeRoot?.completeNode;if(typeof original!=='function')return false;if(original.__runPathAdapter)return true;
    const wrapped=function(node,...args){const runState=activeRun(runtimeRoot);if(runState){ensurePathState(runState);const resolved=nodeById(runState,node);if(resolved&&runState.currentNodeId!==resolved.id){const commit=commitPathChoice(runState,resolved);if(!commit.ok)return commit}}const result=original.call(this,node,...args);const after=activeRun(runtimeRoot);if(after)ensurePathState(after);return result};
    wrapped.__runPathAdapter=true;wrapped.__runPathOriginal=original;runtimeRoot.completeNode=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=root){
    const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__runPathAdapter)return true;
    const wrapped=function(...args){const runState=activeRun(runtimeRoot);if(runState)ensurePathState(runState);const result=original.apply(this,args);decorateMap(runtimeRoot);return result};
    wrapped.__runPathAdapter=true;wrapped.__runPathOriginal=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;if(!runtimeRoot?.RunStructure)return false;
    if(typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.enterNode!=='function'||typeof runtimeRoot.completeNode!=='function'||typeof runtimeRoot.renderMap!=='function')return false;
    if(!runtimeRoot.enterNode.__runStructureAdapter||!runtimeRoot.completeNode.__runStructureAdapter||!runtimeRoot.renderMap.__runStructureAdapter)return false;
    wrapBeginRun(runtimeRoot);wrapEnterNode(runtimeRoot);wrapCompleteNode(runtimeRoot);wrapRenderMap(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<60)setTimeout(attempt,25);else console.warn('[run-paths] 런 구조 어댑터를 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  return{STAGE,PATH_POLICY,activeRun,toSet,ensurePathState,skippedSet,nodeById,reachableNodeIds,previewPathChoice,commitPathChoice,completePathNode,pathSummary,decorateMap,wrapBeginRun,wrapEnterNode,wrapCompleteNode,wrapRenderMap,installBrowserRuntime,installWhenReady};
});
