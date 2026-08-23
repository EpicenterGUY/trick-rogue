(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.BattleCore=api;
  if(typeof document!=='undefined')api.installBrowserTrumpAdapterWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DEFAULT_MAX_HAND_SIZE=3;
  const TRICKS_PER_SET=5;
  const SUITS=Object.freeze(['S','H','D','C']);
  const DEFAULT_TRUMP_BONUS=3;
  const EFFECT_DURATIONS=Object.freeze(['trick','set','battle','run']);
  const ENCOUNTER_PROGRESSION=Object.freeze({
    battle:{setCount:null,bossPhases:[]},
    elite:{setCount:null,bossPhases:[]},
    boss:{setCount:null,bossPhases:[]}
  });
  let browserTrumpAdapterInstalled=false;

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
  function finiteNumber(value,fallback=0){
    const number=Number(value);
    return Number.isFinite(number)?number:fallback;
  }
  function firstFinite(...values){
    for(const value of values){
      const number=Number(value);
      if(Number.isFinite(number))return number;
    }
    return 0;
  }
  function effectiveCard(card,modifiers={}){
    const printedRank=printedValue(card,'Rank'),printedSuit=printedValue(card,'Suit');
    const explicitModifier=Number.isFinite(Number(modifiers.rankModifier))?Number(modifiers.rankModifier):null;
    const requestedRank=modifiers.rank??modifiers.effectiveRank??modifiers.trickRank;
    const fallbackRank=card?.trickRank??card?.effectiveRank??card?.rank??printedRank;
    const effectiveRank=requestedRank!==undefined?requestedRank:explicitModifier!==null?finiteNumber(printedRank)+explicitModifier:fallbackRank;
    const effectiveSuit=modifiers.suit??modifiers.effectiveSuit??modifiers.trickSuit??card?.trickSuit??card?.effectiveSuit??printedSuit;
    const treatedAsTrump=modifiers.treatedAsTrump??card?.treatedAsTrump??false;
    const derivedModifier=finiteNumber(effectiveRank)-finiteNumber(printedRank);
    const trickRankModifier=explicitModifier!==null?explicitModifier:Number.isFinite(Number(card?.trickRankModifier))?Number(card.trickRankModifier):derivedModifier;
    return{...card,printedRank,printedSuit,rank:effectiveRank,suit:effectiveSuit,effectiveRank,effectiveSuit,trickRank:effectiveRank,trickSuit:effectiveSuit,trickRankModifier,treatedAsTrump};
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
  function sideTrickOptions(options={},side){
    if(!options||typeof options!=='object')return{};
    const common={...options};
    delete common.player;delete common.enemy;delete common.playerOptions;delete common.enemyOptions;
    const specific=options[side]||options[`${side}Options`]||{};
    return specific&&typeof specific==='object'?{...common,...specific}:common;
  }
  function resolveTrickValue(card,trump,options={}){
    const printedRank=finiteNumber(printedValue(card,'Rank'));
    const printedSuit=printedValue(card,'Suit');
    const effectiveSuit=options.suit??options.effectiveSuit??options.trickSuit??card?.trickSuit??card?.effectiveSuit??card?.suit??printedSuit;
    const treatedAsTrump=options.treatedAsTrump??card?.treatedAsTrump??false;
    const directRank=options.rank??options.effectiveRank??options.trickRank;
    const storedRank=trickRank(card);
    const derivedCardModifier=directRank!==undefined?finiteNumber(directRank)-printedRank:
      Number.isFinite(Number(card?.trickRankModifier))?Number(card.trickRankModifier):finiteNumber(storedRank)-printedRank;
    const cardRankModifier=firstFinite(options.cardRankModifier,options.rankModifier,derivedCardModifier);
    const otherNumberModifier=firstFinite(options.otherNumberModifier,options.numericModifier,options.modifier);
    const statusModifier=firstFinite(options.statusModifier);
    const fieldModifier=firstFinite(options.fieldModifier);
    const configuredTrumpBonus=Number.isFinite(Number(options.trumpBonus))?Number(options.trumpBonus):DEFAULT_TRUMP_BONUS;
    const trumpView={...card,trickSuit:effectiveSuit,effectiveSuit,suit:effectiveSuit,treatedAsTrump};
    const trumpApplied=isTrumpCard(trumpView,trump);
    const appliedTrumpBonus=trumpApplied?configuredTrumpBonus:0;
    const valueAfterTrump=printedRank+appliedTrumpBonus;
    const valueAfterCardEffects=valueAfterTrump+cardRankModifier+otherNumberModifier;
    const finalValue=valueAfterCardEffects+statusModifier+fieldModifier;
    return{
      printedRank,printedSuit,effectiveSuit,treatedAsTrump,trumpApplied,trumpBonus:appliedTrumpBonus,
      cardRankModifier,otherNumberModifier,statusModifier,fieldModifier,valueAfterTrump,valueAfterCardEffects,finalValue,
      stages:Object.freeze([
        Object.freeze({id:'printed',rank:printedRank,suit:printedSuit,value:printedRank}),
        Object.freeze({id:'suit',suit:effectiveSuit,value:printedRank}),
        Object.freeze({id:'trump',applied:trumpApplied,bonus:appliedTrumpBonus,value:valueAfterTrump}),
        Object.freeze({id:'number',cardModifier:cardRankModifier,otherModifier:otherNumberModifier,value:valueAfterCardEffects}),
        Object.freeze({id:'status_field',statusModifier,fieldModifier,value:finalValue})
      ])
    };
  }
  function trickValue(card,trump,options={}){return resolveTrickValue(card,trump,options).finalValue;}
  function compareTrick(playerCard,enemyCard,trump,options={}){
    const player=resolveTrickValue(playerCard,trump,sideTrickOptions(options,'player'));
    const enemy=resolveTrickValue(enemyCard,trump,sideTrickOptions(options,'enemy'));
    return Math.sign(player.finalValue-enemy.finalValue);
  }
  function resolveShowdownAdvantage(){
    return{mode:'explicit',automaticSuitComparison:false,multiplier:1.25,playerActive:false,enemyActive:false,playerSource:null,enemySource:null};
  }
  function showdownAdvantageBonus(){return 0;}
  function applyShowdownAdvantage(playerPower,enemyPower){return{playerPower,enemyPower};}
  function finishShowdown(state){
    if(state.phase!=='showdown')throw new Error('No showdown to finish');
    expireEffects(state,'set');
    state.setIndex++;state.trickIndex=1;state.phase='trick';state.setHistory=createSetHistory();
    return state;
  }
  function endBattle(state){expireEffects(state,'battle');state.phase='ended';}

  function browserBattle(runtimeRoot=typeof globalThis!=='undefined'?globalThis:null){
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function suitFromSymbol(symbol){
    return symbol==='♠'?'S':symbol==='♥'?'H':symbol==='♦'?'D':symbol==='♣'?'C':null;
  }
  function suitSymbol(suit){return suit==='S'?'♠':suit==='H'?'♥':suit==='D'?'♦':suit==='C'?'♣':String(suit??'?')}
  function signed(value){const number=finiteNumber(value);return number>0?`+${number}`:`${number}`}
  function installBrowserTrumpAdapter(runtimeRoot=typeof globalThis!=='undefined'?globalThis:null){
    if(browserTrumpAdapterInstalled)return true;
    if(!runtimeRoot||typeof runtimeRoot.effective!=='function'||typeof runtimeRoot.compare!=='function')return false;
    const oldEffective=runtimeRoot.effective;
    const oldCompare=runtimeRoot.compare;
    runtimeRoot.effective=function(card){
      const state=browserBattle(runtimeRoot);
      if(!state)return oldEffective.call(this,card);
      const rankModifier=(Number(state?.mods?.plus)||0)+(Number(card?.effectiveRankBonus)||0);
      const suit=state?.mods?.paint?state.trump:card?.suit;
      return effectiveCard(card,{rankModifier,suit,treatedAsTrump:card?.treatedAsTrump===true});
    };
    runtimeRoot.effective.__trickValuePipelineAdapter=true;
    runtimeRoot.effective.__legacyEffective=oldEffective;
    runtimeRoot.compare=function(card,enemyCard){
      const state=browserBattle(runtimeRoot);
      if(!state)return oldCompare.call(this,card,enemyCard);
      const player=runtimeRoot.effective(card),enemy=effectiveCard(enemyCard);
      const compare=runtimeRoot.BattleCore?.compareTrick||compareTrick;
      const result=compare(player,enemy,state.trump);
      return state?.mods?.reverse?-result:result;
    };
    runtimeRoot.compare.__trickValuePipelineAdapter=true;
    runtimeRoot.compare.__legacyCompare=oldCompare;

    if(typeof runtimeRoot.classifyWin==='function'){
      const oldClassify=runtimeRoot.classifyWin;
      runtimeRoot.classifyWin=function(card,enemyCard,result){
        if(result<=0)return null;
        const state=browserBattle(runtimeRoot);if(!state)return oldClassify.call(this,card,enemyCard,result);
        const player=runtimeRoot.effective(card),enemy=effectiveCard(enemyCard);
        const diff=Math.abs(resolveTrickValue(player,state.trump).finalValue-resolveTrickValue(enemy,state.trump).finalValue);
        if(Number(card?.rank)<Number(enemyCard?.rank))return'역전';
        if(diff===1)return'아슬아슬';
        if(diff>=5)return'압승';
        return null;
      };
      runtimeRoot.classifyWin.__trickValuePipelineAdapter=true;
    }
    if(typeof runtimeRoot.renderBattle==='function'){
      const oldRender=runtimeRoot.renderBattle;
      runtimeRoot.renderBattle=function(...args){
        const result=oldRender.apply(this,args),doc=runtimeRoot.document;
        const el=doc?.getElementById?.('trumpText');
        if(el&&!String(el.textContent).includes('+3'))el.textContent=`${el.textContent} +3`;
        return result;
      };
      runtimeRoot.renderBattle.__trickValuePipelineAdapter=true;
      runtimeRoot.renderBattle.__legacyRenderBattle=oldRender;
    }
    if(typeof runtimeRoot.inspectCard==='function'){
      const oldInspect=runtimeRoot.inspectCard;
      runtimeRoot.inspectCard=function(card,placed=false,...rest){
        const result=oldInspect.call(this,card,placed,...rest);
        if(!placed){
          const state=browserBattle(runtimeRoot),doc=runtimeRoot.document,el=doc?.getElementById?.('inspectApply');
          if(state&&card&&el){
            const effective=runtimeRoot.effective(card),trace=resolveTrickValue(effective,state.trump);
            const suitStep=trace.printedSuit===trace.effectiveSuit?suitSymbol(trace.effectiveSuit):`${suitSymbol(trace.printedSuit)}→${suitSymbol(trace.effectiveSuit)}`;
            const numberModifier=trace.cardRankModifier+trace.otherNumberModifier;
            const statusField=trace.statusModifier+trace.fieldModifier;
            let text=String(el.textContent||'').replace(' · 트럼프',' · 트럼프 +3');
            text+=` · 계산: ${trace.printedRank} → 무늬 ${suitStep} → 트럼프 ${signed(trace.trumpBonus)} → 숫자 ${signed(numberModifier)} → 상태/필드 ${signed(statusField)} → 최종 ${trace.finalValue}`;
            el.textContent=text;
          }
        }
        return result;
      };
      runtimeRoot.inspectCard.__trickValuePipelineAdapter=true;
      runtimeRoot.inspectCard.__legacyInspectCard=oldInspect;
    }
    if(typeof runtimeRoot.showTerm==='function'){
      const oldShowTerm=runtimeRoot.showTerm;
      runtimeRoot.showTerm=function(term,...args){
        const result=oldShowTerm.call(this,term,...args);
        if(term==='트럼프'){
          const p=runtimeRoot.document?.querySelector?.('#modal p');
          if(p)p.textContent='현재 세트의 지정 무늬. 카드 효과로 최종 무늬를 먼저 정한 뒤 트럼프 여부를 판정하며, 해당 무늬는 트릭 적용 숫자 +3을 받는다. 비트럼프 자동 승리는 없고 쇼다운 원래 값도 바꾸지 않는다.';
        }
        return result;
      };
      runtimeRoot.showTerm.__trickValuePipelineAdapter=true;
    }
    if(typeof runtimeRoot.showTerms==='function'){
      const oldShowTerms=runtimeRoot.showTerms;
      runtimeRoot.showTerms=function(...args){
        const result=oldShowTerms.apply(this,args),buttons=runtimeRoot.document?.querySelectorAll?.('#modal .choice')||[];
        for(const button of buttons){
          if(button.querySelector?.('b')?.textContent!=='트럼프')continue;
          const span=button.querySelector?.('span');
          if(span)span.textContent='최종 무늬 판정 뒤 트릭 적용 숫자 +3. 모든 보정 후 최종 적용 숫자로 승패를 정한다.';
        }
        return result;
      };
      runtimeRoot.showTerms.__trickValuePipelineAdapter=true;
    }
    browserTrumpAdapterInstalled=true;
    return true;
  }
  function installBrowserTrumpAdapterWhenReady(runtimeRoot=typeof globalThis!=='undefined'?globalThis:null){
    let attempts=0;
    const attempt=()=>{
      if(installBrowserTrumpAdapter(runtimeRoot))return;
      attempts++;
      if(attempts<40)setTimeout(attempt,25);
    };
    setTimeout(attempt,0);
    return true;
  }
  function resetBrowserTrumpAdapterForTests(){browserTrumpAdapterInstalled=false;}

  return{DEFAULT_MAX_HAND_SIZE,TRICKS_PER_SET,SUITS,DEFAULT_TRUMP_BONUS,EFFECT_DURATIONS,ENCOUNTER_PROGRESSION,createSetHistory,createBattleState,drawToMaxHand,playCard,addEffect,expireEffects,recordTrickResult,endTrick,printedValue,showdownValue,finiteNumber,effectiveCard,isTrumpCard,trickRank,trumpRankBonus,sideTrickOptions,resolveTrickValue,trickValue,compareTrick,resolveShowdownAdvantage,showdownAdvantageBonus,applyShowdownAdvantage,finishShowdown,endBattle,browserBattle,suitFromSymbol,suitSymbol,installBrowserTrumpAdapter,installBrowserTrumpAdapterWhenReady,resetBrowserTrumpAdapterForTests};
});
