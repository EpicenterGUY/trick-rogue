(function(root,factory){
  const effectApi=typeof module!=='undefined'?require('../effects.js'):root.CardEffects;
  const value=factory(root,effectApi);
  if(typeof module!=='undefined')module.exports=value;
  root.PACK03_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,effectApi){
  function activeBattle(context={}){
    if(context?.battle)return context.battle;
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return root?.battle||null;
  }

  function effectList(card){
    if(Array.isArray(card?.effects))return card.effects;
    if(Array.isArray(card?.definition?.effects))return card.definition.effects;
    if(Array.isArray(card?.named?.effects))return card.named.effects;
    return [];
  }

  function isEffectCard(entry){
    const card=entry?.card||entry;
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
    }
  ];
});
