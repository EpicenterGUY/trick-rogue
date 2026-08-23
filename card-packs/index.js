(function(root,factory){
  const api=factory(
    typeof module!=='undefined'?require('./pack01.js'):root.PACK01_CARDS,
    typeof module!=='undefined'?require('./pack02.js'):root.PACK02_CARDS
  );
  if(typeof module!=='undefined')module.exports=api;
  Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(PACK01_CARDS,PACK02_CARDS){
  const makePack=(metadata,cards)=>Object.freeze({
    ...metadata,
    cards:Object.freeze(cards),
    cardIds:Object.freeze(cards.map(card=>card.id))
  });

  // Extension point: import a pack module above and add one metadata entry here.
  const CARD_PACK_LIST=Object.freeze([
    makePack({id:'pack01',name:'신규 1팩',version:'1.0.0',enabledByDefault:true,rewardWeight:1},PACK01_CARDS),
    makePack({id:'pack02',name:'조건부 고점팩',version:'1.0.0',enabledByDefault:true,rewardWeight:1},PACK02_CARDS)
  ]);
  const CARD_PACKS=Object.freeze(Object.fromEntries(CARD_PACK_LIST.map(pack=>[pack.id,pack])));

  function validateEnabledPacks(enabledPacks){
    if(!Array.isArray(enabledPacks))throw new TypeError('enabledPacks must be an array');
    const unknown=enabledPacks.filter(id=>!Object.hasOwn(CARD_PACKS,id));
    if(unknown.length)throw new RangeError(`Unknown enabledPacks reference: ${unknown.join(', ')}`);
    return [...new Set(enabledPacks)];
  }
  function defaultEnabledPacks(){
    return CARD_PACK_LIST.filter(pack=>pack.enabledByDefault).map(pack=>pack.id);
  }
  function createRunPackState(enabledPacks=defaultEnabledPacks()){
    return {enabledPacks:validateEnabledPacks(enabledPacks)};
  }

  return{CARD_PACK_LIST,CARD_PACKS,defaultEnabledPacks,validateEnabledPacks,createRunPackState};
});
