(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{
    root.ChipEconomy=api;
    api.installBrowser(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='7.5-B';
  const CHIP_CAP=5;
  const TRICK_WIN_REWARD=1;
  const HAND_EXCHANGE_COST=2;

  function activeBattle(runtimeRoot=defaultRoot){
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }

  function clampChips(value){
    const numeric=Number(value);
    if(!Number.isFinite(numeric))return 0;
    return Math.max(0,Math.min(CHIP_CAP,Math.floor(numeric)));
  }

  function cardKey(card){return card?.uid??card?.id??null}

  function ensureChipState(state,{initialBalance}={}){
    if(!state||typeof state!=='object')return null;
    if(!state.chipEconomy||typeof state.chipEconomy!=='object'){
      state.chipEconomy={
        balance:clampChips(initialBalance??state.chip??0),
        lastBaseWinKey:null,
        exchanges:0
      };
    }
    state.chipEconomy.balance=clampChips(state.chipEconomy.balance);
    state.maxChip=CHIP_CAP;
    state.chip=state.chipEconomy.balance;
    return state.chipEconomy;
  }

  function initializeBattleChipState(state,{balance=0}={}){
    if(!state||typeof state!=='object')throw new TypeError('A battle state is required');
    state.chipEconomy={balance:clampChips(balance),lastBaseWinKey:null,exchanges:0};
    state.maxChip=CHIP_CAP;
    state.chip=state.chipEconomy.balance;
    return state.chipEconomy;
  }

  function trickKey(state,context={}){
    const setIndex=context.setIndex??context.set??state?.setIndex??state?.set??1;
    const trick=context.trick??context.trickIndex??state?.trick??state?.trickIndex??1;
    return`${setIndex}:${trick}`;
  }

  function grantChips(state,amount,{source='effect'}={}){
    const economy=ensureChipState(state);
    if(!economy)throw new TypeError('A battle state is required');
    const requested=Math.max(0,Math.floor(Number(amount)||0));
    const before=economy.balance;
    economy.balance=clampChips(before+requested);
    state.chip=economy.balance;
    return{source,requested,before,after:economy.balance,gained:economy.balance-before,cap:CHIP_CAP};
  }

  function spendChips(state,amount,{recordHistory=true}={}){
    const economy=ensureChipState(state);
    if(!economy)throw new TypeError('A battle state is required');
    const cost=Math.max(0,Math.floor(Number(amount)||0));
    if(economy.balance<cost)return{ok:false,cost,before:economy.balance,after:economy.balance,spent:0};
    const before=economy.balance;
    economy.balance-=cost;
    state.chip=economy.balance;
    if(recordHistory){
      if(!state.history||typeof state.history!=='object')state.history={};
      state.history.chipsSpent=(Number(state.history.chipsSpent)||0)+cost;
    }
    return{ok:true,cost,before,after:economy.balance,spent:cost};
  }

  function rewardTrickWin(state,context={}){
    const economy=ensureChipState(state);
    if(!economy)throw new TypeError('A battle state is required');
    const key=trickKey(state,context);
    if(economy.lastBaseWinKey===key)return{source:'trick_win',requested:TRICK_WIN_REWARD,before:economy.balance,after:economy.balance,gained:0,duplicate:true,cap:CHIP_CAP};
    economy.lastBaseWinKey=key;
    return{...grantChips(state,TRICK_WIN_REWARD,{source:'trick_win'}),duplicate:false};
  }

  function exchangeAvailability(state,uid){
    const economy=ensureChipState(state);
    if(!state||!economy)return{ok:false,reason:'no_battle'};
    if(state.phase&&state.phase!=='trick')return{ok:false,reason:'not_trick'};
    if(state.animating)return{ok:false,reason:'animating'};
    if(economy.balance<HAND_EXCHANGE_COST)return{ok:false,reason:'not_enough_chips'};
    if(!Array.isArray(state.hand))return{ok:false,reason:'no_hand'};
    const index=state.hand.findIndex(card=>cardKey(card)===uid);
    if(index<0)return{ok:false,reason:'no_selection'};
    const replacements=(Array.isArray(state.deck)?state.deck.length:0)+(Array.isArray(state.discard)?state.discard.length:0);
    if(replacements<1)return{ok:false,reason:'no_replacement'};
    return{ok:true,index,card:state.hand[index]};
  }

  function recycleDiscard(state,shuffleFn){
    if(state.deck.length||!state.discard.length)return false;
    const pool=state.discard.splice(0);
    const shuffled=typeof shuffleFn==='function'?shuffleFn(pool):pool;
    state.deck.push(...(Array.isArray(shuffled)?shuffled:pool));
    return true;
  }

  function exchangeHandCard(state,uid,{shuffle}={}){
    const availability=exchangeAvailability(state,uid);
    if(!availability.ok)return availability;
    if(!Array.isArray(state.deck))state.deck=[];
    if(!Array.isArray(state.discard))state.discard=[];

    const outgoing=state.hand.splice(availability.index,1)[0];
    recycleDiscard(state,shuffle);
    const incoming=state.deck.pop();
    if(!incoming){
      state.hand.splice(availability.index,0,outgoing);
      return{ok:false,reason:'no_replacement'};
    }

    const payment=spendChips(state,HAND_EXCHANGE_COST,{recordHistory:true});
    if(!payment.ok){
      state.deck.push(incoming);
      state.hand.splice(availability.index,0,outgoing);
      return{ok:false,reason:'not_enough_chips'};
    }

    state.hand.splice(availability.index,0,incoming);
    state.discard.push(outgoing);
    if(!state.history||typeof state.history!=='object')state.history={};
    state.history.cardsDrawn=(Number(state.history.cardsDrawn)||0)+1;
    const economy=ensureChipState(state);
    economy.exchanges=(Number(economy.exchanges)||0)+1;
    if(state.selected===uid)state.selected=null;
    state.inspectSlot=null;
    state.inspectStage=null;
    return{ok:true,cost:HAND_EXCHANGE_COST,discarded:outgoing,drawn:incoming,balance:economy.balance};
  }

  function reasonText(reason){
    if(reason==='not_enough_chips')return`칩 ${HAND_EXCHANGE_COST}개가 필요하다.`;
    if(reason==='no_selection')return'교환할 손패 카드를 먼저 선택한다.';
    if(reason==='no_replacement')return'덱과 버림 더미에 교환할 카드가 없다.';
    if(reason==='animating')return'카드 처리 중에는 교환할 수 없다.';
    if(reason==='not_trick')return'트릭 선택 단계에서만 교환할 수 있다.';
    return'현재는 손패를 교환할 수 없다.';
  }

  function presentGain(runtimeRoot,result,label='칩'){
    if(!result?.gained)return result;
    const doc=runtimeRoot?.document;
    const arena=doc?.getElementById?.('arena');
    if(typeof runtimeRoot?.floatText==='function'&&arena)runtimeRoot.floatText(arena,`${label} +${result.gained}`,'gold');
    return result;
  }

  function ensureExchangeStyle(runtimeRoot=defaultRoot){
    const doc=runtimeRoot?.document;
    if(!doc?.createElement||doc.getElementById?.('trick-chip-economy-style'))return false;
    const style=doc.createElement('style');
    style.id='trick-chip-economy-style';
    style.textContent=`
#handPanel .panelTitle{gap:6px}
#exchangeBtn{margin-left:auto;min-width:0;padding:3px 6px;font-size:9px;line-height:1.1;white-space:nowrap}
#exchangeBtn:disabled{opacity:.45;filter:grayscale(.25)}
#drawInfo{margin-left:0;white-space:nowrap}
@media(max-width:899px){#exchangeBtn{padding:2px 5px;font-size:8px}}
`;
    (doc.head||doc.documentElement)?.appendChild?.(style);
    return true;
  }

  function ensureExchangeButton(runtimeRoot=defaultRoot){
    const doc=runtimeRoot?.document;
    if(!doc?.createElement)return null;
    const existing=doc.getElementById?.('exchangeBtn');
    if(existing)return existing;
    const handPanel=doc.getElementById?.('handPanel');
    const title=handPanel?.querySelector?.('.panelTitle')||doc.querySelector?.('#handPanel .panelTitle');
    if(!title)return null;
    const button=doc.createElement('button');
    button.id='exchangeBtn';
    button.type='button';
    button.className='pixelBtn gold';
    button.textContent=`교환 ${HAND_EXCHANGE_COST}칩`;
    button.addEventListener?.('click',event=>{event?.preventDefault?.();exchangeSelected(runtimeRoot)});
    const drawInfo=doc.getElementById?.('drawInfo');
    if(drawInfo?.parentElement===title)title.insertBefore(button,drawInfo);else title.appendChild(button);
    return button;
  }

  function syncExchangeButton(runtimeRoot=defaultRoot){
    ensureExchangeStyle(runtimeRoot);
    const button=ensureExchangeButton(runtimeRoot);
    if(!button)return false;
    const state=activeBattle(runtimeRoot);
    if(!state){button.disabled=true;button.title='전투 중에 사용할 수 있다.';return false}
    const economy=ensureChipState(state);
    const availability=exchangeAvailability(state,state.selected);
    button.textContent=`교환 ${HAND_EXCHANGE_COST}칩`;
    button.disabled=!availability.ok;
    button.title=availability.ok?'선택한 손패 1장을 버리고 카드 1장을 뽑는다.':reasonText(availability.reason);
    const chipText=runtimeRoot?.document?.getElementById?.('chipText');
    if(chipText)chipText.title=`트릭 승리 +${TRICK_WIN_REWARD} · 최대 ${CHIP_CAP} · 손패 교환 ${HAND_EXCHANGE_COST}칩`;
    return availability.ok&&economy.balance>=HAND_EXCHANGE_COST;
  }

  function exchangeSelected(runtimeRoot=defaultRoot){
    const state=activeBattle(runtimeRoot);
    if(!state)return{ok:false,reason:'no_battle'};
    const result=exchangeHandCard(state,state.selected,{shuffle:cards=>typeof runtimeRoot?.shuffle==='function'?runtimeRoot.shuffle(cards):cards});
    if(!result.ok){syncExchangeButton(runtimeRoot);return result}
    if(typeof runtimeRoot?.sfx==='function')runtimeRoot.sfx('click');
    if(typeof runtimeRoot?.flash==='function')runtimeRoot.flash(`손패 교환 · 칩 -${HAND_EXCHANGE_COST}`);
    const arena=runtimeRoot?.document?.getElementById?.('arena');
    if(typeof runtimeRoot?.floatText==='function'&&arena)runtimeRoot.floatText(arena,`칩 -${HAND_EXCHANGE_COST}`,'gold');
    if(typeof runtimeRoot?.renderBattle==='function')runtimeRoot.renderBattle();
    return result;
  }

  function prepareRuntimeState(runtimeRoot=defaultRoot){
    const state=activeBattle(runtimeRoot);
    if(!state)return null;
    if(runtimeRoot?.__tricklogChipBattleStarting&&!state.chipEconomy)return initializeBattleChipState(state,{balance:0});
    return ensureChipState(state);
  }

  function installGainChipHandler(runtimeRoot=defaultRoot){
    const effects=runtimeRoot?.CardEffects;
    if(!effects||typeof effects.registerActionHandler!=='function'||runtimeRoot.__tricklogChipGainHandler)return false;
    const handler=(context,value,effect={})=>{
      const state=activeBattle(runtimeRoot);
      if(!state)return;
      if(runtimeRoot.__tricklogChipBattleStarting&&!state.chipEconomy)initializeBattleChipState(state,{balance:0});
      const result=grantChips(state,value,{source:effect?.source||context?.ownerId||'effect'});
      presentGain(runtimeRoot,result,'칩');
      syncExchangeButton(runtimeRoot);
      return result;
    };
    effects.registerActionHandler('gain_chips',handler);
    runtimeRoot.__tricklogChipGainHandler=handler;
    return true;
  }

  function wrapStartBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.startBattle;
    if(typeof original!=='function'||original.__tricklogChipEconomy75B)return false;
    function wrapped(){
      runtimeRoot.__tricklogChipBattleStarting=true;
      try{
        const result=original.apply(this,arguments);
        const state=activeBattle(runtimeRoot);
        if(state&&!state.chipEconomy)initializeBattleChipState(state,{balance:0});
        else if(state)ensureChipState(state);
        if(typeof runtimeRoot.renderBattle==='function')runtimeRoot.renderBattle();
        return result;
      }finally{runtimeRoot.__tricklogChipBattleStarting=false}
    }
    wrapped.__tricklogChipEconomy75B=true;
    wrapped.__original=original;
    runtimeRoot.startBattle=wrapped;
    return true;
  }

  function wrapRunCardEffects(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.runCardEffects;
    if(typeof original!=='function'||original.__tricklogChipEconomy75B)return false;
    function wrapped(trigger,card,extra={}){
      const state=activeBattle(runtimeRoot);
      prepareRuntimeState(runtimeRoot);
      if(trigger==='on_trick_win'&&state&&(extra?.result===undefined||Number(extra.result)>0)){
        const reward=rewardTrickWin(state,{setIndex:state.setIndex,trick:state.trick??state.trickIndex});
        presentGain(runtimeRoot,reward,'승리 칩');
      }
      const result=original.apply(this,arguments);
      if(state)ensureChipState(state);
      syncExchangeButton(runtimeRoot);
      return result;
    }
    wrapped.__tricklogChipEconomy75B=true;
    wrapped.__original=original;
    runtimeRoot.runCardEffects=wrapped;
    return true;
  }

  function wrapRenderBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.renderBattle;
    if(typeof original!=='function'||original.__tricklogChipEconomy75B)return false;
    function wrapped(){
      prepareRuntimeState(runtimeRoot);
      const result=original.apply(this,arguments);
      syncExchangeButton(runtimeRoot);
      return result;
    }
    wrapped.__tricklogChipEconomy75B=true;
    wrapped.__original=original;
    runtimeRoot.renderBattle=wrapped;
    return true;
  }

  function installBrowser(runtimeRoot=defaultRoot){
    const installed={
      chipHandler:installGainChipHandler(runtimeRoot),
      startBattle:wrapStartBattle(runtimeRoot),
      runCardEffects:wrapRunCardEffects(runtimeRoot),
      renderBattle:wrapRenderBattle(runtimeRoot)
    };
    ensureExchangeStyle(runtimeRoot);
    syncExchangeButton(runtimeRoot);
    return installed;
  }

  return{
    STAGE,CHIP_CAP,TRICK_WIN_REWARD,HAND_EXCHANGE_COST,
    activeBattle,clampChips,cardKey,ensureChipState,initializeBattleChipState,trickKey,
    grantChips,spendChips,rewardTrickWin,exchangeAvailability,recycleDiscard,exchangeHandCard,reasonText,
    presentGain,ensureExchangeStyle,ensureExchangeButton,syncExchangeButton,exchangeSelected,prepareRuntimeState,
    installGainChipHandler,wrapStartBattle,wrapRunCardEffects,wrapRenderBattle,installBrowser
  };
});
