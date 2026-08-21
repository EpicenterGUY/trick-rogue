(function(root,factory){
  const migration=typeof module!=='undefined'?require('./tactic-card-migration.js'):root.TacticCardMigration;
  const api=factory(migration);
  if(typeof module!=='undefined')module.exports=api;
  root.MigratedTacticCards=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Migration){
  const DIRECT_IDS=Object.freeze(['paint','plus2','barrier','reverse','recolor','fakeid']);
  const META=Object.freeze({
    paint:Object.freeze({id:'core.paint',terms:Object.freeze(['트릭값','트럼프','인쇄값','쇼다운값'])}),
    plus2:Object.freeze({id:'core.plus2',terms:Object.freeze(['트릭값','인쇄값'])}),
    barrier:Object.freeze({id:'core.barrier',terms:Object.freeze(['보호막'])}),
    reverse:Object.freeze({id:'core.reverse',terms:Object.freeze(['트릭','트릭값'])}),
    recolor:Object.freeze({id:'core.recolor',terms:Object.freeze(['쇼다운값','트럼프'])}),
    fakeid:Object.freeze({id:'core.fakeid',terms:Object.freeze(['쇼다운값'])})
  });

  function createDefinition(legacyId){
    const plan=Migration?.BY_ID?.[legacyId];
    const meta=META[legacyId];
    if(!plan||plan.status!=='direct'||!meta)throw new TypeError(`Unknown direct tactic migration: ${legacyId}`);
    const effects=plan.proposedEffects.map(effect=>Object.freeze({...effect}));
    return Object.freeze({
      id:meta.id,
      name:plan.name,
      short:plan.name,
      suit:plan.printedSuit,
      rank:plan.printedRank,
      printedSuit:plan.printedSuit,
      printedRank:plan.printedRank,
      description:`발동: 이 카드를 낼 때. 효과: ${plan.cardText}`,
      terms:meta.terms,
      effects:Object.freeze(effects),
      implemented:true,
      category:'general',
      rarity:'common',
      legacyTacticId:legacyId,
      migrationStage:'3-1'
    });
  }

  const DIRECT_CARD_DEFINITIONS=Object.freeze(DIRECT_IDS.map(createDefinition));
  const DIRECT_CARD_BY_ID=Object.freeze(Object.fromEntries(DIRECT_CARD_DEFINITIONS.map(card=>[card.id,card])));
  const DIRECT_CARD_BY_LEGACY_ID=Object.freeze(Object.fromEntries(DIRECT_CARD_DEFINITIONS.map(card=>[card.legacyTacticId,card])));
  const DIRECT_CARD_BY_BASE=Object.freeze(Object.fromEntries(DIRECT_CARD_DEFINITIONS.map(card=>[`${card.suit}${card.rank}`,card])));

  function validateDefinitions(){
    const errors=[];
    const ids=new Set(),slots=new Set();
    for(const card of DIRECT_CARD_DEFINITIONS){
      if(ids.has(card.id))errors.push(`duplicate id: ${card.id}`);else ids.add(card.id);
      const slot=`${card.suit}${card.rank}`;
      if(slots.has(slot))errors.push(`duplicate slot: ${slot}`);else slots.add(slot);
      if(!Migration.SUITS.includes(card.suit))errors.push(`${card.id}: invalid suit ${card.suit}`);
      if(!Migration.RANKS.includes(card.rank))errors.push(`${card.id}: invalid rank ${card.rank}`);
      if(!Array.isArray(card.effects)||!card.effects.length)errors.push(`${card.id}: missing effects`);
      if(card.category!=='general')errors.push(`${card.id}: must be a general card`);
    }
    return errors;
  }

  return{DIRECT_IDS,META,DIRECT_CARD_DEFINITIONS,DIRECT_CARD_BY_ID,DIRECT_CARD_BY_LEGACY_ID,DIRECT_CARD_BY_BASE,createDefinition,validateDefinitions};
});
