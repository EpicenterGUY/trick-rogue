(function(root,factory){
  const BattleCore=typeof module!=='undefined'?require('./battle-core.js'):root.BattleCore;
  const EncounterRules=typeof module!=='undefined'?require('./encounter-rules.js'):root.EncounterRules;
  const api=factory(BattleCore,EncounterRules,root);
  if(typeof module!=='undefined')module.exports=api;
  root.TrumpFields=api;
  api.installRulesAdapter();
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(BattleCore,EncounterRules,root){
  const STAGE='7.5-O';
  const DEFAULT_TRUMP_BONUS=BattleCore?.DEFAULT_TRUMP_BONUS??3;
  const DEFAULT_MAX_HAND_SIZE=BattleCore?.DEFAULT_MAX_HAND_SIZE??3;
  const FIELD_DEFINITIONS=Object.freeze({
    resonance_floor:Object.freeze({
      id:'resonance_floor',label:'과충전 구역',description:'트럼프 카드의 트릭 적용 숫자 보너스가 +3 대신 +5가 된다.',
      rulesOverride:Object.freeze({trumpBonus:5}),effects:Object.freeze([])
    }),
    thin_signal:Object.freeze({
      id:'thin_signal',label:'감쇠 지대',description:'트럼프 카드의 트릭 적용 숫자 보너스가 +3 대신 +1이 된다.',
      rulesOverride:Object.freeze({trumpBonus:1}),effects:Object.freeze([])
    }),
    outlaw_zone:Object.freeze({
      id:'outlaw_zone',label:'무법지대',description:'이번 전투에서 트럼프 무늬는 유지되지만 트릭 적용 숫자 보너스는 0이 된다.',
      rulesOverride:Object.freeze({trumpBonus:0}),effects:Object.freeze([])
    }),
    narrow_table:Object.freeze({
      id:'narrow_table',label:'좁은 테이블',description:'기본 최대 손패가 1 감소한다.',
      rulesOverride:Object.freeze({maxHandModifier:-1}),effects:Object.freeze([])
    }),
    inversion_zone:Object.freeze({
      id:'inversion_zone',label:'뒤집힌 세계',description:'모든 보정을 끝낸 최종 적용 숫자가 낮은 쪽이 트릭에서 승리한다.',
      rulesOverride:Object.freeze({lowFinalValueWins:true}),effects:Object.freeze([])
    })
  });
  let rulesInstalled=false;
  let browserInstalled=false;

  function numeric(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback}
  function signed(value){const n=numeric(value,0);return n>0?`+${n}`:`${n}`}
  function cloneEffects(effects=[]){return effects.map(effect=>({...effect,value:effect?.value&&typeof effect.value==='object'?{...effect.value}:effect?.value}))}
  function normalizeRulesOverride(input={}){
    const rules={...(input||{})};
    if(rules.lowFinalValueWins===undefined&&typeof rules.lowRankWinsWhenSameTrumpState==='boolean')rules.lowFinalValueWins=rules.lowRankWinsWhenSameTrumpState;
    delete rules.lowRankWinsWhenSameTrumpState;
    return rules;
  }
  function validateRulesOverride(overrides,prefix='rulesOverride'){
    const errors=[];
    if(overrides===undefined)return errors;
    if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))return[`${prefix}: invalid rulesOverride`];
    if('trumpBonus' in overrides&&(!Number.isFinite(Number(overrides.trumpBonus))||Number(overrides.trumpBonus)<0||Number(overrides.trumpBonus)>10))errors.push(`${prefix}: trumpBonus must be a number from 0 to 10`);
    if('maxHandModifier' in overrides&&(!Number.isInteger(overrides.maxHandModifier)||overrides.maxHandModifier<-2||overrides.maxHandModifier>2))errors.push(`${prefix}: maxHandModifier must be an integer from -2 to 2`);
    if('lowFinalValueWins' in overrides&&typeof overrides.lowFinalValueWins!=='boolean')errors.push(`${prefix}: lowFinalValueWins must be boolean`);
    return errors;
  }
  function fieldDefinition(ref,registry=FIELD_DEFINITIONS){
    if(ref===null||ref===undefined)return null;
    if(typeof ref==='string')return registry?.[ref]||null;
    return ref;
  }
  function validateFieldDefinition(definition,prefix='field'){
    const errors=[];
    if(!definition||typeof definition!=='object')return[`${prefix}: invalid definition`];
    if(!definition.id)errors.push(`${prefix}: missing id`);
    if(!definition.label&&!definition.name)errors.push(`${prefix}: missing label`);
    errors.push(...validateRulesOverride(definition.rulesOverride,`${prefix}/rulesOverride`));
    const legacy=EncounterRules?.validateFieldDefinition;
    if(typeof legacy==='function'&&!legacy.__trumpFields75O){
      for(const error of legacy(definition,prefix))if(!errors.includes(error))errors.push(error);
    }
    return errors;
  }
  function validateFieldRegistry(registry=FIELD_DEFINITIONS){
    const errors=[];
    for(const [key,definition] of Object.entries(registry||{})){
      if(definition?.id&&definition.id!==key)errors.push(`${key}: id mismatch ${definition.id}`);
      errors.push(...validateFieldDefinition(definition,key));
    }
    return errors;
  }
  function createField(ref,registry=FIELD_DEFINITIONS){
    const definition=fieldDefinition(ref,registry);if(!definition)throw new TypeError(`Unknown field: ${String(ref)}`);
    const errors=validateFieldDefinition(definition,definition.id||'field');if(errors.length)throw new TypeError(errors.join('; '));
    return{id:definition.id,label:definition.label||definition.name,description:definition.description||'',effectOwnerType:'field',rulesOverride:normalizeRulesOverride(definition.rulesOverride),effects:cloneEffects(definition.effects||[])};
  }
  function legacyResolvedRules(state){
    const legacy=EncounterRules?.__trumpFieldsLegacyResolveRulesOverride;
    if(typeof legacy==='function')return legacy(state);
    return state?.rulesOverride||{};
  }
  function resolveRulesOverride(state){return normalizeRulesOverride(legacyResolvedRules(state)||{})}
  function activeRulesOverride(state){
    const current=state?.rulesOverride&&typeof state.rulesOverride==='object'?state.rulesOverride:resolveRulesOverride(state||{});
    return normalizeRulesOverride(current);
  }
  function trumpBonusForState(state){return numeric(activeRulesOverride(state)?.trumpBonus,DEFAULT_TRUMP_BONUS)}
  function maxHandSizeForState(state){
    const base=Number.isFinite(Number(state?.baseMaxHandSize))?Math.max(1,Math.floor(Number(state.baseMaxHandSize))):DEFAULT_MAX_HAND_SIZE;
    const modifier=Number.isInteger(activeRulesOverride(state)?.maxHandModifier)?activeRulesOverride(state).maxHandModifier:0;
    return Math.max(1,base+modifier);
  }
  function syncDerivedBattleRules(state){
    if(!state||typeof state!=='object')return state;
    if(!Number.isFinite(Number(state.baseMaxHandSize)))state.baseMaxHandSize=DEFAULT_MAX_HAND_SIZE;
    state.rulesOverride=resolveRulesOverride(state);
    state.trumpBonus=trumpBonusForState(state);
    const target=maxHandSizeForState(state),previous=Number.isFinite(Number(state.maxHandSize))?Math.max(1,Math.floor(Number(state.maxHandSize))):state.baseMaxHandSize;
    state.maxHandSize=target;
    if(target<previous&&Array.isArray(state.hand)&&Array.isArray(state.deck))while(state.hand.length>target)state.deck.push(state.hand.pop());
    return state;
  }
  function setField(state,ref,registry=FIELD_DEFINITIONS){
    if(!state||typeof state!=='object')throw new TypeError('setField requires battle state');
    const previous=state.field||null,next=ref===null||ref===undefined?null:createField(ref,registry);
    state.field=next;
    if(!Array.isArray(state.fieldHistory))state.fieldHistory=[];
    if((previous?.id||null)!==(next?.id||null)){
      state.fieldSource=null;
      state.fieldHistory.push({setIndex:state.setIndex??1,trick:state.trick??1,from:previous?.id||null,to:next?.id||null,sourceType:null,sourceId:null});
    }
    syncDerivedBattleRules(state);
    return{previous,current:next,replaced:!!previous&&!!next&&previous.id!==next.id,cleared:!!previous&&!next};
  }
  function normalizeFieldSource(source={}){
    if(typeof EncounterRules?.normalizeFieldSource==='function')return EncounterRules.normalizeFieldSource(source);
    const input=typeof source==='string'?{type:source}:source||{};return{type:input.type||'scripted',id:input.id||null,label:input.label||null,consume:input.consume||'battle'};
  }
  function setFieldFromSource(state,ref,source={type:'scripted'},registry=FIELD_DEFINITIONS){
    const transition=setField(state,ref,registry);if(!state.field)return transition;
    const normalized=normalizeFieldSource(source);state.fieldSource=normalized;
    const last=state.fieldHistory?.at?.(-1);if(last&&last.to===state.field.id&&last.sourceType===null){last.sourceType=normalized.type;last.sourceId=normalized.id}
    return{...transition,source:normalized};
  }
  function clearField(state){const transition=setField(state,null);state.fieldSource=null;return transition}
  function compareTrickWithRules(playerCard,enemyCard,trump,state,baseCompare,options={}){
    const compare=baseCompare||BattleCore?.compareTrick;if(typeof compare!=='function')throw new TypeError('BattleCore is required');
    const rules=activeRulesOverride(state),result=compare(playerCard,enemyCard,trump,{...(options||{}),trumpBonus:trumpBonusForState(state)});
    return rules.lowFinalValueWins===true?-result:result;
  }

  function installRulesAdapter(){
    if(rulesInstalled||!EncounterRules)return!!EncounterRules;
    const legacyResolve=EncounterRules.resolveRulesOverride;
    const legacySync=EncounterRules.syncEncounterRules;
    const legacyInitialize=EncounterRules.initializeBattle;
    EncounterRules.__trumpFieldsLegacyResolveRulesOverride=legacyResolve;
    EncounterRules.FIELD_DEFINITIONS=FIELD_DEFINITIONS;
    EncounterRules.fieldDefinition=fieldDefinition;
    EncounterRules.createField=createField;
    EncounterRules.validateFieldDefinition=Object.assign(validateFieldDefinition,{__trumpFields75O:true});
    EncounterRules.validateFieldRegistry=validateFieldRegistry;
    EncounterRules.resolveRulesOverride=resolveRulesOverride;
    EncounterRules.activeRulesOverride=activeRulesOverride;
    EncounterRules.trumpBonusForState=trumpBonusForState;
    EncounterRules.maxHandSizeForState=maxHandSizeForState;
    EncounterRules.syncDerivedBattleRules=syncDerivedBattleRules;
    EncounterRules.setField=setField;
    EncounterRules.setFieldFromSource=setFieldFromSource;
    EncounterRules.clearField=clearField;
    EncounterRules.compareTrickWithRules=compareTrickWithRules;
    EncounterRules.syncEncounterRules=function(state,...args){const result=legacySync.call(this,state,...args);syncDerivedBattleRules(state);return{...result,rulesOverride:state.rulesOverride}};
    EncounterRules.initializeBattle=function(state,...args){const result=legacyInitialize.call(this,state,...args);syncDerivedBattleRules(state);return{...result,state}};
    rulesInstalled=true;return true;
  }

  function activeBattle(runtimeRoot=root){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function installCoreCompareAdapter(runtimeRoot=root){
    const core=runtimeRoot?.BattleCore||BattleCore;if(!core||typeof core.compareTrick!=='function')return false;
    if(core.compareTrick.__trumpFields75O)return true;
    const legacy=core.compareTrick;
    const wrapped=function(playerCard,enemyCard,trump,options={}){
      const state=activeBattle(runtimeRoot);if(!state)return legacy.call(this,playerCard,enemyCard,trump,options);
      syncDerivedBattleRules(state);
      const result=legacy.call(this,playerCard,enemyCard,trump,{...(options||{}),trumpBonus:trumpBonusForState(state)});
      return activeRulesOverride(state).lowFinalValueWins===true?-result:result;
    };
    wrapped.__trumpFields75O=true;wrapped.__legacyCompareTrick=legacy;core.compareTrick=wrapped;return true;
  }
  function installDamageAdapter(runtimeRoot=root){
    if(typeof runtimeRoot?.damageEnemy!=='function')return false;if(runtimeRoot.damageEnemy.__trumpFields75O)return true;
    const legacy=runtimeRoot.damageEnemy;
    const wrapped=function(...args){const result=legacy.apply(this,args),state=activeBattle(runtimeRoot);if(state)syncDerivedBattleRules(state);return result};
    wrapped.__trumpFields75O=true;wrapped.__legacyDamageEnemy=legacy;runtimeRoot.damageEnemy=wrapped;return true;
  }
  function installRenderAdapter(runtimeRoot=root){
    if(typeof runtimeRoot?.renderBattle!=='function')return false;if(runtimeRoot.renderBattle.__trumpFields75O)return true;
    const legacy=runtimeRoot.renderBattle;
    const wrapped=function(...args){
      const result=legacy.apply(this,args),state=activeBattle(runtimeRoot),el=runtimeRoot.document?.getElementById?.('trumpText');
      if(state&&el){syncDerivedBattleRules(state);const bonus=trumpBonusForState(state),base=String(el.textContent||'').replace(/\s+[+-]\d+(?:\.\d+)?\s*$/,'').trim();el.textContent=`${base} ${signed(bonus)}`.trim()}
      return result;
    };
    wrapped.__trumpFields75O=true;wrapped.__legacyRenderBattle=legacy;runtimeRoot.renderBattle=wrapped;return true;
  }
  function installInspectAdapter(runtimeRoot=root){
    if(typeof runtimeRoot?.inspectCard!=='function')return false;if(runtimeRoot.inspectCard.__trumpFields75O)return true;
    const legacy=runtimeRoot.inspectCard;
    const wrapped=function(card,placed=false,...rest){
      const result=legacy.call(this,card,placed,...rest);if(placed)return result;
      const state=activeBattle(runtimeRoot),el=runtimeRoot.document?.getElementById?.('inspectApply');if(!state||!card||!el||typeof BattleCore?.resolveTrickValue!=='function')return result;
      syncDerivedBattleRules(state);const effective=typeof runtimeRoot.effective==='function'?runtimeRoot.effective(card):card,trace=BattleCore.resolveTrickValue(effective,state.trump,{trumpBonus:trumpBonusForState(state)});
      const suitSymbol=BattleCore.suitSymbol||((s)=>String(s??'?')),suitStep=trace.printedSuit===trace.effectiveSuit?suitSymbol(trace.effectiveSuit):`${suitSymbol(trace.printedSuit)}→${suitSymbol(trace.effectiveSuit)}`;
      const numberModifier=trace.cardRankModifier+trace.otherNumberModifier,statusField=trace.statusModifier+trace.fieldModifier;
      let text=String(el.textContent||'').replace(/\s*·\s*계산:.*$/,'');text=text.replace(/ · 트럼프(?: [+-]\d+(?:\.\d+)?)?/g,` · 트럼프 ${signed(trumpBonusForState(state))}`);
      el.textContent=`${text} · 계산: ${trace.printedRank} → 무늬 ${suitStep} → 트럼프 ${signed(trace.trumpBonus)} → 숫자 ${signed(numberModifier)} → 상태\/필드 ${signed(statusField)} → 최종 ${trace.finalValue}`;return result;
    };
    wrapped.__trumpFields75O=true;wrapped.__legacyInspectCard=legacy;runtimeRoot.inspectCard=wrapped;return true;
  }
  function installTermsAdapter(runtimeRoot=root){
    if(typeof runtimeRoot?.showTerm==='function'&&!runtimeRoot.showTerm.__trumpFields75O){
      const legacy=runtimeRoot.showTerm;const wrapped=function(term,...args){const result=legacy.call(this,term,...args);if(term==='트럼프'){const p=runtimeRoot.document?.querySelector?.('#modal p');if(p)p.textContent='현재 세트의 지정 무늬. 최종 무늬 판정 뒤 기본적으로 트릭 적용 숫자 +3을 받으며, 필드에 따라 +5·+1·0으로 바뀔 수 있다. 자동 승리권은 아니며 쇼다운 원래 값도 바꾸지 않는다.'}return result};wrapped.__trumpFields75O=true;wrapped.__legacyShowTerm=legacy;runtimeRoot.showTerm=wrapped;
    }
    if(typeof runtimeRoot?.showTerms==='function'&&!runtimeRoot.showTerms.__trumpFields75O){
      const legacy=runtimeRoot.showTerms;const wrapped=function(...args){const result=legacy.apply(this,args),buttons=runtimeRoot.document?.querySelectorAll?.('#modal .choice')||[];for(const button of buttons){if(button.querySelector?.('b')?.textContent!=='트럼프')continue;const span=button.querySelector?.('span');if(span)span.textContent='최종 무늬 판정 뒤 기본 +3. 필드가 있으면 +5·+1·0 등으로 바뀌며 최종 적용 숫자로 승패를 정한다.'}return result};wrapped.__trumpFields75O=true;wrapped.__legacyShowTerms=legacy;runtimeRoot.showTerms=wrapped;
    }
    return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    installRulesAdapter();
    if(!runtimeRoot||!(runtimeRoot.BattleCore||BattleCore)||typeof runtimeRoot.renderBattle!=='function')return false;
    installCoreCompareAdapter(runtimeRoot);installDamageAdapter(runtimeRoot);installRenderAdapter(runtimeRoot);installInspectAdapter(runtimeRoot);installTermsAdapter(runtimeRoot);browserInstalled=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;let attempts=0;const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;attempts++;if(attempts<60)setTimeout(attempt,25);else console.warn('[trump-fields] 런타임을 찾지 못했습니다.')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);return true;
  }
  function resetBrowserAdapterForTests(){browserInstalled=false}

  return{STAGE,DEFAULT_TRUMP_BONUS,DEFAULT_MAX_HAND_SIZE,FIELD_DEFINITIONS,normalizeRulesOverride,validateRulesOverride,fieldDefinition,validateFieldDefinition,validateFieldRegistry,createField,resolveRulesOverride,activeRulesOverride,trumpBonusForState,maxHandSizeForState,syncDerivedBattleRules,setField,setFieldFromSource,clearField,compareTrickWithRules,installRulesAdapter,activeBattle,installCoreCompareAdapter,installDamageAdapter,installRenderAdapter,installInspectAdapter,installTermsAdapter,installBrowserRuntime,installWhenReady,resetBrowserAdapterForTests};
});