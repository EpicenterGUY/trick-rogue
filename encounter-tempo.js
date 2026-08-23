(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.EncounterTempo=api;
  if(typeof document!=='undefined')api.installWhenReady(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(defaultRoot){
  const STAGE='7.5-E';

  const SHOWDOWN_DAMAGE_BANDS=Object.freeze({
    ordinary:Object.freeze({id:'ordinary',label:'평범한 쇼다운',min:10,max:30}),
    good:Object.freeze({id:'good',label:'잘 풀린 쇼다운',min:30,max:50}),
    synergy:Object.freeze({id:'synergy',label:'강한 시너지',min:50,max:80}),
    burst:Object.freeze({id:'burst',label:'고점',min:100,max:null})
  });
  const LOW_DAMAGE_BAND=Object.freeze({id:'low',label:'저점 쇼다운',min:0,max:10});

  const TEMPO_PROFILES=Object.freeze({
    battle_early:Object.freeze({
      id:'battle_early',encounterType:'battle',label:'초반 일반전',hp:12,
      targetSets:Object.freeze({min:1,max:2,preferred:1}),
      note:'차이 피해 기준으로 잘 풀린 첫 쇼다운에 끝내는 것이 기본이며 접전은 2세트까지 허용한다.'
    }),
    battle_strong:Object.freeze({
      id:'battle_strong',encounterType:'battle',label:'강한 일반전',hp:18,
      targetSets:Object.freeze({min:1,max:2,preferred:2}),
      note:'차이 피해 10 안팎이면 2세트, 20 안팎의 좋은 쇼다운이면 1세트 처치도 가능하게 둔다.'
    }),
    elite:Object.freeze({
      id:'elite',encounterType:'elite',label:'엘리트',hp:32,
      targetSets:Object.freeze({min:2,max:3,preferred:2}),
      note:'차이 피해 기준에서도 일반전보다 확실히 오래 버티되 장기전 빌드가 작동할 2~3세트를 목표로 한다.'
    }),
    boss:Object.freeze({
      id:'boss',encounterType:'boss',label:'보스',hp:60,
      targetSets:Object.freeze({min:3,max:null,preferred:4}),
      note:'보스 페이즈와 장기전 효과가 작동하도록 보통 3세트 이상을 목표로 하되 큰 차이 피해에는 더 빨리 끝날 수 있다.'
    })
  });

  let installed=false;
  let originalStartBattle=null;

  function numeric(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  function resolveTempoId(nodeOrType){
    if(typeof nodeOrType==='string'){
      if(TEMPO_PROFILES[nodeOrType])return nodeOrType;
      if(nodeOrType==='battle')return'battle_early';
      if(nodeOrType==='elite'||nodeOrType==='boss')return nodeOrType;
      return'battle_early';
    }
    const node=nodeOrType||{};
    if(node.tempoTier&&TEMPO_PROFILES[node.tempoTier])return node.tempoTier;
    if(node.type==='elite'||node.type==='boss')return node.type;
    if(node.type==='battle')return numeric(node.row,0)<=0?'battle_early':'battle_strong';
    return'battle_early';
  }
  function profileFor(nodeOrType){return TEMPO_PROFILES[resolveTempoId(nodeOrType)]}
  function cloneTargetSets(targetSets){return{min:targetSets.min,max:targetSets.max,preferred:targetSets.preferred}}
  function tempoSnapshot(profile){return{stage:STAGE,id:profile.id,label:profile.label,hp:profile.hp,targetSets:cloneTargetSets(profile.targetSets),note:profile.note}}
  function applyEnemyTempo(enemy,nodeOrType){
    if(!enemy||typeof enemy!=='object')throw new TypeError('Enemy definition is required');
    const profile=profileFor(nodeOrType);
    return{...enemy,hp:profile.hp,tempo:tempoSnapshot(profile)};
  }
  function applyTempoToBattle(state,nodeOrType=state?.node||state?.type){
    if(!state?.enemy)throw new TypeError('Active battle enemy is required');
    const profile=profileFor(nodeOrType);
    const oldMax=Math.max(1,numeric(state.enemy.maxHp,numeric(state.enemy.hp,profile.hp)));
    const oldHp=clamp(numeric(state.enemy.hp,oldMax),0,oldMax);
    const ratio=oldHp/oldMax;
    state.enemy.maxHp=profile.hp;
    state.enemy.hp=clamp(Math.round(profile.hp*ratio),0,profile.hp);
    state.tempo=tempoSnapshot(profile);
    state.encounter={...(state.encounter||{}),tempo:tempoSnapshot(profile)};
    return state.tempo;
  }
  function expectedSets(hp,damage){
    const health=Math.max(0,numeric(hp)),amount=numeric(damage);
    if(health===0)return 0;
    if(amount<=0)return Infinity;
    return Math.ceil(health/amount);
  }
  function damageBand(amount){
    const damage=Math.max(0,numeric(amount));
    if(damage>=SHOWDOWN_DAMAGE_BANDS.burst.min)return SHOWDOWN_DAMAGE_BANDS.burst;
    if(damage>=SHOWDOWN_DAMAGE_BANDS.synergy.min)return SHOWDOWN_DAMAGE_BANDS.synergy;
    if(damage>=SHOWDOWN_DAMAGE_BANDS.good.min)return SHOWDOWN_DAMAGE_BANDS.good;
    if(damage>=SHOWDOWN_DAMAGE_BANDS.ordinary.min)return SHOWDOWN_DAMAGE_BANDS.ordinary;
    return LOW_DAMAGE_BAND;
  }
  function withinTargetSets(profileOrNode,setCount){
    const profile=profileOrNode?.targetSets?profileOrNode:profileFor(profileOrNode),sets=numeric(setCount,Infinity),target=profile.targetSets;
    return sets>=target.min&&(target.max===null||sets<=target.max);
  }
  function assessDamage(profileOrNode,damage){
    const profile=profileOrNode?.hp&&profileOrNode?.targetSets?profileOrNode:profileFor(profileOrNode);
    const sets=expectedSets(profile.hp,damage);
    return{
      stage:STAGE,profileId:profile.id,hp:profile.hp,damage:numeric(damage),damageBand:damageBand(damage).id,
      expectedSets:sets,withinTarget:withinTargetSets(profile,sets),targetSets:cloneTargetSets(profile.targetSets)
    };
  }
  function validateProfiles(registry=TEMPO_PROFILES){
    const errors=[];
    for(const [id,profile] of Object.entries(registry||{})){
      if(profile?.id!==id)errors.push(`${id}: id mismatch`);
      if(!['battle','elite','boss'].includes(profile?.encounterType))errors.push(`${id}: invalid encounter type`);
      if(!Number.isFinite(profile?.hp)||profile.hp<=0)errors.push(`${id}: hp must be positive`);
      const target=profile?.targetSets;
      if(!target||!Number.isInteger(target.min)||target.min<1)errors.push(`${id}: invalid target min`);
      if(target?.max!==null&&(!Number.isInteger(target?.max)||target.max<target.min))errors.push(`${id}: invalid target max`);
      if(!Number.isInteger(target?.preferred)||target.preferred<target.min||(target.max!==null&&target.preferred>target.max))errors.push(`${id}: invalid preferred sets`);
    }
    return errors;
  }
  function activeBattle(runtimeRoot=defaultRoot){
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return runtimeRoot?.battle||null;
  }
  function wrapStartBattle(runtimeRoot=defaultRoot){
    const original=runtimeRoot?.startBattle;
    if(typeof original!=='function')return false;
    if(original.__tricklogTempo75E)return true;
    originalStartBattle=original;
    const wrapped=function(node,...args){
      const finalize=result=>{
        const state=activeBattle(runtimeRoot);
        if(state){applyTempoToBattle(state,node||state.node||state.type);runtimeRoot.renderBattle?.()}
        return result;
      };
      const result=original.call(this,node,...args);
      return result&&typeof result.then==='function'?result.then(finalize):finalize(result);
    };
    wrapped.__tricklogTempo75E=true;
    wrapped.__legacyStartBattle=original;
    runtimeRoot.startBattle=wrapped;
    return true;
  }
  function installBrowserRuntime(runtimeRoot=defaultRoot){
    if(installed)return true;
    const errors=validateProfiles();if(errors.length){runtimeRoot?.console?.error?.('[encounter-tempo] 프로필 오류',errors);return false}
    if(!wrapStartBattle(runtimeRoot))return false;
    installed=true;return true;
  }
  function installWhenReady(runtimeRoot=defaultRoot){
    if(typeof document==='undefined')return false;
    let attempts=0;
    const attempt=()=>{if(installBrowserRuntime(runtimeRoot))return;if(attempts++<40)setTimeout(attempt,25);else runtimeRoot?.console?.warn?.('[encounter-tempo] 전투 런타임을 찾지 못했습니다.')};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    return true;
  }

  return{
    STAGE,SHOWDOWN_DAMAGE_BANDS,LOW_DAMAGE_BAND,TEMPO_PROFILES,numeric,resolveTempoId,profileFor,cloneTargetSets,tempoSnapshot,
    applyEnemyTempo,applyTempoToBattle,expectedSets,damageBand,withinTargetSets,assessDamage,validateProfiles,
    activeBattle,wrapStartBattle,installBrowserRuntime,installWhenReady
  };
});
