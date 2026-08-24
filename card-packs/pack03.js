(function(root,factory){
  const value=factory();
  if(typeof module!=='undefined')module.exports=value;
  root.PACK03_CARDS=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  return [
    {
      id:'pack03.finale_spotlight',
      name:'피날레 스포트라이트',short:'피날레 스포트라이트',suit:'S',rank:10,
      description:'조건: 이 카드가 5번 쇼다운 슬롯에 놓임. 효과: 이 카드의 쇼다운 무늬를 현재 트럼프로 바꾸고 쇼다운 숫자 +2.',
      terms:['쇼다운 슬롯','트럼프','쇼다운값'],
      image:'assets/cards/pack01/battery_1pct.png',packId:'pack03',art:'placeholder_finale',
      effects:[
        {trigger:'after_card_slotted',action:'set_last_showdown_suit_to_trump',condition:'slot_is',conditionValue:5,duration:'set'},
        {trigger:'after_card_slotted',action:'increase_last_showdown_rank',value:2,condition:'slot_is',conditionValue:5,duration:'set'}
      ]
    },
    {
      id:'pack03.reverse_script',
      name:'역전 대본',short:'역전 대본',suit:'H',rank:4,
      description:'조건: 이번 트릭에 칩을 소비해 손패 교환을 사용함. 발동: 이 카드를 낼 때. 효과: 이번 트릭은 낮은 트릭 숫자가 승리하고 칩 +1.',
      terms:['트릭','트릭값','칩','손패'],
      image:'assets/cards/pack01/recursive_function.png',packId:'pack03',art:'placeholder_script',
      effects:[
        {trigger:'on_play',action:'set_reverse_compare',condition:'chips_spent',duration:'trick'},
        {trigger:'on_play',action:'gain_chips',value:1,condition:'chips_spent',duration:'trick'}
      ]
    },
    {
      id:'pack03.trump_encore',
      name:'트럼프 앙코르',short:'트럼프 앙코르',suit:'D',rank:7,
      description:'조건: 이번 세트에서 트릭을 2번 이상 승리. 발동: 이 카드를 낼 때. 효과: 이 카드의 트릭 무늬를 현재 트럼프로 바꾸고 보호막 2 획득.',
      terms:['세트','트릭','트럼프','보호막'],
      image:'assets/cards/pack01/emergency_guard.png',packId:'pack03',art:'placeholder_encore',
      effects:[
        {trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'set_wins_at_least',conditionValue:2,duration:'trick'},
        {trigger:'on_play',action:'gain_shield',value:2,condition:'set_wins_at_least',conditionValue:2,duration:'battle'}
      ]
    },
    {
      id:'pack03.first_scene_preview',
      name:'첫 장면 예고',short:'첫 장면 예고',suit:'C',rank:8,
      description:'조건: 이 카드가 1번 쇼다운 슬롯에 놓임. 효과: 다음 적 카드를 미리 공개하고 다음 트릭의 손패 한도와 보충 드로우 +1.',
      terms:['쇼다운 슬롯','손패'],
      image:'assets/cards/pack01/ambush_observer.png',packId:'pack03',art:'placeholder_preview',
      effects:[
        {trigger:'after_card_slotted',action:'reveal_next_enemy_card',condition:'slot_is',conditionValue:1,duration:'trick'},
        {trigger:'after_card_slotted',action:'grant_next_trick_hand_capacity',value:1,condition:'slot_is',conditionValue:1,duration:'trick'}
      ]
    },
    {
      id:'pack03.delayed_delivery',
      name:'시차 배송',short:'시차 배송',suit:'D',rank:5,
      description:'조건: 이 카드가 2번 쇼다운 슬롯에 놓임. 효과: 바로 다음 트릭에서 승리하면 적에게 추가 피해 8을 주는 예약을 생성.',
      terms:['쇼다운 슬롯','트릭','피해'],
      image:'assets/cards/pack01/scheduled_delivery.png',packId:'pack03',art:'placeholder_delay',
      effects:[
        {trigger:'after_card_slotted',action:'reserve_next_win_damage',value:8,condition:'slot_is',conditionValue:2,duration:'trick'}
      ]
    },
    {
      id:'pack03.river_archivist',
      name:'리버 기록관',short:'리버 기록관',suit:'H',rank:7,
      description:'조건: 4번째 트릭 종료 때 고정한 리버 후보를 5번째 카드로 실제 적중. 효과: 쇼다운 최종 위력 +4, 칩 +1.',
      terms:['쇼다운','최종 위력','칩'],
      image:'assets/cards/pack01/scheduled_delivery.png',packId:'pack03',art:'placeholder_archive',
      effects:[
        {trigger:'on_showdown_score',action:'showdown_power',value:4,condition:'river_hit',duration:'set'},
        {trigger:'on_showdown_score',action:'gain_chips',value:1,condition:'river_hit',duration:'battle'}
      ]
    },
    {
      id:'pack03.blood_dividend',
      name:'피의 배당',short:'피의 배당',suit:'S',rank:5,
      description:'조건: 이 카드의 최종 트릭 숫자가 5 이하인 상태로 트릭 승리. 효과: 적에게 출혈 2 부여, 칩 +1.',
      terms:['트릭','피해','칩'],
      image:'assets/cards/pack01/sharp_glass.png',packId:'pack03',art:'placeholder_dividend',
      effects:[
        {trigger:'on_trick_win',action:'apply_enemy_bleed',value:2,condition:'effective_rank_at_most',conditionValue:5,duration:'battle'},
        {trigger:'on_trick_win',action:'gain_chips',value:1,condition:'effective_rank_at_most',conditionValue:5,duration:'trick'}
      ]
    },
    {
      id:'pack03.retreat_cover',
      name:'철수 엄호',short:'철수 엄호',suit:'H',rank:4,
      description:'발동: 이 카드로 트릭 패배 시. 효과: 보호막 4 획득, 칩 +1.',
      terms:['트릭','보호막','칩'],
      image:'assets/cards/pack01/emergency_guard.png',packId:'pack03',art:'placeholder_retreat',
      effects:[
        {trigger:'on_trick_loss',action:'gain_shield',value:4,duration:'battle'},
        {trigger:'on_trick_loss',action:'gain_chips',value:1,duration:'trick'}
      ]
    },
    {
      id:'pack03.draw_insurance',
      name:'무승부 보험',short:'무승부 보험',suit:'C',rank:9,
      description:'발동: 이 카드로 트릭 무승부 시. 효과: 보호막 4 획득, 칩 +2.',
      terms:['트릭','보호막','칩'],
      image:'assets/cards/pack01/golden_hand.png',packId:'pack03',art:'placeholder_draw',
      effects:[
        {trigger:'on_trick_draw',action:'gain_shield',value:4,duration:'battle'},
        {trigger:'on_trick_draw',action:'gain_chips',value:2,duration:'trick'}
      ]
    },
    {
      id:'pack03.cross_signal',
      name:'교차 신호',short:'교차 신호',suit:'D',rank:9,
      description:'조건: 이번 트릭에 칩을 소비해 손패 교환을 사용함. 발동: 이 카드를 낼 때. 효과: 이 카드의 트릭 무늬를 현재 트럼프로 바꾸고 다음 적 카드를 미리 공개.',
      terms:['트릭','칩','손패','트럼프'],
      image:'assets/cards/pack01/ambush_observer.png',packId:'pack03',art:'placeholder_cross',
      effects:[
        {trigger:'on_play',action:'set_next_trick_suit_to_trump',condition:'chips_spent',duration:'trick'},
        {trigger:'on_play',action:'reveal_next_enemy_card',condition:'chips_spent',duration:'trick'}
      ]
    }
  ];
});