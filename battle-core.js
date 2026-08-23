(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.BattleCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_MAX_HAND_SIZE=3;
  const TRICKS_PER_SET=5;
  const SUITS=Object.freeze(['S','H','D','C']);
  const SHOWDOWN_ADVANTAGE_MULTIPLIER=1.25;
  // Deprecated compatibility constant. Automatic suit-count advantage no longer grants flat power.
  const SHOWDOWN_ADVANTAGE_POWER=0;
  const EFFECT_DURATIONS=Object.freeze(['trick','set','battle','run']);
  const ENCOUNTER_PROGRESSION=Object.freeze({
    battle:{setCount:null,bossPhases:[]},
    elite:{setCount:null,bossPhases:[]},
    boss:{setCount:null,bossPhases:[]}
  });

  function createShowdownAdvantageState(){return{player:false,enemy:false,playerSources:[],enemySources:[]}}
  function advantageStateOf(target,{create=false}={}){
    if(!target||typeof target!=='object')return null;
    if(Object.prototype.hasOwnProperty.call(target,'showdownAdvantage')){
      if(!target.showdownAdvantage&&create)target.showdownAdvantage=createShowdownAdvantageState();
      return target.showdownAdvantage||null;
    }
    if(Object.prototype.hasOwnProperty.call(target,'player')||Object.prototype.hasOwnProperty.call(target,'enemy'))return target;
    if(create){target.showdownAdvantage=createShowdownAdvantageState();return target.showdownAdvantage}
    return null;
  }
  function normalizeAdvantageSide(side){if(side!=='player'&&side!=='enemy')throw new TypeError(`Unknown advantage side: ${side}`);return side}
  function grantShowdownAdvantage(target,side='player',source=null){
    side=normalizeAdvantageSide(side);
    const advantage=advantageStateOf(target,{create:true});
    advantage[side]=true;
    const key=`${side}Sources`;
    if(!Array.isArray(advantage[key]))advantage[key]=[];
    if(source!==null&&source!==undefined&&!advantage[key].includes(source))advantage[key].push(source);
    return advantage;
  }
  function hasShowdownAdvantage(target,side='player'){
    side=normalizeAdvantageSide(side);
    const advantage=advantageStateOf(target);
    return advantage?.[side]===true;
  }
  function clearShowdownAdvantage(target){
    const advantage=advantageStateOf(target,{create:true});
    advantage.player=false;advantage.enemy=false;advantage.playerSources=[];advantage.enemySources=[];
    return advantage;
  }
  function showdownAdvantageSnapshot(target){
    const advantage=advantageStateOf(target)||createShowdownAdvantageState();
    return{
      player:advantage.player===true,
      enemy:advantage.enemy===true,
      playerSources:[...(advantage.playerSources||[])],
      enemySources:[...(advantage.enemySources||[])]
    };
  }

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
      encounter:{type:encounterType,...ENCOUNTER_PROGRESSION[encounterType],...progression},effects:[],showdownAdvantage:createShowdownAdvantageState(),
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
  function compareTrick(playerCard,enemyCard,trump){
    const playerTrump=isTrumpCard(playerCard,trump),enemyTrump=isTrumpCard(enemyCard,trump);
    if(playerTrump!==enemyTrump)return playerTrump?1:-1;
    return Math.sign(trickRank(playerCard)-trickRank(enemyCard));
  }
  function suitCounts(cards){
    return Object.fromEntries(SUITS.map(suit=>[suit,(cards||[]).filter(entry=>showdownValue(entry.card||entry,'Suit')===suit).length]));
  }
  // Compatibility snapshot for older UI/event code. Suit counts are informational only;
  // they never create advantage under the 7.5 rules.
  function resolveShowdownAdvantage({playerCards,enemyCards,advantageState}={}){
    if(!Array.isArray(playerCards)||!Array.isArray(enemyCards))throw new TypeError('Showdown advantage requires both showdown card arrays');
    const explicit=showdownAdvantageSnapshot(advantageState||null);
    return{
      playerAdvantages:[],enemyAdvantages:[],playerAdvantageCount:0,enemyAdvantageCount:0,
      playerSuitCounts:suitCounts(playerCards),enemySuitCounts:suitCounts(enemyCards),
      playerHasAdvantage:explicit.player,enemyHasAdvantage:explicit.enemy,
      playerSources:explicit.playerSources,enemySources:explicit.enemySources
    };
  }
  function showdownAdvantageBonus(){return 0;}
  function applyShowdownAdvantageMultiplier(playerPower,enemyPower,advantage){
    const playerActive=advantage?.playerHasAdvantage===true||hasShowdownAdvantage(advantage,'player');
    const enemyActive=advantage?.enemyHasAdvantage===true||hasShowdownAdvantage(advantage,'enemy');
    return{
      playerPower:playerActive?playerPower*SHOWDOWN_ADVANTAGE_MULTIPLIER:playerPower,
      enemyPower:enemyActive?enemyPower*SHOWDOWN_ADVANTAGE_MULTIPLIER:enemyPower
    };
  }
  // Deprecated name retained so older runtime code stops receiving +3 immediately.
  function applyShowdownAdvantage(playerPower,enemyPower,advantage){return applyShowdownAdvantageMultiplier(playerPower,enemyPower,advantage)}
  function finishShowdown(state){
    if(state.phase!=='showdown')throw new Error('No showdown to finish');
    expireEffects(state,'set');
    clearShowdownAdvantage(state);
    state.setIndex++;state.trickIndex=1;state.phase='trick';state.setHistory=createSetHistory();
    return state;
  }
  function endBattle(state){expireEffects(state,'battle');clearShowdownAdvantage(state);state.phase='ended';}
  return{DEFAULT_MAX_HAND_SIZE,TRICKS_PER_SET,SUITS,SHOWDOWN_ADVANTAGE_MULTIPLIER,SHOWDOWN_ADVANTAGE_POWER,EFFECT_DURATIONS,ENCOUNTER_PROGRESSION,createShowdownAdvantageState,grantShowdownAdvantage,hasShowdownAdvantage,clearShowdownAdvantage,showdownAdvantageSnapshot,createSetHistory,createBattleState,drawToMaxHand,playCard,addEffect,expireEffects,recordTrickResult,endTrick,printedValue,showdownValue,effectiveCard,isTrumpCard,trickRank,compareTrick,resolveShowdownAdvantage,showdownAdvantageBonus,applyShowdownAdvantageMultiplier,applyShowdownAdvantage,finishShowdown,endBattle};
});
