(function(root,factory){
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const api=factory(CardEffects,root);
  if(typeof module!=='undefined')module.exports=api;
  root.CombatEffects=api;
  if(typeof document!=='undefined')api.installWhenReady();
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,root){
  const STATUS_STACKING=Object.freeze(['add','replace','max']);
  const STATUS_DEFINITIONS=Object.freeze({
    shield:Object.freeze({id:'shield',maxStacks:null,trigger:'before_damage',decay:null,duration:'battle',stacking:'add',dispellable:false,implemented:true,role:'absorb'}),
    bleed:Object.freeze({id:'bleed',maxStacks:null,trigger:'on_trick_end',decay:Object.freeze({type:'subtract',amount:1,when:'after_trigger'}),duration:'battle',stacking:'add',dispellable:false,implemented:true,role:'damage'}),
    poison:Object.freeze({id:'poison',maxStacks:null,trigger:null,decay:null,duration:'battle',stacking:'add',dispellable:false,implemented:false,role:'reserved'})
  });
  let installed=false;
  let originalApplyDamageState=null;
  let originalDamageEnemy=null;
  let originalDamagePlayer=null;
  let originalApplyEndStatus=null;

  function validateStatusDefinition(definition){
    const errors=[];
    if(!definition||typeof definition!=='object')return['status definition must be an object'];
    if(!definition.id)errors.push('missing id');
    if(definition.maxStacks!==null&&(!Number.isFinite(definition.maxStacks)||definition.maxStacks<0))errors.push('invalid maxStacks');
    if(definition.trigger!==null&&definition.trigger!==undefined&&!CardEffects.TRIGGERS.includes(definition.trigger))errors.push(`unknown trigger ${definition.trigger}`);
    if(!CardEffects.DURATIONS.includes(definition.duration))errors.push(`unknown duration ${definition.duration}`);
    if(!STATUS_STACKING.includes(definition.stacking))errors.push(`unknown stacking ${definition.stacking}`);
    if(typeof definition.dispellable!=='boolean')errors.push('dispellable must be boolean');
    if(definition.decay){
      if(!['subtract','reset'].includes(definition.decay.type))errors.push(`unknown decay ${definition.decay.type}`);
      if(definition.decay.type==='subtract'&&(!Number.isFinite(definition.decay.amount)||definition.decay.amount<0))errors.push('invalid decay amount');
      if(!['before_trigger','after_trigger'].includes(definition.decay.when))errors.push(`unknown decay timing ${definition.decay.when}`);
    }
    return errors;
  }
  function validateStatusRegistry(registry=STATUS_DEFINITIONS){
    return Object.entries(registry).flatMap(([id,definition])=>validateStatusDefinition(definition).map(error=>`${id}: ${error}`));
  }
  function actorStatuses(statuses,actor){
    if(!statuses||typeof statuses!=='object')throw new TypeError('statuses object is required');
    if(!statuses[actor]||typeof statuses[actor]!=='object')statuses[actor]={};
    return statuses[actor];
  }
  function getStatusValue(statuses,actor,id){
    const value=actorStatuses(statuses,actor)[id];
    if(value&&typeof value==='object'&&Number.isFinite(value.value))return Math.max(0,value.value);
    return Number.isFinite(value)?Math.max(0,value):0;
  }
  function setStatusValue(statuses,actor,id,value){
    if(!STATUS_DEFINITIONS[id])throw new TypeError(`Unknown status: ${id}`);
    const target=actorStatuses(statuses,actor),current=target[id],definition=STATUS_DEFINITIONS[id];
    let next=Math.max(0,Number(value)||0);
    if(Number.isFinite(definition.maxStacks))next=Math.min(definition.maxStacks,next);
    if(current&&typeof current==='object')target[id]={...current,value:next};else target[id]=next;
    return next;
  }
  function addStatus(statuses,actor,id,amount){
    const definition=STATUS_DEFINITIONS[id];if(!definition)throw new TypeError(`Unknown status: ${id}`);
    const current=getStatusValue(statuses,actor,id),incoming=Math.max(0,Number(amount)||0);
    const next=definition.stacking==='replace'?incoming:definition.stacking==='max'?Math.max(current,incoming):current+incoming;
    return setStatusValue(statuses,actor,id,next);
  }
  function statusSnapshot(statuses,actor,id){
    const definition=STATUS_DEFINITIONS[id];if(!definition)throw new TypeError(`Unknown status: ${id}`);
    return Object.freeze({...definition,value:getStatusValue(statuses,actor,id)});
  }
  function applyDecay(statuses,actor,id,definition){
    const decay=definition.decay;if(!decay)return getStatusValue(statuses,actor,id);
    if(decay.type==='reset')return setStatusValue(statuses,actor,id,0);
    if(decay.type==='subtract')return setStatusValue(statuses,actor,id,getStatusValue(statuses,actor,id)-decay.amount);
    return getStatusValue(statuses,actor,id);
  }
  function resolveStatusTrigger({statuses,actor,trigger,damage=()=>0,onStatus=()=>{}}={}){
    const events=[];
    for(const definition of Object.values(STATUS_DEFINITIONS)){
      if(!definition.implemented||definition.trigger!==trigger)continue;
      const value=getStatusValue(statuses,actor,definition.id);if(value<=0)continue;
      if(definition.decay?.when==='before_trigger')applyDecay(statuses,actor,definition.id,definition);
      let result=null;
      if(definition.role==='damage')result=damage(actor,value,{source:'status',statusId:definition.id});
      const event={actor,statusId:definition.id,value,result};events.push(event);onStatus(event);
      if(definition.decay?.when==='after_trigger')applyDecay(statuses,actor,definition.id,definition);
    }
    return events;
  }
  function resolveDamageState({statuses,target,amount,getHp,setHp}={}){
    if(typeof getHp!=='function'||typeof setHp!=='function')throw new TypeError('resolveDamageState requires getHp/setHp');
    const requestedAmount=Math.max(0,Number(amount)||0),shield=getStatusValue(statuses,target,'shield');
    const blocked=Math.min(shield,requestedAmount);setStatusValue(statuses,target,'shield',shield-blocked);
    const hpBefore=Math.max(0,Number(getHp())||0),dealt=Math.min(hpBefore,Math.max(0,requestedAmount-blocked)),hpAfter=hpBefore-dealt;
    setHp(hpAfter);
    return{target,requestedAmount,amount:requestedAmount,blocked,dealt,hpBefore,hpAfter};
  }
  function createDamageEvent({target,amount,feedback,source}={}){
    const requestedAmount=Math.max(0,Number(amount)||0);
    return{target,requestedAmount,amount:requestedAmount,feedback:feedback||null,source:source||feedback||'direct',cancelled:false};
  }
  function uniqueCards(cards){
    const seenObjects=new Set(),seenIds=new Set(),result=[];
    for(const card of cards){
      if(!card||typeof card!=='object')continue;
      const key=card.uid||null;
      if(key){if(seenIds.has(key))continue;seenIds.add(key)}else{if(seenObjects.has(card))continue;seenObjects.add(card)}
      result.push(card);
    }
    return result;
  }
  function activePlayerCards(state){
    if(!state)return[];
    return uniqueCards([...(state.hand||[]),...(state.slots||[]).map(slot=>slot?.card).filter(Boolean)]);
  }
  function dispatchDamageHooks(trigger,cards,damage,{runEffect,chain}={}){
    if(!['before_damage','after_damage'].includes(trigger))throw new TypeError(`Unsupported damage trigger: ${trigger}`);
    const runner=runEffect||((card,nextTrigger,extra)=>CardEffects.run(nextTrigger,card,extra));
    let executed=0;
    uniqueCards(cards||[]).forEach((card,index)=>{executed+=runner(card,trigger,{damage,effectChain:chain,effectOwnerOrdinal:index})||0});
    return executed;
  }
  function runtimeBattle(){
    try{return typeof battle!=='undefined'?battle:root.battle}catch(_error){return root.battle||null}
  }
  function runtimeRun(){
    try{return typeof run!=='undefined'?run:root.run}catch(_error){return root.run||null}
  }
  function runRuntimeCardEffect(card,trigger,extra){
    if(typeof root.runCardEffects==='function'){root.runCardEffects(trigger,card,extra);return 1}
    return CardEffects.run(trigger,card,{...extra,perform:()=>{}});
  }
  function installDamageStateAdapter(){
    if(typeof root.applyDamageState!=='function')return false;
    if(root.applyDamageState.__combatEffectsAdapter)return true;
    originalApplyDamageState=root.applyDamageState;
    const adapted=function(target,amount){
      const state=runtimeBattle(),runState=runtimeRun();
      if(!state||!runState)return originalApplyDamageState(target,amount);
      const hp=target==='enemy'?state.enemy:runState;
      const result=resolveDamageState({statuses:state.statuses,target,amount,getHp:()=>hp.hp,setHp:value=>{hp.hp=value}});
      state.lastDamageEvent=result;
      return result;
    };
    adapted.__combatEffectsAdapter=true;adapted.__legacyApplyDamageState=originalApplyDamageState;root.applyDamageState=adapted;return true;
  }
  function wrapDamageFunction(name,target){
    const original=root[name];if(typeof original!=='function')return false;if(original.__combatEffectsAdapter)return true;
    const wrapped=function(amount,feedback,metadata={}){
      const state=runtimeBattle();if(!state)return original.call(this,amount,feedback);
      const inherited=CardEffects.currentEffectChain(),chain=inherited||CardEffects.createEffectChain();
      return CardEffects.withEffectChain(chain,()=>{
        const damage=createDamageEvent({target,amount,feedback,source:metadata?.source});
        if(target==='player')dispatchDamageHooks('before_damage',activePlayerCards(state),damage,{chain,runEffect:runRuntimeCardEffect});
        damage.amount=Math.max(0,Number(damage.amount)||0);
        if(damage.cancelled||damage.amount<=0){state.lastDamageEvent={...damage,blocked:0,dealt:0,hpBefore:runtimeRun()?.hp??0,hpAfter:runtimeRun()?.hp??0};return 0}
        const dealt=original.call(this,damage.amount,feedback);
        const resolved=state.lastDamageEvent||{target,requestedAmount:damage.requestedAmount,amount:damage.amount,blocked:0,dealt};
        const event={...damage,...resolved,requestedAmount:damage.requestedAmount,amount:damage.amount};
        state.lastDamageEvent=event;
        if(target==='player')dispatchDamageHooks('after_damage',activePlayerCards(state),event,{chain,runEffect:runRuntimeCardEffect});
        return dealt;
      });
    };
    wrapped.__combatEffectsAdapter=true;wrapped.__legacyDamageFunction=original;root[name]=wrapped;
    if(name==='damageEnemy')originalDamageEnemy=original;else originalDamagePlayer=original;
    return true;
  }
  function installEndStatusAdapter(){
    if(typeof root.applyEndStatus!=='function')return false;if(root.applyEndStatus.__combatEffectsAdapter)return true;
    originalApplyEndStatus=root.applyEndStatus;
    const adapted=function(){
      const state=runtimeBattle();if(!state)return originalApplyEndStatus();
      resolveStatusTrigger({statuses:state.statuses,actor:'enemy',trigger:'on_trick_end',damage:(_actor,value,meta)=>root.damageEnemy(value,undefined,meta)});
      resolveStatusTrigger({statuses:state.statuses,actor:'player',trigger:'on_trick_end',damage:(_actor,value,meta)=>root.damagePlayer(value,undefined,meta)});
    };
    adapted.__combatEffectsAdapter=true;adapted.__legacyApplyEndStatus=originalApplyEndStatus;root.applyEndStatus=adapted;return true;
  }
  function installBrowserAdapter(){
    if(installed)return true;
    const errors=validateStatusRegistry();if(errors.length){console.error('[combat-effects] 상태 정의 오류',errors);return false}
    if(typeof root.applyDamageState!=='function'||typeof root.damageEnemy!=='function'||typeof root.damagePlayer!=='function'||typeof root.applyEndStatus!=='function')return false;
    installDamageStateAdapter();wrapDamageFunction('damageEnemy','enemy');wrapDamageFunction('damagePlayer','player');installEndStatusAdapter();installed=true;return true;
  }
  function installWhenReady(){
    if(typeof document==='undefined')return false;
    const attempt=()=>{if(installBrowserAdapter())return;setTimeout(()=>{if(!installBrowserAdapter())console.warn('[combat-effects] 전투 런타임을 찾지 못했습니다.')},0)};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    return true;
  }
  return{STATUS_STACKING,STATUS_DEFINITIONS,validateStatusDefinition,validateStatusRegistry,getStatusValue,setStatusValue,addStatus,statusSnapshot,applyDecay,resolveStatusTrigger,resolveDamageState,createDamageEvent,uniqueCards,activePlayerCards,dispatchDamageHooks,installDamageStateAdapter,wrapDamageFunction,installEndStatusAdapter,installBrowserAdapter,installWhenReady};
});
