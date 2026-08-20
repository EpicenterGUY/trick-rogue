(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.BattleCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_MAX_HAND_SIZE=3;
  const TRICKS_PER_SET=5;
  const SUITS=Object.freeze(['S','H','D','C']);
  const SHOWDOWN_ADVANTAGE_POWER=3;
  const EFFECT_DURATIONS=Object.freeze(['trick','set','battle','run']);
  const ENCOUNTER_PROGRESSION=Object.freeze({
    battle:{setCount:null,bossPhases:[]},
    elite:{setCount:null,bossPhases:[]},
    boss:{setCount:null,bossPhases:[]}
  });

  function drawToMaxHand(state){
    while(state.hand.length<state.maxHandSize){
      if(!state.deck.length&&state.discard.length){state.deck.push(...state.discard.splice(0));}
      if(!state.deck.length)break;
      state.hand.push(state.deck.pop());
    }
    return state.hand;
  }
  function createBattleState({deck=[],maxHandSize=DEFAULT_MAX_HAND_SIZE,encounterType='battle',progression}={}){
    const state={deck:[...deck],discard:[],hand:[],maxHandSize,trickIndex:1,setIndex:1,phase:'trick',setHistory:createSetHistory(),
      encounter:{type:encounterType,...ENCOUNTER_PROGRESSION[encounterType],...progression},effects:[],
      statuses:{player:{shield:0,bleed:0,poison:0},enemy:{shield:0,bleed:0,poison:0}}};
    drawToMaxHand(state);
    return state;
  }
  function playCard(state,handIndex){
    if(state.phase!=='trick')throw new Error('Cards can only be played during a trick');
    if(handIndex<0||handIndex>=state.hand.length)throw new RangeError('Invalid hand index');
    const card=state.hand.splice(handIndex,1)[0];
    state.discard.push(card);
    drawToMaxHand(state);
    return card;
  }
  function addEffect(state,effect){
    if(!EFFECT_DURATIONS.includes(effect.duration))throw new TypeError(`Unknown effect duration: ${effect.duration}`);
    const entry={...effect};state.effects.push(entry);return entry;
  }
  function expireEffects(state,duration){state.effects=state.effects.filter(effect=>effect.duration!==duration);}
  function createSetHistory(){return{trickResults:[]};}
  function recordTrickResult(context,result){
    const history=context.setHistory||context;
    if(!history||!Array.isArray(history.trickResults))throw new TypeError('A setHistory with trickResults is required');
    const normalized=result===1||result==='player'?'player':result===-1||result==='enemy'?'enemy':result===0||result==='draw'?'draw':null;
    if(!normalized)throw new TypeError(`Unknown trick result: ${result}`);
    if(history.trickResults.length>=TRICKS_PER_SET)throw new RangeError('A set cannot record more than five tricks');
    history.trickResults.push(normalized);return normalized;
  }
  function endTrick(state,result){
    if(result!==undefined)recordTrickResult(state,result);
    expireEffects(state,'trick');
    if(state.trickIndex===TRICKS_PER_SET){state.phase='showdown';return 'showdown';}
    state.trickIndex++;return 'trick';
  }
  function printedValue(card,key){
    const printed=card?.[`printed${key}`];
    return printed===undefined?card?.[key.toLowerCase()]:printed;
  }
  function showdownValue(card,key){
    const override=card?.[`showdown${key}`];
    return override===undefined?printedValue(card,key):override;
  }
  function effectiveCard(card,modifiers={}){
    return{...card,printedRank:printedValue(card,'Rank'),printedSuit:printedValue(card,'Suit'),
      effectiveRank:modifiers.rank??modifiers.effectiveRank??printedValue(card,'Rank'),
      effectiveSuit:modifiers.suit??modifiers.effectiveSuit??printedValue(card,'Suit')};
  }
  function compareTrick(playerCard,enemyCard,trump){
    const playerTrump=playerCard.effectiveSuit===trump,enemyTrump=enemyCard.effectiveSuit===trump;
    if(playerTrump!==enemyTrump)return playerTrump?1:-1;
    return Math.sign(playerCard.effectiveRank-enemyCard.effectiveRank);
  }
  function resolveShowdownAdvantage({playerCards,enemyCards}){
    if(!Array.isArray(playerCards)||!Array.isArray(enemyCards))throw new TypeError('Showdown advantage requires both showdown card arrays');
    const count=cards=>Object.fromEntries(SUITS.map(suit=>[suit,cards.filter(entry=>showdownValue(entry.card||entry,'Suit')===suit).length]));
    const playerSuitCounts=count(playerCards),enemySuitCounts=count(enemyCards);
    const playerAdvantages=[],enemyAdvantages=[];
    for(const suit of SUITS){const difference=playerSuitCounts[suit]-enemySuitCounts[suit];if(difference>=2)playerAdvantages.push(suit);else if(difference<=-2)enemyAdvantages.push(suit)}
    return{playerAdvantages,enemyAdvantages,playerAdvantageCount:playerAdvantages.length,enemyAdvantageCount:enemyAdvantages.length,playerSuitCounts,enemySuitCounts};
  }
  function applyShowdownAdvantage(playerPower,enemyPower,advantage){
    return{playerPower:playerPower+advantage.playerAdvantageCount*SHOWDOWN_ADVANTAGE_POWER,enemyPower:enemyPower+advantage.enemyAdvantageCount*SHOWDOWN_ADVANTAGE_POWER};
  }
  function finishShowdown(state){
    if(state.phase!=='showdown')throw new Error('No showdown to finish');
    expireEffects(state,'set');
    state.setIndex++;state.trickIndex=1;state.phase='trick';state.setHistory=createSetHistory();
    return state;
  }
  function endBattle(state){expireEffects(state,'battle');state.phase='ended';}
  return{DEFAULT_MAX_HAND_SIZE,TRICKS_PER_SET,SUITS,SHOWDOWN_ADVANTAGE_POWER,EFFECT_DURATIONS,ENCOUNTER_PROGRESSION,createSetHistory,createBattleState,drawToMaxHand,playCard,addEffect,expireEffects,recordTrickResult,endTrick,printedValue,showdownValue,effectiveCard,compareTrick,resolveShowdownAdvantage,applyShowdownAdvantage,finishShowdown,endBattle};
});
