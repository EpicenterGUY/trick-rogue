(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.BattleCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_MAX_HAND_SIZE=3;
  const TRICKS_PER_SET=5;
  const SUITS=Object.freeze(['S','H','D','C']);
  const DEFAULT_TRUMP_BONUS=3;
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
  function createSetHistory(){return{trickResults:[],wins:0,losses:0,draws:0,lastResult:null,winStreak:0,lossStreak:0};}
  function recordTrickResult(context,result){
    const history=context.setHistory||context;
    if(!history||!Array.isArray(history.trickResults))throw new TypeError('A setHistory with trickResults is required');
    const normalized=result===1||result==='player'?'player':result===-1||result==='enemy'?'enemy':result===0||result==='draw'?'draw':null;
    if(!normalized)throw new TypeError(`Unknown trick result: ${result}`);
    if(history.trickResults.length>=TRICKS_PER_SET)throw new RangeError('A set cannot record more than five tricks');
    history.trickResults.push(normalized);
    history.lastResult=normalized;
    if(normalized==='player'){
      history.wins=(history.wins||0)+1;
      history.winStreak=(history.winStreak||0)+1;
      history.lossStreak=0;
    }else if(normalized==='enemy'){
      history.losses=(history.losses||0)+1;
      history.lossStreak=(history.lossStreak||0)+1;
      history.winStreak=0;
    }else{
      history.draws=(history.draws||0)+1;
      history.winStreak=0;
      history.lossStreak=0;
    }
    return normalized;
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
    const printedRank=printedValue(card,'Rank'),printedSuit=printedValue(card,'Suit');
    const effectiveRank=modifiers.rank??modifiers.effectiveRank??card?.trickRank??card?.effectiveRank??printedRank;
    const effectiveSuit=modifiers.suit??modifiers.effectiveSuit??card?.trickSuit??card?.effectiveSuit??printedSuit;
    const treatedAsTrump=modifiers.treatedAsTrump??card?.treatedAsTrump??false;
    return{...card,printedRank,printedSuit,rank:effectiveRank,suit:effectiveSuit,effectiveRank,effectiveSuit,trickRank:effectiveRank,trickSuit:effectiveSuit,treatedAsTrump};
  }
  function isTrumpCard(card,trump){
    const trickSuit=card?.trickSuit??card?.effectiveSuit??card?.suit;
    return card?.treatedAsTrump===true||trickSuit===trump;
  }
  function trickRank(card){return card?.trickRank??card?.effectiveRank??card?.rank;}
  function trumpRankBonus(card,trump,bonus=DEFAULT_TRUMP_BONUS){
    const amount=Number(bonus);
    return isTrumpCard(card,trump)&&Number.isFinite(amount)?amount:0;
  }
  function trickValue(card,trump,options={}){
    const base=Number(trickRank(card));
    const bonus=Number.isFinite(options?.trumpBonus)?options.trumpBonus:DEFAULT_TRUMP_BONUS;
    const modifier=Number.isFinite(options?.modifier)?options.modifier:0;
    return(Number.isFinite(base)?base:0)+trumpRankBonus(card,trump,bonus)+modifier;
  }
  function compareTrick(playerCard,enemyCard,trump,options={}){
    return Math.sign(trickValue(playerCard,trump,options)-trickValue(enemyCard,trump,options));
  }
  function resolveShowdownAdvantage({playerCards,enemyCards}){
    if(!Array.isArray(playerCards)||!Array.isArray(enemyCards))throw new TypeError('Showdown advantage requires both showdown card arrays');
    const count=cards=>Object.fromEntries(SUITS.map(suit=>[suit,cards.filter(entry=>showdownValue(entry.card||entry,'Suit')===suit).length]));
    const playerSuitCounts=count(playerCards),enemySuitCounts=count(enemyCards);
    const playerAdvantages=[],enemyAdvantages=[];
    for(const suit of SUITS){const difference=playerSuitCounts[suit]-enemySuitCounts[suit];if(difference>=2)playerAdvantages.push(suit);else if(difference<=-2)enemyAdvantages.push(suit)}
    return{playerAdvantages,enemyAdvantages,playerAdvantageCount:playerAdvantages.length,enemyAdvantageCount:enemyAdvantages.length,playerSuitCounts,enemySuitCounts};
  }
  function showdownAdvantageBonus(advantages){return Array.isArray(advantages)&&advantages.length>0?SHOWDOWN_ADVANTAGE_POWER:0;}
  function applyShowdownAdvantage(playerPower,enemyPower,advantage){
    return{playerPower:playerPower+showdownAdvantageBonus(advantage.playerAdvantages),enemyPower:enemyPower+showdownAdvantageBonus(advantage.enemyAdvantages)};
  }
  function finishShowdown(state){
    if(state.phase!=='showdown')throw new Error('No showdown to finish');
    expireEffects(state,'set');
    state.setIndex++;state.trickIndex=1;state.phase='trick';state.setHistory=createSetHistory();
    return state;
  }
  function endBattle(state){expireEffects(state,'battle');state.phase='ended';}
  return{DEFAULT_MAX_HAND_SIZE,TRICKS_PER_SET,SUITS,DEFAULT_TRUMP_BONUS,SHOWDOWN_ADVANTAGE_POWER,EFFECT_DURATIONS,ENCOUNTER_PROGRESSION,createSetHistory,createBattleState,drawToMaxHand,playCard,addEffect,expireEffects,recordTrickResult,endTrick,printedValue,showdownValue,effectiveCard,isTrumpCard,trickRank,trumpRankBonus,trickValue,compareTrick,resolveShowdownAdvantage,showdownAdvantageBonus,applyShowdownAdvantage,finishShowdown,endBattle};
});
