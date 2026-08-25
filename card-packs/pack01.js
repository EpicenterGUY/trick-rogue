(function(root,factory){const value=factory();if(typeof module!=='undefined')module.exports=value;root.PACK01_CARDS=value})(typeof globalThis!=='undefined'?globalThis:this,function(){
  return [
  {
    id:'pack01.black_bullet',name:'검은 탄환',short:'검은 탄환',suit:'S',rank:7,
    description:'승리 — 적에게 피해 4. 정확히 5번 쇼다운 슬롯에서 승리했다면 추가 피해 4.',
    terms:['트릭','피해','쇼다운 슬롯'],image:'assets/cards/pack01/black_bullet.png',packId:'pack01',art:'bullet',
    effects:[
      {trigger:'on_trick_win',action:'damage_enemy',value:4,duration:'trick'},
      {trigger:'on_trick_win',action:'damage_enemy',value:4,condition:'slot_is',conditionValue:5,duration:'trick'}
    ]
  },
  {
    id:'pack01.phoenix',name:'불사조',short:'불사조',suit:'H',rank:4,
    description:'승리 — 체력 4 회복. 효과 처리 직전 체력이 최대 체력의 50% 이하라면 추가로 3 회복.',
    terms:['트릭','회복'],image:'assets/cards/pack01/phoenix.png',packId:'pack01',art:'phoenix',
    effects:[
      {trigger:'on_trick_win',action:'heal_player',value:3,condition:'player_hp_ratio_at_most',conditionValue:0.5,duration:'trick'},
      {trigger:'on_trick_win',action:'heal_player',value:4,duration:'trick'}
    ]
  },
  {
    id:'pack01.golden_hand',name:'골든 핸드',short:'골든 핸드',suit:'D',rank:7,
    description:'승리 — 칩 +1. 다음 트릭의 최대 손패와 보충 드로우 +1.',
    terms:['트릭','칩','손패','드로우'],image:'assets/cards/pack01/golden_hand.png',packId:'pack01',art:'gold',
    effects:[
      {trigger:'on_trick_win',action:'gain_chips',value:1,duration:'trick'},
      {trigger:'on_trick_win',action:'grant_next_trick_hand_capacity',value:1,duration:'trick'}
    ]
  },
  {
    id:'pack01.dirty_gambler',name:'로우 블러프',short:'로우 블러프',suit:'C',rank:3,
    description:'승리 — 최종 적용 숫자가 5 이하라면 칩 +2.',
    terms:['적용 숫자','트릭','칩'],image:'assets/cards/pack01/dirty_gambler.png',packId:'pack01',art:'cheat',
    effects:[{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'effective_rank_at_most',conditionValue:5,duration:'trick'}]
  },
  {
    id:'pack01.recursive_function',name:'재귀 함수',short:'재귀 함수',suit:'C',rank:8,
    description:'승리 — 직전에 발동한 다른 효과 카드의 복사 가능한 수치 효과 하나를 1회 복사. 자기 자신은 복사하지 않는다.',
    terms:['트릭','피해','회복','칩','보호막','출혈','예측'],image:'assets/cards/pack01/recursive_function.png',packId:'pack01',art:'loop',
    effects:[{trigger:'on_trick_win',handler:'repeat_last_named_numeric',duration:'trick'}]
  },
  {
    id:'pack01.scheduled_delivery',name:'예약 사격',short:'예약 사격',suit:'D',rank:6,
    description:'낼 때 — 예약 생성. 바로 다음 트릭에서 승리하면 적에게 피해 8. 패배하거나 무승부면 예약은 사라진다.',
    terms:['예약','트릭','피해'],image:'assets/cards/pack01/scheduled_delivery.png',packId:'pack01',art:'mail',
    effects:[{trigger:'on_play',action:'reserve_next_win_damage',value:8,duration:'trick'}]
  },
  {
    id:'pack01.emergency_guard',name:'비상 방패',short:'비상 방패',suit:'H',rank:8,
    description:'낼 때 — 보호막 6. 쇼다운 — 보호막이 1 이상 남아 있다면 쇼다운 위력 +6.',
    terms:['보호막','쇼다운','최종 위력'],image:'assets/cards/pack01/emergency_guard.png',packId:'pack01',art:'shield',
    effects:[
      {trigger:'on_play',action:'gain_shield',value:6,duration:'battle'},
      {trigger:'on_showdown_score',action:'showdown_power',value:6,condition:'player_shield_at_least',conditionValue:1,duration:'set'}
    ]
  },
  {
    id:'pack01.sharp_glass',name:'유리 칼날',short:'유리 칼날',suit:'S',rank:5,
    description:'승리 — 적이 이미 출혈 중이라면 먼저 피해 3. 그 후 출혈 3.',
    terms:['출혈','트릭','피해'],image:'assets/cards/pack01/sharp_glass.png',packId:'pack01',art:'glass',
    effects:[
      {trigger:'on_trick_win',action:'damage_enemy',value:3,condition:'enemy_has_status',statusId:'bleed',conditionValue:1,duration:'trick'},
      {trigger:'on_trick_win',action:'apply_enemy_bleed',value:3,duration:'battle'}
    ]
  },
  {
    id:'pack01.ambush_observer',name:'잠복 관측자',short:'잠복 관측자',suit:'C',rank:5,
    description:'3번 쇼다운 슬롯 — 적 카드 예측 단계 +2.',
    terms:['쇼다운 슬롯','예측'],image:'assets/cards/pack01/ambush_observer.png',packId:'pack01',art:'eye',
    effects:[{trigger:'after_card_slotted',action:'increase_enemy_forecast',value:2,condition:'slot_is',conditionValue:3,duration:'set'}]
  },
  {
    id:'pack01.battery_1pct',name:'배터리 1%',short:'배터리 1%',suit:'S',rank:14,
    description:'손에 있는 동안 각 트릭 종료 시 20% 확률로 소진. 소진되지 않고 정확히 5번 쇼다운 슬롯에 들어가면 쇼다운 위력 +12.',
    terms:['트릭','소진','전투','쇼다운 슬롯','최종 위력'],image:'assets/cards/pack01/battery_1pct.png',packId:'pack01',art:'battery',
    effects:[
      {trigger:'on_trick_end',handler:'deplete_battery_in_hand',chance:0.2,duration:'battle'},
      {trigger:'on_showdown_score',action:'showdown_power',value:12,condition:'slot_is',conditionValue:5,duration:'set'}
    ]
  }
];
});

(function(root){
  if(typeof document==='undefined'||root.PACK02_CARDS||document.querySelector('script[data-trick-pack02-bootstrap]'))return;
  if(document.readyState!=='loading')return;
  document.write('<script src="card-packs/pack02.js" data-trick-pack02-bootstrap="true"></script>');
})(typeof globalThis!=='undefined'?globalThis:this);
