(function(root,factory){
  const effectApi=typeof module!=='undefined'?require('../effects.js'):root.CardEffects;
  const enemyInformation=typeof module!=='undefined'?require('../enemy-information.js'):root.EnemyInformation;
  const personality=typeof module!=='undefined'?require('../card-personality-runtime.js'):root.CardPersonalityRuntime;
  const value=factory(root,effectApi,enemyInformation,personality);
  if(typeof module!=='undefined')module.exports=value;
  root.EFFECT70_BATCH1_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,effectApi,nodeEnemyInformation,nodePersonality){
  const MEMORY_KEY='cardEffectMemory';

  function activeBattle(context={}){
    if(context?.battle)return context.battle;
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return root?.battle||null;
  }
  function currentSet(context={}){return Number(context.setIndex??context.set??context.battle?.setIndex??context.battle?.set??1)}
  function enemyInfo(){return root?.EnemyInformation||nodeEnemyInformation||null}
  function personalityApi(){return root?.CardPersonalityRuntime||nodePersonality||null}
  function currentEnemy(context={}){const state=activeBattle(context);return context.enemyCard||state?.enemyCard||null}
  function currentEnemyExplicitExact(context={}){
    const state=activeBattle(context),enemy=currentEnemy(context),api=enemyInfo();
    if(!state||!enemy||typeof api?.ensureState!=='function')return false;
    const info=api.ensureState(state);
    return info.currentExact===true&&info.currentCard===enemy;
  }
  function memoryFor(card){
    const api=personalityApi();
    if(typeof api?.memoryFor==='function')return api.memoryFor(card);
    if(!card||typeof card!=='object')return null;
    if(!card[MEMORY_KEY]||typeof card[MEMORY_KEY]!=='object')card[MEMORY_KEY]={};
    return card[MEMORY_KEY];
  }
  function setMemory(card,key,value,context={}){
    const api=personalityApi();
    if(typeof api?.setCardMemory==='function')return api.setCardMemory(card,key,value,context);
    if(!key)return null;const memory=memoryFor(card);if(!memory)return null;
    memory[key]={value:Number(value)||0,setIndex:currentSet(context)};return memory[key];
  }
  function getMemory(card,key,context={}){
    const api=personalityApi();
    if(typeof api?.getCardMemory==='function')return api.getCardMemory(card,key,context);
    const entry=card?.[MEMORY_KEY]?.[key];if(!entry)return null;
    if(entry.setIndex!==undefined&&Number.isFinite(currentSet(context))&&entry.setIndex!==currentSet(context))return null;
    return entry;
  }
  function ensureAction(api,name,handler){
    if(!api?.ACTIONS||!api?.registerActionHandler)return false;
    if(!api.ACTIONS.includes(name))api.ACTIONS.push(name);
    api.registerActionHandler(name,handler);return true;
  }
  function installConditions(api){
    if(!api?.conditions)return false;
    api.conditions.current_enemy_exact=context=>currentEnemyExplicitExact(context);
    return true;
  }
  function installActions(api){
    if(!api?.registerActionHandler)return false;
    ensureAction(api,'snapshot_enemy_rank_for_showdown',(context,_value,effect)=>{
      const card=context.card,enemy=currentEnemy(context);if(!card||!enemy)return null;
      const rank=Number(enemy.printedRank??enemy.rank);if(!Number.isFinite(rank))return null;
      setMemory(card,effect.memoryKey||'enemy_printed_rank',rank,context);
      card.showdownRank=rank;
      return rank;
    });
    ensureAction(api,'set_trick_rank_below_enemy',(context,_value,effect)=>{
      const state=activeBattle(context),card=context.card,enemy=currentEnemy(context);if(!state||!card||!enemy)return null;
      const enemyRank=Number(enemy.printedRank??enemy.rank),printed=Number(card.printedRank??card.rank);
      if(!Number.isFinite(enemyRank)||!Number.isFinite(printed))return null;
      const floor=Math.max(2,Number(effect.minRank)||2),offset=Math.max(0,Number(effect.offset)||1),target=Math.max(floor,enemyRank-offset);
      if(!state.mods||typeof state.mods!=='object')state.mods={};
      const current=printed+(Number(state.mods.plus)||0)+(Number(card.effectiveRankBonus)||0);
      state.mods.plus=(Number(state.mods.plus)||0)+(target-current);
      setMemory(card,effect.memoryKey||'enemy_below_applied',1,context);
      return target;
    });
    ensureAction(api,'restore_showdown_rank_from_memory',(context,_value,effect)=>{
      const rank=getMemory(context.card,effect.memoryKey||'enemy_printed_rank',context)?.value;
      if(!context.card||!Number.isFinite(rank))return null;
      context.card.showdownRank=rank;return rank;
    });
    return true;
  }
  function install(api=effectApi){return installConditions(api)&&installActions(api)}
  install(effectApi);
  if(typeof document!=='undefined'&&!effectApi)document.addEventListener('DOMContentLoaded',()=>install(root.CardEffects),{once:true});

  return [
    {
      id:'effect70.observation_record',name:'관측 기록',short:'관측 기록',suit:'C',rank:9,
      description:'낼 때 — 현재 적 카드가 플레이 전에 정확히 공개되어 있었다면 그 인쇄 숫자를 기록한다. 쇼다운에서는 이 카드의 숫자 대신 기록한 숫자를 사용한다. 트릭 숫자와 인쇄값은 변하지 않는다.',
      terms:['예측','인쇄값','쇼다운','족보'],systemTags:['예측','족보','쇼다운 개입'],image:'assets/cards/pack01/ambush_observer.png',art:'observation_record',
      effects:[
        {trigger:'on_play',action:'snapshot_enemy_rank_for_showdown',condition:'current_enemy_exact',memoryKey:'enemy_printed_rank',duration:'set'},
        {trigger:'on_showdown_score',action:'restore_showdown_rank_from_memory',memoryKey:'enemy_printed_rank',duration:'set'}
      ]
    },
    {
      id:'effect70.reverse_table',name:'역산표',short:'역산표',suit:'D',rank:4,
      description:'비교 전 — 현재 적 카드가 플레이 전에 정확히 공개되어 있었다면 이번 트릭 기본 숫자를 적 인쇄 숫자 -1로 맞춘다(최소 2). 이 효과가 적용된 트릭에서 패배하면 칩 +2. 쇼다운에서는 인쇄 4를 유지한다.',
      terms:['예측','인쇄값','적용 숫자','패배','칩'],systemTags:['예측','적용값 감소','칩'],image:'assets/cards/pack01/dirty_gambler.png',art:'reverse_table',
      effects:[
        {trigger:'before_compare',action:'set_trick_rank_below_enemy',condition:'current_enemy_exact',offset:1,minRank:2,memoryKey:'enemy_below_applied',duration:'trick'},
        {trigger:'on_trick_loss',action:'gain_chips',value:2,condition:'card_memory_at_least',conditionValue:1,memoryKey:'enemy_below_applied',duration:'trick'}
      ]
    },
    {
      id:'effect70.signal_flare',name:'신호탄',short:'신호탄',suit:'S',rank:5,
      description:'승리 — 적에게 피해 2. 그리고 다음 트릭의 적 카드를 정확히 공개한다.',
      terms:['트릭','피해','예측'],systemTags:['직접 피해','예측'],image:'assets/cards/pack01/black_bullet.png',art:'signal_flare',
      effects:[
        {trigger:'on_trick_win',action:'damage_enemy',value:2,duration:'trick'},
        {trigger:'on_trick_win',action:'reveal_next_enemy_card',duration:'trick'}
      ]
    },
    {
      id:'effect70.film_roll',name:'필름 롤',short:'필름 롤',suit:'H',rank:6,
      description:'낼 때 — 현재 적 카드가 플레이 전에 정확히 공개되어 있었다면 다음 트릭의 최대 손패 +1, 보충 드로우 +1.',
      terms:['예측','손패','드로우'],systemTags:['예측','손패'],image:'assets/cards/pack01/golden_hand.png',art:'film_roll',
      effects:[{trigger:'on_play',action:'grant_next_trick_hand_capacity',value:1,condition:'current_enemy_exact',duration:'trick'}]
    }
  ];
});
