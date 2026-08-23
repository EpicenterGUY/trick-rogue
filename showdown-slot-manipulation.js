(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined')module.exports=api;
  root.ShowdownSlotManipulation=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STAGE='8-D';
  const STATE_KEY='showdownSlotManipulation';
  const OPERATIONS=Object.freeze(['move','withdraw','exchange','discard_replace']);
  const EFFECT_ACTIONS=Object.freeze({
    move:'move_showdown_slots',
    withdraw:'withdraw_showdown_card',
    exchange:'exchange_showdown_card',
    discardReplace:'discard_replace_showdown_card',
    shackle:'shackle_showdown_card'
  });
  const DEFAULT_SHACKLE_BLOCKS=Object.freeze(['move','withdraw','exchange']);
  const DEFAULT_HISTORY_LIMIT=40;

  function slotCard(entry){return entry?.card??entry??null}
  function cardUid(card){return card?.uid??card?.instanceId??card?.metadata?.uid??null}
  function setNumber(battle){return Number.isInteger(battle?.setIndex)&&battle.setIndex>0?battle.setIndex:1}
  function ensureBattle(battle){
    if(!battle||typeof battle!=='object')throw new TypeError('battle state is required');
    if(!Array.isArray(battle.slots))battle.slots=[];
    if(!Array.isArray(battle.hand))battle.hand=[];
    if(!Array.isArray(battle.discard))battle.discard=[];
    return battle;
  }
  function ensureState(battle){
    ensureBattle(battle);
    const currentSet=setNumber(battle);
    let state=battle[STATE_KEY];
    if(!state||typeof state!=='object')state=battle[STATE_KEY]={setIndex:currentSet,locks:[],history:[]};
    if(!Array.isArray(state.locks))state.locks=[];
    if(!Array.isArray(state.history))state.history=[];
    if(state.setIndex!==currentSet){state.setIndex=currentSet;state.locks=[];}
    return state;
  }
  function normalizeSlot(slot,battle,{allowFuture=false}={}){
    const value=Number(slot);
    if(!Number.isInteger(value)||value<1||value>5)return null;
    if(!allowFuture&&value>ensureBattle(battle).slots.length)return null;
    return value;
  }
  function resolveSlotRef(ref,context={},battle=context?.battle){
    if(ref==='self')return Number.isInteger(context?.slotIndex)?context.slotIndex+1:null;
    if(ref==='last')return ensureBattle(battle).slots.length||null;
    return normalizeSlot(ref,battle);
  }
  function slotEntry(battle,slot){
    const normalized=normalizeSlot(slot,battle);return normalized?battle.slots[normalized-1]:null;
  }
  function showdownCardUids(battle){return ensureBattle(battle).slots.map(slotCard).map(cardUid).filter(Boolean)}
  function findSlotByUid(battle,uid){
    if(!uid)return null;
    const index=ensureBattle(battle).slots.findIndex(entry=>cardUid(slotCard(entry))===uid);
    return index<0?null:index+1;
  }
  function removeLockForUid(battle,uid){
    if(!uid)return false;const state=ensureState(battle),before=state.locks.length;
    state.locks=state.locks.filter(lock=>lock.cardUid!==uid);return state.locks.length!==before;
  }
  function lockForCard(battle,card){
    const uid=cardUid(card);if(!uid)return null;
    return ensureState(battle).locks.find(lock=>lock.cardUid===uid)||null;
  }
  function operationBlock(battle,operation,cards){
    for(const card of cards.filter(Boolean)){
      const lock=lockForCard(battle,card);
      if(lock&&lock.blockedOperations.includes(operation))return{operation,cardUid:cardUid(card),label:lock.label,sourceId:lock.sourceId||null};
    }
    return null;
  }
  function record(battle,action,data={}){
    const state=ensureState(battle),entry={step:state.history.length+1,setIndex:setNumber(battle),action,...data};
    state.history.push(entry);if(state.history.length>DEFAULT_HISTORY_LIMIT)state.history.splice(0,state.history.length-DEFAULT_HISTORY_LIMIT);
    return entry;
  }
  function ok(action,data={}){return{ok:true,stage:STAGE,action,...data}}
  function fail(action,reason,data={}){return{ok:false,stage:STAGE,action,reason,...data}}

  function applyShackle(battle,slot,{label='족쇄',blockedOperations=DEFAULT_SHACKLE_BLOCKS,sourceId=null}={}){
    ensureState(battle);const normalized=normalizeSlot(slot,battle);if(!normalized)return fail('shackle','invalid_slot',{slot});
    const card=slotCard(slotEntry(battle,normalized)),uid=cardUid(card);if(!card||!uid)return fail('shackle','missing_card',{slot:normalized});
    const blocked=[...new Set(blockedOperations)].filter(operation=>OPERATIONS.includes(operation));
    if(!blocked.length)return fail('shackle','no_blocked_operations',{slot:normalized});
    const state=ensureState(battle),existing=state.locks.find(lock=>lock.cardUid===uid);
    if(existing){existing.label=label;existing.blockedOperations=blocked;existing.sourceId=sourceId;return ok('shackle',{slot:normalized,cardUid:uid,lock:existing,updated:true});}
    const lock={cardUid:uid,label,blockedOperations:blocked,sourceId};state.locks.push(lock);
    record(battle,'shackle',{slot:normalized,cardUid:uid,label,blockedOperations:[...blocked],sourceId});
    return ok('shackle',{slot:normalized,cardUid:uid,lock,updated:false});
  }
  function isShackled(battle,slot){
    const entry=slotEntry(battle,slot);return!!entry&&!!lockForCard(battle,slotCard(entry));
  }
  function clearSetLocks(battle){const state=ensureState(battle),count=state.locks.length;state.locks=[];return count}

  function moveShowdownSlots(battle,fromSlot,toSlot,{sourceId=null}={}){
    ensureState(battle);const from=normalizeSlot(fromSlot,battle),to=normalizeSlot(toSlot,battle);
    if(!from||!to)return fail('move','invalid_slot',{fromSlot,toSlot});
    if(from===to)return fail('move','same_slot',{fromSlot:from,toSlot:to});
    const first=battle.slots[from-1],second=battle.slots[to-1],block=operationBlock(battle,'move',[slotCard(first),slotCard(second)]);
    if(block)return fail('move','blocked',{fromSlot:from,toSlot:to,block});
    battle.slots[from-1]=second;battle.slots[to-1]=first;
    record(battle,'move',{fromSlot:from,toSlot:to,sourceId});
    return ok('move',{fromSlot:from,toSlot:to,sourceId});
  }

  function replacementDescriptor(battle,{replacementCard=null,replacementEntry=null,replacementUid=null}={}){
    const hand=ensureBattle(battle).hand;
    let entry=replacementEntry||null,card=slotCard(entry)||replacementCard||null,handIndex=-1;
    if(replacementUid){handIndex=hand.findIndex(item=>cardUid(item)===replacementUid);if(handIndex<0)return{error:'replacement_not_in_hand'};card=hand[handIndex];entry={card,result:null};}
    if(!card)return{error:'missing_replacement'};
    const uid=cardUid(card);if(uid&&showdownCardUids(battle).includes(uid))return{error:'replacement_already_slotted'};
    if(handIndex<0&&uid)handIndex=hand.findIndex(item=>cardUid(item)===uid);
    return{entry:entry||{card,result:null},card,uid,handIndex};
  }
  function replaceSlotEntry(original,replacement){
    if(replacement&&Object.prototype.hasOwnProperty.call(replacement,'card'))return{...original,...replacement,card:replacement.card,result:replacement.result??original?.result??null};
    return{...original,card:slotCard(replacement),result:original?.result??null};
  }

  function withdrawShowdownCard(battle,slot,{replacementCard=null,replacementEntry=null,replacementUid=null,sourceId=null}={}){
    ensureState(battle);const target=normalizeSlot(slot,battle);if(!target)return fail('withdraw','invalid_slot',{slot});
    const original=battle.slots[target-1],oldCard=slotCard(original),block=operationBlock(battle,'withdraw',[oldCard]);
    if(block)return fail('withdraw','blocked',{slot:target,block});
    const replacement=replacementDescriptor(battle,{replacementCard,replacementEntry,replacementUid});
    if(replacement.error)return fail('withdraw',replacement.error,{slot:target});
    if(replacement.handIndex>=0)battle.hand.splice(replacement.handIndex,1);
    battle.slots[target-1]=replaceSlotEntry(original,replacement.entry);battle.hand.push(oldCard);removeLockForUid(battle,cardUid(oldCard));
    record(battle,'withdraw',{slot:target,cardUid:cardUid(oldCard),replacementUid:cardUid(replacement.card),sourceId});
    return ok('withdraw',{slot:target,card:oldCard,replacementCard:replacement.card,sourceId});
  }

  function exchangeShowdownCard(battle,slot,handRef,{sourceId=null}={}){
    ensureState(battle);const target=normalizeSlot(slot,battle);if(!target)return fail('exchange','invalid_slot',{slot});
    const original=battle.slots[target-1],oldCard=slotCard(original),block=operationBlock(battle,'exchange',[oldCard]);
    if(block)return fail('exchange','blocked',{slot:target,block});
    if(handRef==null)return fail('exchange','invalid_hand_card',{slot:target,handRef});
    const hand=battle.hand;let handIndex=-1;
    if(Number.isInteger(handRef))handIndex=handRef;
    else handIndex=hand.findIndex(card=>cardUid(card)===handRef);
    if(handIndex<0||handIndex>=hand.length)return fail('exchange','invalid_hand_card',{slot:target,handRef});
    const incoming=hand[handIndex],incomingUid=cardUid(incoming);
    if(incomingUid&&showdownCardUids(battle).includes(incomingUid))return fail('exchange','hand_card_already_slotted',{slot:target,handRef});
    hand[handIndex]=oldCard;battle.slots[target-1]={...original,card:incoming};removeLockForUid(battle,cardUid(oldCard));
    record(battle,'exchange',{slot:target,cardUid:cardUid(oldCard),replacementUid:incomingUid,sourceId});
    return ok('exchange',{slot:target,card:oldCard,replacementCard:incoming,handIndex,sourceId});
  }

  function discardReplaceShowdownCard(battle,slot,{replacementCard=null,replacementEntry=null,replacementUid=null,sourceId=null}={}){
    ensureState(battle);const target=normalizeSlot(slot,battle);if(!target)return fail('discard_replace','invalid_slot',{slot});
    const original=battle.slots[target-1],oldCard=slotCard(original),block=operationBlock(battle,'discard_replace',[oldCard]);
    if(block)return fail('discard_replace','blocked',{slot:target,block});
    const replacement=replacementDescriptor(battle,{replacementCard,replacementEntry,replacementUid});
    if(replacement.error)return fail('discard_replace',replacement.error,{slot:target});
    if(replacement.handIndex>=0)battle.hand.splice(replacement.handIndex,1);
    battle.slots[target-1]=replaceSlotEntry(original,replacement.entry);battle.discard.push(oldCard);removeLockForUid(battle,cardUid(oldCard));
    record(battle,'discard_replace',{slot:target,cardUid:cardUid(oldCard),replacementUid:cardUid(replacement.card),sourceId});
    return ok('discard_replace',{slot:target,card:oldCard,replacementCard:replacement.card,sourceId});
  }

  function activeBattle(root,context={}){
    if(context?.battle)return context.battle;if(root?.battle)return root.battle;
    try{if(typeof battle!=='undefined')return battle}catch{}
    return null;
  }
  function feedback(root,result){
    const labels={move:'슬롯 이동',withdraw:'카드 철회',exchange:'카드 교체',discard_replace:'카드 폐기·대체',shackle:'족쇄'};
    const text=result.ok?labels[result.action]||'슬롯 조작':result.reason==='blocked'?`${result.block?.label||'족쇄'} · 조작 불가`:'슬롯 조작 실패';
    try{if(typeof root?.floatText==='function'&&root?.arena)root.floatText(root.arena,text,result.ok?'cyan':'red')}catch{}
    try{root?.renderBattle?.()}catch{}
    return result;
  }
  function effectSlot(effect,value,context,key='slot'){
    const raw=effect?.[key]??(value&&typeof value==='object'?value[key]:undefined);
    return resolveSlotRef(raw,context,activeBattle(null,context));
  }
  function effectSourceId(context){return context?.ownerId??context?.cardId??cardUid(context?.card)??null}
  function ensureEffectAction(CardEffects,action){
    if(!Array.isArray(CardEffects?.ACTIONS)||typeof CardEffects?.registerActionHandler!=='function')return false;
    if(!CardEffects.ACTIONS.includes(action))CardEffects.ACTIONS.push(action);return true;
  }
  function installEffectActions(root){
    const CardEffects=root?.CardEffects;if(!CardEffects)return false;
    Object.values(EFFECT_ACTIONS).forEach(action=>ensureEffectAction(CardEffects,action));
    if(!CardEffects.actionHandlers[EFFECT_ACTIONS.move])CardEffects.registerActionHandler(EFFECT_ACTIONS.move,(context,value,effect)=>{
      const b=activeBattle(root,context),from=effectSlot(effect,value,context,'fromSlot'),to=effectSlot(effect,value,context,'toSlot');
      feedback(root,moveShowdownSlots(b,from,to,{sourceId:effectSourceId(context)}));
    });
    if(!CardEffects.actionHandlers[EFFECT_ACTIONS.withdraw])CardEffects.registerActionHandler(EFFECT_ACTIONS.withdraw,(context,value,effect)=>{
      const b=activeBattle(root,context),slot=effectSlot(effect,value,context),replacementCard=context?.showdownReplacementCard??null;
      feedback(root,withdrawShowdownCard(b,slot,{replacementCard,replacementUid:effect?.replacementUid??context?.secondaryTargetUid??null,sourceId:effectSourceId(context)}));
    });
    if(!CardEffects.actionHandlers[EFFECT_ACTIONS.exchange])CardEffects.registerActionHandler(EFFECT_ACTIONS.exchange,(context,value,effect)=>{
      const b=activeBattle(root,context),slot=effectSlot(effect,value,context),handRef=effect?.handUid??context?.secondaryTargetUid??context?.secondaryTargetCard?.uid??null;
      feedback(root,exchangeShowdownCard(b,slot,handRef,{sourceId:effectSourceId(context)}));
    });
    if(!CardEffects.actionHandlers[EFFECT_ACTIONS.discardReplace])CardEffects.registerActionHandler(EFFECT_ACTIONS.discardReplace,(context,value,effect)=>{
      const b=activeBattle(root,context),slot=effectSlot(effect,value,context),replacementCard=context?.showdownReplacementCard??null;
      feedback(root,discardReplaceShowdownCard(b,slot,{replacementCard,replacementUid:effect?.replacementUid??context?.secondaryTargetUid??null,sourceId:effectSourceId(context)}));
    });
    if(!CardEffects.actionHandlers[EFFECT_ACTIONS.shackle])CardEffects.registerActionHandler(EFFECT_ACTIONS.shackle,(context,value,effect)=>{
      const b=activeBattle(root,context),slot=effectSlot(effect,value,context),blocked=Array.isArray(effect?.blockedOperations)?effect.blockedOperations:DEFAULT_SHACKLE_BLOCKS;
      feedback(root,applyShackle(b,slot,{label:effect?.label||'족쇄',blockedOperations:blocked,sourceId:effectSourceId(context)}));
    });
    return true;
  }
  function installStartBattleAdapter(root){
    if(typeof root?.startBattle!=='function')return true;
    if(root.startBattle.__showdownSlotManipulation8D)return true;
    const legacy=root.startBattle;
    const wrapped=function(){const result=legacy.apply(this,arguments),b=activeBattle(root);if(b)ensureState(b);return result};
    wrapped.__showdownSlotManipulation8D=true;wrapped.__legacyStartBattle=legacy;root.startBattle=wrapped;return true;
  }
  function installBrowserRuntime(root){return!!root&&installEffectActions(root)&&installStartBattleAdapter(root)}
  function installWhenReady(root){
    if(typeof document==='undefined')return false;let attempts=0;
    const attempt=()=>{if(installBrowserRuntime(root))return;if(attempts++<40)setTimeout(attempt,25);else console.warn('[showdown-slot-manipulation] 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();return true;
  }

  return{STAGE,STATE_KEY,OPERATIONS,EFFECT_ACTIONS,DEFAULT_SHACKLE_BLOCKS,DEFAULT_HISTORY_LIMIT,slotCard,cardUid,ensureBattle,ensureState,normalizeSlot,resolveSlotRef,slotEntry,showdownCardUids,findSlotByUid,lockForCard,operationBlock,record,applyShackle,isShackled,clearSetLocks,moveShowdownSlots,withdrawShowdownCard,exchangeShowdownCard,discardReplaceShowdownCard,activeBattle,installEffectActions,installStartBattleAdapter,installBrowserRuntime,installWhenReady};
});
