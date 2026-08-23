(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.ShowdownResolution=api;
    api.installBrowser(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='7.5-C';
  const SHOWDOWN_PHASES=Object.freeze([
    'cards_locked',
    'pre_showdown_effects',
    'showdown_value_changes',
    'poker',
    'additive_bonuses',
    'rare_multipliers',
    'final_power',
    'damage',
    'overkill',
    'set_end'
  ]);
  const POKER_HANDS=Object.freeze({
    high_card:Object.freeze({id:'high_card',name:'하이카드',power:5}),
    pair:Object.freeze({id:'pair',name:'페어',power:10}),
    two_pair:Object.freeze({id:'two_pair',name:'투페어',power:14}),
    three_kind:Object.freeze({id:'three_kind',name:'트리플',power:18}),
    straight:Object.freeze({id:'straight',name:'스트레이트',power:24}),
    flush:Object.freeze({id:'flush',name:'플러시',power:26}),
    full_house:Object.freeze({id:'full_house',name:'풀하우스',power:32}),
    four_kind:Object.freeze({id:'four_kind',name:'포카드',power:42}),
    straight_flush:Object.freeze({id:'straight_flush',name:'스트레이트 플러시',power:60})
  });

  function activeBattle(runtimeRoot=defaultRoot){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function activeRun(runtimeRoot=defaultRoot){
    try{if(typeof run!=='undefined'&&run)return run}catch(_error){}
    return runtimeRoot?.run||null;
  }
  function numeric(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function signed(value){const number=numeric(value);return number>0?`+${number}`:String(number)}
  function unwrapCard(entry){return entry?.card||entry}
  function showdownValue(card,key,resolver){
    if(typeof resolver==='function')return resolver(card,key);
    const override=card?.[`showdown${key}`];
    if(override!==undefined)return override;
    const printed=card?.[`printed${key}`];
    if(printed!==undefined)return printed;
    return card?.[key.toLowerCase()];
  }
  function evaluatePoker(entries,{valueResolver}={}){
    if(!Array.isArray(entries)||entries.length!==5)throw new RangeError('Showdown poker requires exactly five cards');
    const cards=entries.map(unwrapCard);
    const ranks=cards.map(card=>numeric(showdownValue(card,'Rank',valueResolver),NaN)).sort((a,b)=>a-b);
    const suits=cards.map(card=>showdownValue(card,'Suit',valueResolver));
    if(ranks.some(rank=>!Number.isFinite(rank)))throw new TypeError('Showdown ranks must be numeric');
    const counts={};for(const rank of ranks)counts[rank]=(counts[rank]||0)+1;
    const groups=Object.values(counts).sort((a,b)=>b-a);
    const unique=[...new Set(ranks)];
    const flush=new Set(suits).size===1;
    const straight=(unique.length===5&&unique[4]-unique[0]===4)||JSON.stringify(unique)===JSON.stringify([2,3,4,5,14]);
    let definition=POKER_HANDS.high_card;
    if(straight&&flush)definition=POKER_HANDS.straight_flush;
    else if(groups[0]===4)definition=POKER_HANDS.four_kind;
    else if(groups[0]===3&&groups[1]===2)definition=POKER_HANDS.full_house;
    else if(flush)definition=POKER_HANDS.flush;
    else if(straight)definition=POKER_HANDS.straight;
    else if(groups[0]===3)definition=POKER_HANDS.three_kind;
    else if(groups[0]===2&&groups[1]===2)definition=POKER_HANDS.two_pair;
    else if(groups[0]===2)definition=POKER_HANDS.pair;
    return{...definition,ranks:[...ranks],suits:[...suits]};
  }
  function createSide(hand){
    return{
      hand:{...hand,ranks:[...(hand?.ranks||[])],suits:[...(hand?.suits||[])]},
      basePower:numeric(hand?.power),
      additives:[],additiveTotal:0,preMultiplierPower:numeric(hand?.power),
      multipliers:[],multiplierProduct:1,finalPower:numeric(hand?.power)
    };
  }
  function createBreakdown({playerHand,enemyHand,setIndex=1}={}){
    if(!playerHand||!enemyHand)throw new TypeError('Both showdown hands are required');
    return{
      stage:STAGE,order:[...SHOWDOWN_PHASES],setIndex,
      player:createSide(playerHand),enemy:createSide(enemyHand),
      damage:{target:null,amount:0},finalized:false
    };
  }
  function sideOf(model,side){
    if(side!=='player'&&side!=='enemy')throw new TypeError(`Unknown showdown side: ${String(side)}`);
    if(!model?.[side])throw new TypeError('A showdown breakdown is required');
    return model[side];
  }
  function addAdditive(model,side,{id,label,value,source='effect',metadata}={}){
    const target=sideOf(model,side),amount=numeric(value);
    if(!amount)return null;
    const entry={id:id||`${source}:${target.additives.length+1}`,label:label||source,value:amount,source};
    if(metadata!==undefined)entry.metadata=metadata;
    target.additives.push(entry);return entry;
  }
  function addMultiplier(model,side,{id,label,factor,source='condition',metadata}={}){
    const target=sideOf(model,side),multiplier=numeric(factor,1);
    if(multiplier<=0)throw new RangeError('Showdown multiplier must be greater than zero');
    if(multiplier===1)return null;
    const entry={id:id||`${source}:${target.multipliers.length+1}`,label:label||source,factor:multiplier,source,before:null,after:null};
    if(metadata!==undefined)entry.metadata=metadata;
    target.multipliers.push(entry);return entry;
  }
  function finalizeSide(side){
    side.additiveTotal=side.additives.reduce((sum,entry)=>sum+numeric(entry.value),0);
    side.preMultiplierPower=Math.max(0,side.basePower+side.additiveTotal);
    let current=side.preMultiplierPower,product=1;
    for(const entry of side.multipliers){
      entry.before=current;product*=entry.factor;current=Math.max(0,Math.round(current*entry.factor));entry.after=current;
    }
    side.multiplierProduct=product;
    side.finalPower=current;
    return side;
  }
  function finalizeBreakdown(model){
    finalizeSide(model.player);finalizeSide(model.enemy);
    const difference=Math.abs(model.player.finalPower-model.enemy.finalPower);
    model.damage={target:difference?(model.player.finalPower>model.enemy.finalPower?'enemy':'player'):null,amount:difference};
    model.finalized=true;return model;
  }
  function multiplierText(side){
    return side.multipliers.length?side.multipliers.map(entry=>`${entry.label} ×${entry.factor}`).join(' · '):'없음';
  }
  function additiveText(side){return `${signed(side.additiveTotal)}`}
  function traceLines(model){
    if(!model?.finalized)finalizeBreakdown(model);
    return[
      `족보: ${model.player.hand.name} ${model.player.basePower} / 적 ${model.enemy.hand.name} ${model.enemy.basePower}`,
      `덧셈: 나 ${additiveText(model.player)} / 적 ${additiveText(model.enemy)}`,
      `배율: 나 ${multiplierText(model.player)} / 적 ${multiplierText(model.enemy)}`,
      `최종 위력: ${model.player.finalPower} : ${model.enemy.finalPower}`
    ];
  }
  function snapshotBreakdown(model){return JSON.parse(JSON.stringify(model))}
  function cardLabel(card,index){return card?.named?.name||card?.definition?.name||card?.name||card?.cardId||card?.id||`${index+1}번 슬롯`}
  function advantageExtra(advantage,score){
    return{
      score,advantage,
      playerAdvantages:advantage?.playerAdvantages||[],enemyAdvantages:advantage?.enemyAdvantages||[],
      playerAdvantageCount:numeric(advantage?.playerAdvantageCount),enemyAdvantageCount:numeric(advantage?.enemyAdvantageCount),
      playerSuitCounts:advantage?.playerSuitCounts||{},enemySuitCounts:advantage?.enemySuitCounts||{}
    };
  }
  function currentContractResolution(state){
    const resolution=state?.contractTabooLastResolution;
    return resolution&&resolution.setIndex===(state?.setIndex??resolution.setIndex)?resolution:null;
  }
  function recordScoreTrigger(runtimeRoot,state,model,trigger,score,advantage){
    const slots=Array.isArray(state?.slots)?state.slots:[];
    for(let index=0;index<slots.length;index++){
      const slot=slots[index],before=numeric(score.value),beforeResolution=currentContractResolution(state);
      runtimeRoot.runCardEffects?.(trigger,slot.card,{slotIndex:index,...advantageExtra(advantage,score)});
      const resolution=currentContractResolution(state);
      let after=numeric(score.value),effectAfter=after,contractApplied=0;
      if(trigger==='on_showdown_score'&&resolution&&resolution!==beforeResolution&&Number.isFinite(resolution.basePower)&&Number.isFinite(resolution.finalPower)){
        effectAfter=numeric(resolution.basePower);
        contractApplied=numeric(resolution.finalPower)-numeric(resolution.basePower);
      }
      const effectDelta=effectAfter-before;
      if(effectDelta)addAdditive(model,'player',{
        id:`${trigger}:${index}`,label:`${trigger==='on_showdown_advantage'?'우세 반응':'쇼다운 효과'} · ${cardLabel(slot.card,index)}`,
        value:effectDelta,source:'effects',metadata:{trigger,slotIndex:index}
      });
      if(contractApplied)addAdditive(model,'player',{
        id:`contract_taboo:${state.setIndex}`,label:'계약/금기',value:contractApplied,source:'contract_taboo',
        metadata:{summary:resolution.summary,nominalDelta:resolution.delta,entries:resolution.entries}
      });
    }
    return score;
  }
  function undoLegacyAdvantageScale(state,score){
    const legacy=state?.advantageState,currentSet=state?.setIndex??1;
    if(!legacy||legacy.appliedSet!==currentSet)return false;
    if(!Number.isFinite(legacy.lastPlayerPreMultiplier)||!Number.isFinite(legacy.lastPlayerPostMultiplier))return false;
    if(numeric(score?.value,NaN)!==legacy.lastPlayerPostMultiplier)return false;
    score.value=legacy.lastPlayerPreMultiplier;return true;
  }
  function addActiveAdvantageMultipliers(runtimeRoot,state,model,advantage){
    const factor=numeric(advantage?.multiplier,runtimeRoot?.ShowdownAdvantage?.ADVANTAGE_MULTIPLIER||1.25);
    if(advantage?.playerActive)addMultiplier(model,'player',{id:'advantage',label:'우세',factor,source:advantage.playerSource||'advantage'});
    if(advantage?.enemyActive)addMultiplier(model,'enemy',{id:'advantage',label:'우세',factor,source:advantage.enemySource||'advantage'});
    return model;
  }
  function syncAdvantageDiagnostics(state,model,advantage){
    const legacy=state?.advantageState;if(!legacy)return;
    legacy.scoreBase=model.player.basePower;
    legacy.lastPlayerPreMultiplier=model.player.preMultiplierPower;
    legacy.lastPlayerPostMultiplier=model.player.finalPower;
    legacy.appliedSet=advantage?.playerActive?(state?.setIndex??1):null;
  }
  function wait(runtimeRoot,ms){return typeof runtimeRoot?.wait==='function'?runtimeRoot.wait(ms):new Promise(resolve=>(runtimeRoot?.setTimeout||setTimeout)(resolve,ms))}
  async function animateBreakdown(runtimeRoot,state,model){
    const doc=runtimeRoot?.document;
    state.showdownVisualStage='scan';
    for(let index=0;index<5;index++){
      doc?.getElementById?.(`showdown-slot-${index}`)?.classList?.add?.('showdownScan');
      await wait(runtimeRoot,45);
    }
    const show=runtimeRoot?.showShowdownStep;
    if(typeof show!=='function')return;
    show('5장 확정','쇼다운 계산 시작');await wait(runtimeRoot,75);
    show('쇼다운 전 효과','숫자·무늬·슬롯 변경 확정');await wait(runtimeRoot,90);
    show('족보 확정',`나 ${model.player.hand.name} ${model.player.basePower} / 적 ${model.enemy.hand.name} ${model.enemy.basePower}`);await wait(runtimeRoot,110);
    show('덧셈 정산',`나 ${additiveText(model.player)} / 적 ${additiveText(model.enemy)}`);await wait(runtimeRoot,110);
    if(model.player.multipliers.length||model.enemy.multipliers.length){
      show('배율 정산',`나 ${multiplierText(model.player)} / 적 ${multiplierText(model.enemy)}`,'multiplier');await wait(runtimeRoot,120);
    }
    show('최종 위력',`${model.player.finalPower} : ${model.enemy.finalPower}`,'finalPower');await wait(runtimeRoot,180);
  }
  function clearShowdownSequence(runtimeRoot){
    const sequence=runtimeRoot?.document?.getElementById?.('showdownSequence');
    if(sequence){sequence.className='';sequence.innerHTML=''}
  }
  function archiveBreakdown(state,model){
    const snapshot=snapshotBreakdown(model);
    state.showdownBreakdown=snapshot;
    state.lastShowdownBreakdown=snapshot;
    if(!Array.isArray(state.showdownHistory))state.showdownHistory=[];
    state.showdownHistory.push(snapshot);
    if(state.showdownHistory.length>20)state.showdownHistory.splice(0,state.showdownHistory.length-20);
    state.showdownTrace=traceLines(snapshot);
    return snapshot;
  }
  async function resolveRuntimeShowdown(runtimeRoot=defaultRoot){
    const state=activeBattle(runtimeRoot),runState=activeRun(runtimeRoot),core=runtimeRoot?.BattleCore;
    if(!state||!runState||!core)throw new TypeError('Active battle, run, and BattleCore are required');
    if(!Array.isArray(state.slots)||state.slots.length!==5||!Array.isArray(state.enemySlots)||state.enemySlots.length!==5)throw new RangeError('Showdown requires five cards on both sides');
    runtimeRoot.sfx?.('showdown');
    state.phase='showdown';state.showdownVisualStage='scan';
    const advantage=core.resolveShowdownAdvantage?.({playerCards:state.slots,enemyCards:state.enemySlots})||{playerActive:false,enemyActive:false,playerAdvantageCount:0,enemyAdvantageCount:0,multiplier:1.25};
    state.advantage=advantage;
    runtimeRoot.renderBattle?.();

    // 7.5-C: 쇼다운 전 조작을 먼저 끝낸 뒤 족보를 계산한다.
    state.slots.forEach((slot,index)=>runtimeRoot.runCardEffects?.('before_showdown',slot.card,{slotIndex:index,advantage,showdownPhase:'pre_poker'}));
    const resolver=(card,key)=>core.showdownValue(card,key);
    const playerHand=evaluatePoker(state.slots,{valueResolver:resolver}),enemyHand=evaluatePoker(state.enemySlots,{valueResolver:resolver});
    const model=createBreakdown({playerHand,enemyHand,setIndex:state.setIndex});

    const score={value:playerHand.power};
    const slotBonus=numeric(state.slotBonus);
    if(slotBonus){score.value+=slotBonus;addAdditive(model,'player',{id:'slot_bonus',label:'슬롯 보너스',value:slotBonus,source:'battle'})}
    recordScoreTrigger(runtimeRoot,state,model,'on_showdown_advantage',score,advantage);
    recordScoreTrigger(runtimeRoot,state,model,'on_showdown_score',score,advantage);

    // 7.5-A의 임시 어댑터가 마지막 score 호출에서 배율을 적용했다면 되돌리고,
    // 7.5-C의 전용 배율 단계에서 한 번만 다시 계산한다.
    undoLegacyAdvantageScale(state,score);
    const represented=model.player.basePower+model.player.additives.reduce((sum,entry)=>sum+entry.value,0);
    const untracked=numeric(score.value)-represented;
    if(untracked)addAdditive(model,'player',{id:'untracked_additive',label:'기타 덧셈',value:untracked,source:'runtime'});

    addActiveAdvantageMultipliers(runtimeRoot,state,model,advantage);
    finalizeBreakdown(model);
    syncAdvantageDiagnostics(state,model,advantage);
    const archived=archiveBreakdown(state,model);
    if(runtimeRoot?.console?.debug)runtimeRoot.console.debug('[showdown 7.5-C]',archived);

    await animateBreakdown(runtimeRoot,state,model);
    const sequence=runtimeRoot?.document?.getElementById?.('showdownSequence');
    if(model.damage.amount)sequence?.classList?.add?.('impact');
    if(model.damage.target==='enemy'){
      runtimeRoot.damageEnemy?.(model.damage.amount,'showdown');runtimeRoot.flash?.(`적 -${model.damage.amount}`);
    }else if(model.damage.target==='player'){
      runtimeRoot.damagePlayer?.(model.damage.amount,'showdown');runtimeRoot.flash?.(`플레이어 -${model.damage.amount}`);
    }else runtimeRoot.flash?.('동점');

    state.slots.forEach(slot=>runtimeRoot.runCardEffects?.('after_showdown_result',slot.card,{playerWon:model.player.finalPower>model.enemy.finalPower,draw:model.player.finalPower===model.enemy.finalPower,showdownBreakdown:archived}));
    await wait(runtimeRoot,450);
    clearShowdownSequence(runtimeRoot);
    state.slots.forEach(slot=>runtimeRoot.runCardEffects?.('on_set_end',slot.card,{showdownBreakdown:archived}));

    state.slots.forEach(slot=>state.discard.push(slot.card));
    state.enemySlots=[];state.slots=[];
    state.effects=Array.isArray(state.effects)?state.effects.filter(effect=>effect.duration!=='set'):[];
    runtimeRoot.ShowdownAdvantage?.consumeAdvantage?.(state);
    state.advantage=null;state.showdownVisualStage=null;
    state.contractTabooLastResolution=null;state.contractTabooResolvedSet=null;

    if(runState.hp<=0){runtimeRoot.loseRun?.();return archived}
    if(state.enemy?.hp<=0){await runtimeRoot.winBattle?.();return archived}

    state.trick=1;state.setIndex=(state.setIndex||1)+1;state.phase='trick';
    state.setHistory=core.createSetHistory?.()||{trickResults:[],wins:0,losses:0,draws:0};
    state.history=runtimeRoot.CardEffects?.newHistory?.()||{};
    state.playerStage=null;state.selected=null;state.inspectSlot=null;state.inspectStage=null;
    state.mods={paint:false,plus:0,reverse:false,double:false};
    state.trump=runtimeRoot.drawSetTrump?.(state)??state.trump;
    runtimeRoot.drawP?.(state.maxHandSize);
    state.hand?.forEach?.(card=>runtimeRoot.runCardEffects?.('on_set_start',card,{trump:state.trump,setIndex:state.setIndex}));
    runtimeRoot.nextEnemy?.();runtimeRoot.renderBattle?.();
    return archived;
  }
  function wrapPoker(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.poker;
    if(typeof original!=='function'||original.__tricklogShowdown75C)return false;
    function wrapped(entries){
      const core=runtimeRoot?.BattleCore;
      const hand=evaluatePoker(entries,{valueResolver:(card,key)=>core?.showdownValue?core.showdownValue(card,key):showdownValue(card,key)});
      return{name:hand.name,p:hand.power,id:hand.id,power:hand.power,ranks:hand.ranks,suits:hand.suits};
    }
    wrapped.__tricklogShowdown75C=true;wrapped.__original=original;runtimeRoot.poker=wrapped;return true;
  }
  function wrapShowdown(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.showdown;
    if(typeof original!=='function'||original.__tricklogShowdown75C)return false;
    async function wrapped(){return resolveRuntimeShowdown(runtimeRoot)}
    wrapped.__tricklogShowdown75C=true;wrapped.__original=original;runtimeRoot.showdown=wrapped;return true;
  }
  function installBrowser(runtimeRoot=defaultRoot){return{poker:wrapPoker(runtimeRoot),showdown:wrapShowdown(runtimeRoot)}}

  return{
    STAGE,SHOWDOWN_PHASES,POKER_HANDS,
    activeBattle,activeRun,numeric,signed,unwrapCard,showdownValue,evaluatePoker,
    createBreakdown,addAdditive,addMultiplier,finalizeSide,finalizeBreakdown,multiplierText,additiveText,traceLines,snapshotBreakdown,
    cardLabel,advantageExtra,currentContractResolution,recordScoreTrigger,undoLegacyAdvantageScale,addActiveAdvantageMultipliers,syncAdvantageDiagnostics,
    animateBreakdown,archiveBreakdown,resolveRuntimeShowdown,wrapPoker,wrapShowdown,installBrowser
  };
});
