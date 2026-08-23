(function(root,factory){const value=factory();if(typeof module!=='undefined')module.exports=value;root.PACK01_CARDS=value})(typeof globalThis!=='undefined'?globalThis:this,function(){
  return [
  {
    "id": "pack01.black_bullet",
    "name": "검은 탄환",
    "short": "검은 탄환",
    "suit": "S",
    "rank": 7,
    "description": "발동: 이 카드로 트릭 승리 시 즉시 적에게 피해 3. 추가: 이 카드가 쇼다운 5장 중 하나면 최종 쇼다운 위력 +4.",
    "terms": [
      "트릭",
      "쇼다운",
      "우세"
    ],
    "image": "assets/cards/pack01/black_bullet.png",
    "packId": "pack01",
    "art": "bullet"
  },
  {
    "id": "pack01.phoenix",
    "name": "불사조",
    "short": "불사조",
    "suit": "H",
    "rank": 4,
    "description": "발동: 이 카드로 트릭 승리 시 체력 4 회복. 회복은 최대 체력을 넘지 않는다.",
    "terms": [
      "트릭"
    ],
    "image": "assets/cards/pack01/phoenix.png",
    "packId": "pack01",
    "art": "phoenix"
  },
  {
    "id": "pack01.golden_hand",
    "name": "황금손",
    "short": "황금손",
    "suit": "D",
    "rank": 7,
    "description": "발동: 이 카드로 트릭 승리 시 칩 +1. 추가: 다음 트릭의 손패 한도와 보충 드로우 +1.",
    "terms": [
      "트릭",
      "칩",
      "손패",
      "드로우"
    ],
    "image": "assets/cards/pack01/golden_hand.png",
    "packId": "pack01",
    "art": "gold"
  },
  {
    "id": "pack01.dirty_gambler",
    "name": "비열한 승부사",
    "short": "비열한 승부사",
    "suit": "C",
    "rank": 3,
    "description": "조건: 이 카드의 적용 숫자가 5 이하인 상태로 트릭 승리. 효과: 칩 +2.",
    "terms": [
      "적용 숫자",
      "트릭"
    ],
    "image": "assets/cards/pack01/dirty_gambler.png",
    "packId": "pack01",
    "art": "cheat"
  },
  {
    "id": "pack01.recursive_function",
    "name": "재귀 함수",
    "short": "재귀 함수",
    "suit": "C",
    "rank": 8,
    "description": "발동: 이 카드로 트릭 승리 시 직전에 발동한 다른 네임드 카드의 복사 가능한 수치 효과 하나를 1회 복사. 복사 범위는 피해, 회복, 칩, 보호막, 출혈, 예측이며 자기 자신은 복사하지 않는다.",
    "terms": [
      "트릭",
      "피해",
      "회복",
      "칩",
      "보호막",
      "출혈",
      "예측"
    ],
    "image": "assets/cards/pack01/recursive_function.png",
    "packId": "pack01",
    "art": "loop"
  },
  {
    "id": "pack01.scheduled_delivery",
    "name": "예약 발송",
    "short": "예약 발송",
    "suit": "D",
    "rank": 6,
    "description": "발동: 이 카드를 사용하면 예약 생성. 현재 트릭에는 발동하지 않고, 바로 다음 트릭에서 승리하면 적에게 추가 피해 6. 패배하거나 무승부면 예약은 사라진다.",
    "terms": [
      "예약",
      "트릭"
    ],
    "image": "assets/cards/pack01/scheduled_delivery.png",
    "packId": "pack01",
    "art": "mail"
  },
  {
    "id": "pack01.emergency_guard",
    "name": "응급 보호구",
    "short": "응급 보호구",
    "suit": "H",
    "rank": 8,
    "description": "발동: 이 카드를 내는 즉시 보호막 5 획득. 보호막은 다음 피해를 먼저 막는다.",
    "terms": [
      "보호막"
    ],
    "image": "assets/cards/pack01/emergency_guard.png",
    "packId": "pack01",
    "art": "shield"
  },
  {
    "id": "pack01.sharp_glass",
    "name": "날 선 유리",
    "short": "날 선 유리",
    "suit": "S",
    "rank": 5,
    "description": "발동: 이 카드로 트릭 승리 시 적에게 출혈 2 부여. 출혈은 트릭 종료 시 피해를 주고 1 감소한다.",
    "terms": [
      "출혈",
      "트릭"
    ],
    "image": "assets/cards/pack01/sharp_glass.png",
    "packId": "pack01",
    "art": "glass"
  },
  {
    "id": "pack01.ambush_observer",
    "name": "매복한 관측자",
    "short": "관측자",
    "suit": "C",
    "rank": 5,
    "description": "조건: 이 카드가 현재 세트의 3번 쇼다운 슬롯에 들어갈 때. 효과: 적 카드 예측 단계 +2.",
    "terms": [
      "쇼다운 슬롯",
      "예측"
    ],
    "image": "assets/cards/pack01/ambush_observer.png",
    "packId": "pack01",
    "art": "eye"
  },
  {
    "id": "pack01.battery_1pct",
    "name": "배터리 1%",
    "short": "배터리 1%",
    "suit": "S",
    "rank": 14,
    "description": "손에 들고 있는 동안 각 트릭 종료 시 20% 확률로 소진되어 이번 전투 동안 사용할 수 없다. 소진되지 않고 쇼다운 카드로 제출하면 최종 쇼다운 위력 +15. 손에 없으면 소진 판정하지 않는다.",
    "terms": [
      "트릭",
      "소진",
      "전투",
      "쇼다운",
      "최종 위력"
    ],
    "image": "assets/cards/pack01/battery_1pct.png",
    "packId": "pack01",
    "art": "battery"
  }
];
});

(function(root){
  if(typeof document==='undefined'||root.PACK02_CARDS||document.querySelector('script[data-trick-pack02-bootstrap]'))return;
  if(document.readyState!=='loading')return;
  document.write('<script src="card-packs/pack02.js" data-trick-pack02-bootstrap="true"><\\/script>');
})(typeof globalThis!=='undefined'?globalThis:this);
