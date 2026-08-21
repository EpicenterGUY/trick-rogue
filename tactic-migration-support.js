(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.TacticMigrationSupport=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STAGE='3-2A';
  const STATE_KEY='tacticMigrationSupport';
  const TARGET_ZONE_HAND='hand';
  const SUPPORTED_REQUIREMENTS=Object.freeze({
    temporary_hand_capacity:'grant_next_trick_hand_capacity',
    post_refill_draw:'grant_next_trick_hand_capacity',
    secondary_hand_target:'targeting.hand',
    next_enemy_preview_ui:'reveal_next_enemy_card',
    advantage_count_condition:'advantage_count_at_least',
    unmodified_trick_value_condition:'unmodified_trick_value',
    printed_equals_trick_condition:'printed_equals_trick'
  });

  function positiveInteger(value,label='value'){
    if(!Number.isInteger(value)||value<1)throw new TypeError(`${label} must be a positive integer`);
    return value;
  }
  function normalizeTurn(value={}){
    const set=value.set??value.setIndex;
    const trick=value.trick;
    if(!Number.isInteger(set)||set<1)throw new TypeError('set must be a positive integer');
    if(!Number.isInteger(trick)||trick<1||trick>5)throw new TypeError('trick must be an integer from 1 to 5');
    return{set,trick};
  }
  function nextTurn(value){
    const turn=normalizeTurn(value);
    return turn.trick===5?{set:turn.set+1,trick:1}:{set:turn.set,trick:turn.trick+1};
  }
  function turnKey(value){const turn=normalizeTurn(value);return`${turn.set}:${turn.trick}`}
  function compareTurns(a,b){
    const left=normalizeTurn(a),right=normalizeTurn(b);
    return left.set===right.set?left.trick-right.trick:left.set-right.set;
  }
  function ensureState(battle){
    if(!battle||typeof battle!=='object')throw new TypeError('battle state is required');
    if(!battle[STATE_KEY]||typeof battle[STATE_KEY]!=='object'){
      battle[STATE_KEY]={handCapacity:[],postRefillDraws:[],secondaryTarget:null,revealNextEnemyPreview:false};
    }
    const state=battle[STATE_KEY];
    if(!Array.isArray(state.handCapacity))state.handCapacity=[];
    if(!Array.isArray(state.postRefillDraws))state.postRefillDraws=[];
    if(!('secondaryTarget' in state))state.secondaryTarget=null;
    if(!('revealNextEnemyPreview' in state))state.revealNextEnemyPreview=false;
    return state;
  }
  function currentTurn(battle){return normalizeTurn({set:battle?.setIndex,trick:battle?.trick})}
  function grantNextTrickHandCapacity(battle,amount=1,fromTurn=currentTurn(battle)){
    positiveInteger(amount,'hand capacity amount');
    const target=nextTurn(fromTurn),state=ensureState(battle),entry={amount,targetSet:target.set,targetTrick:target.trick};
    state.handCapacity.push(entry);
    state.postRefillDraws.push({count:amount,targetSet:target.set,targetTrick:target.trick});
    return Object.freeze({...entry});
  }
  function matchesTurn(entry,turn){return entry.targetSet===turn.set&&entry.targetTrick===turn.trick}
  function effectiveHandCapacity(battle,turn=currentTurn(battle)){
    const normalized=normalizeTurn(turn),base=Number.isInteger(battle?.maxHandSize)?battle.maxHandSize:3;
    const bonus=ensureState(battle).handCapacity.filter(entry=>matchesTurn(entry,normalized)).reduce((sum,entry)=>sum+entry.amount,0);
    return base+bonus;
  }
  function queuedPostRefillDraw(battle,turn=currentTurn(battle)){
    const normalized=normalizeTurn(turn);
    return ensureState(battle).postRefillDraws.filter(entry=>matchesTurn(entry,normalized)).reduce((sum,entry)=>sum+entry.count,0);
  }
  function consumePostRefillDraw(battle,turn=currentTurn(battle)){
    const normalized=normalizeTurn(turn),state=ensureState(battle);let count=0;
    state.postRefillDraws=state.postRefillDraws.filter(entry=>{if(matchesTurn(entry,normalized)){count+=entry.count;return false}return true});
    return count;
  }
  function pruneTurnSupport(battle,turn=currentTurn(battle)){
    const normalized=normalizeTurn(turn),state=ensureState(battle);
    state.handCapacity=state.handCapacity.filter(entry=>compareTurns({set:entry.targetSet,trick:entry.targetTrick},normalized)>=0);
    state.postRefillDraws=state.postRefillDraws.filter(entry=>compareTurns({set:entry.targetSet,trick:entry.targetTrick},normalized)>=0);
    return state;
  }

  function secondaryTargetRequirement(card){
    const raw=card?.targeting??card?.definition?.targeting??null;
    if(!raw)return null;
    if(raw.zone!==TARGET_ZONE_HAND)throw new TypeError(`Unsupported secondary target zone: ${raw.zone}`);
    const count=raw.count??1;
    if(count!==1)throw new TypeError('Only one secondary hand target is supported in 3-2A');
    return Object.freeze({zone:TARGET_ZONE_HAND,count:1,excludeSelf:raw.excludeSelf!==false});
  }
  function beginSecondaryHandTarget(battle,source,requirement=secondaryTargetRequirement(source)){
    if(!requirement)return null;
    const state=ensureState(battle),sourceUid=typeof source==='string'?source:source?.uid;
    if(!sourceUid)throw new TypeError('secondary target source requires uid');
    state.secondaryTarget={sourceUid,zone:requirement.zone,count:1,excludeSelf:requirement.excludeSelf,selectedUid:null};
    return state.secondaryTarget;
  }
  function selectSecondaryHandTarget(battle,uid,hand=battle?.hand){
    const state=ensureState(battle),pending=state.secondaryTarget;
    if(!pending)throw new TypeError('No secondary target request is active');
    if(!Array.isArray(hand))throw new TypeError('hand must be an array');
    if(pending.excludeSelf&&uid===pending.sourceUid)throw new TypeError('Source card cannot target itself');
    const target=hand.find(card=>card?.uid===uid);
    if(!target)throw new TypeError('Secondary target must be in hand');
    pending.selectedUid=uid;
    return target;
  }
  function secondaryTargetCard(battle,hand=battle?.hand){
    const pending=ensureState(battle).secondaryTarget;
    if(!pending?.selectedUid||!Array.isArray(hand))return null;
    return hand.find(card=>card?.uid===pending.selectedUid)||null;
  }
  function clearSecondaryHandTarget(battle){const state=ensureState(battle),previous=state.secondaryTarget;state.secondaryTarget=null;return previous}
  function consumeSecondaryHandTarget(battle,hand=battle?.hand){const target=secondaryTargetCard(battle,hand);clearSecondaryHandTarget(battle);return target}

  function revealNextEnemyPreview(battle){ensureState(battle).revealNextEnemyPreview=true;return battle?.nextEnemyPreview||null}
  function isNextEnemyPreviewRevealed(battle){return ensureState(battle).revealNextEnemyPreview===true}
  function consumeNextEnemyPreviewReveal(battle){const state=ensureState(battle),was=state.revealNextEnemyPreview===true;state.revealNextEnemyPreview=false;return was}

  function activeBattle(root,context={}){
    if(context?.battle)return context.battle;
    if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined')return battle}catch{}
    return null;
  }
  function feedback(root,text,tone='cyan'){
    try{if(typeof root?.floatText==='function'&&root?.arena)root.floatText(root.arena,text,tone);else if(typeof floatText==='function'&&typeof arena!=='undefined')floatText(arena,text,tone)}catch{}
  }
  function render(root){try{if(typeof root?.renderBattle==='function')root.renderBattle();else if(typeof renderBattle==='function')renderBattle()}catch{}}

  function installActionHandlers(root){
    const CardEffects=root?.CardEffects;if(!CardEffects?.registerActionHandler)return false;
    if(!CardEffects.actionHandlers.draw_cards)CardEffects.registerActionHandler('draw_cards',(context,value)=>{
      const b=activeBattle(root,context),draw=root?.drawP||(typeof drawP==='function'?drawP:null);
      if(!b||typeof draw!=='function')throw new TypeError('draw_cards requires an active battle draw function');
      draw(Math.max(1,Number(value)||1));
    });
    if(!CardEffects.actionHandlers.grant_next_trick_hand_capacity)CardEffects.registerActionHandler('grant_next_trick_hand_capacity',(context,value)=>{
      const b=activeBattle(root,context);if(!b)throw new TypeError('grant_next_trick_hand_capacity requires an active battle');
      grantNextTrickHandCapacity(b,Math.max(1,Number(value)||1));
    });
    if(!CardEffects.actionHandlers.reveal_next_enemy_card)CardEffects.registerActionHandler('reveal_next_enemy_card',(context)=>{
      const b=activeBattle(root,context);if(!b)throw new TypeError('reveal_next_enemy_card requires an active battle');
      revealNextEnemyPreview(b);
    });
    if(!CardEffects.actionHandlers.discard_secondary_target)CardEffects.registerActionHandler('discard_secondary_target',(context)=>{
      const b=activeBattle(root,context);if(!b)throw new TypeError('discard_secondary_target requires an active battle');
      const target=context?.secondaryTargetCard||secondaryTargetCard(b,b.hand);
      if(!target)throw new TypeError('discard_secondary_target requires a selected hand target');
      const index=b.hand.findIndex(card=>card.uid===target.uid);if(index<0)throw new TypeError('secondary target left hand before resolution');
      b.discard.push(b.hand.splice(index,1)[0]);
    });
    return true;
  }
  function installDrawAdapter(root){
    if(typeof root?.drawP!=='function')return false;
    if(root.drawP.__tacticMigrationSupport)return true;
    const legacy=root.drawP;
    const wrapped=function(n=1){
      const b=activeBattle(root);if(!b)return legacy.apply(this,arguments);
      const isRefill=Number(n)===b.maxHandSize;
      let target=currentTurn(b);
      if(isRefill&&Array.isArray(b.slots)&&b.slots.length>0&&b.slots.length<5)target=nextTurn(target);
      const originalMax=b.maxHandSize,limit=effectiveHandCapacity(b,target),queued=isRefill?queuedPostRefillDraw(b,target):0;
      b.maxHandSize=limit;
      try{return legacy.call(this,(Number(n)||1)+queued)}finally{b.maxHandSize=originalMax;if(isRefill)consumePostRefillDraw(b,target)}
    };
    wrapped.__tacticMigrationSupport=true;wrapped.__legacyDrawP=legacy;root.drawP=wrapped;return true;
  }
  function installForecastAdapter(root){
    if(typeof root?.forecastText!=='function')return false;
    if(root.forecastText.__tacticMigrationSupport)return true;
    const legacy=root.forecastText;
    const wrapped=function(target){
      const b=activeBattle(root);
      if(target==='enemy'&&b&&isNextEnemyPreviewRevealed(b)&&b.nextEnemyPreview){
        const c=b.nextEnemyPreview;
        try{
          const suit=(root.suitObj||suitObj)(c.suit).sym,rank=(root.rankLabel||rankLabel)(c.rank);
          return`${suit}${rank}`;
        }catch{return`${c.suit}${c.rank}`}
      }
      return legacy.apply(this,arguments);
    };
    wrapped.__tacticMigrationSupport=true;wrapped.__legacyForecastText=legacy;root.forecastText=wrapped;return true;
  }
  function installNextEnemyAdapter(root){
    if(typeof root?.nextEnemy!=='function')return false;
    if(root.nextEnemy.__tacticMigrationSupport)return true;
    const legacy=root.nextEnemy;
    const wrapped=function(){
      const b=activeBattle(root),clear=b&&isNextEnemyPreviewRevealed(b);
      const result=legacy.apply(this,arguments);
      if(b){if(clear)consumeNextEnemyPreviewReveal(b);pruneTurnSupport(b,currentTurn(b))}
      return result;
    };
    wrapped.__tacticMigrationSupport=true;wrapped.__legacyNextEnemy=legacy;root.nextEnemy=wrapped;return true;
  }
  function installEffectContextAdapter(root){
    if(typeof root?.effectContext!=='function')return false;
    if(root.effectContext.__tacticMigrationSupport)return true;
    const legacy=root.effectContext;
    const wrapped=function(card,extra={}){
      const b=activeBattle(root),context=legacy.call(this,card,extra);
      if(!b)return context;
      const target=secondaryTargetCard(b,b.hand);
      return{...context,battle:b,secondaryTargetCard:target,secondaryTargetUid:target?.uid||null};
    };
    wrapped.__tacticMigrationSupport=true;wrapped.__legacyEffectContext=legacy;root.effectContext=wrapped;return true;
  }
  function installSecondaryTargetAdapters(root){
    if(typeof root?.selectCard!=='function'||typeof root?.playSelected!=='function')return false;
    if(!root.selectCard.__tacticMigrationSupport){
      const legacySelect=root.selectCard;
      const wrappedSelect=function(uid){
        const b=activeBattle(root),pending=b?ensureState(b).secondaryTarget:null;
        if(pending&&b.selected===pending.sourceUid&&uid!==pending.sourceUid){
          try{selectSecondaryHandTarget(b,uid,b.hand);feedback(root,'추가 대상 선택','cyan');render(root)}catch(error){feedback(root,error.message,'red')}
          return;
        }
        if(pending&&uid===pending.sourceUid)clearSecondaryHandTarget(b);
        return legacySelect.apply(this,arguments);
      };
      wrappedSelect.__tacticMigrationSupport=true;wrappedSelect.__legacySelectCard=legacySelect;root.selectCard=wrappedSelect;
    }
    if(!root.playSelected.__tacticMigrationSupport){
      const legacyPlay=root.playSelected;
      const wrappedPlay=async function(){
        const b=activeBattle(root),card=b?.hand?.find(entry=>entry.uid===b.selected),requirement=secondaryTargetRequirement(card);
        if(requirement){
          let pending=ensureState(b).secondaryTarget;
          if(!pending||pending.sourceUid!==card.uid){pending=beginSecondaryHandTarget(b,card,requirement);feedback(root,'이 카드 외 손패 1장 선택','cyan');render(root);return}
          if(!secondaryTargetCard(b,b.hand)){feedback(root,'이 카드 외 손패 1장 선택','cyan');return}
        }
        try{return await legacyPlay.apply(this,arguments)}finally{if(b&&requirement)clearSecondaryHandTarget(b)}
      };
      wrappedPlay.__tacticMigrationSupport=true;wrappedPlay.__legacyPlaySelected=legacyPlay;root.playSelected=wrappedPlay;
    }
    return true;
  }
  function installBrowserRuntime(root){
    const ok=installActionHandlers(root);
    if(!ok)return false;
    const adapters=[installDrawAdapter,installForecastAdapter,installNextEnemyAdapter,installEffectContextAdapter,installSecondaryTargetAdapters];
    return adapters.every(install=>install(root));
  }
  function installWhenReady(root){
    if(typeof document==='undefined')return false;
    let attempts=0;
    const attempt=()=>{
      if(installBrowserRuntime(root))return;
      attempts++;
      if(attempts<40)setTimeout(attempt,25);else console.warn('[tactic-migration-support] 전투 런타임을 찾지 못했습니다.');
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);
    return true;
  }

  return{STAGE,STATE_KEY,TARGET_ZONE_HAND,SUPPORTED_REQUIREMENTS,normalizeTurn,nextTurn,turnKey,compareTurns,ensureState,currentTurn,grantNextTrickHandCapacity,effectiveHandCapacity,queuedPostRefillDraw,consumePostRefillDraw,pruneTurnSupport,secondaryTargetRequirement,beginSecondaryHandTarget,selectSecondaryHandTarget,secondaryTargetCard,clearSecondaryHandTarget,consumeSecondaryHandTarget,revealNextEnemyPreview,isNextEnemyPreviewRevealed,consumeNextEnemyPreviewReveal,installActionHandlers,installDrawAdapter,installForecastAdapter,installNextEnemyAdapter,installEffectContextAdapter,installSecondaryTargetAdapters,installBrowserRuntime,installWhenReady};
});