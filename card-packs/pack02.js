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
    api.conditions.pure_cards_at_least=(context,effect)=>{
      const slots=Array.isArray(context?.slots)?context.slots:Array.isArray(context?.battle?.slots)?context.battle.slots:[];
      const needed=Math.max(1,Number(effect?.conditionValue)||1);
      const count=slots.reduce((sum,entry)=>{
        const card=entry?.card||entry;
        if(!card||typeof card!=='object'||card.named||card.definition||card.cardId)return sum;
        const effects=Array.isArray(card.effects)?card.effects:[];
        return sum+(effects.length===0?1:0);
      },0);
      return count>=needed;
    };
    return true;
  }

  if(!installConditions(effectApi)&&typeof document!=='undefined'){
    document.addEventListener('DOMContentLoaded',()=>installConditions(root.CardEffects),{once:true});
  }

  return [
    {
      id:'pack02.trump_signal',
      name:'트럼프 시그널',short:'트럼프 시그널',suit:'S',rank:8,
      description:'조건: 이 카드의 최종 트릭 무늬가 현재 트럼프. 발동: 이 카드로 트릭 승리 시. 효과: 칩 +2.',
      terms:['트럼프','트릭','칩'],
      image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_signal',
      effects:[{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'effective_suit_is_trump',duration:'trick'}]
    },
    {
      id:'pack02.river_ticket',
      name:'리버 콜',short:'리버 콜',suit:'H',rank:5,
      description:'조건: 4번째 트릭 종료 때 고정한 리버 후보를 5번째 카드로 실제 적중. 효과: 쇼다운 최종 위력 +8.',
      terms:['트릭','쇼다운','최종 위력'],
      image:'assets/cards/pack01/scheduled_delivery.png',packId:'pack02',art:'placeholder_ticket',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:8,condition:'river_hit',duration:'set'}]
    },
    {
      id:'pack02.clean_cut',
      name:'클래식 핸드',short:'클래식 핸드',suit:'D',rank:8,
      description:'조건: 쇼다운 5장에 순수 카드가 3장 이상 있음. 효과: 쇼다운 최종 위력 +7.',
      terms:['쇼다운','순수','최종 위력'],
      image:'assets/cards/pack01/sharp_glass.png',packId:'pack02',art:'placeholder_clean',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:7,condition:'pure_cards_at_least',conditionValue:3,duration:'set'}]
    },
    {
      id:'pack02.afterburner',
      name:'라스트 스퍼트',short:'라스트 스퍼트',suit:'C',rank:7,
      description:'조건: 이 카드가 4번 쇼다운 슬롯에 놓이면 칩 +1, 5번 쇼다운 슬롯에 놓이면 칩 +2.',
      terms:['쇼다운 슬롯','칩'],
      image:'assets/cards/pack01/battery_1pct.png',packId:'pack02',art:'placeholder_afterburner',
      effects:[
        {trigger:'after_card_slotted',action:'gain_chips',value:1,condition:'slot_is',conditionValue:4,duration:'set'},
        {trigger:'after_card_slotted',action:'gain_chips',value:2,condition:'slot_is',conditionValue:5,duration:'set'}
      ]
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
      name:'복리',short:'복리',suit:'H',rank:11,
      description:'조건: 이번 세트에서 트릭을 4번 이상 승리. 효과: 쇼다운 최종 위력 +12.',
      terms:['세트','트릭','쇼다운','최종 위력'],
      image:'assets/cards/pack01/phoenix.png',packId:'pack02',art:'placeholder_interest',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:12,condition:'set_wins_at_least',conditionValue:4,duration:'set'}]
    },
    {
      id:'pack02.advantage_settlement',
      name:'캐시아웃',short:'캐시아웃',suit:'D',rank:11,
      description:'조건: 이번 쇼다운에 명시적 우세가 활성화됨. 효과: 쇼다운 최종 위력 +10.',
      terms:['우세','쇼다운','최종 위력'],
      image:'assets/cards/pack01/dirty_gambler.png',packId:'pack02',art:'placeholder_settlement',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:10,condition:'player_has_advantage',duration:'set'}]
    },
    {
      id:'pack02.trump_forge',
      name:'트럼프 포지',short:'트럼프 포지',suit:'C',rank:11,
      description:'조건: 이번 트릭에 칩을 소비해 손패 교환을 사용함. 발동: 이 카드를 낼 때. 효과: 이 카드의 트릭 무늬를 현재 트럼프로 바꾸고 트릭 숫자 +2. 인쇄값과 쇼다운값은 바뀌지 않는다.',
      terms:['칩','손패','트럼프','트릭값','인쇄값','쇼다운값'],
      image:'assets/cards/pack01/emergency_guard.png',packId:'pack02',art:'placeholder_forge',
      effects:[
        {trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'chips_spent',duration:'trick'},
        {trigger:'on_play',action:'increase_next_trick_rank',value:2,condition:'chips_spent',duration:'trick'}
      ]
    },
    {
      id:'pack02.insurance_exchange',
      name:'교환 보험',short:'교환 보험',suit:'H',rank:12,
      description:'조건: 이번 트릭에 칩을 소비해 손패 교환을 사용함. 발동: 이 카드를 낼 때. 효과: 보호막 6 획득.',
      terms:['트릭','칩','손패','보호막'],
      image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_insurance',
      effects:[{trigger:'on_play',action:'gain_shield',value:6,condition:'chips_spent',duration:'battle'}]
    },
    {
      id:'pack02.originalist',
      name:'있는 그대로',short:'있는 그대로',suit:'D',rank:12,
      description:'조건: 이 카드의 최종 트릭값이 인쇄값과 완전히 같음. 발동: 이 카드로 트릭 승리 시. 효과: 적에게 피해 4.',
      terms:['인쇄값','트릭값','트릭','피해'],
      image:'assets/cards/pack01/ambush_observer.png',packId:'pack02',art:'placeholder_original',
      effects:[{trigger:'on_trick_win',action:'damage_enemy',value:4,condition:'unmodified_trick_value',duration:'trick'}]
    },
    {
      id:'pack02.advance_payment',
      name:'선지급',short:'선지급',suit:'S',rank:7,
      description:'발동: 이 카드로 트릭 승리 시 적에게 피해 6. 추가: 이 카드가 쇼다운 5장에 포함되면 쇼다운 최종 위력 -5.',
      terms:['트릭','피해','쇼다운','최종 위력'],
      image:'assets/cards/pack01/black_bullet.png',packId:'pack02',art:'placeholder_advance_payment',
      effects:[
        {trigger:'on_trick_win',action:'damage_enemy',value:6,duration:'trick'},
        {trigger:'on_showdown_score',action:'showdown_power',value:-5,duration:'set'}
      ]
    },
    {
      id:'pack02.consolation_prize',
      name:'위로금',short:'위로금',suit:'H',rank:4,
      description:'발동: 이 카드로 트릭 패배 시. 효과: 칩 +2.',
      terms:['트릭','패배','칩'],
      image:'assets/cards/pack01/golden_hand.png',packId:'pack02',art:'placeholder_consolation_prize',
      effects:[{trigger:'on_trick_loss',action:'gain_chips',value:2,duration:'trick'}]
    },
    {
      id:'pack02.last_word',
      name:'마지막 한 수',short:'마지막 한 수',suit:'D',rank:8,
      description:'조건: 이 카드가 5번 쇼다운 슬롯에 위치. 효과: 쇼다운 최종 위력 +9.',
      terms:['쇼다운 슬롯','쇼다운','최종 위력'],
      image:'assets/cards/pack01/ambush_observer.png',packId:'pack02',art:'placeholder_last_word',
      effects:[{trigger:'on_showdown_score',action:'showdown_power',value:9,condition:'slot_is',conditionValue:5,duration:'set'}]
    }
  ];
});
