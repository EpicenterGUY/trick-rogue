(function(root,factory){
  const CardEffects=typeof module!=='undefined'?require('./effects.js'):root.CardEffects;
  const api=factory(CardEffects,root);
  if(typeof module!=='undefined')module.exports=api;
  root.EncounterRules=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects,root){
  const FIELD_SLOT_COUNT=1;
  const RULE_KINDS=Object.freeze(['elite_modifier','boss_phase']);
  const FIELD_DEFINITIONS=Object.freeze({});
  const ENCOUNTER_PROFILES=Object.freeze({
    battle:Object.freeze({
      id:'raider',type:'battle',label:'폐허 약탈자',rulesOverride:Object.freeze({}),eliteModifier:null,bossPhases:Object.freeze([]),defaultField:null
    }),
    elite:Object.freeze({
      id:'armored_hunter',type:'elite',label:'철갑 사냥꾼',rulesOverride:Object.freeze({}),defaultField:null,
      eliteModifier:Object.freeze({
        id:'armored_shell',label:'철갑',description:'각 세트 시작 시 보호막 3을 얻는다.',rulesOverride:Object.freeze({}),
        effects:Object.freeze([
          Object.freeze({id:'armored-shell-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:3}),duration:'set'})
        ])
      }),
      bossPhases:Object.freeze([])
    }),
    boss:Object.freeze({
      id:'tower_watcher',type:'boss',label:'탑의 감시자',rulesOverride:Object.freeze({}),eliteModifier:null,defaultField:null,
      bossPhases:Object.freeze([
        Object.freeze({id:'phase_1',label:'1페이즈',minHpRatio:.70,rulesOverride:Object.freeze({}),rule:null}),
        Object.freeze({
          id:'phase_2',label:'2페이즈',minHpRatio:.40,rulesOverride:Object.freeze({}),
          rule:Object.freeze({
            id:'watcher-phase-2',label:'감시 강화',description:'2페이즈부터 세트 시작 시 보호막 2를 얻는다.',rulesOverride:Object.freeze({}),
            effects:Object.freeze([
              Object.freeze({id:'watcher-phase-2-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:2}),duration:'set'})
            ])
          })
        }),
        Object.freeze({
          id:'phase_3',label:'3페이즈',minHpRatio:0,rulesOverride:Object.freeze({}),
          rule:Object.freeze({
            id:'watcher-phase-3',label:'규칙 재작성',description:'3페이즈부터 세트 시작 시 보호막 4를 얻는다.',rulesOverride:Object.freeze({}),
            effects:Object.freeze([
              Object.freeze({id:'watcher-phase-3-shield',trigger:'on_set_start',action:'apply_status',value:Object.freeze({target:'enemy',statusId:'shield',amount:4}),duration:'set'})
            ])
          })
        })
      ])
    })
  });
  let installed=false;
  let originalStartBattle=null;
  let originalDamageEnemy=null;

  function cloneEffects(effects=[]){return effects.map(effect=>({...effect,value:effect?.value&&typeof effect.value==='object'?{...effect.value}:effect?.value}))}
  function profileFor(typeOrId){
    if(ENCOUNTER_PROFILES[typeOrId])return ENCOUNTER_PROFILES[typeOrId];
    return Object.values(ENCOUNTER_PROFILES).find(profile=>profile.id===typeOrId)||ENCOUNTER_PROFILES.battle;
  }
  function validateRule(rule,prefix='rule'){
    const errors=[];
    if(!rule||typeof rule!=='object')return[`${prefix}: invalid rule`];
    if(!rule.id)errors.push(`${prefix}: missing id`);
    if(!rule.label)errors.push(`${prefix}: missing label`);
    if(rule.rulesOverride!==undefined&&(!rule.rulesOverride||typeof rule.rulesOverride!=='object'||Array.isArray(rule.rulesOverride)))errors.push(`${prefix}: invalid rulesOverride`);
    errors.push(...CardEffects.validateEffectList(rule.effects||[],{requireTrigger:true,requireDuration:true}).map(error=>`${prefix}: ${error}`));
    return errors;
  }
  function validateEncounterProfiles(profiles=ENCOUNTER_PROFILES){
    const errors=[];
    for(const [type,profile] of Object.entries(profiles)){
      if(!profile?.id)errors.push(`${type}: missing id`);
      if(profile?.type!==type)errors.push(`${type}: profile type mismatch`);
      if(profile?.rulesOverride!==undefined&&(!profile.rulesOverride||typeof profile.rulesOverride!=='object'||Array.isArray(profile.rulesOverride)))errors.push(`${type}: invalid rulesOverride`);
      if(profile?.eliteModifier)errors.push(...validateRule(profile.eliteModifier,`${type}/eliteModifier`));
      const phases=profile?.bossPhases||[];
      if(!Array.isArray(phases))errors.push(`${type}: bossPhases must be an array`);
      else{
        let previous=Infinity;
        const ids=new Set();
        phases.forEach((phase,index)=>{
          const prefix=`${type}/phase[${index}]`;
          if(!phase?.id)errors.push(`${prefix}: missing id`);else if(ids.has(phase.id))errors.push(`${prefix}: duplicate id ${phase.id}`);else ids.add(phase.id);
          if(!Number.isFinite(phase?.minHpRatio)||phase.minHpRatio<0||phase.minHpRatio>1)errors.push(`${prefix}: invalid minHpRatio`);
          if(Number.isFinite(phase?.minHpRatio)&&phase.minHpRatio>previous)errors.push(`${prefix}: phases must be descending`);
          previous=Number.isFinite(phase?.minHpRatio)?phase.minHpRatio:previous;
          if(phase?.rule)errors.push(...validateRule(phase.rule,`${prefix}/rule`));
        });
        if(type==='boss'&&phases.length&&phases[phases.length-1].minHpRatio!==0)errors.push(`${type}: last phase must start at 0`);
      }
    }
    return errors;
  }
  function validateFieldDefinition(definition,prefix='field'){
    const errors=[];
    if(!definition||typeof definition!=='object')return[`${prefix}: invalid definition`];
    if(!definition.id)errors.push(`${prefix}: missing id`);
    if(!definition.label&&!definition.name)errors.push(`${prefix}: missing label`);
    if(definition.rulesOverride!==undefined&&(!definition.rulesOverride||typeof definition.rulesOverride!=='object'||Array.isArray(definition.rulesOverride)))errors.push(`${prefix}: invalid rulesOverride`);
    errors.push(...CardEffects.validateEffectList(definition.effects||[],{requireTrigger:true,requireDuration:true}).map(error=>`${prefix}: ${error}`));
    return errors;
  }
  function hpRatio(state){
    const hp=Math.max(0,Number(state?.enemy?.hp)||0),maxHp=Math.max(1,Number(state?.enemy?.maxHp)||1);
    return Math.max(0,Math.min(1,hp/maxHp));
  }
  function resolveBossPhase(profileOrType,stateOrHp,maxHp){
    const profile=typeof profileOrType==='object'&&profileOrType?.bossPhases?profileOrType:profileFor(profileOrType);
    const phases=profile?.bossPhases||[];if(!phases.length)return null;
    const ratio=typeof stateOrHp==='object'?hpRatio(stateOrHp):Math.max(0,Math.min(1,(Number(stateOrHp)||0)/Math.max(1,Number(maxHp)||1)));
    return phases.find(phase=>ratio>=phase.minHpRatio)||phases[phases.length-1]||null;
  }
  function makeRuleOwner(rule,{kind,profileId,phaseId=null}={}){
    if(!rule)return null;
    if(!RULE_KINDS.includes(kind))throw new TypeError(`Unknown encounter rule kind: ${kind}`);
    const errors=validateRule(rule,rule.id||kind);if(errors.length)throw new TypeError(errors.join('; '));
    return{
      id:rule.id,label:rule.label,description:rule.description||'',effectOwnerType:'boss_rule',encounterManaged:true,
      encounterRuleKind:kind,encounterProfileId:profileId||null,bossPhaseId:phaseId,
      rulesOverride:{...(rule.rulesOverride||{})},effects:cloneEffects(rule.effects||[])
    };
  }
  function managedRulesFor(state,profile=profileFor(state?.type)){
    const rules=[];
    if(profile.eliteModifier)rules.push(makeRuleOwner(profile.eliteModifier,{kind:'elite_modifier',profileId:profile.id}));
    const phase=resolveBossPhase(profile,state);
    if(phase?.rule)rules.push(makeRuleOwner(phase.rule,{kind:'boss_phase',profileId:profile.id,phaseId:phase.id}));
    return rules.filter(Boolean);
  }
  function preserveExternalBossRules(state){return(Array.isArray(state?.bossRules)?state.bossRules:[]).filter(rule=>rule?.encounterManaged!==true)}
  function fieldDefinition(ref,registry=FIELD_DEFINITIONS){
    if(ref===null||ref===undefined)return null;
    if(typeof ref==='string')return registry?.[ref]||null;
    return ref;
  }
  function createField(ref,registry=FIELD_DEFINITIONS){
    const definition=fieldDefinition(ref,registry);if(!definition)throw new TypeError(`Unknown field: ${String(ref)}`);
    const errors=validateFieldDefinition(definition,definition.id||'field');if(errors.length)throw new TypeError(errors.join('; '));
    return{
      id:definition.id,label:definition.label||definition.name,description:definition.description||'',effectOwnerType:'field',
      rulesOverride:{...(definition.rulesOverride||{})},effects:cloneEffects(definition.effects||[])
    };
  }
  function setField(state,ref,registry=FIELD_DEFINITIONS){
    if(!state||typeof state!=='object')throw new TypeError('setField requires battle state');
    const previous=state.field||null,next=ref===null||ref===undefined?null:createField(ref,registry);
    state.field=next;
    if(!Array.isArray(state.fieldHistory))state.fieldHistory=[];
    if((previous?.id||null)!==(next?.id||null))state.fieldHistory.push({setIndex:state.setIndex??1,trick:state.trick??1,from:previous?.id||null,to:next?.id||null});
    state.rulesOverride=resolveRulesOverride(state);
    return{previous,current:next,replaced:!!previous&&!!next&&previous.id!==next.id,cleared:!!previous&&!next};
  }
  function clearField(state){return setField(state,null)}
  function resolveRulesOverride(state){
    const profile=profileFor(state?.encounterProfileId||state?.type),phase=resolveBossPhase(profile,state);
    const merged={...(profile.rulesOverride||{})};
    if(profile.eliteModifier?.rulesOverride)Object.assign(merged,profile.eliteModifier.rulesOverride);
    if(phase?.rulesOverride)Object.assign(merged,phase.rulesOverride);
    if(phase?.rule?.rulesOverride)Object.assign(merged,phase.rule.rulesOverride);
    if(state?.field?.rulesOverride)Object.assign(merged,state.field.rulesOverride);
    return merged;
  }
  function syncEncounterRules(state){
    if(!state||typeof state!=='object')throw new TypeError('syncEncounterRules requires battle state');
    const profile=profileFor(state.encounterProfileId||state.type),previousId=state.bossPhase?.id||null,phase=resolveBossPhase(profile,state);
    state.encounterProfileId=profile.id;
    state.bossPhase=phase?{id:phase.id,label:phase.label,minHpRatio:phase.minHpRatio}:null;
    state.encounterRules=managedRulesFor(state,profile);
    state.bossRules=[...preserveExternalBossRules(state),...state.encounterRules];
    state.rulesOverride=resolveRulesOverride(state);
    return{changed:previousId!==(state.bossPhase?.id||null),previousId,currentId:state.bossPhase?.id||null,phase:state.bossPhase,rules:state.encounterRules};
  }
  function initializeBattle(state){
    if(!state||typeof state!=='object')throw new TypeError('initializeBattle requires battle state');
    const profile=profileFor(state.type),errors=validateEncounterProfiles();if(errors.length)throw new TypeError(errors.join('; '));
    state.encounterProfileId=profile.id;
    state.encounter={...(state.encounter||{}),profileId:profile.id,fieldSlotCount:FIELD_SLOT_COUNT,bossPhases:(profile.bossPhases||[]).map(phase=>({id:phase.id,label:phase.label,minHpRatio:phase.minHpRatio}))};
    if(state.field===undefined)state.field=null;
    if(!Array.isArray(state.fieldHistory))state.fieldHistory=[];
    if(profile.defaultField&&state.field===null)setField(state,profile.defaultField);
    const transition=syncEncounterRules(state);
    state.encounterRulesInitialized=true;
    return{state,profile,transition};
  }
  function activeBattle(runtimeRoot=root){
    try{if(typeof battle!=='undefined')return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function ensureInitialized(runtimeRoot=root){
    const state=activeBattle(runtimeRoot);if(!state)return null;
    if(!state.encounterRulesInitialized)initializeBattle(state);
    return state;
  }
  function wrapStartBattle(runtimeRoot=root){
    if(typeof runtimeRoot?.startBattle!=='function')return false;
    if(runtimeRoot.startBattle.__encounterRulesAdapter)return true;
    originalStartBattle=runtimeRoot.startBattle;
    const wrapped=function(...args){
      const previousRun=runtimeRoot.runCardEffects,previousNext=runtimeRoot.nextEnemy;
      const ensure=()=>ensureInitialized(runtimeRoot);
      if(typeof previousRun==='function')runtimeRoot.runCardEffects=function(...effectArgs){ensure();return previousRun.apply(this,effectArgs)};
      if(typeof previousNext==='function')runtimeRoot.nextEnemy=function(...enemyArgs){ensure();return previousNext.apply(this,enemyArgs)};
      try{
        const result=originalStartBattle.apply(this,args);ensure();return result;
      }finally{
        if(typeof previousRun==='function')runtimeRoot.runCardEffects=previousRun;
        if(typeof previousNext==='function')runtimeRoot.nextEnemy=previousNext;
      }
    };
    wrapped.__encounterRulesAdapter=true;wrapped.__legacyStartBattle=originalStartBattle;runtimeRoot.startBattle=wrapped;return true;
  }
  function wrapDamageEnemy(runtimeRoot=root){
    if(typeof runtimeRoot?.damageEnemy!=='function')return false;
    if(runtimeRoot.damageEnemy.__encounterRulesAdapter)return true;
    originalDamageEnemy=runtimeRoot.damageEnemy;
    const wrapped=function(...args){
      const result=originalDamageEnemy.apply(this,args),state=ensureInitialized(runtimeRoot);
      if(state?.type==='boss'){
        const transition=syncEncounterRules(state);
        if(transition.changed&&typeof runtimeRoot.renderBattle==='function')runtimeRoot.renderBattle();
      }
      return result;
    };
    wrapped.__encounterRulesAdapter=true;wrapped.__legacyDamageEnemy=originalDamageEnemy;runtimeRoot.damageEnemy=wrapped;return true;
  }
  function installBrowserRuntime(runtimeRoot=root){
    if(installed)return true;
    if(typeof runtimeRoot?.startBattle!=='function'||typeof runtimeRoot?.damageEnemy!=='function')return false;
    wrapStartBattle(runtimeRoot);wrapDamageEnemy(runtimeRoot);installed=true;return true;
  }
  function installWhenReady(runtimeRoot=root){
    if(typeof document==='undefined')return false;
    let attempts=0;
    const attempt=()=>{
      if(installBrowserRuntime(runtimeRoot))return;
      attempts++;
      if(attempts<40)setTimeout(attempt,25);else console.warn('[encounter-rules] 전투 런타임을 찾지 못했습니다.');
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else setTimeout(attempt,0);
    return true;
  }
  return{
    FIELD_SLOT_COUNT,RULE_KINDS,FIELD_DEFINITIONS,ENCOUNTER_PROFILES,profileFor,validateRule,validateEncounterProfiles,validateFieldDefinition,
    hpRatio,resolveBossPhase,makeRuleOwner,managedRulesFor,preserveExternalBossRules,fieldDefinition,createField,setField,clearField,resolveRulesOverride,
    syncEncounterRules,initializeBattle,activeBattle,ensureInitialized,wrapStartBattle,wrapDamageEnemy,installBrowserRuntime,installWhenReady
  };
});