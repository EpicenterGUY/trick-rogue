(function(root,factory){
  const migration=typeof module!=='undefined'?require('./tactic-card-migration.js'):root.TacticCardMigration;
  const systemTags=typeof module!=='undefined'?require('./card-system-tags.js'):root.CardSystemTags;
  const api=factory(migration,systemTags);
  if(typeof module!=='undefined')module.exports=api;
  root.MigratedTacticCards=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Migration,SystemTags){
  const DIRECT_IDS=Object.freeze(['paint','plus2','barrier','reverse','recolor','fakeid']);
  const ACTIVE_IDS=Object.freeze(Migration?.ACTIVE_IDS?[...Migration.ACTIVE_IDS]:['paint','plus2','draw','scout','double','barrier','burn','reverse','pureboost','clean','recolor','fakeid']);
  const META=Object.freeze({
    paint:Object.freeze({id:'core.paint',activation:'이 카드를 낼 때',terms:Object.freeze(['트릭값','트럼프','인쇄값','쇼다운값'])}),
    plus2:Object.freeze({id:'core.plus2',activation:'이 카드를 낼 때',terms:Object.freeze(['트릭값','인쇄값'])}),
    draw:Object.freeze({id:'core.draw',activation:'이 카드를 낼 때',terms:Object.freeze(['트릭','손패','드로우'])}),
    scout:Object.freeze({id:'core.scout',activation:'이 카드를 낼 때',terms:Object.freeze(['트릭','예측','칩','인쇄값'])}),
    double:Object.freeze({id:'core.double',activation:'이 카드를 낼 때',terms:Object.freeze(['트릭','칩','적용 숫자'])}),
    barrier:Object.freeze({id:'core.barrier',activation:'이 카드를 낼 때',terms:Object.freeze(['트릭','보호막'])}),
    burn:Object.freeze({id:'core.burn',activation:'이 카드를 낼 때',terms:Object.freeze(['손패','버림','칩','드로우']),targeting:Object.freeze({zone:'hand',count:1,excludeSelf:true})}),
    reverse:Object.freeze({id:'core.reverse',activation:'이 카드를 낼 때',terms:Object.freeze(['트릭','트릭값'])}),
    pureboost:Object.freeze({id:'core.pureboost',activation:'이 카드를 낼 때',terms:Object.freeze(['순수 카드','쇼다운','쇼다운 슬롯','트릭값'])}),
    clean:Object.freeze({id:'core.clean',activation:'이 카드로 트릭 승리 시',terms:Object.freeze(['순수 카드','쇼다운','트릭','칩'])}),
    recolor:Object.freeze({id:'core.recolor',activation:'이 카드를 낼 때',terms:Object.freeze(['쇼다운값','트럼프'])}),
    fakeid:Object.freeze({id:'core.fakeid',activation:'이 카드를 낼 때',terms:Object.freeze(['쇼다운값','쇼다운 슬롯'])})
  });

  function createDefinition(legacyId){
    const plan=Migration?.BY_ID?.[legacyId];const meta=META[legacyId];
    if(!plan||!Array.isArray(plan.proposedEffects)||!plan.proposedEffects.length||!meta)throw new TypeError(`Unknown active tactic migration: ${legacyId}`);
    const effects=plan.proposedEffects.map(effect=>Object.freeze({
      ...effect,
      ...(Array.isArray(effect.conditions)?{conditions:Object.freeze(effect.conditions.map(item=>Object.freeze({...item})))}:{}),
      ...(Array.isArray(effect.tiers)?{tiers:Object.freeze(effect.tiers.map(item=>Object.freeze({...item})))}:{})
    }));
    const targeting=meta.targeting||plan.targeting||null;
    const definition={
      id:meta.id,name:plan.name,short:plan.name,suit:plan.printedSuit,rank:plan.printedRank,printedSuit:plan.printedSuit,printedRank:plan.printedRank,
      description:plan.cardText,activation:meta.activation,terms:meta.terms,effects:Object.freeze(effects),targeting:targeting?Object.freeze({...targeting}):null,
      implemented:true,category:'general',rarity:'common',legacyTacticId:legacyId,migrationStage:plan.activationStage||'7.5-P'
    };
    return typeof SystemTags?.decorateDefinition==='function'?SystemTags.decorateDefinition(definition):Object.freeze(definition);
  }

  const ACTIVE_CARD_DEFINITIONS=Object.freeze(ACTIVE_IDS.map(createDefinition));
  const ACTIVE_CARD_BY_ID=Object.freeze(Object.fromEntries(ACTIVE_CARD_DEFINITIONS.map(card=>[card.id,card])));
  const ACTIVE_CARD_BY_LEGACY_ID=Object.freeze(Object.fromEntries(ACTIVE_CARD_DEFINITIONS.map(card=>[card.legacyTacticId,card])));
  const ACTIVE_CARD_BY_BASE=Object.freeze(Object.fromEntries(ACTIVE_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card])));
  const DIRECT_CARD_DEFINITIONS=Object.freeze(DIRECT_IDS.map(id=>ACTIVE_CARD_BY_LEGACY_ID[id]));
  const DIRECT_CARD_BY_ID=Object.freeze(Object.fromEntries(DIRECT_CARD_DEFINITIONS.map(card=>[card.id,card])));
  const DIRECT_CARD_BY_LEGACY_ID=Object.freeze(Object.fromEntries(DIRECT_CARD_DEFINITIONS.map(card=>[card.legacyTacticId,card])));
  const DIRECT_CARD_BY_BASE=Object.freeze(Object.fromEntries(DIRECT_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card])));

  function validateDefinitions(){
    const errors=[];const ids=new Set(),slots=new Set();
    for(const card of ACTIVE_CARD_DEFINITIONS){
      if(ids.has(card.id))errors.push(`duplicate id: ${card.id}`);else ids.add(card.id);
      const slot=`${card.suit}${card.rank}`;if(slots.has(slot))errors.push(`duplicate slot: ${slot}`);else slots.add(slot);
      if(!Migration.SUITS.includes(card.suit))errors.push(`${card.id}: invalid suit ${card.suit}`);
      if(!Migration.RANKS.includes(card.rank))errors.push(`${card.id}: invalid rank ${card.rank}`);
      if(!Array.isArray(card.effects)||!card.effects.length)errors.push(`${card.id}: missing effects`);
      if(card.category!=='general')errors.push(`${card.id}: must be a general card`);
      if(!card.migrationStage)errors.push(`${card.id}: missing migration stage`);
      if(typeof SystemTags?.validateDefinition==='function')for(const issue of SystemTags.validateDefinition(card))errors.push(`${card.id}: ${issue}`);
      if(card.legacyTacticId==='burn'&&(!card.targeting||card.targeting.zone!=='hand'||card.targeting.count!==1||card.targeting.excludeSelf!==true))errors.push('core.burn: invalid hand targeting');
    }
    return errors;
  }

  return{DIRECT_IDS,ACTIVE_IDS,META,ACTIVE_CARD_DEFINITIONS,ACTIVE_CARD_BY_ID,ACTIVE_CARD_BY_LEGACY_ID,ACTIVE_CARD_BY_BASE,DIRECT_CARD_DEFINITIONS,DIRECT_CARD_BY_ID,DIRECT_CARD_BY_LEGACY_ID,DIRECT_CARD_BY_BASE,createDefinition,validateDefinitions};
});
