(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.RunStartV2=api;
    if(typeof document!=='undefined')api.installWhenReady(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  const STAGE='8-A';
  const BASE_HP=60;
  const BASE_GOLD=60;
  const STARTER_DECK_SIZE=12;
  const TRAIT_OFFER_COUNT=3;
  const SUITS=Object.freeze(['S','H','D','C']);
  const COMMON_STARTER_ID='common';
  const COMMON_OPENING_ACT_ID='common';

  const COMMON_CARD_POOL_IDS=Object.freeze([
    'core.paint','core.plus2','core.draw','core.scout','core.double','core.barrier',
    'core.burn','core.reverse','core.pureboost','core.clean','core.recolor','core.fakeid'
  ]);
  const COMMON_STARTER_EFFECT_CARD_IDS=Object.freeze(['core.plus2','core.draw','core.burn','core.pureboost','core.clean']);
  const COMMON_STARTER_PURE_SLOTS=Object.freeze(['S5','H4','H7','D2','D3','C3','C5']);

  const STARTERS=Object.freeze([
    Object.freeze({
      id:COMMON_STARTER_ID,name:'공용 스타터',icon:'◫',kind:'common',
      desc:'순수 카드, 손패 순환, 칩 운용을 함께 익히는 공용 시작 덱. 특정 카드군에 속하지 않는다.',
      pureSlots:COMMON_STARTER_PURE_SLOTS,
      effectCardIds:COMMON_STARTER_EFFECT_CARD_IDS,
      exposed:true
    })
  ]);

  const ARCHIVED_STARTERS=Object.freeze([
    Object.freeze({
      id:'free',name:'무소속',icon:'◫',kind:'legacy',hidden:true,archived:true,
      desc:'구버전 범용 스타터. 새 런에서는 공용 스타터로 치환된다.',
      pureSlots:Object.freeze(['S5','H4','H7','D2','D3','C3','C5']),
      effectCardIds:Object.freeze(['core.plus2','core.draw','core.barrier','core.burn','core.pureboost'])
    }),
    Object.freeze({
      id:'sniper',name:'저격수',icon:'◎',kind:'legacy',hidden:true,archived:true,
      desc:'구버전 테마 스타터. 정의는 호환용으로 보관하지만 새 런에는 노출하지 않는다.',
      pureSlots:Object.freeze(['S5','S7','S8','D2','D3','C3','H4']),
      effectCardIds:Object.freeze(['core.plus2','core.scout','core.double','core.pureboost','core.clean'])
    }),
    Object.freeze({
      id:'photographer',name:'사진가',icon:'▣',kind:'legacy',hidden:true,archived:true,
      desc:'구버전 테마 스타터. 정의는 호환용으로 보관하지만 새 런에는 노출하지 않는다.',
      pureSlots:Object.freeze(['H4','H5','H7','D2','D3','S5','C3']),
      effectCardIds:Object.freeze(['core.scout','core.draw','core.paint','core.recolor','core.barrier'])
    })
  ]);
  const LEGACY_STARTER_ALIASES=Object.freeze({free:COMMON_STARTER_ID,sniper:COMMON_STARTER_ID,photographer:COMMON_STARTER_ID});

  const RUN_TRAITS=Object.freeze([
    Object.freeze({id:'extra_gold',name:'여유 자금',desc:'런 시작 골드 +20.',run:Object.freeze({gold:20})}),
    Object.freeze({id:'durable',name:'튼튼한 몸',desc:'최대 체력과 현재 체력 +6.',run:Object.freeze({maxHp:6,hp:6})}),
    Object.freeze({id:'foresight',name:'선행 관측',desc:'매 전투 시작 시 예측 단계 +1.',battle:Object.freeze({forecast:1})}),
    Object.freeze({id:'pocket_chip',name:'비상용 칩',desc:'매 전투 시작 시 칩 +1.',battle:Object.freeze({chips:1})})
  ]);

  let installed=false;
  let selection=null;
  let uidCounter=0;

  function normalizeStarterId(id=COMMON_STARTER_ID){return LEGACY_STARTER_ALIASES[id]||id}
  function starterDefinition(id=COMMON_STARTER_ID){const normalized=normalizeStarterId(id);return STARTERS.find(starter=>starter.id===normalized)||null}
  function archivedStarterDefinition(id){return ARCHIVED_STARTERS.find(starter=>starter.id===id)||null}
  function traitDefinition(id){return RUN_TRAITS.find(trait=>trait.id===id)||null}
  function parseSlot(slot){
    const match=/^([SHDC])(\d{1,2})$/.exec(String(slot||''));
    if(!match)return null;
    const rank=Number(match[2]);
    if(rank<2||rank>14)return null;
    return{suit:match[1],rank};
  }
  function starterCardCount(starter){return(starter?.pureSlots?.length||0)+(starter?.effectCardIds?.length||0)}
  function commonCardPoolIds(cardsApi=root){
    const registry=cardsApi?.CARD_DEFINITION_BY_ID;
    if(!registry)return[...COMMON_CARD_POOL_IDS];
    return COMMON_CARD_POOL_IDS.filter(id=>{
      const card=registry[id];return!!card&&card.category==='general'&&card.rarity==='common';
    });
  }
  function validateCommonCardPool(cardsApi){
    const errors=[],seen=new Set();
    for(const id of COMMON_CARD_POOL_IDS){
      if(seen.has(id)){errors.push(`common pool duplicate: ${id}`);continue}seen.add(id);
      const card=cardsApi?.CARD_DEFINITION_BY_ID?.[id];
      if(!card){errors.push(`common pool unknown card: ${id}`);continue}
      if(card.category!=='general')errors.push(`${id}: common pool card must be general`);
      if(card.rarity!=='common')errors.push(`${id}: common pool card must be common rarity`);
    }
    return errors;
  }
  function validateStarterDefinition(starter,cardsApi){
    const errors=[];
    if(!starter?.id)errors.push('missing id');
    if(!starter?.name)errors.push('missing name');
    const pureCount=starter?.pureSlots?.length||0,effectCount=starter?.effectCardIds?.length||0;
    if(pureCount<6||pureCount>8)errors.push(`${starter?.id||'starter'}: pure cards must be 6~8`);
    if(effectCount<4||effectCount>6)errors.push(`${starter?.id||'starter'}: common effect cards must be 4~6`);
    if(starterCardCount(starter)!==STARTER_DECK_SIZE)errors.push(`${starter?.id||'starter'}: deck must contain ${STARTER_DECK_SIZE} cards`);
    const seen=new Set();
    for(const slot of starter?.pureSlots||[]){
      const parsed=parseSlot(slot);
      if(!parsed)errors.push(`${starter.id}: invalid slot ${slot}`);
      if(seen.has(slot))errors.push(`${starter.id}: duplicate slot ${slot}`);
      seen.add(slot);
      if(cardsApi?.createBaseCardSlots&&parsed){
        const base=cardsApi.createBaseCardSlots().find(card=>card.suit===parsed.suit&&card.rank===parsed.rank);
        if(!base)errors.push(`${starter.id}: missing base slot ${slot}`);
        else if(base.cardId||base.definition||(Array.isArray(base.effects)&&base.effects.length))errors.push(`${starter.id}: ${slot} is not a pure card`);
      }
    }
    const commonPool=new Set(commonCardPoolIds(cardsApi));
    for(const id of starter?.effectCardIds||[]){
      if(!cardsApi?.CARD_DEFINITION_BY_ID?.[id])errors.push(`${starter.id}: unknown card ${id}`);
      else if(!commonPool.has(id))errors.push(`${starter.id}: ${id} is not in the common opening pool`);
    }
    return errors;
  }
  function validateStarterRegistry(cardsApi){return[...validateCommonCardPool(cardsApi),...STARTERS.flatMap(starter=>validateStarterDefinition(starter,cardsApi))]}

  function nextUid(runtimeRoot=root,prefix='starter'){
    if(typeof runtimeRoot?.newUid==='function')return runtimeRoot.newUid();
    uidCounter+=1;return`${prefix}-${uidCounter}`;
  }
  function buildStarterDeck(starterId=COMMON_STARTER_ID,cardsApi=root,runtimeRoot=root){
    const starter=starterDefinition(starterId);if(!starter)throw new TypeError(`Unknown starter: ${String(starterId)}`);
    if(typeof cardsApi?.createCardRecord!=='function'||typeof cardsApi?.createDefinitionCard!=='function')throw new TypeError('Card creation API is required');
    const cards=[];
    for(const slot of starter.pureSlots){
      const parsed=parseSlot(slot);cards.push(cardsApi.createCardRecord({suit:parsed.suit,rank:parsed.rank,metadata:{uid:nextUid(runtimeRoot,'pure')}}));
    }
    for(const id of starter.effectCardIds)cards.push(cardsApi.createDefinitionCard(id,{uid:nextUid(runtimeRoot,'common')}));
    return cards;
  }

  function isCommonOpeningPhase(runState){return!!runState&&(runState.actId===COMMON_OPENING_ACT_ID||runState.runFlow?.phase==='common')}
  function earlyCommonRewardIds(cardsApi=root){return commonCardPoolIds(cardsApi)}
  function rewardPoolForRun(runState,{cardsApi=root,namedRewardIds=[]}={}){
    if(isCommonOpeningPhase(runState))return earlyCommonRewardIds(cardsApi);
    return Array.isArray(namedRewardIds)?[...namedRewardIds]:[];
  }
  function isOpeningRewardCard(cardId,cardsApi=root){return commonCardPoolIds(cardsApi).includes(cardId)}

  function offerTraits(rng=Math.random,count=TRAIT_OFFER_COUNT){
    const pool=[...RUN_TRAITS];
    for(let i=pool.length-1;i>0;i--){const raw=Number(rng());const safe=Number.isFinite(raw)?Math.max(0,Math.min(.999999999,raw)):0;const j=Math.floor(safe*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    return pool.slice(0,Math.max(1,Math.min(count,pool.length)));
  }
  function createSelection(rng=Math.random){
    const offers=offerTraits(rng,TRAIT_OFFER_COUNT);
    return{starterId:COMMON_STARTER_ID,traitOfferIds:offers.map(trait=>trait.id),traitId:offers[0]?.id||RUN_TRAITS[0].id};
  }
  function ensureSelection(){if(!selection)selection=createSelection(root?.Math?.random||Math.random);return selection}
  function resetSelection(rng=root?.Math?.random||Math.random){selection=createSelection(rng);return{...selection,traitOfferIds:[...selection.traitOfferIds]}}
  function selectedStarter(){return starterDefinition(ensureSelection().starterId)||STARTERS[0]}
  function selectedTrait(){return traitDefinition(ensureSelection().traitId)||RUN_TRAITS[0]}

  function applyTraitToRun(runState,traitOrId){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    const trait=typeof traitOrId==='string'?traitDefinition(traitOrId):traitOrId;if(!trait)throw new TypeError('Unknown trait');
    const modifiers=trait.run||{};
    if(Number(modifiers.gold))runState.gold=(Number(runState.gold)||0)+Number(modifiers.gold);
    if(Number(modifiers.maxHp)){runState.maxHp=(Number(runState.maxHp)||0)+Number(modifiers.maxHp);runState.hp=(Number(runState.hp)||0)+Number(modifiers.hp??modifiers.maxHp)}
    else if(Number(modifiers.hp))runState.hp=Math.min(Number(runState.maxHp)||Infinity,(Number(runState.hp)||0)+Number(modifiers.hp));
    runState.traitId=trait.id;runState.trait=trait;
    return runState;
  }
  function applyTraitToBattle(battleState,traitOrId,runtimeRoot=root){
    if(!battleState||typeof battleState!=='object')return null;
    const trait=typeof traitOrId==='string'?traitDefinition(traitOrId):traitOrId;if(!trait)return null;
    if(battleState.__runStartTraitApplied===trait.id)return{traitId:trait.id,duplicate:true};
    const result={traitId:trait.id,forecast:0,chips:0,duplicate:false};
    if(Number(trait.battle?.forecast)){
      const amount=Number(trait.battle.forecast);battleState.myForecast=(Number(battleState.myForecast)||0)+amount;battleState.enemyForecast=(Number(battleState.enemyForecast)||0)+amount;result.forecast=amount;
    }
    if(Number(trait.battle?.chips)){
      const amount=Number(trait.battle.chips);
      if(runtimeRoot?.ChipEconomy?.grantChips){const gain=runtimeRoot.ChipEconomy.grantChips(battleState,amount,{source:'run_trait'});result.chips=gain.gained}
      else{const cap=Number(battleState.maxChip)||5,before=Number(battleState.chip)||0;battleState.chip=Math.min(cap,before+amount);result.chips=battleState.chip-before}
    }
    battleState.__runStartTraitApplied=trait.id;
    return result;
  }
  function applyIdentityToRun(runState,{starterId,traitId}={},cardsApi=root,runtimeRoot=root){
    if(!runState||typeof runState!=='object')throw new TypeError('runState is required');
    const starter=starterDefinition(starterId)||STARTERS[0],trait=traitDefinition(traitId)||RUN_TRAITS[0];
    runState.hp=BASE_HP;runState.maxHp=BASE_HP;runState.gold=BASE_GOLD;
    runState.deck=buildStarterDeck(starter.id,cardsApi,runtimeRoot);
    runState.starterId=starter.id;runState.starter=starter;
    runState.identity={starterId:starter.id,traitId:trait.id};
    runState.startingDeckSize=runState.deck.length;runState.startingDeckRule=STAGE;
    runState.char={id:'starter_identity',name:starter.name,hp:BASE_HP,named:[],remove:0,compatibilityOnly:true};
    runState.pack={id:'starter_v2',name:'공용 시작 덱',desc:starter.name,compatibilityOnly:true};
    applyTraitToRun(runState,trait);
    runState.char.hp=runState.maxHp;
    return runState;
  }
  function canAcquireCard(){return true}

  function activeRun(runtimeRoot=root){if(runtimeRoot?.run)return runtimeRoot.run;try{if(typeof run!=='undefined'&&run)return run}catch(_error){}return null}
  function activeBattle(runtimeRoot=root){if(runtimeRoot?.battle)return runtimeRoot.battle;try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}return null}
  function setLegacyNeutralSelection(){
    try{if(typeof selectedChar!=='undefined')selectedChar='keeper'}catch(_error){}
    try{if(typeof selectedPack!=='undefined')selectedPack='steady'}catch(_error){}
  }
  function cardsApiFor(runtimeRoot=root){return{createCardRecord:runtimeRoot?.createCardRecord,createDefinitionCard:runtimeRoot?.createDefinitionCard,CARD_DEFINITION_BY_ID:runtimeRoot?.CARD_DEFINITION_BY_ID,GENERAL_EFFECT_CARD_DEFINITIONS:runtimeRoot?.GENERAL_EFFECT_CARD_DEFINITIONS,createBaseCardSlots:runtimeRoot?.createBaseCardSlots}}

  function starterIcon(starter){return starter?.icon||'◫'}
  function renderStart(runtimeRoot=root){
    const doc=runtimeRoot?.document;if(!doc)return false;const state=ensureSelection(),starter=selectedStarter(),trait=selectedTrait();
    const titles=doc.querySelectorAll?.('#startScreen .sectionTitle')||[];if(titles[0])titles[0].textContent='공용 시작 덱';if(titles[1])titles[1].textContent='시작 특성';
    const hero=doc.getElementById?.('heroSprite');if(hero)hero.innerHTML='<div style="font-size:28px;line-height:1.25;text-align:center;color:#e4bd62">♠ ♥<br>♦ ♣</div>';
    const starterGrid=doc.getElementById?.('charGrid');if(starterGrid)starterGrid.innerHTML=STARTERS.map(item=>`<button class="option pixel ${state.starterId===item.id?'sel':''}" onclick="RunStartV2.selectStarter('${item.id}')"><div class="optionSprite" style="font-size:28px">${starterIcon(item)}</div><h3>${item.name}</h3><p>${item.desc}<br><span class="cyan">12장 · 순수 ${item.pureSlots.length} / 공용 효과 ${item.effectCardIds.length}</span></p></button>`).join('');
    const traitGrid=doc.getElementById?.('packGrid');if(traitGrid)traitGrid.innerHTML=state.traitOfferIds.map(id=>traitDefinition(id)).filter(Boolean).map(item=>`<button class="option pixel ${state.traitId===item.id?'sel':''}" onclick="RunStartV2.selectTrait('${item.id}')"><div class="optionSprite" style="font-size:26px">✦</div><h3>${item.name}</h3><p>${item.desc}</p></button>`).join('');
    const heroText=doc.querySelector?.('#startScreen .hero p');if(heroText)heroText.textContent=`${starter.name} + ${trait.name} 특성으로 시작한다. 초반 공통지역은 같은 공용 카드풀을 사용하고 이후 지역에서 빌드 방향을 정한다.`;
    return true;
  }
  function selectStarter(id,runtimeRoot=root){const starter=starterDefinition(id);if(!starter)return false;ensureSelection().starterId=starter.id;if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');renderStart(runtimeRoot);return true}
  function selectTrait(id,runtimeRoot=root){const state=ensureSelection();if(!state.traitOfferIds.includes(id)||!traitDefinition(id))return false;state.traitId=id;if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');renderStart(runtimeRoot);return true}

  function renderIdentityBadge(runtimeRoot=root){
    const doc=runtimeRoot?.document,runState=activeRun(runtimeRoot);if(!doc||!runState?.starter||!runState?.trait)return false;
    const build=doc.getElementById?.('mapBuild'),row=build?.parentElement?.parentElement||build?.parentElement;let badge=doc.getElementById?.('runIdentityBadge');
    if(row&&!badge){badge=doc.createElement('span');badge.id='runIdentityBadge';badge.className='badge';row.appendChild(badge)}
    if(badge){badge.textContent=`${runState.starter.name} · ${runState.trait.name}`;badge.title='공용 시작 덱 · 시작 특성'}
    return !!badge;
  }
  function renderBattleIdentity(runtimeRoot=root){
    const doc=runtimeRoot?.document,runState=activeRun(runtimeRoot);if(!doc||!runState?.starter)return false;
    const pName=doc.getElementById?.('pName');if(pName){pName.textContent=runState.starter.name;pName.title=runState.trait?`특성 · ${runState.trait.name}`:''}
    return true;
  }

  function shuffleIds(ids,rng=Math.random){
    const next=[...ids];for(let i=next.length-1;i>0;i--){const raw=Number(rng());const safe=Number.isFinite(raw)?Math.max(0,Math.min(.999999999,raw)):0;const j=Math.floor(safe*(i+1));[next[i],next[j]]=[next[j],next[i]]}return next;
  }
  function openingRewardCard(runtimeRoot,cardId){
    if(typeof runtimeRoot?.makeGeneral==='function')return runtimeRoot.makeGeneral(cardId);
    if(typeof runtimeRoot?.createDefinitionCard==='function')return runtimeRoot.createDefinitionCard(cardId,{uid:nextUid(runtimeRoot,'reward')});
    return null;
  }
  function openingRewardArt(runtimeRoot,cardId){
    const card=openingRewardCard(runtimeRoot,cardId);if(!card)return'';
    if(typeof runtimeRoot?.artHtml==='function')return runtimeRoot.artHtml(card);
    return'';
  }
  function showOpeningReward(runtimeRoot=root,node){
    const runState=activeRun(runtimeRoot);if(!runState||!node)return false;
    const cardsApi=cardsApiFor(runtimeRoot),opts=shuffleIds(earlyCommonRewardIds(cardsApi),runtimeRoot?.Math?.random||Math.random).slice(0,3);
    if(!opts.length)return false;
    const boxes=opts.map(id=>{const def=cardsApi.CARD_DEFINITION_BY_ID?.[id];if(!def)return'';return`<div class="rewardBox"><div class="cardArt">${openingRewardArt(runtimeRoot,id)}</div><h3>${def.name}</h3><p>${def.description||''}</p><div class="rewardBtns"><button onclick="RunStartV2.takeOpeningReward('${id}','engrave','${node.id}')">각인</button><button onclick="RunStartV2.takeOpeningReward('${id}','add','${node.id}')">추가</button></div></div>`}).join('');
    const html=`<h2>공통지역 카드 보상</h2><p>초반에는 특정 카드군 전용 카드 대신 <b>공용 효과 카드</b>만 등장한다. <b>각인</b>은 같은 숫자·무늬의 기존 카드를 바꾸고, <b>추가</b>는 새 복사본을 덱에 넣는다.</p><div class="rewardGrid">${boxes}</div><div class="choiceList"><button class="choice" onclick="skipReward('${node.id}')"><b>자원 보상으로 바꾸기</b><span>골드 +12</span></button></div>`;
    if(typeof runtimeRoot?.showModal==='function'){runtimeRoot.showModal(html);return true}
    return false;
  }
  function takeOpeningReward(cardId,mode,nodeId,runtimeRoot=root){
    const runState=activeRun(runtimeRoot),cardsApi=cardsApiFor(runtimeRoot);if(!runState||!isCommonOpeningPhase(runState)||!isOpeningRewardCard(cardId,cardsApi))return{ok:false,reason:'not_opening_reward'};
    const def=cardsApi.CARD_DEFINITION_BY_ID?.[cardId];if(!def)return{ok:false,reason:'unknown_card'};
    if(typeof runtimeRoot?.makeGeneral!=='function'&&typeof runtimeRoot?.createDefinitionCard!=='function')return{ok:false,reason:'card_factory_missing'};
    const create=()=>openingRewardCard(runtimeRoot,cardId);let replacedIndex=-1;
    if(mode==='engrave'){
      replacedIndex=runState.deck.findIndex(card=>card.suit===def.suit&&card.rank===def.rank&&!card.named&&!card.definition&&!card.cardId&&(!Array.isArray(card.effects)||card.effects.length===0));
      if(replacedIndex<0)replacedIndex=runState.deck.findIndex(card=>card.suit===def.suit&&card.rank===def.rank);
      if(replacedIndex>=0)runState.deck[replacedIndex]=create();else runState.deck.push(create());
    }else if(mode==='add')runState.deck.push(create());
    else return{ok:false,reason:'invalid_mode'};
    if(typeof runtimeRoot?.closeOverlay==='function')runtimeRoot.closeOverlay();
    const node=(runState.map||[]).find(entry=>entry.id===nodeId);if(node&&typeof runtimeRoot?.completeNode==='function')runtimeRoot.completeNode(node);
    return{ok:true,cardId,mode,replacedIndex,deckSize:runState.deck.length};
  }
  function wrapShowReward(runtimeRoot=root){
    const original=runtimeRoot?.showReward;if(typeof original!=='function')return false;if(original.__runStartV2CommonPool)return true;
    function wrapped(node){const runState=activeRun(runtimeRoot);if(isCommonOpeningPhase(runState)&&showOpeningReward(runtimeRoot,node))return;return original.apply(this,arguments)}
    wrapped.__runStartV2CommonPool=true;wrapped.__original=original;runtimeRoot.showReward=wrapped;return true;
  }

  function wrapBeginRun(runtimeRoot=root){
    const original=runtimeRoot?.beginRun;if(typeof original!=='function')return false;if(original.__runStartV2)return true;
    function wrapped(){
      setLegacyNeutralSelection();const result=original.apply(this,arguments),runState=activeRun(runtimeRoot),state=ensureSelection();
      if(runState){applyIdentityToRun(runState,state,cardsApiFor(runtimeRoot),runtimeRoot);if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap()}
      return result;
    }
    wrapped.__runStartV2=true;wrapped.__original=original;runtimeRoot.beginRun=wrapped;return true;
  }
  function wrapStartBattle(runtimeRoot=root){
    const original=runtimeRoot?.startBattle;if(typeof original!=='function')return false;if(original.__runStartV2)return true;
    function wrapped(){const result=original.apply(this,arguments),runState=activeRun(runtimeRoot),battleState=activeBattle(runtimeRoot);if(runState?.trait&&battleState)applyTraitToBattle(battleState,runState.trait,runtimeRoot);if(typeof runtimeRoot.renderBattle==='function')runtimeRoot.renderBattle();return result}
    wrapped.__runStartV2=true;wrapped.__original=original;runtimeRoot.startBattle=wrapped;return true;
  }
  function wrapRenderMap(runtimeRoot=root){
    const original=runtimeRoot?.renderMap;if(typeof original!=='function')return false;if(original.__runStartV2)return true;
    function wrapped(){const result=original.apply(this,arguments);renderIdentityBadge(runtimeRoot);return result}
    wrapped.__runStartV2=true;wrapped.__original=original;runtimeRoot.renderMap=wrapped;return true;
  }
  function wrapRenderBattle(runtimeRoot=root){
    const original=runtimeRoot?.renderBattle;if(typeof original!=='function')return false;if(original.__runStartV2)return true;
    function wrapped(){const result=original.apply(this,arguments);renderBattleIdentity(runtimeRoot);return result}
    wrapped.__runStartV2=true;wrapped.__original=original;runtimeRoot.renderBattle=wrapped;return true;
  }
  function installBrowser(runtimeRoot=root){
    if(installed)return true;
    if(typeof runtimeRoot?.beginRun!=='function'||typeof runtimeRoot?.startBattle!=='function'||typeof runtimeRoot?.renderMap!=='function'||typeof runtimeRoot?.renderBattle!=='function')return false;
    const errors=validateStarterRegistry(cardsApiFor(runtimeRoot));if(errors.length){console.error('[run-start-v2] 공용 스타터 정의 오류',errors);return false}
    resetSelection(runtimeRoot?.Math?.random||Math.random);
    runtimeRoot.renderStart=function(){return renderStart(runtimeRoot)};
    wrapBeginRun(runtimeRoot);wrapStartBattle(runtimeRoot);wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);wrapShowReward(runtimeRoot);
    installed=true;renderStart(runtimeRoot);return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25);else console.warn('[run-start-v2] 시작 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  function resetForTests(){installed=false;selection=null;uidCounter=0}

  return{STAGE,BASE_HP,BASE_GOLD,STARTER_DECK_SIZE,TRAIT_OFFER_COUNT,SUITS,COMMON_STARTER_ID,COMMON_OPENING_ACT_ID,COMMON_CARD_POOL_IDS,COMMON_STARTER_EFFECT_CARD_IDS,COMMON_STARTER_PURE_SLOTS,STARTERS,ARCHIVED_STARTERS,LEGACY_STARTER_ALIASES,RUN_TRAITS,normalizeStarterId,starterDefinition,archivedStarterDefinition,traitDefinition,parseSlot,starterCardCount,commonCardPoolIds,validateCommonCardPool,validateStarterDefinition,validateStarterRegistry,buildStarterDeck,isCommonOpeningPhase,earlyCommonRewardIds,rewardPoolForRun,isOpeningRewardCard,offerTraits,createSelection,ensureSelection,resetSelection,selectedStarter,selectedTrait,applyTraitToRun,applyTraitToBattle,applyIdentityToRun,canAcquireCard,activeRun,activeBattle,cardsApiFor,renderStart,selectStarter,selectTrait,renderIdentityBadge,renderBattleIdentity,shuffleIds,openingRewardCard,openingRewardArt,showOpeningReward,takeOpeningReward,wrapShowReward,wrapBeginRun,wrapStartBattle,wrapRenderMap,wrapRenderBattle,installBrowser,installWhenReady,resetForTests};
});
