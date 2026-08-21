(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined')module.exports=api;
  root.MigratedTacticRuntime=api;
  if(typeof document!=='undefined')api.installWhenReady();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  let installed=false;
  let originalBaseDeck=null;
  let originalBeginRun=null;
  let originalEffectContext=null;
  let originalInspectCard=null;
  let originalPoolItemFromCard=null;
  let originalShortFrontLabel=null;

  function migratedDefinition(card){
    const definition=card?.definition||null;
    return definition?.category==='general'&&definition?.migrationStage==='3-1'&&definition?.legacyTacticId?definition:null;
  }
  function isMigratedCard(card){return!!migratedDefinition(card)}
  function setupDeckCard(card){
    const next={...card,uid:Math.random().toString(36).slice(2),effects:Array.isArray(card?.effects)?card.effects.map(effect=>({...effect})):[]};
    if(isMigratedCard(next)&&!next.named){
      // beginRun의 레거시 "순수 카드 제거"가 효과 카드를 지우지 않도록 덱 조립 중에만 alias를 둔다.
      next.named=next.definition;
      next.__migrationSetupAlias=true;
    }
    return next;
  }
  function cleanSetupAliases(deck){
    if(!Array.isArray(deck))return deck;
    for(const card of deck){
      if(!card?.__migrationSetupAlias)continue;
      card.named=null;
      delete card.__migrationSetupAlias;
    }
    return deck;
  }
  function withUiAlias(card,callback){
    if(!isMigratedCard(card)||card.named)return callback();
    card.named=card.definition;
    try{return callback()}finally{card.named=null}
  }
  function installBaseDeckAdapter(){
    if(typeof root.baseDeck!=='function'||typeof root.createBaseCardSlots!=='function')return false;
    if(root.baseDeck.__migratedTacticCards)return true;
    originalBaseDeck=root.baseDeck;
    const migratedBaseDeck=function(){return root.createBaseCardSlots().map(setupDeckCard)};
    migratedBaseDeck.__migratedTacticCards=true;
    migratedBaseDeck.__legacyBaseDeck=originalBaseDeck;
    root.baseDeck=migratedBaseDeck;
    return true;
  }
  function installBeginRunAdapter(){
    if(typeof root.beginRun!=='function')return false;
    if(root.beginRun.__migratedTacticCards)return true;
    originalBeginRun=root.beginRun;
    const migratedBeginRun=function(...args){
      const result=originalBeginRun.apply(this,args);
      try{
        if(typeof run!=='undefined'&&run?.deck){
          cleanSetupAliases(run.deck);
          if(typeof renderMap==='function')renderMap();
        }
      }catch(error){console.error('[migrated-tactic-runtime] 덱 alias 정리 실패',error)}
      return result;
    };
    migratedBeginRun.__migratedTacticCards=true;
    migratedBeginRun.__legacyBeginRun=originalBeginRun;
    root.beginRun=migratedBeginRun;
    return true;
  }
  function installEffectContextAdapter(){
    if(typeof root.effectContext!=='function')return false;
    if(root.effectContext.__migratedTacticCards)return true;
    originalEffectContext=root.effectContext;
    const migratedEffectContext=function(card,extra={}){
      const context=originalEffectContext(card,extra);
      if(!isMigratedCard(card)||typeof context?.perform!=='function')return context;
      const legacyPerform=context.perform.bind(context);
      context.perform=function(action,value,effect={}){
        if(action==='set_next_trick_suit_to_trump'){
          battle.mods.paint=true;
          return;
        }
        if(action==='increase_next_trick_rank'){
          battle.mods.plus+=(value||0);
          return;
        }
        if(action==='set_reverse_compare'){
          battle.mods.reverse=true;
          return;
        }
        if(action==='set_last_showdown_suit_to_trump'){
          const slot=battle.slots[battle.slots.length-1];
          if(slot)slot.card.showdownSuit=battle.trump;
          return;
        }
        if(action==='increase_last_showdown_rank'){
          const slot=battle.slots[battle.slots.length-1];
          if(slot)slot.card.showdownRank=Math.min(14,root.BattleCore.showdownValue(slot.card,'Rank')+(value||0));
          return;
        }
        return legacyPerform(action,value,effect);
      };
      return context;
    };
    migratedEffectContext.__migratedTacticCards=true;
    migratedEffectContext.__legacyEffectContext=originalEffectContext;
    root.effectContext=migratedEffectContext;
    return true;
  }
  function installUiAdapters(){
    if(typeof root.inspectCard==='function'&&!root.inspectCard.__migratedTacticCards){
      originalInspectCard=root.inspectCard;
      const migratedInspectCard=function(card,...args){return withUiAlias(card,()=>originalInspectCard.call(this,card,...args))};
      migratedInspectCard.__migratedTacticCards=true;
      root.inspectCard=migratedInspectCard;
    }
    if(typeof root.poolItemFromCard==='function'&&!root.poolItemFromCard.__migratedTacticCards){
      originalPoolItemFromCard=root.poolItemFromCard;
      const migratedPoolItemFromCard=function(card,...args){return withUiAlias(card,()=>originalPoolItemFromCard.call(this,card,...args))};
      migratedPoolItemFromCard.__migratedTacticCards=true;
      root.poolItemFromCard=migratedPoolItemFromCard;
    }
    if(typeof root.shortFrontLabel==='function'&&!root.shortFrontLabel.__migratedTacticCards){
      originalShortFrontLabel=root.shortFrontLabel;
      const migratedShortFrontLabel=function(card){return migratedDefinition(card)?.name||originalShortFrontLabel.call(this,card)};
      migratedShortFrontLabel.__migratedTacticCards=true;
      root.shortFrontLabel=migratedShortFrontLabel;
    }
    return true;
  }
  function install(){
    if(installed)return true;
    if(typeof root.baseDeck!=='function'||typeof root.beginRun!=='function'||typeof root.effectContext!=='function')return false;
    installBaseDeckAdapter();
    installBeginRunAdapter();
    installEffectContextAdapter();
    installUiAdapters();
    installed=true;
    return true;
  }
  function installWhenReady(){
    if(typeof document==='undefined')return false;
    const attempt=()=>{
      if(install())return;
      setTimeout(()=>{if(!install())console.warn('[migrated-tactic-runtime] 전투 런타임을 찾지 못했습니다.')},0);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attempt,{once:true});else attempt();
    return true;
  }
  return{migratedDefinition,isMigratedCard,setupDeckCard,cleanSetupAliases,installBaseDeckAdapter,installBeginRunAdapter,installEffectContextAdapter,installUiAdapters,install,installWhenReady};
});
