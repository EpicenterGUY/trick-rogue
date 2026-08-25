(function(root,factory){
  const effectApi=typeof module!=='undefined'?require('../effects.js'):root.CardEffects;
  const value=factory(root,effectApi);
  if(typeof module!=='undefined')module.exports=value;
  root.PACK03_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,effectApi){
  const MEMORY_KEY='cardEffectMemory';

  function activeBattle(context={}){
    if(context?.battle)return context.battle;
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return root?.battle||null;
  }

  function currentSet(context={}){
    return Number(context.setIndex??context.set??context.battle?.setIndex??context.battle?.set??1);
  }

  function memoryFor(card){
    if(!card||typeof card!=='object')return null;
    if(!card[MEMORY_KEY]||typeof card[MEMORY_KEY]!=='object')card[MEMORY_KEY]={};
    return card[MEMORY_KEY];
  }

  function setMemory(card,key,value,context={}){
    if(!key)return null;
    const memory=memoryFor(card);if(!memory)return null;
    memory[key]={value:Number(value)||0,setIndex:currentSet(context)};
    return memory[key];
  }

  function getMemory(card,key,context={}){
    const entry=card?.[MEMORY_KEY]?.[key];if(!entry)return null;
    if(entry.setIndex!==undefined&&Number.isFinite(currentSet(context))&&entry.setIndex!==currentSet(context))return null;
    return entry;
  }

  function effectList(card){
    if(Array.isArray(card?.effects))return card.effects;
    if(Array.isArray(card?.definition?.effects))return card.definition.effects;
    if(Array.isArray(card?.named?.effects))return card.named.effects;
    return [];
  }

  function slotCard(entry){return entry?.card||entry||null}

  function isEffectCard(entry){
    const card=slotCard(entry);
    if(!card||typeof card!=='object')return false;
    return effectList(card).length>0||!!card.cardId||!!card.definition||!!card.named;
  }

  function ensureAction(api,name,handler){
    if(!api?.ACTIONS||!api?.registerActionHandler)return false;
    if(!api.ACTIONS.includes(name))api.ACTIONS.push(name);
    api.registerActionHandler(name,handler);
    return true;
  }

  function installActions(api){
    if(!api?.registerActionHandler)return false;

    ensureAction(api,'reserve_delayed_damage',(context,value,effect)=>{
      const state=activeBattle(context);
      if(!state)return null;
      const currentTrick=Number(context.trick??state.trick??1);
      const currentSet=Number(context.setIndex??state.setIndex??1);
      const delay=Math.max(1,Math.floor(Number(effect.delayTricks)||2));
      const targetTrick=currentTrick+delay;
      if(targetTrick>5)return null;
      if(!Array.isArray(state.reservations))state.reservations=[];
      const reservation=api.createReservation({
        type:'delayedDamage',
        timing:'on_trick_result',
        duration:'set',
        consume:'when_due',
        action:'damage_enemy',
        value:Number(value)||0,
        eligibleSet:currentSet,
        eligibleTrick:targetTrick,
        label:`${delay}트릭 뒤 피해 ${Number(value)||0}`,
        ownerType:'card',
        ownerId:context.card?.cardId||context.card?.definition?.id||context.card?.named?.id||context.card?.id||'pack03.time_bomb'
      });
      state.reservations.push(reservation);
      return reservation;
    });

    ensureAction(api,'showdown_power_from_adjacent_effect_cards',(context,value,effect)=>{
      const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots;
      const index=Number(context.slotIndex);
      if(!Array.isArray(slots)||!Number.isInteger(index))return 0;
      const neighbors=[slots[index-1],slots[index+1]].filter(Boolean);
      const infected=neighbors.filter(isEffectCard).length;
      if(infected<=0)return 0;
      const base=Number(value)||0;
      const bonus=infected*base+(infected===2?(Number(effect.bothBonus)||0):0);
      if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);
      return bonus;
    });

    ensureAction(api,'copy_previous_showdown_card',(context)=>{
      const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots;
      const index=Number(context.slotIndex);
      if(!Array.isArray(slots)||!Number.isInteger(index)||index<1||!context.card)return null;
      const previous=slotCard(slots[index-1]);
      if(!previous)return null;
      const rank=previous.showdownRank??previous.printedRank??previous.rank;
      const suit=previous.showdownSuit??previous.printedSuit??previous.suit;
      if(rank===undefined||suit===undefined)return null;
      context.card.showdownRank=rank;
      context.card.showdownSuit=suit;
      return{rank,suit};
    });

    ensureAction(api,'russian_roulette_rank',(context,_value,effect)=>{
      const state=activeBattle(context),card=context.card;
      if(!state||!card)return null;
      const rng=typeof context.random==='function'?context.random:Math.random;
      const chance=Math.max(0,Math.min(1,Number(effect.fireChance) || (1/6)));
      const fired=Number(rng())<chance;
      const target=fired?(Number(effect.failRank)||2):(Number(effect.safeRank)||14);
      const printed=Number(card.printedRank??card.rank);
      if(!Number.isFinite(printed)||!Number.isFinite(target))return null;
      if(!state.mods||typeof state.mods!=='object')state.mods={};
      state.mods.plus=(Number(state.mods.plus)||0)+(target-printed);
      setMemory(card,effect.memoryKey||'roulette_fired',fired?1:0,context);
      return target;
    });

    ensureAction(api,'mark_card_memory',(context,value,effect)=>{
      return setMemory(context.card,effect.memoryKey||'marked',value===undefined?1:value,context);
    });

    ensureAction(api,'showdown_power_if_memory',(context,value,effect)=>{
      const stored=getMemory(context.card,effect.memoryKey||'marked',context);
      if(!stored||stored.value<(Number(effect.memoryAtLeast)||1))return 0;
      const bonus=Number(value)||0;
      if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);
      return bonus;
    });

    return true;
  }

  installActions(effectApi);
  if(typeof document!=='undefined'&&!effectApi){
    document.addEventListener('DOMContentLoaded',()=>installActions(root.CardEffects),{once:true});
  }

  return [
    {
      id:'pack03.time_bomb',name:'시한폭탄',short:'시한폭탄',suit:'S',rank:2,
      description:'낼 때 — 1~3번째 트릭이라면 두 트릭 뒤 종료에 적에게 피해 12를 예약한다. 4~5번째 트릭에서는 불발한다.',
      terms:['예약','트릭','피해'],image:'assets/cards/pack01/scheduled_delivery.png',packId:'pack03',art:'placeholder_time_bomb',
      effects:[{trigger:'on_play',action:'reserve_delayed_damage',value:12,delayTricks:2,duration:'set'}]
    },
    {
      id:'pack03.bad_check',name:'부도수표',short:'부도수표',suit:'C',rank:12,
      description:'낼 때 — 이번 트릭 적용 숫자 +8. 쇼다운 — 쇼다운 위력 -10. 지금 힘을 빌리고 마지막에 갚는다.',
      terms:['트릭','적용 숫자','쇼다운','최종 위력'],image:'assets/cards/pack01/golden_hand.png',packId:'pack03',art:'placeholder_bad_check',
      effects:[
        {trigger:'on_play',action:'increase_next_trick_rank',value:8,duration:'trick'},
        {trigger:'on_showdown_score',action:'showdown_power',value:-10,duration:'set'}
      ]
    },
    {
      id:'pack03.infection',name:'감염 카드',short:'감염 카드',suit:'C',rank:4,
      description:'쇼다운 — 바로 양옆 슬롯의 효과 카드를 감염시켜 각 1장당 쇼다운 위력 +4. 양쪽 모두 효과 카드면 추가 +4.',
      terms:['쇼다운','쇼다운 슬롯','최종 위력'],image:'assets/cards/pack01/sharp_glass.png',packId:'pack03',art:'placeholder_infection',
      effects:[{trigger:'on_showdown_score',action:'showdown_power_from_adjacent_effect_cards',value:4,bothBonus:4,duration:'set'}]
    },
    {
      id:'pack03.doppelganger',name:'도플갱어',short:'도플갱어',suit:'H',rank:13,
      description:'낼 때 — 바로 이전 쇼다운 카드의 숫자와 무늬를 모두 복사한다. 이번 트릭값은 K 그대로이며 1번 슬롯에서는 효과가 없다.',
      terms:['트릭값','쇼다운','쇼다운 슬롯','족보'],image:'assets/cards/pack01/recursive_function.png',packId:'pack03',art:'placeholder_doppelganger',
      effects:[{trigger:'on_play',action:'copy_previous_showdown_card',duration:'set'}]
    },
    {
      id:'pack03.russian_roulette',name:'러시안 룰렛',short:'러시안 룰렛',suit:'S',rank:10,
      description:'낼 때 — 1/6 확률로 이번 트릭 숫자가 2, 그 외에는 A가 된다. 트럼프 보너스는 그 뒤 적용되며 쇼다운에서는 인쇄 숫자 10으로 계산한다.',
      terms:['트릭','적용 숫자','쇼다운','인쇄값'],image:'assets/cards/pack01/black_bullet.png',packId:'pack03',art:'placeholder_russian_roulette',
      effects:[{trigger:'on_play',action:'russian_roulette_rank',fireChance:0.16666666666666666,failRank:2,safeRank:14,memoryKey:'roulette_fired',duration:'trick'}]
    },
    {
      id:'pack03.black_box',name:'블랙박스',short:'블랙박스',suit:'D',rank:10,
      description:'이 카드로 낸 트릭이 무승부였다면 그 사실을 기록한다. 쇼다운 — 기록되어 있다면 쇼다운 위력 +15.',
      terms:['트릭','쇼다운','최종 위력'],image:'assets/cards/pack01/ambush_observer.png',packId:'pack03',art:'placeholder_black_box',
      effects:[
        {trigger:'on_trick_draw',action:'mark_card_memory',value:1,memoryKey:'black_box_draw',duration:'set'},
        {trigger:'on_showdown_score',action:'showdown_power_if_memory',value:15,memoryKey:'black_box_draw',duration:'set'}
      ]
    }
  ];
});
