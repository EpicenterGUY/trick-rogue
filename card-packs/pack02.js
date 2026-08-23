(function(root,factory){
  const effectApi=typeof module!=='undefined'?require('../effects.js'):root.CardEffects;
  const value=factory(root,effectApi);
  if(typeof module!=='undefined')module.exports=value;
  root.PACK02_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(root,effectApi){
  function installConditions(api){
    if(!api?.conditions)return false;
    api.conditions.effective_suit_is_trump=context=>{
      const suit=context?.trickSuit
        ??context?.effectiveSuit
        ??context?.card?.trickSuit
        ??context?.card?.effectiveSuit
        ??context?.card?.suit
        ??null;
      const trump=context?.trump??context?.battle?.trump??null;
      return !!trump&&suit===trump;
    };
    api.conditions.river_hit=context=>context?.riverHit?.active===true
      ||context?.battle?.riverHit?.active===true
      ||context?.showdown?.riverHit?.active===true;
    return true;
  }

  if(!installConditions(effectApi)&&typeof document!=='undefined'){
    document.addEventListener('DOMContentLoaded',()=>installConditions(root.CardEffects),{once:true});
  }

  return [
    {
      id:'pack02.trump_signal',
      name:'트럼프 신호',short:'트럼프 신호',suit:'S',rank:8,
      description:'조건: 이 카드의 최종 트릭 무늬가 현재 트럼프. 발동: 이 카드로 트릭 승리 시. 효과: 칩 +1.',
      terms:['트럼프','트릭','칩'],
      image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_signal',
      effects:[{trigger:'on_trick_win',action:'gain_chips',value:1,condition:'effective_suit_is_trump',duration:'trick'}]
    },
    {
      id:'pack02.river_ticket',
      name:'리버 티켓',short:'리버 티켓',suit:'H',rank:5,
      description:'조건: 4번째 트릭 종료 때 고정한 리버 후보를 5번째 카드로 실제 적중. 효과: 쇼다운 최종 위력 +8.',
      terms:['리버','트릭','쇼다운','최종 위력'],
      image:'assets/cards/pack01/scheduled_delivery.png',packId:'pack02',art:'placeholder_ticket',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:8,condition:'river_hit',duration:'set'}]
    },
    {
      id:'pack02.clean_cut',
      name:'정석 승부',short:'정석 승부',suit:'D',rank:8,
      description:'조건: 쇼다운 5장에 순수 카드가 1장 이상 있음. 효과: 쇼다운 최종 위력 +5.',
      terms:['쇼다운','순수 카드','최종 위력'],
      image:'assets/cards/pack01/sharp_glass.png',packId:'pack02',art:'placeholder_clean',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:5,condition:'pure_card_in_showdown',duration:'set'}]
    },
    {
      id:'pack02.afterburner',
      name:'후반 가속',short:'후반 가속',suit:'C',rank:7,
      description:'조건: 이 카드가 4번 또는 5번 쇼다운 슬롯에 놓임. 효과: 칩 +1.',
      terms:['쇼다운 슬롯','칩'],
      image:'assets/cards/pack01/battery_1pct.png',packId:'pack02',art:'placeholder_afterburner',
      effects:[{trigger:'after_card_slotted',action:'gain_chips',value:1,condition:'slot_at_least',conditionValue:4,duration:'set'}]
    },
    {
      id:'pack02.first_strike',
      name:'선수필승',short:'선수필승',suit:'S',rank:9,
      description:'조건: 이 카드의 최종 트릭 무늬가 현재 트럼프. 발동: 이 카드로 트릭 승리 시. 효과: 적에게 피해 6.',
      terms:['트럼프','트릭','피해'],
      image:'assets/cards/pack01/black_bullet.png',packId:'pack02',art:'placeholder_first_strike',
      effects:[{trigger:'on_trick_win',action:'damage_enemy',value:6,condition:'effective_suit_is_trump',duration:'trick'}]
    },
    {
      id:'pack02.long_game',
      name:'누적 이자',short:'누적 이자',suit:'H',rank:11,
      description:'조건: 이번 세트에서 트릭을 4번 이상 승리. 효과: 쇼다운 최종 위력 +12.',
      terms:['세트','트릭','쇼다운','최종 위력'],
      image:'assets/cards/pack01/phoenix.png',packId:'pack02',art:'placeholder_interest',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:12,condition:'set_wins_at_least',conditionValue:4,duration:'set'}]
    },
    {
      id:'pack02.advantage_settlement',
      name:'우세 청산',short:'우세 청산',suit:'D',rank:11,
      description:'조건: 이번 쇼다운에 명시적 우세가 활성화됨. 효과: 쇼다운 최종 위력 +10.',
      terms:['우세','쇼다운','최종 위력'],
      image:'assets/cards/pack01/dirty_gambler.png',packId:'pack02',art:'placeholder_settlement',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:10,condition:'player_has_advantage',duration:'set'}]
    },
    {
      id:'pack02.trump_forge',
      name:'트럼프 단조',short:'트럼프 단조',suit:'C',rank:11,
      description:'조건: 이번 트릭에 칩을 소비해 손패 교환을 사용함. 발동: 이 카드를 낼 때. 효과: 이 카드의 트릭 무늬를 현재 트럼프로 바꾸고 트릭 숫자 +2. 인쇄값과 쇼다운값은 바뀌지 않는다.',
      terms:['칩','손패','교환','트럼프','트릭값','인쇄값','쇼다운값'],
      image:'assets/cards/pack01/emergency_guard.png',packId:'pack02',art:'placeholder_forge',
      effects:[
        {trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'chips_spent',duration:'trick'},
        {trigger:'on_play',action:'increase_next_trick_rank',value:2,condition:'chips_spent',duration:'trick'}
      ]
    },
    {
      id:'pack02.insurance_exchange',
      name:'보험 교환',short:'보험 교환',suit:'H',rank:12,
      description:'조건: 이번 트릭에 칩을 소비해 손패 교환을 사용함. 발동: 이 카드를 낼 때. 효과: 보호막 6 획득.',
      terms:['트릭','칩','손패','보호막'],
      image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_insurance',
      effects:[{trigger:'on_play',action:'gain_shield',value:6,condition:'chips_spent',duration:'battle'}]
    },
    {
      id:'pack02.originalist',
      name:'원본주의',short:'원본주의',suit:'D',rank:12,
      description:'조건: 이 카드의 최종 트릭값이 인쇄값과 완전히 같음. 발동: 이 카드로 트릭 승리 시. 효과: 적에게 피해 6.',
      terms:['인쇄값','트릭값','트릭','피해'],
      image:'assets/cards/pack01/ambush_observer.png',packId:'pack02',art:'placeholder_original',
      effects:[{trigger:'on_trick_win',action:'damage_enemy',value:6,condition:'unmodified_trick_value',duration:'trick'}]
    }
  ];
});
