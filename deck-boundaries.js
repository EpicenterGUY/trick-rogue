(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.DeckBoundaries=api;
  if(typeof document!=='undefined')api.installBrowserAdapterWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_STARTING_DECK_SIZE=12;
  const MIN_STARTING_DECK_SIZE=10;
  const MAX_STARTING_DECK_SIZE=14;
  const MIN_STARTING_PLAIN_CARDS=2;
  let browserAdapterInstalled=false;

  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  function isNamedCard(card){return!!card?.named}
  function isEffectCard(card){
    if(!card||isNamedCard(card))return false;
    return!!card.definition||!!card.cardId||(Array.isArray(card.effects)&&card.effects.length>0);
  }
  function isPlainCard(card){return!!card&&!isNamedCard(card)&&!isEffectCard(card)}
  function startingDeckSizeForCharacter(character={}){
    const removals=Number.isFinite(Number(character?.remove))?Math.max(0,Math.floor(Number(character.remove))):0;
    return clamp(DEFAULT_STARTING_DECK_SIZE-removals,MIN_STARTING_DECK_SIZE,MAX_STARTING_DECK_SIZE);
  }
  function selectStartingDeck(cards,{targetSize=DEFAULT_STARTING_DECK_SIZE,minPlain=MIN_STARTING_PLAIN_CARDS}={}){
    if(!Array.isArray(cards))throw new TypeError('Starting deck source must be an array');
    const target=clamp(Math.floor(Number(targetSize)||DEFAULT_STARTING_DECK_SIZE),MIN_STARTING_DECK_SIZE,MAX_STARTING_DECK_SIZE);
    if(cards.length<=target)return cards.slice();
    const named=cards.filter(isNamedCard),effects=cards.filter(isEffectCard),plain=cards.filter(isPlainCard);
    const selected=[];
    selected.push(...named.slice(0,target));
    let remaining=target-selected.length;
    const plainReserve=Math.min(Math.max(0,Math.floor(Number(minPlain)||0)),plain.length,remaining);
    const effectCount=Math.min(effects.length,Math.max(0,remaining-plainReserve));
    selected.push(...effects.slice(0,effectCount));
    remaining=target-selected.length;
    selected.push(...plain.slice(0,Math.min(plain.length,remaining)));
    remaining=target-selected.length;
    if(remaining>0)selected.push(...effects.slice(effectCount,effectCount+remaining));
    remaining=target-selected.length;
    if(remaining>0)selected.push(...named.slice(selected.filter(isNamedCard).length,selected.filter(isNamedCard).length+remaining));
    return selected.slice(0,target);
  }
  function defaultShuffle(cards,random=Math.random){
    const next=cards.slice();
    for(let i=next.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[next[i],next[j]]=[next[j],next[i]]}
    return next;
  }
  function ensureBoundaryState(state){
    if(!state||typeof state!=='object')throw new TypeError('Battle state is required');
    if(!Array.isArray(state.deck))state.deck=[];
    if(!Array.isArray(state.discard))state.discard=[];
    if(!Array.isArray(state.hand))state.hand=[];
    if(!Array.isArray(state.showdownCards))state.showdownCards=[];
    return state;
  }
  function recycleDiscardWhenEmpty(state){
    ensureBoundaryState(state);
    if(state.deck.length||!state.discard.length)return false;
    const recycled=state.discard.splice(0);
    let shuffled;
    if(typeof state.shuffleFn==='function'){
      const result=state.shuffleFn(recycled);
      shuffled=Array.isArray(result)?result:recycled;
    }else shuffled=defaultShuffle(recycled,typeof state.random==='function'?state.random:Math.random);
    state.deck.push(...shuffled);
    return true;
  }
  function drawToMaxHand(state){
    ensureBoundaryState(state);
    const max=Number.isFinite(Number(state.maxHandSize))?Math.max(0,Math.floor(Number(state.maxHandSize))):3;
    while(state.hand.length<max){
      recycleDiscardWhenEmpty(state);
      if(!state.deck.length)break;
      state.hand.push(state.deck.pop());
    }
    return state.hand;
  }
  function playCardToShowdown(state,handIndex){
    ensureBoundaryState(state);
    if(state.phase!=='trick')throw new Error('Cards can only be played during a trick');
    if(handIndex<0||handIndex>=state.hand.length)throw new RangeError('Invalid hand index');
    const card=state.hand.splice(handIndex,1)[0];
    state.showdownCards.push(card);
    drawToMaxHand(state);
    return card;
  }
  function moveShowdownCardsToDiscard(state){
    ensureBoundaryState(state);
    if(!state.showdownCards.length)return 0;
    const moved=state.showdownCards.length;
    state.discard.push(...state.showdownCards.splice(0));
    return moved;
  }
  function installBattleCoreAdapter(core){
    if(!core||typeof core!=='object')return false;
    if(core.__deckBoundaries75J)return true;
    const oldCreate=core.createBattleState;
    const oldFinish=core.finishShowdown;
    if(typeof oldCreate!=='function'||typeof oldFinish!=='function')return false;
    core.createBattleState=function(options={}){
      const state=oldCreate.call(this,options);
      ensureBoundaryState(state);
      if(typeof options.shuffleFn==='function')state.shuffleFn=options.shuffleFn;
      if(typeof options.random==='function')state.random=options.random;
      return state;
    };
    core.drawToMaxHand=drawToMaxHand;
    core.playCard=playCardToShowdown;
    core.finishShowdown=function(state){
      moveShowdownCardsToDiscard(state);
      return oldFinish.call(this,state);
    };
    Object.defineProperty(core,'__deckBoundaries75J',{value:true,configurable:true});
    return true;
  }
  function browserRun(runtimeRoot){
    try{if(typeof run!=='undefined')return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function browserBattle(runtimeRoot){
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function browserDraw(runtimeRoot,count){
    try{if(typeof drawP==='function')return drawP(count)}catch(_error){}
    if(typeof runtimeRoot?.drawP==='function')return runtimeRoot.drawP(count);
  }
  function normalizeRunDeck(runtimeRoot){
    const state=browserRun(runtimeRoot);
    if(!state||!Array.isArray(state.deck))return null;
    const target=startingDeckSizeForCharacter(state.char);
    state.deck=selectStartingDeck(state.deck,{targetSize:target,minPlain:MIN_STARTING_PLAIN_CARDS});
    state.startingDeckSize=state.deck.length;
    state.startingDeckRule='7.5-J';
    return state.deck;
  }
  function refillBeforeShowdown(runtimeRoot){
    const state=browserBattle(runtimeRoot);
    if(!state||!Array.isArray(state.hand)||!Array.isArray(state.slots))return false;
    if(state.slots.length!==5||state.hand.length>=state.maxHandSize)return false;
    browserDraw(runtimeRoot,state.maxHandSize);
    return true;
  }
  function installBrowserAdapter(runtimeRoot=typeof globalThis!=='undefined'?globalThis:null){
    if(browserAdapterInstalled)return true;
    if(!runtimeRoot||typeof runtimeRoot.beginRun!=='function'||typeof runtimeRoot.showdown!=='function')return false;
    installBattleCoreAdapter(runtimeRoot.BattleCore);
    const oldBeginRun=runtimeRoot.beginRun;
    runtimeRoot.beginRun=function(...args){
      const result=oldBeginRun.apply(this,args);
      normalizeRunDeck(runtimeRoot);
      if(typeof runtimeRoot.renderMap==='function')runtimeRoot.renderMap();
      return result;
    };
    runtimeRoot.beginRun.__deckBoundaries75J=true;
    runtimeRoot.beginRun.__legacyBeginRun=oldBeginRun;
    const oldShowdown=runtimeRoot.showdown;
    runtimeRoot.showdown=async function(...args){
      refillBeforeShowdown(runtimeRoot);
      return await oldShowdown.apply(this,args);
    };
    runtimeRoot.showdown.__deckBoundaries75J=true;
    runtimeRoot.showdown.__legacyShowdown=oldShowdown;
    browserAdapterInstalled=true;
    return true;
  }
  function installBrowserAdapterWhenReady(runtimeRoot=typeof globalThis!=='undefined'?globalThis:null){
    let attempts=0;
    const attempt=()=>{
      if(installBrowserAdapter(runtimeRoot))return;
      attempts++;
      if(attempts<40)setTimeout(attempt,25);
    };
    setTimeout(attempt,0);
    return true;
  }
  function resetBrowserAdapterForTests(){browserAdapterInstalled=false;}

  return{DEFAULT_STARTING_DECK_SIZE,MIN_STARTING_DECK_SIZE,MAX_STARTING_DECK_SIZE,MIN_STARTING_PLAIN_CARDS,isNamedCard,isEffectCard,isPlainCard,startingDeckSizeForCharacter,selectStartingDeck,defaultShuffle,ensureBoundaryState,recycleDiscardWhenEmpty,drawToMaxHand,playCardToShowdown,moveShowdownCardsToDiscard,installBattleCoreAdapter,browserRun,browserBattle,normalizeRunDeck,refillBeforeShowdown,installBrowserAdapter,installBrowserAdapterWhenReady,resetBrowserAdapterForTests};
});