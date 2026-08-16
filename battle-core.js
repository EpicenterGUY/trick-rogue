(function(root,factory){const api=factory();if(typeof module!=='undefined')module.exports=api;root.BattleCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_MAX_HAND_SIZE=3;
  const TRICKS_PER_SET=5;
  const SHOWDOWN_ADVANTAGE_POWER=6;
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
  function resolveShowdownAdvantage(context){
    const results=context?.setHistory?.trickResults||context?.trickResults;
    if(!Array.isArray(results))throw new TypeError('Showdown advantage requires the current set trick history');
    const playerWins=results.filter(result=>result==='player').length;
    const enemyWins=results.filter(result=>result==='enemy').length;
    const draws=results.filter(result=>result==='draw').length;
    const result=playerWins>enemyWins?'player':enemyWins>playerWins?'enemy':'neutral';
    return{result,playerWins,enemyWins,draws,powerBonus:result==='neutral'?0:SHOWDOWN_ADVANTAGE_POWER};
  }
  function applyShowdownAdvantage(playerPower,enemyPower,advantage){
    return{playerPower:playerPower+(advantage.result==='player'?advantage.powerBonus:0),enemyPower:enemyPower+(advantage.result==='enemy'?advantage.powerBonus:0)};
  }
  function finishShowdown(state){
    if(state.phase!=='showdown')throw new Error('No showdown to finish');
    expireEffects(state,'set');
    state.setIndex++;state.trickIndex=1;state.phase='trick';state.setHistory=createSetHistory();
    return state;
  }
  function endBattle(state){expireEffects(state,'battle');state.phase='ended';}
  return{DEFAULT_MAX_HAND_SIZE,TRICKS_PER_SET,SHOWDOWN_ADVANTAGE_POWER,EFFECT_DURATIONS,ENCOUNTER_PROGRESSION,createSetHistory,createBattleState,drawToMaxHand,playCard,addEffect,expireEffects,recordTrickResult,endTrick,resolveShowdownAdvantage,applyShowdownAdvantage,finishShowdown,endBattle};
});
