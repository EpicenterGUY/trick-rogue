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

  const STARTERS=Object.freeze([
    Object.freeze({
      id:'free',name:'무소속',icon:'◫',kind:'neutral',
      desc:'특정 카드군에 얽매이지 않고 런에서 방향을 정하는 범용 시작.',
      pureSlots:Object.freeze(['S5','H4','H7','D2','D3','C3','C5']),
      effectCardIds:Object.freeze(['core.plus2','core.draw','core.barrier','core.burn','core.pureboost'])
    }),
    Object.freeze({
      id:'sniper',name:'저격수',icon:'◎',kind:'theme',
      desc:'정밀한 숫자 조절과 정보 활용의 씨앗을 가진 카드군 시작. 현재 카드는 프로토타입 구성이다.',
      pureSlots:Object.freeze(['S5','S7','S8','D2','D3','C3','H4']),
      effectCardIds:Object.freeze(['core.plus2','core.scout','core.double','core.pureboost','core.clean'])
    }),
    Object.freeze({
      id:'photographer',name:'사진가',icon:'▣',kind:'theme',
      desc:'정보 확인과 무늬 조작의 씨앗을 가진 카드군 시작. 현재 카드는 프로토타입 구성이다.',
      pureSlots:Object.freeze(['H4','H5','H7','D2','D3','S5','C3']),
      effectCardIds:Object.freeze(['core.scout','core.draw','core.paint','core.recolor','core.barrier'])
    })
  ]);

  const RUN_TRAITS=Object.freeze([
    Object.freeze({id:'extra_gold',name:'여유 자금',desc:'런 시작 골드 +20.',run:Object.freeze({gold:20})}),
    Object.freeze({id:'durable',name:'튼튼한 몸',desc:'최대 체력과 현재 체력 +6.',run:Object.freeze({maxHp:6,hp:6})}),
    Object.freeze({id:'foresight',name:'선행 관측',desc:'매 전투 시작 시 예측 단계 +1.',battle:Object.freeze({forecast:1})}),
    Object.freeze({id:'pocket_chip',name:'비상용 칩',desc:'매 전투 시작 시 칩 +1.',battle:Object.freeze({chips:1})})
  ]);

  let installed=false;
  let selection=null;
  let uidCounter=0;

  function starterDefinition(id='free'){return STARTERS.find(starter=>starter.id===id)||null}
  function traitDefinition(id){return RUN_TRAITS.find(trait=>trait.id===id)||null}
  function parseSlot(slot){
    const match=/^([SHDC])(\d{1,2})$/.exec(String(slot||''));
    if(!match)return null;
    const rank=Number(match[2]);
    if(rank<2||rank>14)return null;
    return{suit:match[1],rank};
  }
  function starterCardCount(starter){return(starter?.pureSlots?.length||0)+(starter?.effectCardIds?.length||0)}
  function validateStarterDefinition(starter,cardsApi){
    const errors=[];
    if(!starter?.id)errors.push('missing id');
    if(!starter?.name)errors.push('missing name');
    const pureCount=starter?.pureSlots?.length||0,effectCount=starter?.effectCardIds?.length||0;
    if(pureCount<7||pureCount>8)errors.push(`${starter?.id||'starter'}: pure cards must be 7~8`);
    if(effectCount<4||effectCount>5)errors.push(`${starter?.id||'starter'}: core cards must be 4~5`);
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
    if(cardsApi?.CARD_DEFINITION_BY_ID){
      for(const id of starter?.effectCardIds||[])if(!cardsApi.CARD_DEFINITION_BY_ID[id])errors.push(`${starter.id}: unknown card ${id}`);
    }
    return errors;
  }
  function validateStarterRegistry(cardsApi){return STARTERS.flatMap(starter=>validateStarterDefinition(starter,cardsApi))}

  function nextUid(runtimeRoot=root,prefix='starter'){
    if(typeof runtimeRoot?.newUid==='function')return runtimeRoot.newUid();
    uidCounter+=1;return`${prefix}-${uidCounter}`;
  }
  function buildStarterDeck(starterId='free',cardsApi=root,runtimeRoot=root){
    const starter=starterDefinition(starterId);if(!starter)throw new TypeError(`Unknown starter: ${String(starterId)}`);
    if(typeof cardsApi?.createCardRecord!=='function'||typeof cardsApi?.createDefinitionCard!=='function')throw new TypeError('Card creation API is required');
    const cards=[];
    for(const slot of starter.pureSlots){
      const parsed=parseSlot(slot);cards.push(cardsApi.createCardRecord({suit:parsed.suit,rank:parsed.rank,metadata:{uid:nextUid(runtimeRoot,'pure')}}));
    }
    for(const id of starter.effectCardIds)cards.push(cardsApi.createDefinitionCard(id,{uid:nextUid(runtimeRoot,'core')}));
    return cards;
  }

  function offerTraits(rng=Math.random,count=TRAIT_OFFER_COUNT){
    const pool=[...RUN_TRAITS];
    for(let i=pool.length-1;i>0;i--){const raw=Number(rng());const safe=Number.isFinite(raw)?Math.max(0,Math.min(.999999999,raw)):0;const j=Math.floor(safe*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    return pool.slice(0,Math.max(1,Math.min(count,pool.length)));
  }
  function createSelection(rng=Math.random){
    const offers=offerTraits(rng,TRAIT_OFFER_COUNT);
    return{starterId:'free',traitOfferIds:offers.map(trait=>trait.id),traitId:offers[0]?.id||RUN_TRAITS[0].id};
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
    runState.pack={id:'starter_v2',name:'시작 카드군',desc:starter.name,compatibilityOnly:true};
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
  function cardsApiFor(runtimeRoot=root){return{createCardRecord:runtimeRoot?.createCardRecord,createDefinitionCard:runtimeRoot?.createDefinitionCard,CARD_DEFINITION_BY_ID:runtimeRoot?.CARD_DEFINITION_BY_ID,createBaseCardSlots:runtimeRoot?.createBaseCardSlots}}

  function starterIcon(starter){return starter?.icon||'◫'}
  function renderStart(runtimeRoot=root){
    const doc=runtimeRoot?.document;if(!doc)return false;const state=ensureSelection(),starter=selectedStarter(),trait=selectedTrait();
    const titles=doc.querySelectorAll?.('#startScreen .sectionTitle')||[];if(titles[0])titles[0].textContent='시작 카드군';if(titles[1])titles[1].textContent='시작 특성';
    const hero=doc.getElementById?.('heroSprite');if(hero)hero.innerHTML='<div style="font-size:28px;line-height:1.25;text-align:center;color:#e4bd62">♠ ♥<br>♦ ♣</div>';
    const starterGrid=doc.getElementById?.('charGrid');if(starterGrid)starterGrid.innerHTML=STARTERS.map(item=>`<button class="option pixel ${state.starterId===item.id?'sel':''}" onclick="RunStartV2.selectStarter('${item.id}')"><div class="optionSprite" style="font-size:28px">${starterIcon(item)}</div><h3>${item.name}</h3><p>${item.desc}<br><span class="cyan">12장 · 순수 ${item.pureSlots.length} / 핵심 ${item.effectCardIds.length}</span></p></button>`).join('');
    const traitGrid=doc.getElementById?.('packGrid');if(traitGrid)traitGrid.innerHTML=state.traitOfferIds.map(id=>traitDefinition(id)).filter(Boolean).map(item=>`<button class="option pixel ${state.traitId===item.id?'sel':''}" onclick="RunStartV2.selectTrait('${item.id}')"><div class="optionSprite" style="font-size:26px">✦</div><h3>${item.name}</h3><p>${item.desc}</p></button>`).join('');
    const heroText=doc.querySelector?.('#startScreen .hero p');if(heroText)heroText.textContent=`${starter.name} 스타터 + ${trait.name} 특성으로 시작한다. 카드군은 클래스가 아니며 런 중 자유롭게 섞을 수 있다.`;
    return true;
  }
  function selectStarter(id,runtimeRoot=root){if(!starterDefinition(id))return false;ensureSelection().starterId=id;if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');renderStart(runtimeRoot);return true}
  function selectTrait(id,runtimeRoot=root){const state=ensureSelection();if(!state.traitOfferIds.includes(id)||!traitDefinition(id))return false;state.traitId=id;if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');renderStart(runtimeRoot);return true}

  function renderIdentityBadge(runtimeRoot=root){
    const doc=runtimeRoot?.document,runState=activeRun(runtimeRoot);if(!doc||!runState?.starter||!runState?.trait)return false;
    const build=doc.getElementById?.('mapBuild'),row=build?.parentElement?.parentElement||build?.parentElement;let badge=doc.getElementById?.('runIdentityBadge');
    if(row&&!badge){badge=doc.createElement('span');badge.id='runIdentityBadge';badge.className='badge';row.appendChild(badge)}
    if(badge){badge.textContent=`${runState.starter.name} · ${runState.trait.name}`;badge.title='시작 카드군 · 시작 특성'}
    return !!badge;
  }
  function renderBattleIdentity(runtimeRoot=root){
    const doc=runtimeRoot?.document,runState=activeRun(runtimeRoot);if(!doc||!runState?.starter)return false;
    const pName=doc.getElementById?.('pName');if(pName){pName.textContent=runState.starter.name;pName.title=runState.trait?`특성 · ${runState.trait.name}`:''}
    return true;
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
    const errors=validateStarterRegistry(cardsApiFor(runtimeRoot));if(errors.length){console.error('[run-start-v2] 스타터 정의 오류',errors);return false}
    resetSelection(runtimeRoot?.Math?.random||Math.random);
    runtimeRoot.renderStart=function(){return renderStart(runtimeRoot)};
    wrapBeginRun(runtimeRoot);wrapStartBattle(runtimeRoot);wrapRenderMap(runtimeRoot);wrapRenderBattle(runtimeRoot);
    installed=true;renderStart(runtimeRoot);return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowser(runtimeRoot))return;if(attempts++<80)setTimeout(attempt,25);else console.warn('[run-start-v2] 시작 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }
  function resetForTests(){installed=false;selection=null;uidCounter=0}

  return{STAGE,BASE_HP,BASE_GOLD,STARTER_DECK_SIZE,TRAIT_OFFER_COUNT,SUITS,STARTERS,RUN_TRAITS,starterDefinition,traitDefinition,parseSlot,starterCardCount,validateStarterDefinition,validateStarterRegistry,buildStarterDeck,offerTraits,createSelection,ensureSelection,resetSelection,selectedStarter,selectedTrait,applyTraitToRun,applyTraitToBattle,applyIdentityToRun,canAcquireCard,activeRun,activeBattle,cardsApiFor,renderStart,selectStarter,selectTrait,renderIdentityBadge,renderBattleIdentity,wrapBeginRun,wrapStartBattle,wrapRenderMap,wrapRenderBattle,installBrowser,installWhenReady,resetForTests};
});
