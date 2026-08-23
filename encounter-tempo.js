(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.EncounterTempo=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STAGE='7.5-E';

  const SHOWDOWN_DAMAGE_BANDS=Object.freeze({
    ordinary:Object.freeze({id:'ordinary',label:'평범한 쇼다운',min:10,max:30}),
    good:Object.freeze({id:'good',label:'잘 풀린 쇼다운',min:30,max:50}),
    synergy:Object.freeze({id:'synergy',label:'강한 시너지',min:50,max:80}),
    burst:Object.freeze({id:'burst',label:'고점',min:100,max:null})
  });

  const TEMPO_PROFILES=Object.freeze({
    battle_early:Object.freeze({
      id:'battle_early',encounterType:'battle',label:'초반 일반전',hp:24,
      targetSets:Object.freeze({min:1,max:2,preferred:1}),
      note:'잘 풀린 첫 쇼다운으로 끝내는 것이 기본이며 약한 쇼다운은 2세트까지 허용한다.'
    }),
    battle_strong:Object.freeze({
      id:'battle_strong',encounterType:'battle',label:'강한 일반전',hp:36,
      targetSets:Object.freeze({min:1,max:2,preferred:2}),
      note:'좋은 쇼다운은 1세트 처치가 가능하지만 평범한 전개는 2세트를 허용한다.'
    }),
    elite:Object.freeze({
      id:'elite',encounterType:'elite',label:'엘리트',hp:64,
      targetSets:Object.freeze({min:2,max:3,preferred:2}),
      note:'일반전보다 확실히 오래 버티되 장기전 빌드가 작동할 2~3세트를 목표로 한다.'
    }),
    boss:Object.freeze({
      id:'boss',encounterType:'boss',label:'보스',hp:120,
      targetSets:Object.freeze({min:3,max:null,preferred:4}),
      note:'보스 페이즈와 장기전 효과가 실제로 작동하도록 보통 3세트 이상을 목표로 한다.'
    })
  });

  function numeric(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
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
  function applyEnemyTempo(enemy,nodeOrType){
    if(!enemy||typeof enemy!=='object')throw new TypeError('Enemy definition is required');
    const profile=profileFor(nodeOrType);
    return{
      ...enemy,
      hp:profile.hp,
      tempo:{stage:STAGE,id:profile.id,label:profile.label,targetSets:cloneTargetSets(profile.targetSets),note:profile.note}
    };
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
    return Object.freeze({id:'low',label:'저점 쇼다운',min:0,max:10});
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

  return{STAGE,SHOWDOWN_DAMAGE_BANDS,TEMPO_PROFILES,numeric,resolveTempoId,profileFor,applyEnemyTempo,expectedSets,damageBand,withinTargetSets,assessDamage,validateProfiles};
});
