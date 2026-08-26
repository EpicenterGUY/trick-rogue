(function(root,factory){
  const effectApi=typeof module!=='undefined'?require('../effects.js'):root.CardEffects;
  const value=factory(root,effectApi);
  if(typeof module!=='undefined')module.exports=value;
  root.PACK04_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,effectApi){
  function activeBattle(context={}){
    if(context?.battle)return context.battle;
    try{if(typeof battle!=='undefined'&&battle)return battle}catch(_error){}
    return root?.battle||null;
  }
  function slotCard(entry){return entry?.card||entry||null}
  function showdownRank(card){return card?.showdownRank??card?.printedRank??card?.rank??null}
  function showdownSuit(card){return card?.showdownSuit??card?.printedSuit??card?.suit??null}
  function pureCard(entry){
    const card=slotCard(entry);if(!card||card.named||card.definition||card.cardId)return false;
    const effects=Array.isArray(card.effects)?card.effects:[];return effects.length===0;
  }
  function ensureAction(api,name,handler){
    if(!api?.ACTIONS||!api?.registerActionHandler)return false;
    if(!api.ACTIONS.includes(name))api.ACTIONS.push(name);
    api.registerActionHandler(name,handler);return true;
  }
  function installActions(api){
    if(!api?.registerActionHandler)return false;

    ensureAction(api,'match_enemy_printed_rank',(context)=>{
      const state=activeBattle(context),card=context.card,enemy=context.enemyCard||state?.enemyCard;if(!state||!card||!enemy)return null;
      const target=Number(enemy.printedRank??enemy.rank),current=Number(card.printedRank??card.rank)+(Number(state.mods?.plus)||0)+(Number(card.effectiveRankBonus)||0);
      if(!Number.isFinite(target)||!Number.isFinite(current))return null;
      if(!state.mods)state.mods={};state.mods.plus=(Number(state.mods.plus)||0)+(target-current);return target;
    });

    ensureAction(api,'swap_showdown_with_previous',(context)=>{
      const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots,index=Number(context.slotIndex);
      if(!Array.isArray(slots)||!Number.isInteger(index)||index<1||!context.card)return null;
      const previous=slotCard(slots[index-1]);if(!previous)return null;
      const mine={rank:showdownRank(context.card),suit:showdownSuit(context.card)},theirs={rank:showdownRank(previous),suit:showdownSuit(previous)};
      if(theirs.rank==null||theirs.suit==null||mine.rank==null||mine.suit==null)return null;
      context.card.showdownRank=theirs.rank;context.card.showdownSuit=theirs.suit;previous.showdownRank=mine.rank;previous.showdownSuit=mine.suit;
      return{previous:mine,current:theirs};
    });

    ensureAction(api,'set_showdown_rank_from_slot',(context)=>{
      if(!context.card||!Number.isInteger(Number(context.slotIndex)))return null;
      const value=Math.max(10,Math.min(14,10+Number(context.slotIndex)));context.card.showdownRank=value;return value;
    });

    ensureAction(api,'set_showdown_rank_from_result',(context,_value,effect)=>{
      if(!context.card)return null;const result=Number(context.result);let value=Number(effect.drawRank)||13;
      if(result>0)value=Number(effect.winRank)||2;else if(result<0)value=Number(effect.lossRank)||14;
      context.card.showdownRank=value;return value;
    });

    ensureAction(api,'copy_first_showdown_card',(context)=>{
      const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots;if(!Array.isArray(slots)||!slots.length||!context.card)return null;
      const first=slotCard(slots[0]);if(!first||first===context.card)return null;
      const rank=showdownRank(first),suit=showdownSuit(first);if(rank==null||suit==null)return null;
      context.card.showdownRank=rank;context.card.showdownSuit=suit;return{rank,suit};
    });

    ensureAction(api,'showdown_power_from_adjacent_pure',(context,value,effect)=>{
      const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots,index=Number(context.slotIndex);
      if(!Array.isArray(slots)||!Number.isInteger(index))return 0;
      const count=[slots[index-1],slots[index+1]].filter(Boolean).filter(pureCard).length,bonus=count*(Number(value)||0)+(count===2?(Number(effect.bothBonus)||0):0);
      if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);return bonus;
    });

    ensureAction(api,'spend_all_chips_to_shield',(context,value,effect)=>{
      const state=activeBattle(context);if(!state)return 0;
      const balance=Math.max(0,Number(state.chipEconomy?.balance??state.chip)||0),multiplier=Math.max(0,Number(value)||2);
      state.chip=0;if(state.chipEconomy)state.chipEconomy.balance=0;
      if(context.history)context.history.chipsSpent=(Number(context.history.chipsSpent)||0)+balance;
      const shield=Math.floor(balance*multiplier);if(shield&&typeof context.perform==='function')context.perform('gain_shield',shield,effect);return shield;
    });

    ensureAction(api,'set_trick_rank_midpoint_enemy',(context)=>{
      const state=activeBattle(context),card=context.card,enemy=context.enemyCard||state?.enemyCard;if(!state||!card||!enemy)return null;
      const mine=Number(card.printedRank??card.rank),theirs=Number(enemy.printedRank??enemy.rank);if(!Number.isFinite(mine)||!Number.isFinite(theirs))return null;
      const target=Math.round((mine+theirs)/2),current=mine+(Number(state.mods?.plus)||0)+(Number(card.effectiveRankBonus)||0);
      if(!state.mods)state.mods={};state.mods.plus=(Number(state.mods.plus)||0)+(target-current);return target;
    });

    ensureAction(api,'showdown_power_per_distinct_suit',(context,value,effect)=>{
      const slots=Array.isArray(context.slots)?context.slots:context.battle?.slots;if(!Array.isArray(slots))return 0;
      const suits=new Set(slots.map(slotCard).map(showdownSuit).filter(Boolean)),bonus=suits.size*(Number(value)||0)+(suits.size===4?(Number(effect.allFourBonus)||0):0);
      if(bonus&&typeof context.perform==='function')context.perform('showdown_power',bonus,effect);return bonus;
    });
    return true;
  }
  installActions(effectApi);
  if(typeof document!=='undefined'&&!effectApi)document.addEventListener('DOMContentLoaded',()=>installActions(root.CardEffects),{once:true});

  return [
    {
      id:'pack04.copycat',name:'카피캣',short:'카피캣',suit:'C',rank:14,packId:'pack04',buildTags:['승부 조작'],
      description:'비교 전 — 이번 트릭의 기본 숫자를 적 카드의 인쇄 숫자와 같게 맞춘다. 트럼프 보너스는 그 뒤 적용되며 쇼다운에서는 인쇄 A로 남는다.',
      terms:['트릭','적용 숫자','인쇄값','트럼프'],image:'assets/cards/pack01/recursive_function.png',art:'copycat',
      effects:[{trigger:'before_compare',action:'match_enemy_printed_rank',duration:'trick'}]
    },
    {
      id:'pack04.seat_swap',name:'자리바꿈',short:'자리바꿈',suit:'H',rank:14,packId:'pack04',buildTags:['쇼다운 조작'],
      description:'낼 때 — 바로 이전 쇼다운 카드와 이 카드의 쇼다운 숫자·무늬를 통째로 교환한다. 1번 슬롯에서는 아무 일도 없다.',
      terms:['쇼다운','쇼다운 슬롯','족보'],image:'assets/cards/pack01/recursive_function.png',art:'seat_swap',
      effects:[{trigger:'on_play',action:'swap_showdown_with_previous',condition:'previous_showdown_slot_exists',duration:'set'}]
    },
    {
      id:'pack04.reserved_seat',name:'예약석',short:'예약석',suit:'D',rank:14,packId:'pack04',buildTags:['쇼다운 조작'],
      description:'낼 때 — 쇼다운 숫자가 슬롯에 따라 10/J/Q/K/A가 된다. 트릭에서는 인쇄 A를 그대로 사용한다.',
      terms:['쇼다운','쇼다운 슬롯','인쇄값'],image:'assets/cards/pack01/ambush_observer.png',art:'reserved_seat',
      effects:[{trigger:'on_play',action:'set_showdown_rank_from_slot',duration:'set'}]
    },
    {
      id:'pack04.black_envelope',name:'검은 봉투',short:'검은 봉투',suit:'S',rank:13,packId:'pack04',buildTags:['패배 활용','예약·연쇄'],
      description:'패배 — 바로 다음 트릭에서 승리하면 적에게 피해 10을 주는 예약을 남긴다. 연속 패배하면 각 예약은 자기 차례에 따로 판정된다.',
      terms:['패배','예약','트릭','피해'],image:'assets/cards/pack01/scheduled_delivery.png',art:'black_envelope',
      effects:[{trigger:'on_trick_loss',action:'reserve_next_win_damage',value:10,duration:'trick'}]
    },
    {
      id:'pack04.loser_crown',name:'패자의 왕관',short:'패자의 왕관',suit:'C',rank:13,packId:'pack04',buildTags:['패배 활용','쇼다운 조작'],
      description:'비교 후 — 이 트릭에서 패배했다면 쇼다운 숫자 A, 승리했다면 2가 된다. 무승부라면 인쇄 K를 유지한다.',
      terms:['패배','트릭','쇼다운','인쇄값'],image:'assets/cards/pack01/dirty_gambler.png',art:'loser_crown',
      effects:[{trigger:'after_compare',action:'set_showdown_rank_from_result',lossRank:14,winRank:2,drawRank:13,duration:'set'}]
    },
    {
      id:'pack04.rewind',name:'되감기',short:'되감기',suit:'D',rank:13,packId:'pack04',buildTags:['쇼다운 조작'],
      description:'5번 슬롯에서 낼 때 — 1번 쇼다운 카드의 숫자와 무늬를 그대로 복사한다. 다른 슬롯에서는 인쇄 K 그대로다.',
      terms:['쇼다운','쇼다운 슬롯','족보'],image:'assets/cards/pack01/recursive_function.png',art:'rewind',
      effects:[{trigger:'on_play',action:'copy_first_showdown_card',condition:'slot_is',conditionValue:5,duration:'set'}]
    },
    {
      id:'pack04.joint_guarantee',name:'연대보증',short:'연대보증',suit:'S',rank:12,packId:'pack04',buildTags:['쇼다운 조작'],
      description:'쇼다운 — 바로 양옆의 순수 카드 1장당 쇼다운 위력 +5. 양쪽이 모두 순수 카드라면 추가 +4.',
      terms:['순수 카드','쇼다운','쇼다운 슬롯','최종 위력'],image:'assets/cards/pack01/emergency_guard.png',art:'joint_guarantee',
      effects:[{trigger:'on_showdown_score',action:'showdown_power_from_adjacent_pure',value:5,bothBonus:4,duration:'set'}]
    },
    {
      id:'pack04.bankruptcy_shield',name:'파산 방패',short:'파산 방패',suit:'H',rank:6,packId:'pack04',buildTags:['칩 경제'],
      description:'낼 때 — 보유 칩을 전부 0으로 만들고, 소비한 칩 1개당 보호막 3을 얻는다. 칩이 없으면 아무 효과도 없다.',
      terms:['칩','보호막','트릭'],image:'assets/cards/pack01/emergency_guard.png',art:'bankruptcy_shield',
      effects:[{trigger:'on_play',action:'spend_all_chips_to_shield',value:3,duration:'battle'}]
    },
    {
      id:'pack04.midpoint',name:'중간값',short:'중간값',suit:'D',rank:10,packId:'pack04',buildTags:['승부 조작'],
      description:'비교 전 — 이번 트릭의 기본 숫자를 이 카드의 인쇄 숫자와 적 인쇄 숫자의 평균(반올림)으로 맞춘다. 쇼다운 숫자는 10 그대로다.',
      terms:['트릭','적용 숫자','인쇄값','쇼다운'],image:'assets/cards/pack01/ambush_observer.png',art:'midpoint',
      effects:[{trigger:'before_compare',action:'set_trick_rank_midpoint_enemy',duration:'trick'}]
    },
    {
      id:'pack04.suit_tax',name:'무늬 세금',short:'무늬 세금',suit:'D',rank:3,packId:'pack04',buildTags:['쇼다운 조작'],
      description:'쇼다운 — 완성된 5장의 서로 다른 쇼다운 무늬 1종당 위력 +2. 네 무늬가 전부 있으면 추가 +4.',
      terms:['쇼다운','무늬','최종 위력'],image:'assets/cards/pack01/golden_hand.png',art:'suit_tax',
      effects:[{trigger:'on_showdown_score',action:'showdown_power_per_distinct_suit',value:2,allFourBonus:4,duration:'set'}]
    },
    {
      id:'pack04.reverse_odds',name:'역배당',short:'역배당',suit:'S',rank:2,packId:'pack04',buildTags:['승부 조작','칩 경제'],
      description:'낼 때 — 이번 트릭은 낮은 최종 적용 숫자가 승리한다. 이 반전 트릭에서 승리하면 칩 +2.',
      terms:['트릭','적용 숫자','칩'],image:'assets/cards/pack01/dirty_gambler.png',art:'reverse_odds',
      effects:[{trigger:'on_play',action:'set_reverse_compare',duration:'trick'},{trigger:'on_trick_win',action:'gain_chips',value:2,duration:'trick'}]
    },
    {
      id:'pack04.zero_account',name:'영점 통장',short:'영점 통장',suit:'H',rank:13,packId:'pack04',buildTags:['칩 경제','쇼다운 조작'],
      description:'쇼다운 — 현재 칩이 정확히 0이면 쇼다운 위력 +10. 칩이 하나라도 남아 있으면 효과가 없다.',
      terms:['칩','쇼다운','최종 위력'],image:'assets/cards/pack01/golden_hand.png',art:'zero_account',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:10,condition:'chips_empty',duration:'set'}]
    }
  ];
});
