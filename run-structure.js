(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.RunStructure=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='RUN-V3';
  const NODE_TYPES=Object.freeze(['battle','event','camp','shop','elite','boss']);
  function frozenNode(id,type,lane,row,next=[],metadata={}){
    const extras={...metadata};
    if(Array.isArray(extras.tags))extras.tags=Object.freeze([...extras.tags]);
    return Object.freeze({id,type,lane,row,next:Object.freeze([...next]),...extras});
  }
  function frozenAct({id,index,name,entryNodeIds,nextActId=null,requiresBoss=true,nodes}){return Object.freeze({id,index,name,entryNodeIds:Object.freeze([...entryNodeIds]),nextActId,requiresBoss,nodes:Object.freeze(nodes)})}
  function regionAct(id,name,prefix,branches){
    const [left,right]=branches;
    return frozenAct({id,index:1,name,entryNodeIds:[`${prefix}0`],nodes:[
      frozenNode(`${prefix}0`,'battle',1,0,[`${prefix}1`,`${prefix}2`]),
      frozenNode(`${prefix}1`,'event',0,1,[`${prefix}3`],{branchId:left.id,branchLabel:left.label,branchEntry:true,branchTags:left.tags}),
      frozenNode(`${prefix}2`,'battle',2,1,[`${prefix}4`],{branchId:right.id,branchLabel:right.label,branchEntry:true,branchTags:right.tags}),
      frozenNode(`${prefix}3`,'camp',0,2,[`${prefix}5`],{branchId:left.id,branchLabel:left.label,branchTags:left.tags}),
      frozenNode(`${prefix}4`,'shop',2,2,[`${prefix}5`],{branchId:right.id,branchLabel:right.label,branchTags:right.tags}),
      frozenNode(`${prefix}5`,'elite',1,3,[`${prefix}6`]),
      frozenNode(`${prefix}6`,'boss',1,4,[])
    ]})
  }
  const REGION_BRANCHES=Object.freeze({
    region_theater:Object.freeze([
      Object.freeze({id:'backstage',label:'무대 뒤편',tags:Object.freeze(['slot','exchange','object','performance'])}),
      Object.freeze({id:'grand_stage',label:'대극장',tags:Object.freeze(['field','showdown','risk','performance'])})
    ]),
    region_observatory:Object.freeze([
      Object.freeze({id:'archive',label:'기록실',tags:Object.freeze(['memory','deck_info','information'])}),
      Object.freeze({id:'tower',label:'전망대',tags:Object.freeze(['forecast','precision','information'])})
    ]),
    region_frontier:Object.freeze([
      Object.freeze({id:'supply_route',label:'보급로',tags:Object.freeze(['chip','exchange','supply'])}),
      Object.freeze({id:'outpost',label:'전초기지',tags:Object.freeze(['status','damage','risk'])})
    ]),
    region_casino:Object.freeze([
      Object.freeze({id:'vip_room',label:'VIP 룸',tags:Object.freeze(['chip','gambling','risk','low_rank'])}),
      Object.freeze({id:'underground_table',label:'지하 도박장',tags:Object.freeze(['reverse','debt','river','gambling'])})
    ])
  });
  const ACT_DEFINITIONS=Object.freeze({
    act1:frozenAct({id:'act1',index:1,name:'액트 1',entryNodeIds:['n0'],nodes:[
      frozenNode('n0','battle',1,0,['n1','n2']),frozenNode('n1','event',0,1,['n3']),frozenNode('n2','battle',2,1,['n4']),frozenNode('n3','camp',0,2,['n5']),frozenNode('n4','shop',2,2,['n5']),frozenNode('n5','elite',1,3,['n6']),frozenNode('n6','boss',1,4,[])
    ]}),
    common:frozenAct({id:'common',index:1,name:'공통지역',entryNodeIds:['c0'],requiresBoss:false,nodes:[
      frozenNode('c0','battle',1,0,['c1']),frozenNode('c1','event',1,1,['c2']),frozenNode('c2','battle',1,2,['c3']),frozenNode('c3','camp',1,3,['c4']),frozenNode('c4','elite',1,4,[])
    ]}),
    region_theater:regionAct('region_theater','유랑극장','t',REGION_BRANCHES.region_theater),
    region_observatory:regionAct('region_observatory','안개 관측소','o',REGION_BRANCHES.region_observatory),
    region_frontier:regionAct('region_frontier','황야 전선','w',REGION_BRANCHES.region_frontier),
    region_casino:regionAct('region_casino','침몰 카지노','k',REGION_BRANCHES.region_casino),
    gateway:frozenAct({id:'gateway',index:3,name:'최종 관문',entryNodeIds:['g0'],requiresBoss:false,nodes:[
      frozenNode('g0','event',1,0,['g1','g2']),
      frozenNode('g1','battle',0,1,['g3']),
      frozenNode('g2','event',2,1,['g3']),
      frozenNode('g3','elite',1,2,[])
    ]}),
    final:frozenAct({id:'final',index:4,name:'최종지역',entryNodeIds:['f0'],nodes:[
      frozenNode('f0','battle',1,0,['f1','f2']),frozenNode('f1','event',0,1,['f3']),frozenNode('f2','battle',2,1,['f3']),frozenNode('f3','elite',1,2,['f4']),frozenNode('f4','camp',1,3,['f5']),frozenNode('f5','boss',1,4,[])
    ]})
  });
  let installed=false;

  function actDefinition(id='act1',registry=ACT_DEFINITIONS){return registry?.[id]||null}
  function cloneNode(node){
    const result={...node,next:[...(node?.next||[])]};
    if(Array.isArray(node?.tags))result.tags=[...node.tags];if(Array.isArray(node?.branchTags))result.branchTags=[...node.branchTags];
    return result;
  }
  function createActMap(actId='act1',registry=ACT_DEFINITIONS){const definition=actDefinition(actId,registry);if(!definition)throw new TypeError(`Unknown act: ${String(actId)}`);return definition.nodes.map(cloneNode)}
  function validateActDefinition(definition,id=definition?.id){
    const errors=[];if(!definition||typeof definition!=='object')return['act definition must be an object'];
    if(!definition.id)errors.push('missing id');if(id&&definition.id!==id)errors.push(`id mismatch ${definition.id}`);
    if(!Number.isInteger(definition.index)||definition.index<1)errors.push('index must be a positive integer');if(!definition.name)errors.push('missing name');
    if(!Array.isArray(definition.entryNodeIds)||!definition.entryNodeIds.length)errors.push('entryNodeIds must not be empty');
    if(!Array.isArray(definition.nodes)||!definition.nodes.length)return[...errors,'nodes must not be empty'];
    const ids=new Set(),positions=new Set();
    for(const node of definition.nodes){
      if(!node?.id){errors.push('node missing id');continue}if(ids.has(node.id))errors.push(`duplicate node id ${node.id}`);ids.add(node.id);
      if(!NODE_TYPES.includes(node.type))errors.push(`unknown node type ${node.type}`);
      if(!Number.isInteger(node.lane)||node.lane<0)errors.push(`${node.id}: lane must be a non-negative integer`);if(!Number.isInteger(node.row)||node.row<0)errors.push(`${node.id}: row must be a non-negative integer`);
      const position=`${node.lane}:${node.row}`;if(positions.has(position))errors.push(`duplicate node position ${position}`);positions.add(position);if(!Array.isArray(node.next))errors.push(`${node.id}: next must be an array`);
      if(node.branchEntry&&!node.branchId)errors.push(`${node.id}: branchEntry requires branchId`);
    }
    for(const entryId of definition.entryNodeIds||[])if(!ids.has(entryId))errors.push(`unknown entry node ${entryId}`);
    for(const node of definition.nodes)for(const nextId of node.next||[])if(!ids.has(nextId))errors.push(`${node.id}: unknown next node ${nextId}`);
    const bosses=definition.nodes.filter(node=>node.type==='boss');if(definition.requiresBoss!==false&&!bosses.length)errors.push('act requires a boss node');for(const node of bosses)if((node.next||[]).length)errors.push(`${node.id}: boss node must be terminal inside an act`);
    const byId=new Map(definition.nodes.map(node=>[node.id,node])),visiting=new Set(),visited=new Set();let cycle=false;
    function visit(nodeId){if(visiting.has(nodeId)){cycle=true;return}if(visited.has(nodeId))return;visiting.add(nodeId);for(const nextId of byId.get(nodeId)?.next||[])visit(nextId);visiting.delete(nodeId);visited.add(nodeId)}
    for(const entryId of definition.entryNodeIds||[])visit(entryId);if(cycle)errors.push('act graph must be acyclic');for(const node of definition.nodes)if(!visited.has(node.id))errors.push(`unreachable node ${node.id}`);return errors;
  }
  function validateActRegistry(registry=ACT_DEFINITIONS){const errors=[];for(const [id,definition] of Object.entries(registry||{}))errors.push(...validateActDefinition(definition,id).map(error=>`${id}: ${error}`));for(const [id,definition] of Object.entries(registry||{}))if(definition.nextActId&&!registry[definition.nextActId])errors.push(`${id}: unknown next act ${definition.nextActId}`);return errors}
  function toSet(value){return value instanceof Set?new Set(value):new Set(Array.isArray(value)?value:[])}
  function createActProgress(actId='act1',registry=ACT_DEFINITIONS){const definition=actDefinition(actId,registry);if(!definition)throw new TypeError(`Unknown act: ${String(actId)}`);return{actId:definition.id,actIndex:definition.index,actName:definition.name,map:createActMap(actId,registry),available:new Set(definition.entryNodeIds),completed:new Set(),currentNodeId:null,lastCompletedNodeId:null,runComplete:false}}
  function actSnapshot(runState){return{actId:runState.actId,actIndex:runState.actIndex,completed:[...toSet(runState.completed)],lastCompletedNodeId:runState.lastCompletedNodeId||null}}
  function applyActToRun(runState,actId='act1',{registry=ACT_DEFINITIONS,recordPrevious=true}={}){if(!runState||typeof runState!=='object')throw new TypeError('runState is required');const definition=actDefinition(actId,registry);if(!definition)throw new TypeError(`Unknown act: ${String(actId)}`);if(!Array.isArray(runState.actHistory))runState.actHistory=[];if(recordPrevious&&runState.actId&&runState.actId!==actId)runState.actHistory.push(actSnapshot(runState));Object.assign(runState,createActProgress(actId,registry));return runState}
  function ensureRunProgress(runState,{registry=ACT_DEFINITIONS,defaultActId='act1'}={}){if(!runState||typeof runState!=='object')throw new TypeError('runState is required');const actId=runState.actId||defaultActId,definition=actDefinition(actId,registry);if(!definition)throw new TypeError(`Unknown act: ${String(actId)}`);runState.actId=definition.id;runState.actIndex=runState.actIndex??definition.index;runState.actName=definition.name;if(!Array.isArray(runState.map)||!runState.map.length)runState.map=createActMap(actId,registry);else runState.map=runState.map.map(cloneNode);runState.completed=toSet(runState.completed);runState.available=runState.available==null?new Set(definition.entryNodeIds):toSet(runState.available);if(!Array.isArray(runState.actHistory))runState.actHistory=[];if(!('currentNodeId' in runState))runState.currentNodeId=null;if(!('lastCompletedNodeId' in runState))runState.lastCompletedNodeId=null;if(!('runComplete' in runState))runState.runComplete=false;return runState}
  function nodeById(runState,nodeOrId){const id=typeof nodeOrId==='string'?nodeOrId:nodeOrId?.id;return(runState?.map||[]).find(node=>node.id===id)||null}
  function canEnterNode(runState,nodeOrId){const node=nodeById(runState,nodeOrId);return!!node&&toSet(runState?.available).has(node.id)&&!toSet(runState?.completed).has(node.id)}
  function markNodeEntered(runState,nodeOrId){const node=nodeById(runState,nodeOrId);if(!node||!canEnterNode(runState,node))return false;runState.currentNodeId=node.id;return true}
  function completeNodeProgress(runState,nodeOrId,{registry=ACT_DEFINITIONS}={}){ensureRunProgress(runState,{registry});const node=nodeById(runState,nodeOrId);if(!node)return{ok:false,reason:'unknown_node'};if(runState.completed.has(node.id))return{ok:false,reason:'already_completed',node};if(!runState.available.has(node.id))return{ok:false,reason:'node_locked',node};runState.completed.add(node.id);runState.available.delete(node.id);for(const nextId of node.next)if(!runState.completed.has(nextId))runState.available.add(nextId);runState.lastCompletedNodeId=node.id;runState.currentNodeId=null;if(node.type!=='boss')return{ok:true,node,actComplete:(node.next||[]).length===0,runComplete:false,transitioned:false};const definition=actDefinition(runState.actId,registry),fromActId=runState.actId;if(definition?.nextActId){const nextActId=definition.nextActId;applyActToRun(runState,nextActId,{registry,recordPrevious:true});return{ok:true,node,actComplete:true,runComplete:false,transitioned:true,fromActId,nextActId}}runState.runComplete=true;return{ok:true,node,actComplete:true,runComplete:true,transitioned:false,fromActId,nextActId:null}}
  function runProgressSummary(runState){if(!runState)return null;const completed=toSet(runState.completed),available=toSet(runState.available);return{actId:runState.actId||null,actIndex:runState.actIndex??null,actName:runState.actName||'',completedCount:completed.size,totalNodes:Array.isArray(runState.map)?runState.map.length:0,availableCount:available.size,currentNodeId:runState.currentNodeId||null,runComplete:runState.runComplete===true}}
  function activeRun(runtimeRoot=root){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function renderMapActBadge(runtimeRoot=root){const runState=activeRun(runtimeRoot),doc=runtimeRoot?.document||(typeof document!=='undefined'?document:null);if(!runState||!doc)return null;ensureRunProgress(runState);const build=doc.getElementById?.('mapBuild'),row=build?.parentElement?.parentElement;let badge=doc.getElementById?.('mapActBadge');if(row&&!badge){badge=doc.createElement('span');badge.id='mapActBadge';badge.className='badge';if(row.firstChild)row.insertBefore(badge,row.firstChild);else row.appendChild(badge)}if(badge){badge.innerHTML=`액트 <b>${runState.actIndex}</b>`;badge.title=runState.actName}return runProgressSummary(runState)}
  function wrapBeginRun(runtimeRoot=root){const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runStructureAdapter)return true;const wrapped=function(...args){const result=original.apply(this,args),runState=activeRun(runtimeRoot);if(runState){if(runState.actId)ensureRunProgress(runState);else applyActToRun(runState,'act1',{recordPrevious:false});if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap()}return result};wrapped.__runStructureAdapter=true;wrapped.__legacyBeginRun=original;runtimeRoot.beginRun=wrapped;return true}
  function wrapEnterNode(runtimeRoot=root){const original=runtimeRoot?.enterNode;if(typeof original!=='function')return false;if(original.__runStructureAdapter)return true;const wrapped=function(node,...args){const runState=activeRun(runtimeRoot);if(runState){ensureRunProgress(runState);if(!markNodeEntered(runState,node))return false}return original.call(this,node,...args)};wrapped.__runStructureAdapter=true;wrapped.__legacyEnterNode=original;runtimeRoot.enterNode=wrapped;return true}
  function wrapCompleteNode(runtimeRoot=root){const original=runtimeRoot?.completeNode;if(typeof original!=='function')return false;if(original.__runStructureAdapter)return true;const wrapped=function(node,...args){const runState=activeRun(runtimeRoot);if(!runState)return original.call(this,node,...args);const result=completeNodeProgress(runState,node);if(!result.ok)return result;if(result.runComplete){if(typeof runtimeRoot.finishRun==='function')runtimeRoot.finishRun();return result}if(typeof runtimeRoot.closeOverlay==='function')runtimeRoot.closeOverlay();if(typeof runtimeRoot.showScreen==='function')runtimeRoot.showScreen('mapScreen');if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();return result};wrapped.__runStructureAdapter=true;wrapped.__legacyCompleteNode=original;runtimeRoot.completeNode=wrapped;return true}
  function wrapRenderMap(runtimeRoot=root){const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__runStructureAdapter)return true;const wrapped=function(...args){const runState=activeRun(runtimeRoot);if(runState)ensureRunProgress(runState);const result=original.apply(this,args);renderMapActBadge(runtimeRoot);return result};wrapped.__runStructureAdapter=true;wrapped.__legacyRenderMap=original;runtimeRoot.renderMap=wrapped;return true}
  function installBrowserRuntime(runtimeRoot=root){if(installed)return true;if(typeof runtimeRoot?.beginRun!=='function'||typeof runtimeRoot?.enterNode!=='function'||typeof runtimeRoot?.completeNode!=='function'||typeof runtimeRoot?.renderMap!=='function')return false;const errors=validateActRegistry();if(errors.length){console.error('[run-structure] 액트 정의 오류',errors);return false}wrapBeginRun(runtimeRoot);wrapEnterNode(runtimeRoot);wrapCompleteNode(runtimeRoot);wrapRenderMap(runtimeRoot);installed=true;return true}
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else console.warn('[run-structure] 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  return{STAGE,NODE_TYPES,REGION_BRANCHES,ACT_DEFINITIONS,actDefinition,cloneNode,createActMap,validateActDefinition,validateActRegistry,toSet,createActProgress,actSnapshot,applyActToRun,ensureRunProgress,nodeById,canEnterNode,markNodeEntered,completeNodeProgress,runProgressSummary,activeRun,renderMapActBadge,wrapBeginRun,wrapEnterNode,wrapCompleteNode,wrapRenderMap,installBrowserRuntime,installWhenReady};
});