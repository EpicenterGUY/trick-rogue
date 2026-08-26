(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunBalanceTelemetry=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='M5-1';
  const VERSION='M5-1';
  const NODE_TYPES=Object.freeze(['battle','event','camp','shop','elite','boss']);
  let browserInstalled=false;

  function numeric(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function clock(runtimeRoot=defaultRoot){return typeof runtimeRoot?.performance?.now==='function'?runtimeRoot.performance.now():Date.now()}
  function activeRun(runtimeRoot=defaultRoot){try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return runtimeRoot?.run||null}
  function activeBattle(runtimeRoot=defaultRoot){try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return runtimeRoot?.battle||null}
  function blankNodeCounts(){return{battle:0,event:0,camp:0,shop:0,elite:0,boss:0}}
  function blankBattleTypeCounts(){return{battle:0,elite:0,boss:0}}
  function createStats(now=Date.now()){
    return{
      version:VERSION,startedAtMs:numeric(now,0),nodeEntryKeys:[],nodes:{total:0,...blankNodeCounts()},
      battles:{count:0,wins:0,defeats:0,totalDurationMs:0,totalTricks:0,trickWins:0,trickLosses:0,trickDraws:0,totalShowdowns:0,showdownDiffTotal:0,showdownDiffMax:0,pureCardsPlayed:0,effectCardsPlayed:0,byType:blankBattleTypeCounts()},
      chip:{exchanges:0,spentOnExchanges:0,maxBalanceSeen:0,endingBalanceTotal:0}
    };
  }
  function ensureStats(runState,{now=Date.now()}={}){
    if(!runState||typeof runState!=='object')return null;
    const current=runState.balanceTelemetry&&typeof runState.balanceTelemetry==='object'?runState.balanceTelemetry:createStats(now);
    current.version=VERSION;
    if(!Array.isArray(current.nodeEntryKeys))current.nodeEntryKeys=[];
    current.nodes={total:0,...blankNodeCounts(),...(current.nodes||{})};
    current.battles={count:0,wins:0,defeats:0,totalDurationMs:0,totalTricks:0,trickWins:0,trickLosses:0,trickDraws:0,totalShowdowns:0,showdownDiffTotal:0,showdownDiffMax:0,pureCardsPlayed:0,effectCardsPlayed:0,byType:blankBattleTypeCounts(),...(current.battles||{})};
    current.battles.byType={...blankBattleTypeCounts(),...(current.battles.byType||{})};
    current.chip={exchanges:0,spentOnExchanges:0,maxBalanceSeen:0,endingBalanceTotal:0,...(current.chip||{})};
    runState.balanceTelemetry=current;return current;
  }
  function resetStats(runState,{now=Date.now()}={}){if(!runState||typeof runState!=='object')return null;runState.balanceTelemetry=createStats(now);return runState.balanceTelemetry}

  function nodeEntryKey(runState,node){return`${runState?.actId||'act'}:${node?.id||'node'}`}
  function recordNodeEntry(runState,node){
    const stats=ensureStats(runState);if(!stats||!node||!NODE_TYPES.includes(node.type))return false;
    const key=nodeEntryKey(runState,node);if(stats.nodeEntryKeys.includes(key))return false;
    stats.nodeEntryKeys.push(key);stats.nodes.total+=1;stats.nodes[node.type]=(stats.nodes[node.type]||0)+1;return true;
  }

  function cardEffects(card){return card?.effects||card?.definition?.effects||card?.named?.effects||[]}
  function cardKind(card){return Array.isArray(cardEffects(card))&&cardEffects(card).length?'effect':'pure'}
  function beginBattleRecord(state,{now=Date.now()}={}){
    if(!state||typeof state!=='object')return null;
    state.balanceTelemetry={version:VERSION,startedAtMs:numeric(now,0),archived:false,tricks:0,trickWins:0,trickLosses:0,trickDraws:0,showdowns:0,showdownDiffTotal:0,showdownDiffMax:0,pureCardsPlayed:0,effectCardsPlayed:0,maxChipSeen:Math.max(0,numeric(state?.chipEconomy?.balance??state?.chip,0)),lastShowdownSetIndex:null};
    return state.balanceTelemetry;
  }
  function ensureBattleRecord(state,{now=Date.now()}={}){return state?.balanceTelemetry&&typeof state.balanceTelemetry==='object'?state.balanceTelemetry:beginBattleRecord(state,{now})}
  function sampleChip(state){const record=ensureBattleRecord(state);if(!record)return 0;const balance=Math.max(0,numeric(state?.chipEconomy?.balance??state?.chip,0));record.maxChipSeen=Math.max(numeric(record.maxChipSeen,0),balance);return record.maxChipSeen}
  function recordTrick(state,result){
    const record=ensureBattleRecord(state);if(!record||record.archived)return null;
    const normalized=result===1||result==='player'?'player':result===-1||result==='enemy'?'enemy':result===0||result==='draw'?'draw':null;if(!normalized)return null;
    record.tricks+=1;if(normalized==='player')record.trickWins+=1;else if(normalized==='enemy')record.trickLosses+=1;else record.trickDraws+=1;
    const card=state?.playerStage;if(card){if(cardKind(card)==='effect')record.effectCardsPlayed+=1;else record.pureCardsPlayed+=1}
    sampleChip(state);return normalized;
  }
  function recordShowdown(state,playerPower,enemyPower){
    const record=ensureBattleRecord(state);if(!record||record.archived)return null;
    const setIndex=Math.max(1,Math.trunc(numeric(state?.setIndex,1)));if(record.lastShowdownSetIndex===setIndex)return null;
    const player=numeric(playerPower,0),enemy=numeric(enemyPower,0),diff=Math.abs(player-enemy);record.lastShowdownSetIndex=setIndex;record.showdowns+=1;record.showdownDiffTotal+=diff;record.showdownDiffMax=Math.max(record.showdownDiffMax,diff);return{playerPower:player,enemyPower:enemy,diff,setIndex};
  }
  function parseShowdownPower(value){const match=String(value??'').match(/(-?\d+(?:\.\d+)?)\s*:\s*(-?\d+(?:\.\d+)?)/);return match?{player:Number(match[1]),enemy:Number(match[2])}:null}

  function archiveBattle(runState,state,{outcome='win',now=Date.now(),exchangeCost=2}={}){
    const stats=ensureStats(runState,{now}),record=ensureBattleRecord(state,{now});if(!stats||!record||record.archived)return null;
    record.archived=true;sampleChip(state);
    const durationMs=Math.max(0,numeric(now,0)-numeric(record.startedAtMs,0)),type=['battle','elite','boss'].includes(state?.type)?state.type:'battle';
    const battles=stats.battles;battles.count+=1;if(outcome==='defeat')battles.defeats+=1;else battles.wins+=1;battles.totalDurationMs+=durationMs;battles.totalTricks+=record.tricks;battles.trickWins+=record.trickWins;battles.trickLosses+=record.trickLosses;battles.trickDraws+=record.trickDraws;battles.totalShowdowns+=record.showdowns;battles.showdownDiffTotal+=record.showdownDiffTotal;battles.showdownDiffMax=Math.max(battles.showdownDiffMax,record.showdownDiffMax);battles.pureCardsPlayed+=record.pureCardsPlayed;battles.effectCardsPlayed+=record.effectCardsPlayed;battles.byType[type]=(battles.byType[type]||0)+1;
    const exchanges=Math.max(0,Math.trunc(numeric(state?.chipEconomy?.exchanges,0))),endingBalance=Math.max(0,numeric(state?.chipEconomy?.balance??state?.chip,0));stats.chip.exchanges+=exchanges;stats.chip.spentOnExchanges+=exchanges*Math.max(0,numeric(exchangeCost,2));stats.chip.maxBalanceSeen=Math.max(stats.chip.maxBalanceSeen,record.maxChipSeen);stats.chip.endingBalanceTotal+=endingBalance;
    return{type,outcome,durationMs,tricks:record.tricks,showdowns:record.showdowns,showdownDiffMax:record.showdownDiffMax,exchanges,maxChipSeen:record.maxChipSeen};
  }

  function flowCounts(runState){const flow=runState?.runFlow||{};return{regionsVisited:Array.isArray(flow.visitedRegionIds)?flow.visitedRegionIds.length:0,regionsCompleted:Array.isArray(flow.completedRegionIds)?flow.completedRegionIds.length:0,branchesVisited:Array.isArray(flow.visitedRegionBranches)?flow.visitedRegionBranches.length:0,journeys:Array.isArray(flow.journeyHistory)?flow.journeyHistory.length:0}}
  function buildBalanceSummary(runState){
    const stats=ensureStats(runState)||createStats(0),battles=stats.battles,chip=stats.chip,folds=runState?.foldStats||{},flow=flowCounts(runState),avgBattleMs=battles.count?Math.round(battles.totalDurationMs/battles.count):0,avgShowdownDiff=battles.totalShowdowns?Number((battles.showdownDiffTotal/battles.totalShowdowns).toFixed(2)):0;
    return{version:VERSION,nodes:{...stats.nodes},battleCount:battles.count,battleWins:battles.wins,battleDefeats:battles.defeats,battleByType:{...battles.byType},averageBattleMs:avgBattleMs,tricks:battles.totalTricks,trickWins:battles.trickWins,trickLosses:battles.trickLosses,trickDraws:battles.trickDraws,showdowns:battles.totalShowdowns,averageShowdownDiff:avgShowdownDiff,maxShowdownDiff:battles.showdownDiffMax,pureCardsPlayed:battles.pureCardsPlayed,effectCardsPlayed:battles.effectCardsPlayed,chipExchanges:chip.exchanges,chipExchangeSpend:chip.spentOnExchanges,chipMaxSeen:chip.maxBalanceSeen,folds:Math.max(0,Math.trunc(numeric(folds.count,0))),foldHpLost:Math.max(0,numeric(folds.hpLost,0)),...flow};
  }
  function balanceRows(summary){
    return[
      `M5 경로 · 전투 ${summary.nodes.battle+summary.nodes.elite+summary.nodes.boss} / 이벤트 ${summary.nodes.event} / 캠프 ${summary.nodes.camp} / 상점 ${summary.nodes.shop}`,
      `M5 전투 · ${summary.battleCount}회 · 트릭 ${summary.tricks} · 쇼다운 ${summary.showdowns} · 평균 차이 ${summary.averageShowdownDiff} · 최대 ${summary.maxShowdownDiff}`,
      `M5 카드 사용 · 순수 ${summary.pureCardsPlayed} / 효과 ${summary.effectCardsPlayed}`,
      `M5 칩/폴드 · 교환 ${summary.chipExchanges}회 (${summary.chipExchangeSpend}칩) · 최대 ${summary.chipMaxSeen} · 폴드 ${summary.folds}회 / HP ${summary.foldHpLost}`,
      `M5 지역 · 방문 ${summary.regionsVisited} / 완료 ${summary.regionsCompleted} · 분기 ${summary.branchesVisited}`
    ];
  }
  function enrichResult(runState,result){const summary=buildBalanceSummary(runState);if(result&&typeof result==='object')result.balance=summary;if(runState?.runResult&&typeof runState.runResult==='object')runState.runResult.balance=summary;return summary}
  function renderBalanceRows(runtimeRoot=defaultRoot,summary){
    const doc=runtimeRoot?.document;if(!doc?.querySelector)return false;const list=doc.querySelector('#modal .choiceList');if(!list)return false;
    list.querySelectorAll?.('[data-m5-balance]')?.forEach?.(node=>node.remove?.());const before=[...list.querySelectorAll?.('button')||[]].find(button=>(button.textContent||'').includes('새 런'))||null;
    for(const text of balanceRows(summary)){const row=doc.createElement('div');row.className='choice';row.setAttribute('data-m5-balance','true');const bold=doc.createElement('b');bold.textContent=text;row.appendChild(bold);list.insertBefore(row,before)}return true;
  }

  function wrapBeginRun(runtimeRoot=defaultRoot){const original=runtimeRoot?.beginRun;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(){const result=original.apply(this,arguments),runState=activeRun(runtimeRoot);if(runState)resetStats(runState,{now:clock(runtimeRoot)});return result}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.beginRun=wrapped;return true}
  function wrapEnterNode(runtimeRoot=defaultRoot){const original=runtimeRoot?.enterNode;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(node){const result=original.apply(this,arguments),runState=activeRun(runtimeRoot);if(result!==false&&runState){const resolved=(runState.map||[]).find(item=>item.id===(typeof node==='string'?node:node?.id))||node;recordNodeEntry(runState,resolved)}return result}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.enterNode=wrapped;return true}
  function wrapStartBattle(runtimeRoot=defaultRoot){const original=runtimeRoot?.startBattle;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(){const result=original.apply(this,arguments),state=activeBattle(runtimeRoot);if(state)beginBattleRecord(state,{now:clock(runtimeRoot)});return result}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.startBattle=wrapped;return true}
  function wrapRenderBattle(runtimeRoot=defaultRoot){const original=runtimeRoot?.renderBattle;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(){const result=original.apply(this,arguments),state=activeBattle(runtimeRoot);if(state)sampleChip(state);return result}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.renderBattle=wrapped;return true}
  function wrapBattleCore(runtimeRoot=defaultRoot){const core=runtimeRoot?.BattleCore,original=core?.recordTrickResult;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(context,result){const value=original.apply(this,arguments),state=activeBattle(runtimeRoot);if(state&&(context===state||context?.setHistory===state.setHistory))recordTrick(state,value);return value}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;core.recordTrickResult=wrapped;return true}
  function wrapShowdownStep(runtimeRoot=defaultRoot){const original=runtimeRoot?.showShowdownStep;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(label,value){const result=original.apply(this,arguments);if(label==='최종 위력'){const parsed=parseShowdownPower(value),state=activeBattle(runtimeRoot);if(parsed&&state)recordShowdown(state,parsed.player,parsed.enemy)}return result}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.showShowdownStep=wrapped;return true}
  function wrapWinBattle(runtimeRoot=defaultRoot){const original=runtimeRoot?.winBattle;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(){const runState=activeRun(runtimeRoot),state=activeBattle(runtimeRoot);if(runState&&state&&!state.balanceTelemetry?.archived)archiveBattle(runState,state,{outcome:'win',now:clock(runtimeRoot),exchangeCost:runtimeRoot?.ChipEconomy?.HAND_EXCHANGE_COST||2});return original.apply(this,arguments)}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.winBattle=wrapped;return true}
  function finalizeRunResult(runtimeRoot,result){const runState=activeRun(runtimeRoot);if(!runState)return result;const summary=enrichResult(runState,result);renderBalanceRows(runtimeRoot,summary);return result}
  function wrapLoseRun(runtimeRoot=defaultRoot){const original=runtimeRoot?.loseRun;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(){const runState=activeRun(runtimeRoot),state=activeBattle(runtimeRoot);if(runState&&state&&!state.balanceTelemetry?.archived)archiveBattle(runState,state,{outcome:'defeat',now:clock(runtimeRoot),exchangeCost:runtimeRoot?.ChipEconomy?.HAND_EXCHANGE_COST||2});const result=original.apply(this,arguments);if(result&&typeof result.then==='function')return result.then(value=>finalizeRunResult(runtimeRoot,value));return finalizeRunResult(runtimeRoot,result)}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.loseRun=wrapped;return true}
  function wrapFinishRun(runtimeRoot=defaultRoot){const original=runtimeRoot?.finishRun;if(typeof original!=='function'||original.__m5BalanceTelemetry)return false;function wrapped(){const result=original.apply(this,arguments);if(result&&typeof result.then==='function')return result.then(value=>finalizeRunResult(runtimeRoot,value));return finalizeRunResult(runtimeRoot,result)}wrapped.__m5BalanceTelemetry=true;wrapped.__original=original;runtimeRoot.finishRun=wrapped;return true}

  function installBrowser(runtimeRoot=defaultRoot){
    if(browserInstalled)return true;
    if(!runtimeRoot?.RunResults||!runtimeRoot?.ChipEconomy||!runtimeRoot?.FoldExperiment||!runtimeRoot?.BattleCore)return false;
    if(typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.enterNode!=='function'||typeof runtimeRoot.startBattle!=='function'||typeof runtimeRoot.renderBattle!=='function'||typeof runtimeRoot.winBattle!=='function'||typeof runtimeRoot.loseRun!=='function'||typeof runtimeRoot.finishRun!=='function'||typeof runtimeRoot.showShowdownStep!=='function')return false;
    wrapBeginRun(runtimeRoot);wrapEnterNode(runtimeRoot);wrapStartBattle(runtimeRoot);wrapRenderBattle(runtimeRoot);wrapBattleCore(runtimeRoot);wrapShowdownStep(runtimeRoot);wrapWinBattle(runtimeRoot);wrapLoseRun(runtimeRoot);wrapFinishRun(runtimeRoot);browserInstalled=true;return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<120)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[m5] 밸런스 텔레메트리 설치 실패')};if(typeof document!=='undefined'&&document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true}
  function resetBrowserInstallForTests(){browserInstalled=false}

  return{STAGE,VERSION,NODE_TYPES,numeric,clock,activeRun,activeBattle,blankNodeCounts,blankBattleTypeCounts,createStats,ensureStats,resetStats,nodeEntryKey,recordNodeEntry,cardEffects,cardKind,beginBattleRecord,ensureBattleRecord,sampleChip,recordTrick,recordShowdown,parseShowdownPower,archiveBattle,flowCounts,buildBalanceSummary,balanceRows,enrichResult,renderBalanceRows,wrapBeginRun,wrapEnterNode,wrapStartBattle,wrapRenderBattle,wrapBattleCore,wrapShowdownStep,wrapWinBattle,wrapLoseRun,wrapFinishRun,installBrowser,installWhenReady,resetBrowserInstallForTests};
});
