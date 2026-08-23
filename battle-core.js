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
  const SHOWDOWN_ADVANTAGE_POWER=3;
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

  function browserBattle(runtimeRoot=typeof globalThis!=='undefined'?globalThis:null){
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function suitFromSymbol(symbol){
    return symbol==='♠'?'S':symbol==='♥'?'H':symbol==='♦'?'D':symbol==='♣'?'C':null;
  }
  function installBrowserTrumpAdapter(runtimeRoot=typeof globalThis!=='undefined'?globalThis:null){
    if(browserTrumpAdapterInstalled)return true;
    if(!runtimeRoot||typeof runtimeRoot.effective!=='function'||typeof runtimeRoot.compare!=='function')return false;
    const oldEffective=runtimeRoot.effective;
    const oldCompare=runtimeRoot.compare;
    runtimeRoot.effective=function(card){
      const state=browserBattle(runtimeRoot);
      if(!state)return oldEffective.call(this,card);
      const rank=(Number(card?.rank)||0)+(Number(state?.mods?.plus)||0)+(Number(card?.effectiveRankBonus)||0);
      const suit=state?.mods?.paint?state.trump:card?.suit;
      return effectiveCard(card,{rank,suit,treatedAsTrump:card?.treatedAsTrump===true});
    };
    runtimeRoot.effective.__trumpPlus3Adapter=true;
    runtimeRoot.effective.__legacyEffective=oldEffective;
    runtimeRoot.compare=function(card,enemyCard){
      const state=browserBattle(runtimeRoot);
      if(!state)return oldCompare.call(this,card,enemyCard);
      const player=runtimeRoot.effective(card),enemy=effectiveCard(enemyCard);
      const compare=runtimeRoot.BattleCore?.compareTrick||compareTrick;
      const result=compare(player,enemy,state.trump);
      return state?.mods?.reverse?-result:result;
    };
    runtimeRoot.compare.__trumpPlus3Adapter=true;
    runtimeRoot.compare.__legacyCompare=oldCompare;

    if(typeof runtimeRoot.classifyWin==='function'){
      const oldClassify=runtimeRoot.classifyWin;
      runtimeRoot.classifyWin=function(card,enemyCard,result){
        if(result<=0)return null;
        const state=browserBattle(runtimeRoot);if(!state)return oldClassify.call(this,card,enemyCard,result);
        const player=runtimeRoot.effective(card),enemy=effectiveCard(enemyCard);
        const diff=Math.abs(trickValue(player,state.trump)-trickValue(enemy,state.trump));
        if(Number(card?.rank)<Number(enemyCard?.rank))return'역전';
        if(diff===1)return'아슬아슬';
        if(diff>=5)return'압승';
        return null;
      };
      runtimeRoot.classifyWin.__trumpPlus3Adapter=true;
    }
    if(typeof runtimeRoot.renderBattle==='function'){
      const oldRender=runtimeRoot.renderBattle;
      runtimeRoot.renderBattle=function(...args){
        const result=oldRender.apply(this,args),doc=runtimeRoot.document;
        const el=doc?.getElementById?.('trumpText');
        if(el&&!String(el.textContent).includes('+3'))el.textContent=`${el.textContent} +3`;
        return result;
      };
      runtimeRoot.renderBattle.__trumpPlus3Adapter=true;
      runtimeRoot.renderBattle.__legacyRenderBattle=oldRender;
    }
    if(typeof runtimeRoot.inspectCard==='function'){
      const oldInspect=runtimeRoot.inspectCard;
      runtimeRoot.inspectCard=function(card,placed=false,...rest){
        const result=oldInspect.call(this,card,placed,...rest);
        if(!placed){
          const state=browserBattle(runtimeRoot),doc=runtimeRoot.document,el=doc?.getElementById?.('inspectApply');
          if(state&&card&&el){
            const effective=runtimeRoot.effective(card),finalValue=trickValue(effective,state.trump);
            let text=String(el.textContent||'').replace(' · 트럼프',' · 트럼프 +3');
            if(!text.includes('최종 적용 숫자'))text+=` · 최종 적용 숫자 ${finalValue}`;
            el.textContent=text;
          }
        }
        return result;
      };
      runtimeRoot.inspectCard.__trumpPlus3Adapter=true;
      runtimeRoot.inspectCard.__legacyInspectCard=oldInspect;
    }
    if(typeof runtimeRoot.showTerm==='function'){
      const oldShowTerm=runtimeRoot.showTerm;
      runtimeRoot.showTerm=function(term,...args){
        const result=oldShowTerm.call(this,term,...args);
        if(term==='트럼프'){
          const p=runtimeRoot.document?.querySelector?.('#modal p');
          if(p)p.textContent='현재 세트의 지정 무늬. 해당 무늬 카드는 트릭에서 최종 적용 숫자 +3을 받으며, 비트럼프를 자동으로 이기지는 않는다. 쇼다운 원래 값에는 자동 보너스를 주지 않는다.';
        }
        return result;
      };
      runtimeRoot.showTerm.__trumpPlus3Adapter=true;
    }
    if(typeof runtimeRoot.showTerms==='function'){
      const oldShowTerms=runtimeRoot.showTerms;
      runtimeRoot.showTerms=function(...args){
        const result=oldShowTerms.apply(this,args),buttons=runtimeRoot.document?.querySelectorAll?.('#modal .choice')||[];
        for(const button of buttons){
          if(button.querySelector?.('b')?.textContent!=='트럼프')continue;
          const span=button.querySelector?.('span');
          if(span)span.textContent='현재 세트의 지정 무늬. 트릭에서 최종 적용 숫자 +3. 비트럼프 자동 승리 없음.';
        }
        return result;
      };
      runtimeRoot.showTerms.__trumpPlus3Adapter=true;
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

  return{DEFAULT_MAX_HAND_SIZE,TRICKS_PER_SET,SUITS,DEFAULT_TRUMP_BONUS,SHOWDOWN_ADVANTAGE_POWER,EFFECT_DURATIONS,ENCOUNTER_PROGRESSION,createSetHistory,createBattleState,drawToMaxHand,playCard,addEffect,expireEffects,recordTrickResult,endTrick,printedValue,showdownValue,effectiveCard,isTrumpCard,trickRank,trumpRankBonus,trickValue,compareTrick,resolveShowdownAdvantage,showdownAdvantageBonus,applyShowdownAdvantage,finishShowdown,endBattle,browserBattle,suitFromSymbol,installBrowserTrumpAdapter,installBrowserTrumpAdapterWhenReady,resetBrowserTrumpAdapterForTests};
});
