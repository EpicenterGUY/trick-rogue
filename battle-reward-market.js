(function(root,factory){
  const api=factory(
    root,
    typeof module!=='undefined'?require('./run-economy-v2.js'):root.RunEconomyV2
  );
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.BattleRewardMarket=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Economy){
  const STAGE='battle-market-v1';
  const OFFER_COUNT=8;
  const PRICES=Object.freeze({pure:12,general:20,effect:32});
  let installed=false;

  function activeRun(runtimeRoot=root){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function economyApi(runtimeRoot=root){return runtimeRoot?.RunEconomyV2||Economy}
  function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]))}
  function rankLabel(rank){const value=Number(rank);return value===14?'A':value===13?'K':value===12?'Q':value===11?'J':String(value)}
  function suitSymbol(suit){return suit==='S'?'♠':suit==='H'?'♥':suit==='D'?'♦':suit==='C'?'♣':'?'}
  function candidateName(candidate){return`${candidate?.name||'카드'} ${suitSymbol(candidate?.suit)}${rankLabel(candidate?.rank)}`}

  function ensureMarketStore(runState,runtimeRoot=root){
    const economy=economyApi(runtimeRoot);if(!runState||!economy?.ensureEconomyState)throw new TypeError('RunEconomyV2 state is required');
    const state=economy.ensureEconomyState(runState);if(!state.rewardMarkets||typeof state.rewardMarkets!=='object')state.rewardMarkets={};return state;
  }
  function priceFor(candidate){
    if(!candidate)return Infinity;if(candidate.kind==='pure')return PRICES.pure;
    if(String(candidate.definitionId||'').startsWith('core.'))return PRICES.general;
    return PRICES.effect;
  }
  function unlockBossCards(runState,node,runtimeRoot=root){
    const economy=economyApi(runtimeRoot);if(node?.type!=='boss'||!node?.enemyContentId||typeof economy?.unlockBossSignatures!=='function')return[];
    return economy.unlockBossSignatures(runState,node.enemyContentId,runtimeRoot?.createCardRecord?runtimeRoot:undefined)||[];
  }
  function marketState(runState,node,{runtimeRoot=root}={}){
    const economy=economyApi(runtimeRoot),state=ensureMarketStore(runState,runtimeRoot),id=node?.id;if(!id)throw new TypeError('reward node id is required');
    if(state.rewardMarkets[id])return state.rewardMarkets[id];
    unlockBossCards(runState,node,runtimeRoot);
    const rng=typeof economy?.deterministicRng==='function'?economy.deterministicRng(runState,`battle-market:${runState.actId||'act'}:${id}`,runtimeRoot):Math.random;
    const offers=economy.generateCardOffer(runState,node,{count:OFFER_COUNT,rng,runtimeRoot});
    state.rewardMarkets[id]={version:STAGE,offers,purchased:{},finished:!!state.rewardClaims?.[id],selectedKey:offers[0]?.key||null};
    return state.rewardMarkets[id];
  }
  function marketFinished(runState,nodeId,runtimeRoot=root){const state=ensureMarketStore(runState,runtimeRoot);return!!(state.rewardClaims?.[nodeId]||state.rewardMarkets?.[nodeId]?.finished)}
  function buy(runState,node,key,{runtimeRoot=root}={}){
    const economy=economyApi(runtimeRoot),id=node?.id;if(!runState||!id)return{ok:false,reason:'invalid_node'};
    const market=marketState(runState,node,{runtimeRoot});if(marketFinished(runState,id,runtimeRoot)||market.finished)return{ok:false,reason:'finished'};
    if(market.purchased[key])return{ok:false,reason:'purchased'};
    const candidate=market.offers.find(item=>item.key===key);if(!candidate)return{ok:false,reason:'not_offered'};
    const cost=priceFor(candidate);if(finite(runState.gold)<cost)return{ok:false,reason:'gold',cost};
    const card=economy.instantiateCandidate(candidate,runtimeRoot);if(!Array.isArray(runState.deck))runState.deck=[];runState.gold-=cost;runState.deck.push(card);market.purchased[key]={cost};market.selectedKey=key;
    economy.record?.(runState,{action:'battle_reward_market_purchase',nodeId:id,key,cost});return{ok:true,candidate,card,cost};
  }
  function finish(runState,node,{runtimeRoot=root}={}){
    const economy=economyApi(runtimeRoot),id=node?.id;if(!runState||!id)return{ok:false,reason:'invalid_node'};
    const state=ensureMarketStore(runState,runtimeRoot),market=marketState(runState,node,{runtimeRoot});if(state.rewardClaims?.[id]||market.finished)return{ok:false,reason:'finished'};
    const purchases=Object.keys(market.purchased);market.finished=true;state.rewardClaims[id]={key:null,skipped:purchases.length===0,market:true,purchases:[...purchases]};
    economy.record?.(runState,{action:'battle_reward_market_close',nodeId:id,purchases:purchases.length});return{ok:true,purchases,skipped:purchases.length===0};
  }

  function currentNode(runtimeRoot=root){
    const runState=activeRun(runtimeRoot),battleState=runtimeRoot?.battle;if(!runState)return null;
    if(battleState?.node&&['battle','elite','boss'].includes(battleState.node.type))return battleState.node;
    if(runState.currentNodeId){const current=(runState.map||[]).find(node=>node.id===runState.currentNodeId);if(current)return current}
    if(runState.lastCompletedNodeId){const last=(runState.map||[]).find(node=>node.id===runState.lastCompletedNodeId);if(last&&!marketFinished(runState,last.id,runtimeRoot))return last}
    return(runState.map||[]).find(node=>['battle','elite','boss'].includes(node.type)&&!marketFinished(runState,node.id,runtimeRoot))||null;
  }
  function previewCard(candidate,runtimeRoot=root){
    const economy=economyApi(runtimeRoot);try{return economy.instantiateCandidate(candidate,Object.assign({},runtimeRoot,{newUid:()=>`market-preview-${candidate.key}`}))}catch(_error){return null}
  }
  function sourceLabel(candidate){if(candidate?.signatureBossId)return'보스 시그니처';return candidate?.sourceCategory==='theme'?'지역 경향':'공용 카드'}
  function tileHtml(candidate,market,runtimeRoot=root){
    const selected=market.selectedKey===candidate.key,bought=!!market.purchased[candidate.key],cost=priceFor(candidate),preview=previewCard(candidate,runtimeRoot);
    const art=preview&&typeof runtimeRoot?.artHtml==='function'?`<div class="brmArt">${runtimeRoot.artHtml(preview)}</div>`:`<div class="brmFallback"><b>${suitSymbol(candidate.suit)}${rankLabel(candidate.rank)}</b></div>`;
    return`<button type="button" class="brmCard${selected?' is-selected':''}${bought?' is-bought':''}" onclick="BattleRewardMarket.selectFromUi('${escapeHtml(candidate.key)}')">${art}<span class="brmCardName">${escapeHtml(candidate.name||'순수 카드')}</span><span class="brmPrice">${bought?'구매 완료':`${cost}G`}</span></button>`;
  }
  function detailHtml(candidate,market,runState){
    if(!candidate)return'<div class="brmDetail"><b>판매 카드 없음</b></div>';
    const cost=priceFor(candidate),bought=!!market.purchased[candidate.key],affordable=finite(runState.gold)>=cost;
    const action=bought?'구매 완료':affordable?`${cost}G 구매`:`${cost}G · 골드 부족`;
    return`<div class="brmDetail"><div><span class="brmEyebrow">${escapeHtml(sourceLabel(candidate))}</span><h3>${escapeHtml(candidateName(candidate))}</h3><p>${escapeHtml(candidate.description||'효과 없음')}</p></div><button type="button" ${bought||!affordable?'disabled':''} onclick="BattleRewardMarket.buyFromUi('${escapeHtml(candidate.key)}')">${action}</button></div>`;
  }
  function marketCss(){return`
    .brmShell{display:grid;gap:10px}.brmTop{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.brmTop h2{margin:0}.brmWallet{font-weight:900;font-size:18px;color:#f2cf70;text-shadow:1px 1px #000}.brmHint{font-size:11px;opacity:.78;line-height:1.45}
    .brmGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.brmCard{position:relative;display:flex;flex-direction:column;min-width:0;min-height:132px;padding:5px;border:2px solid #17130e;background:linear-gradient(#e7dfc7,#c7baa0);color:#201911;box-shadow:inset 0 0 0 2px #8d816d,2px 3px 0 #0008;transform:translateY(0);transition:transform .1s ease,filter .1s ease}.brmCard.is-selected{transform:translateY(-4px);box-shadow:inset 0 0 0 2px #75dbe1,0 0 0 2px #75dbe1,2px 5px 0 #0009}.brmCard.is-bought{filter:saturate(.2) brightness(.7)}
    .brmArt{width:100%;aspect-ratio:5/7;overflow:hidden;border:1px solid #2b241a;background:#121722}.brmArt>*{width:100%;height:100%;object-fit:cover}.brmFallback{display:grid;place-items:center;aspect-ratio:5/7;background:#f4ecd5;border:1px solid #514737;font-size:18px}.brmCardName{font-size:9px;font-weight:900;line-height:1.15;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brmPrice{margin-top:auto;font-size:10px;font-weight:900;color:#6f4d11}
    .brmDetail{display:grid;grid-template-columns:minmax(0,1fr) 104px;gap:8px;align-items:center;background:#101827;border:2px solid #0a0d12;box-shadow:inset 0 0 0 2px #566783;padding:10px}.brmDetail h3{margin:2px 0 5px;color:#f3e6ba}.brmDetail p{margin:0;font-size:11px;line-height:1.5;color:#c9d0dc}.brmDetail button,.brmLeave{min-height:44px;border:2px solid #0b0d11;background:#31415d;color:#f7f1df;box-shadow:inset 0 0 0 2px #798cae;font-weight:900}.brmDetail button:disabled{opacity:.45}.brmEyebrow{font-size:9px;color:#7fe4ea;font-weight:900}.brmLeave{width:100%;background:#49394d;box-shadow:inset 0 0 0 2px #9b749d}
    @media(max-width:390px){.brmGrid{gap:4px}.brmCard{min-height:116px;padding:4px}.brmCardName{font-size:8px}.brmDetail{grid-template-columns:minmax(0,1fr) 92px;padding:8px}.brmDetail p{font-size:10px}}
  `}
  function ensureStyle(runtimeRoot=root){const doc=runtimeRoot?.document;if(!doc?.createElement||doc.getElementById?.('battleRewardMarketStyle'))return false;const style=doc.createElement('style');style.id='battleRewardMarketStyle';style.textContent=marketCss();(doc.head||doc.documentElement).appendChild(style);return true}
  function show(runtimeRoot=root,node=null,selectedKey=null){
    const runState=activeRun(runtimeRoot),rewardNode=node||currentNode(runtimeRoot);if(!runState||!rewardNode||marketFinished(runState,rewardNode.id,runtimeRoot))return false;
    ensureStyle(runtimeRoot);const market=marketState(runState,rewardNode,{runtimeRoot});if(selectedKey&&market.offers.some(item=>item.key===selectedKey))market.selectedKey=selectedKey;
    const selected=market.offers.find(item=>item.key===market.selectedKey)||market.offers[0]||null,bought=Object.keys(market.purchased).length;
    const html=`<div class="brmShell"><div class="brmTop"><div><span class="brmEyebrow">전투 전리품</span><h2>카드 마켓</h2></div><div class="brmWallet">◆ ${finite(runState.gold)}G</div></div><div class="brmHint">8장 중 원하는 만큼 구매할 수 있다 · 순수 ${PRICES.pure}G / 일반 효과 ${PRICES.general}G / 특수 효과 ${PRICES.effect}G</div><div class="brmGrid">${market.offers.map(candidate=>tileHtml(candidate,market,runtimeRoot)).join('')}</div>${detailHtml(selected,market,runState)}<button type="button" class="brmLeave" onclick="BattleRewardMarket.leaveFromUi()">마켓 나가기${bought?` · ${bought}장 구매`:''}</button></div>`;
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return market.offers}return false;
  }
  function selectFromUi(key,runtimeRoot=root){const node=currentNode(runtimeRoot);return node?show(runtimeRoot,node,key):false}
  function buyFromUi(key,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=currentNode(runtimeRoot);if(!runState||!node)return false;const result=buy(runState,node,key,{runtimeRoot});runtimeRoot.sfx?.(result.ok?'reward':'lose');return show(runtimeRoot,node,key)}
  function leaveFromUi(runtimeRoot=root){const runState=activeRun(runtimeRoot),node=currentNode(runtimeRoot);if(!runState||!node)return false;const result=finish(runState,node,{runtimeRoot});if(!result.ok)return false;runtimeRoot.closeOverlay?.();runtimeRoot.completeNode?.(node);return true}

  function wrapShowReward(runtimeRoot=root){
    const original=runtimeRoot?.showReward;if(typeof original!=='function')return false;if(original.__battleRewardMarket)return true;
    function wrapped(node,...args){
      const runState=activeRun(runtimeRoot),relics=runtimeRoot?.RelicSystem;
      if(!runState||!node||!['battle','elite','boss'].includes(node.type))return original.call(this,node,...args);
      if(relics?.isRelicRewardNode?.(node)&&!relics.rewardClaimed?.(runState,node.id))return original.call(this,node,...args);
      unlockBossCards(runState,node,runtimeRoot);return show(runtimeRoot,node);
    }
    wrapped.__battleRewardMarket=true;wrapped.__original=original;runtimeRoot.showReward=wrapped;return true;
  }
  function installBrowser(runtimeRoot=root){if(installed)return true;if(!runtimeRoot?.RunEconomyV2||typeof runtimeRoot.showReward!=='function')return false;wrapShowReward(runtimeRoot);ensureStyle(runtimeRoot);installed=true;return true}
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25);else console.warn('[battle-reward-market] 보상 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function resetForTests(){installed=false}

  return{STAGE,OFFER_COUNT,PRICES,activeRun,economyApi,ensureMarketStore,priceFor,unlockBossCards,marketState,marketFinished,buy,finish,currentNode,candidateName,sourceLabel,tileHtml,detailHtml,marketCss,show,selectFromUi,buyFromUi,leaveFromUi,wrapShowReward,installBrowser,installWhenReady,resetForTests};
});
