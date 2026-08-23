(function(root,factory){
  const api=factory(
    root,
    typeof module!=='undefined'?require('./cards.js'):root,
    typeof module!=='undefined'?require('./run-flow-v2.js'):root.RunFlowV2,
    typeof module!=='undefined'?require('./relics.js'):root.RelicSystem
  );
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunEconomyV2=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(root,Cards,RunFlowV2,RelicSystem){
  const STAGE='8-C';
  const CARD_OFFER_COUNT=3;
  const MAX_UPGRADE_LEVEL=1;
  const UPGRADE_TRICK_BONUS=1;
  const CAMP_HEAL_RATIO=.30;
  const SHOP_CARD_COST=45;
  const SHOP_RELIC_COST=80;
  const SHOP_REMOVE_COST=45;
  const MIN_DECK_SIZE=5;
  const BATTLE_GOLD_BY_TYPE=Object.freeze({battle:20,elite:40,boss:70});
  const REGION_THEME_CARD_IDS=Object.freeze({
    region_theater:Object.freeze(['core.paint','core.reverse','core.recolor','core.fakeid','pack01.recursive_function']),
    region_observatory:Object.freeze(['core.scout','core.draw','pack01.ambush_observer','pack01.scheduled_delivery','pack01.battery_1pct']),
    region_frontier:Object.freeze(['core.double','core.barrier','core.burn','core.clean','pack01.black_bullet','pack01.golden_hand','pack01.dirty_gambler','pack01.sharp_glass','pack01.emergency_guard'])
  });

  let installed=false;
  let originalShowReward=null;
  let originalShowCamp=null;
  let originalShowShop=null;
  let uidCounter=0;

  function activeRun(runtimeRoot=root){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function cardsApi(runtimeRoot=root){return runtimeRoot&&runtimeRoot.createCardRecord?runtimeRoot:Cards}
  function flowApi(runtimeRoot=root){return runtimeRoot?.RunFlowV2||RunFlowV2}
  function relicApi(runtimeRoot=root){return runtimeRoot?.RelicSystem||RelicSystem}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function safeRngValue(rng=Math.random){const value=Number(rng());return Number.isFinite(value)?Math.max(0,Math.min(.999999999,value)):0}
  function shuffleCopy(items,rng=Math.random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(safeRngValue(rng)*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
  function nextUid(runtimeRoot=root,prefix='reward'){if(typeof runtimeRoot?.newUid==='function')return runtimeRoot.newUid();uidCounter+=1;return`${prefix}-${uidCounter}`}
  function rankLabel(rank){return Number(rank)===14?'A':Number(rank)===13?'K':Number(rank)===12?'Q':Number(rank)===11?'J':String(rank)}
  function suitSymbol(suit){return suit==='S'?'♠':suit==='H'?'♥':suit==='D'?'♦':suit==='C'?'♣':'?'}

  function ensureEconomyState(runState){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    const current=runState.economyState&&typeof runState.economyState==='object'?runState.economyState:{};
    runState.economyState={
      ...current,version:STAGE,
      rewards:current.rewards&&typeof current.rewards==='object'?current.rewards:{},
      rewardClaims:current.rewardClaims&&typeof current.rewardClaims==='object'?current.rewardClaims:{},
      shops:current.shops&&typeof current.shops==='object'?current.shops:{},
      history:Array.isArray(current.history)?current.history:[]
    };
    return runState.economyState;
  }
  function record(runState,entry){const state=ensureEconomyState(runState),item={step:state.history.length+1,...entry};state.history.push(item);return item}

  function definitionList(api=Cards){return Array.isArray(api?.ALL_CARD_DEFINITIONS)?api.ALL_CARD_DEFINITIONS:[]}
  function candidateFromDefinition(definition){
    return{key:`def:${definition.id}`,kind:'definition',definitionId:definition.id,name:definition.name||definition.id,suit:definition.suit,rank:Number(definition.rank),description:definition.description||definition.text||'',rarity:definition.rarity||'common'};
  }
  function candidateFromPure(card){return{key:`pure:${card.suit}${card.rank}`,kind:'pure',definitionId:null,name:'순수 카드',suit:card.suit,rank:Number(card.rank),description:'고유 효과가 없는 순수 카드. 족보 구성과 순수 카드 시너지에 사용한다.',rarity:'common'}}
  function candidateCatalog(api=Cards){
    const definitions=definitionList(api).map(candidateFromDefinition);
    const slots=typeof api?.createBaseCardSlots==='function'?api.createBaseCardSlots():[];
    const pure=slots.filter(card=>typeof api?.isPureCard==='function'?api.isPureCard(card):!card.cardId&&!card.definition&&(!card.effects||!card.effects.length)).map(candidateFromPure);
    const seen=new Set();return[...definitions,...pure].filter(item=>item.key&&!seen.has(item.key)&&(seen.add(item.key),true));
  }
  function themeIds(regionId){return new Set(REGION_THEME_CARD_IDS[regionId]||[])}
  function isThemeCandidate(candidate,regionId){return candidate.kind==='definition'&&themeIds(regionId).has(candidate.definitionId)}
  function regionIdFor(runState,node,runtimeRoot=root){return node?.regionPlan?.regionId||flowApi(runtimeRoot)?.nodePlan?.(runState,node)?.regionId||runState?.runFlow?.currentRegionId||null}
  function rewardWeightsFor(runState,node,runtimeRoot=root){
    const planned=node?.regionPlan?.rewardWeights||flowApi(runtimeRoot)?.nodePlan?.(runState,node)?.rewardWeights||null;
    const neutral=finite(planned?.neutral,1),theme=finite(planned?.theme,0),sum=neutral+theme;
    return sum>0?{neutral:neutral/sum,theme:theme/sum}:{neutral:1,theme:0};
  }
  function rewardPools(runState,node,runtimeRoot=root){
    const api=cardsApi(runtimeRoot),catalog=candidateCatalog(api),regionId=regionIdFor(runState,node,runtimeRoot);
    const theme=catalog.filter(candidate=>isThemeCandidate(candidate,regionId));
    const neutral=catalog.filter(candidate=>!isThemeCandidate(candidate,regionId));
    return{catalog,theme,neutral,regionId,weights:rewardWeightsFor(runState,node,runtimeRoot)};
  }
  function chooseFromPool(pool,used,rng){const available=pool.filter(item=>!used.has(item.key));if(!available.length)return null;return available[Math.floor(safeRngValue(rng)*available.length)]||available[0]}
  function generateCardOffer(runState,node,{count=CARD_OFFER_COUNT,rng=Math.random,runtimeRoot=root}={}){
    const pools=rewardPools(runState,node,runtimeRoot),used=new Set(),offer=[];
    for(let i=0;i<count;i++){
      const wantsTheme=pools.theme.length>0&&safeRngValue(rng)>=pools.weights.neutral;
      let candidate=chooseFromPool(wantsTheme?pools.theme:pools.neutral,used,rng);
      if(!candidate)candidate=chooseFromPool(wantsTheme?pools.neutral:pools.theme,used,rng);
      if(!candidate)break;
      used.add(candidate.key);offer.push({...candidate,sourceCategory:isThemeCandidate(candidate,pools.regionId)?'theme':'neutral',regionId:pools.regionId});
    }
    return offer;
  }
  function deterministicRng(runState,salt,runtimeRoot=root){
    const flow=flowApi(runtimeRoot);if(typeof flow?.deterministicRng==='function')return flow.deterministicRng(runState,salt);
    let state=((finite(runState?.runSeed,1)>>>0)^String(salt||'').split('').reduce((sum,ch)=>((sum*33)^ch.charCodeAt(0))>>>0,5381))>>>0||1;
    return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000};
  }
  function ensureRewardOffer(runState,node,runtimeRoot=root){
    const state=ensureEconomyState(runState),id=node?.id;if(!id)throw new TypeError('reward node id is required');
    if(!Array.isArray(state.rewards[id]))state.rewards[id]=generateCardOffer(runState,node,{runtimeRoot,rng:deterministicRng(runState,`8-C:reward:${runState.actId||'act'}:${id}`,runtimeRoot)});
    return state.rewards[id];
  }
  function rewardClaim(runState,nodeId){return ensureEconomyState(runState).rewardClaims[nodeId]||null}
  function instantiateCandidate(candidate,runtimeRoot=root){
    const api=cardsApi(runtimeRoot);if(!candidate)throw new TypeError('candidate is required');
    if(candidate.kind==='definition')return api.createDefinitionCard(candidate.definitionId,{uid:nextUid(runtimeRoot,'reward')});
    return api.createCardRecord({suit:candidate.suit,rank:candidate.rank,metadata:{uid:nextUid(runtimeRoot,'pure')}});
  }
  function claimCardReward(runState,node,key,{runtimeRoot=root}={}){
    const id=node?.id,state=ensureEconomyState(runState);if(!id)return{ok:false,reason:'invalid_node'};
    if(state.rewardClaims[id])return{ok:false,reason:'claimed'};
    const offer=ensureRewardOffer(runState,node,runtimeRoot),candidate=offer.find(item=>item.key===key);if(!candidate)return{ok:false,reason:'not_offered'};
    const card=instantiateCandidate(candidate,runtimeRoot);runState.deck.push(card);state.rewardClaims[id]={key,skipped:false};record(runState,{action:'card_reward',nodeId:id,key});
    return{ok:true,card,candidate};
  }
  function skipCardReward(runState,node){
    const id=node?.id,state=ensureEconomyState(runState);if(!id)return{ok:false,reason:'invalid_node'};
    if(state.rewardClaims[id])return{ok:false,reason:'claimed'};
    state.rewardClaims[id]={key:null,skipped:true};record(runState,{action:'card_reward_skip',nodeId:id});return{ok:true,skipped:true};
  }

  function cardEffects(card){return Array.isArray(card?.effects)?card.effects:Array.isArray(card?.definition?.effects)?card.definition.effects:Array.isArray(card?.named?.effects)?card.named.effects:[]}
  function cardUpgradeLevel(card){return Math.max(0,finite(card?.upgradeLevel,0)|0)}
  function canUpgradeCard(card){return!!card&&cardUpgradeLevel(card)<MAX_UPGRADE_LEVEL}
  function upgradeCard(card){
    if(!card)return{ok:false,reason:'missing_card'};if(!canUpgradeCard(card))return{ok:false,reason:'max_upgrade'};
    card.upgradeLevel=1;card.effectiveRankBonus=finite(card.effectiveRankBonus,0)+UPGRADE_TRICK_BONUS;card.trickRankModifier=finite(card.trickRankModifier,0)+UPGRADE_TRICK_BONUS;
    card.upgrade={stage:STAGE,level:1,trickBonus:UPGRADE_TRICK_BONUS};
    return{ok:true,card,level:1,trickBonus:UPGRADE_TRICK_BONUS};
  }
  function campHeal(runState,ratio=CAMP_HEAL_RATIO){const before=finite(runState.hp),maxHp=finite(runState.maxHp);const amount=Math.ceil(maxHp*Math.max(0,ratio));runState.hp=Math.min(maxHp,before+amount);record(runState,{action:'camp_heal',amount:runState.hp-before});return runState.hp-before}
  function upgradeCampCard(runState,index){
    const card=runState?.deck?.[index];const result=upgradeCard(card);if(result.ok)record(runState,{action:'camp_upgrade',index,uid:card?.uid||null});return result;
  }

  function createShopState(runState,node,{runtimeRoot=root}={}){
    const economy=ensureEconomyState(runState),id=node?.id;if(!id)throw new TypeError('shop node id is required');
    if(economy.shops[id])return economy.shops[id];
    const rng=deterministicRng(runState,`8-C:shop:${runState.actId||'act'}:${id}`,runtimeRoot),cardOffers=generateCardOffer(runState,node,{count:3,rng,runtimeRoot});
    const relics=relicApi(runtimeRoot),relicPool=typeof relics?.rewardPool==='function'?relics.rewardPool(runState):[];
    const relicId=relicPool.length?shuffleCopy(relicPool,rng)[0]:null;
    economy.shops[id]={cardOffers,cardPurchased:{},relicId,relicPurchased:false,removeUsed:false};return economy.shops[id];
  }
  function buyShopCard(runState,node,key,{runtimeRoot=root,cost=SHOP_CARD_COST}={}){
    const shop=createShopState(runState,node,{runtimeRoot});if(shop.cardPurchased[key])return{ok:false,reason:'purchased'};
    const candidate=shop.cardOffers.find(item=>item.key===key);if(!candidate)return{ok:false,reason:'not_offered'};
    if(finite(runState.gold)<cost)return{ok:false,reason:'gold'};
    runState.gold-=cost;const card=instantiateCandidate(candidate,runtimeRoot);runState.deck.push(card);shop.cardPurchased[key]=true;record(runState,{action:'shop_card',nodeId:node.id,key,cost});return{ok:true,card,candidate,cost};
  }
  function buyShopRelic(runState,node,{runtimeRoot=root,cost=SHOP_RELIC_COST}={}){
    const shop=createShopState(runState,node,{runtimeRoot}),relics=relicApi(runtimeRoot);if(shop.relicPurchased)return{ok:false,reason:'purchased'};if(!shop.relicId)return{ok:false,reason:'no_relic'};
    if(finite(runState.gold)<cost)return{ok:false,reason:'gold'};
    if(typeof relics?.acquireRelic!=='function')return{ok:false,reason:'relic_system'};
    const acquired=relics.acquireRelic(runState,shop.relicId,{source:`shop:${node.id}`});if(acquired.alreadyOwned)return{ok:false,reason:'owned'};
    runState.gold-=cost;shop.relicPurchased=true;record(runState,{action:'shop_relic',nodeId:node.id,id:shop.relicId,cost});return{ok:true,relic:acquired.relic,cost};
  }
  function canRemoveCard(runState,node,{runtimeRoot=root}={}){const shop=createShopState(runState,node,{runtimeRoot});return!shop.removeUsed&&Array.isArray(runState.deck)&&runState.deck.length>MIN_DECK_SIZE}
  function removeShopCard(runState,node,index,{runtimeRoot=root,cost=SHOP_REMOVE_COST}={}){
    const shop=createShopState(runState,node,{runtimeRoot});if(shop.removeUsed)return{ok:false,reason:'used'};if(!Array.isArray(runState.deck)||runState.deck.length<=MIN_DECK_SIZE)return{ok:false,reason:'minimum'};
    if(index<0||index>=runState.deck.length)return{ok:false,reason:'invalid_card'};if(finite(runState.gold)<cost)return{ok:false,reason:'gold'};
    runState.gold-=cost;const [card]=runState.deck.splice(index,1);shop.removeUsed=true;record(runState,{action:'shop_remove',nodeId:node.id,index,uid:card?.uid||null,cost});return{ok:true,card,cost};
  }

  function cardName(card){const def=card?.definition||card?.named;return`${def?.name||'순수 카드'} ${suitSymbol(card?.suit)}${rankLabel(card?.rank)}${cardUpgradeLevel(card)?' +':''}`}
  function candidateName(candidate){return`${candidate.name} ${suitSymbol(candidate.suit)}${rankLabel(candidate.rank)}`}
  function previewCard(candidate,runtimeRoot=root){try{return instantiateCandidate({...candidate},Object.assign({},runtimeRoot,{newUid:()=>`preview-${candidate.key}`}))}catch(_error){return null}}
  function candidateHtml(candidate,runtimeRoot=root){
    const preview=previewCard(candidate,runtimeRoot),art=preview&&typeof runtimeRoot?.artHtml==='function'?`<div class="cardArt">${runtimeRoot.artHtml(preview)}</div>`:'';
    const source=candidate.sourceCategory==='theme'?'지역 경향':'공용/무소속';return`<div class="rewardBox">${art}<h3>${escapeHtml(candidateName(candidate))}</h3><p>${escapeHtml(candidate.description||'')}</p><span class="tiny">${escapeHtml(source)}</span><div class="rewardBtns"><button onclick="RunEconomyV2.takeRewardFromUi('${escapeHtml(candidate.key)}')">받기</button></div></div>`;
  }
  function finishNode(runtimeRoot,node){if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();if(typeof runtimeRoot?.completeNode==='function')runtimeRoot.completeNode(node);return true}
  function showBattleCardReward(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot);if(!runState||!node)return false;if(rewardClaim(runState,node.id))return false;
    const offer=ensureRewardOffer(runState,node,runtimeRoot),gold=BATTLE_GOLD_BY_TYPE[node.type]||0,weights=rewardWeightsFor(runState,node,runtimeRoot),regionId=regionIdFor(runState,node,runtimeRoot);
    const mix=regionId?`지역 경향 ${Math.round(weights.theme*100)}% · 공용/무소속 ${Math.round(weights.neutral*100)}%`:'공용 카드 보상';
    const html=`<h2>전투 보상</h2><p>골드 +${gold} 지급 완료. 카드 3장 중 1장을 고르거나 건너뛸 수 있다.<br><span class="tiny">${escapeHtml(mix)} · 건너뛰어도 추가 골드는 없다.</span></p><div class="rewardGrid">${offer.map(candidate=>candidateHtml(candidate,runtimeRoot)).join('')}</div><div class="choiceList"><button class="choice" onclick="RunEconomyV2.skipRewardFromUi()"><b>카드 보상 건너뛰기</b><span>덱에 카드를 추가하지 않는다.</span></button></div>`;
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return offer}
    return false;
  }
  function currentRewardNode(runtimeRoot=root){const runState=activeRun(runtimeRoot),battleState=runtimeRoot?.battle;return battleState?.node||(runState?.map||[]).find(node=>!rewardClaim(runState,node.id)&&['battle','elite','boss'].includes(node.type)&&runState?.currentNodeId===node.id)||null}
  function takeRewardFromUi(key,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=currentRewardNode(runtimeRoot);if(!runState||!node)return false;const result=claimCardReward(runState,node,key,{runtimeRoot});if(!result.ok)return false;if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('reward');return finishNode(runtimeRoot,node)}
  function skipRewardFromUi(runtimeRoot=root){const runState=activeRun(runtimeRoot),node=currentRewardNode(runtimeRoot);if(!runState||!node)return false;const result=skipCardReward(runState,node);if(!result.ok)return false;return finishNode(runtimeRoot,node)}

  function showCampV2(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot);if(!runState||!node)return false;const heal=Math.ceil(finite(runState.maxHp)*CAMP_HEAL_RATIO),eligible=runState.deck.filter(canUpgradeCard).length;
    const html=`<h2>캠프</h2><p>한 가지 행동을 선택한다.</p><div class="choiceList"><button class="choice" onclick="RunEconomyV2.campHealFromUi('${escapeHtml(node.id)}')"><b>휴식</b><span>체력 ${heal} 회복 · 최대 체력을 넘지 않는다.</span></button><button class="choice" onclick="RunEconomyV2.showCampUpgradeFromUi('${escapeHtml(node.id)}')"><b>카드 강화</b><span>카드 1장을 1단계 강화 · 트릭 적용 숫자 +${UPGRADE_TRICK_BONUS} · 강화 가능 ${eligible}장</span></button></div>`;
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}return false;
  }
  function campHealFromUi(nodeId,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);if(!runState||!node)return false;campHeal(runState);return finishNode(runtimeRoot,node)}
  function showCampUpgradeFromUi(nodeId,runtimeRoot=root){
    const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);if(!runState||!node)return false;
    const options=runState.deck.map((card,index)=>({card,index})).filter(item=>canUpgradeCard(item.card));
    const body=options.length?options.map(({card,index})=>`<button class="choice" onclick="RunEconomyV2.upgradeCampCardFromUi('${escapeHtml(nodeId)}',${index})"><b>${escapeHtml(cardName(card))}</b><span>강화 후 트릭 적용 숫자 +${UPGRADE_TRICK_BONUS} · 인쇄값/쇼다운값 유지</span></button>`).join(''):`<div class="choice"><b>강화 가능한 카드 없음</b><span>모든 카드가 이미 1단계 강화되었다.</span></div>`;
    const html=`<h2>카드 강화</h2><p>이번 캠프에서 카드 1장을 선택한다.</p><div class="choiceList">${body}<button class="choice" onclick="RunEconomyV2.showCampFromUi('${escapeHtml(nodeId)}')"><b>뒤로</b></button></div>`;
    runtimeRoot.showModal?.(html);return true;
  }
  function upgradeCampCardFromUi(nodeId,index,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);if(!runState||!node)return false;const result=upgradeCampCard(runState,index);if(!result.ok)return false;if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('reward');return finishNode(runtimeRoot,node)}
  function showCampFromUi(nodeId,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);return node?showCampV2(runtimeRoot,node):false}

  function relicLabel(id,runtimeRoot=root){const relic=relicApi(runtimeRoot)?.relicDefinition?.(id);return relic?`${relic.name} · ${relic.description}`:'유물 품절'}
  function showShopV2(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot);if(!runState||!node)return false;const shop=createShopState(runState,node,{runtimeRoot});
    const cardButtons=shop.cardOffers.map(candidate=>{const bought=!!shop.cardPurchased[candidate.key];return`<button class="choice" ${bought?'disabled':''} onclick="RunEconomyV2.buyShopCardFromUi('${escapeHtml(node.id)}','${escapeHtml(candidate.key)}')"><b>${escapeHtml(candidateName(candidate))} · ${SHOP_CARD_COST}G</b><span>${bought?'구매 완료':escapeHtml(candidate.description||'')}</span></button>`}).join('');
    const relicText=shop.relicId?relicLabel(shop.relicId,runtimeRoot):'구매 가능한 유물 없음';
    const html=`<h2>상점</h2><p>골드 <b>${finite(runState.gold)}</b> · 구매 후에도 나가기 전까지 상점을 계속 이용할 수 있다.</p><div class="choiceList">${cardButtons}<button class="choice" ${!shop.relicId||shop.relicPurchased?'disabled':''} onclick="RunEconomyV2.buyShopRelicFromUi('${escapeHtml(node.id)}')"><b>유물 · ${SHOP_RELIC_COST}G</b><span>${shop.relicPurchased?'구매 완료':escapeHtml(relicText)}</span></button><button class="choice" ${shop.removeUsed||runState.deck.length<=MIN_DECK_SIZE?'disabled':''} onclick="RunEconomyV2.showShopRemoveFromUi('${escapeHtml(node.id)}')"><b>카드 제거 · ${SHOP_REMOVE_COST}G</b><span>${shop.removeUsed?'이번 상점에서 이미 사용함':`카드 1장을 덱에서 제거 · 최소 ${MIN_DECK_SIZE}장`}</span></button><button class="choice" onclick="RunEconomyV2.leaveShopFromUi('${escapeHtml(node.id)}')"><b>나가기</b></button></div>`;
    runtimeRoot.showModal?.(html);return shop;
  }
  function buyShopCardFromUi(nodeId,key,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);if(!runState||!node)return false;const result=buyShopCard(runState,node,key,{runtimeRoot});if(!result.ok){runtimeRoot.sfx?.('lose');return showShopV2(runtimeRoot,node)}runtimeRoot.sfx?.('reward');return showShopV2(runtimeRoot,node)}
  function buyShopRelicFromUi(nodeId,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);if(!runState||!node)return false;const result=buyShopRelic(runState,node,{runtimeRoot});if(!result.ok){runtimeRoot.sfx?.('lose');return showShopV2(runtimeRoot,node)}runtimeRoot.sfx?.('reward');return showShopV2(runtimeRoot,node)}
  function showShopRemoveFromUi(nodeId,runtimeRoot=root){
    const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);if(!runState||!node)return false;const shop=createShopState(runState,node,{runtimeRoot});if(shop.removeUsed||runState.deck.length<=MIN_DECK_SIZE)return showShopV2(runtimeRoot,node);
    const buttons=runState.deck.map((card,index)=>`<button class="choice" onclick="RunEconomyV2.removeShopCardFromUi('${escapeHtml(nodeId)}',${index})"><b>${escapeHtml(cardName(card))}</b><span>이 카드를 제거 · ${SHOP_REMOVE_COST}G</span></button>`).join('');
    runtimeRoot.showModal?.(`<h2>카드 제거</h2><p>골드 ${finite(runState.gold)} · 이번 상점에서 1회만 가능하다.</p><div class="choiceList">${buttons}<button class="choice" onclick="RunEconomyV2.showShopFromUi('${escapeHtml(nodeId)}')"><b>뒤로</b></button></div>`);return true;
  }
  function removeShopCardFromUi(nodeId,index,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);if(!runState||!node)return false;const result=removeShopCard(runState,node,index,{runtimeRoot});if(!result.ok){runtimeRoot.sfx?.('lose');return showShopV2(runtimeRoot,node)}runtimeRoot.sfx?.('reward');return showShopV2(runtimeRoot,node)}
  function showShopFromUi(nodeId,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);return node?showShopV2(runtimeRoot,node):false}
  function leaveShopFromUi(nodeId,runtimeRoot=root){const runState=activeRun(runtimeRoot),node=runState?.map?.find(item=>item.id===nodeId);return runState&&node?finishNode(runtimeRoot,node):false}

  function wrapBeginRun(runtimeRoot=root){const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runEconomyV2)return true;const wrapped=function(){const result=original.apply(this,arguments),runState=activeRun(runtimeRoot);if(runState){delete runState.economyState;ensureEconomyState(runState)}return result};wrapped.__runEconomyV2=true;wrapped.__legacyBeginRun=original;runtimeRoot.beginRun=wrapped;return true}
  function wrapShowReward(runtimeRoot=root){
    const original=runtimeRoot?.showReward;if(typeof original!=='function')return false;if(original.__runEconomyV2)return true;originalShowReward=original;
    const wrapped=function(node){const runState=activeRun(runtimeRoot),relics=relicApi(runtimeRoot);if(runState&&relics?.isRelicRewardNode?.(node)&&!relics.rewardClaimed?.(runState,node.id))return original.apply(this,arguments);return showBattleCardReward(runtimeRoot,node)};
    wrapped.__runEconomyV2=true;wrapped.__legacyShowReward=original;runtimeRoot.showReward=wrapped;return true;
  }
  function wrapShowCamp(runtimeRoot=root){const original=runtimeRoot?.showCamp;if(typeof original!=='function')return false;if(original.__runEconomyV2)return true;originalShowCamp=original;const wrapped=function(node){return showCampV2(runtimeRoot,node)};wrapped.__runEconomyV2=true;wrapped.__legacyShowCamp=original;runtimeRoot.showCamp=wrapped;return true}
  function wrapShowShop(runtimeRoot=root){const original=runtimeRoot?.showShop;if(typeof original!=='function')return false;if(original.__runEconomyV2)return true;originalShowShop=original;const wrapped=function(node){return showShopV2(runtimeRoot,node)};wrapped.__runEconomyV2=true;wrapped.__legacyShowShop=original;runtimeRoot.showShop=wrapped;return true}
  function installBrowser(runtimeRoot=root){if(installed)return true;if(!runtimeRoot?.RunFlowV2||!runtimeRoot?.RelicSystem)return false;if(typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.showReward!=='function'||typeof runtimeRoot.showCamp!=='function'||typeof runtimeRoot.showShop!=='function')return false;wrapBeginRun(runtimeRoot);wrapShowReward(runtimeRoot);wrapShowCamp(runtimeRoot);wrapShowShop(runtimeRoot);installed=true;return true}
  function installWhenReady(runtimeRoot=root){if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25);else console.warn('[run-economy-v2] 보상/캠프/상점 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true}
  function resetForTests(){installed=false;originalShowReward=null;originalShowCamp=null;originalShowShop=null;uidCounter=0}

  return{STAGE,CARD_OFFER_COUNT,MAX_UPGRADE_LEVEL,UPGRADE_TRICK_BONUS,CAMP_HEAL_RATIO,SHOP_CARD_COST,SHOP_RELIC_COST,SHOP_REMOVE_COST,MIN_DECK_SIZE,BATTLE_GOLD_BY_TYPE,REGION_THEME_CARD_IDS,activeRun,cardsApi,flowApi,relicApi,ensureEconomyState,record,definitionList,candidateFromDefinition,candidateFromPure,candidateCatalog,themeIds,isThemeCandidate,regionIdFor,rewardWeightsFor,rewardPools,generateCardOffer,deterministicRng,ensureRewardOffer,rewardClaim,instantiateCandidate,claimCardReward,skipCardReward,cardEffects,cardUpgradeLevel,canUpgradeCard,upgradeCard,campHeal,upgradeCampCard,createShopState,buyShopCard,buyShopRelic,canRemoveCard,removeShopCard,cardName,candidateName,showBattleCardReward,takeRewardFromUi,skipRewardFromUi,showCampV2,campHealFromUi,showCampUpgradeFromUi,upgradeCampCardFromUi,showCampFromUi,showShopV2,buyShopCardFromUi,buyShopRelicFromUi,showShopRemoveFromUi,removeShopCardFromUi,showShopFromUi,leaveShopFromUi,wrapBeginRun,wrapShowReward,wrapShowCamp,wrapShowShop,installBrowser,installWhenReady,resetForTests};
});
