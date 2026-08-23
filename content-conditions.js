(function(root,factory){
  const api=factory(typeof module!=='undefined'?require('./effects.js'):root.CardEffects);
  if(typeof module!=='undefined')module.exports=api;
  root.ContentConditions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(CardEffects){
  if(!CardEffects||!CardEffects.conditions)throw new Error('CardEffects conditions are required');
  const conditions=CardEffects.conditions;

  function effectiveSuit(context){
    return context?.trickSuit
      ??context?.effectiveSuit
      ??context?.card?.trickSuit
      ??context?.card?.effectiveSuit
      ??context?.card?.suit
      ??null;
  }
  function currentTrump(context){
    return context?.trump??context?.battle?.trump??null;
  }
  function riverHit(context){
    return context?.riverHit?.active===true
      ||context?.battle?.riverHit?.active===true
      ||context?.showdown?.riverHit?.active===true;
  }

  conditions.effective_suit_is_trump=context=>{
    const trump=currentTrump(context);
    return !!trump&&effectiveSuit(context)===trump;
  };
  conditions.river_hit=context=>riverHit(context);

  return Object.freeze({
    stage:'9-A',
    conditionIds:Object.freeze(['effective_suit_is_trump','river_hit']),
    effectiveSuit,
    currentTrump,
    riverHit
  });
});
