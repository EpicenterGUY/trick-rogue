// Single source of truth for every named card. Card identity is independent from suit/rank.
const CARD_DEFINITIONS = [
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
    "description": "조건: 이번 트릭에서 전술 카드나 칩을 1회 이상 사용한 뒤 이 카드로 승리. 효과: 칩 +1.",
    "terms": [
      "트릭"
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
      "적용 값",
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
    "description": "발동: 이 카드로 승리 시 직전에 발동한 네임드의 수치 효과를 1회 복사. 예: 직전 피해 3이면 추가 피해 3.",
    "terms": [
      "트릭"
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
    "description": "발동: 이 카드를 내는 즉시 예약 생성. 다음 트릭에서 승리하면 적에게 추가 피해 6.",
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
    "description": "발동: 이 카드로 트릭 승리 시 적에게 출혈 2 부여. 출혈은 트릭 종료마다 피해를 준다.",
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
    "description": "조건: 이 카드가 쇼다운 3번째 슬롯에 놓일 때. 효과: 적의 다음 카드 예측 단계 +2.",
    "terms": [
      "슬롯",
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
    "description": "효과: 이 카드가 쇼다운 5장 중 하나면 최종 쇼다운 위력 +15. 트릭 중 즉시 효과는 없다.",
    "terms": [
      "쇼다운"
    ],
    "image": "assets/cards/pack01/battery_1pct.png",
    "packId": "pack01",
    "art": "battery"
  },
  {
    "id": "legacy.d8",
    "name": "행운의 주사위",
    "short": "행운 주사위",
    "suit": "D",
    "rank": 8,
    "description": "발동: 이 카드를 낼 때 주사위를 굴린다. 효과: 50% 확률로 칩 +2, 실패하면 칩 +0.",
    "terms": [
      "랜덤",
      "칩"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.c4",
    "name": "황동 조수",
    "short": "황동 조수",
    "suit": "C",
    "rank": 4,
    "description": "발동: 이 카드를 내는 즉시 전술 카드 1장을 뽑는다. 추가: 이 트릭에서 승리하면 칩 +1.",
    "terms": [
      "드로우",
      "트릭"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.s9",
    "name": "검집의 칼날",
    "short": "검집의 칼날",
    "suit": "S",
    "rank": 9,
    "description": "발동: 이 카드로 트릭 승리 시 적에게 피해 2. 추가: 적의 원래 숫자가 이 카드보다 높았다면 피해 +3.",
    "terms": [
      "트릭",
      "피해"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.h5",
    "name": "봉인된 장미",
    "short": "봉인된 장미",
    "suit": "H",
    "rank": 5,
    "description": "발동: 이 카드로 트릭 패배 시 체력 3 회복. 추가: 쇼다운에 포함되면 위력 +3.",
    "terms": [
      "트릭",
      "쇼다운"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.dq",
    "name": "황금 모래시계",
    "short": "황금 모래시계",
    "suit": "D",
    "rank": 12,
    "description": "조건: 이 카드가 쇼다운 4번 또는 5번 슬롯에 놓일 때. 효과: 최종 쇼다운 위력 +8.",
    "terms": [
      "슬롯",
      "쇼다운"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.c6",
    "name": "극성 자석",
    "short": "극성 자석",
    "suit": "C",
    "rank": 6,
    "description": "발동: 이 카드로 같은 무늬의 적 카드를 이기면 우세 +1을 추가로 얻는다.",
    "terms": [
      "우세",
      "트릭"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.sj",
    "name": "검은 서명",
    "short": "검은 서명",
    "suit": "S",
    "rank": 11,
    "description": "발동: 이 카드로 트릭 승리 시 적의 다음 카드 예측 단계 +1. 추가: 이미 최대 예측이면 칩 +1.",
    "terms": [
      "예측",
      "트릭"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.hk",
    "name": "심장의 등불",
    "short": "심장의 등불",
    "suit": "H",
    "rank": 13,
    "description": "발동: 이 카드를 내는 즉시 보호막 4 획득. 추가: 이 카드로 승리하면 체력 2 회복.",
    "terms": [
      "보호막",
      "트릭"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.da",
    "name": "왕실 인장",
    "short": "왕실 인장",
    "suit": "D",
    "rank": 14,
    "description": "효과: 이 카드가 쇼다운에 포함되면 위력 +10. 조건: 다른 네 장의 무늬가 모두 같으면 추가로 +6.",
    "terms": [
      "쇼다운",
      "무늬"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.c10",
    "name": "태엽 상자",
    "short": "태엽 상자",
    "suit": "C",
    "rank": 10,
    "description": "발동: 이 카드를 내는 즉시 전술 카드 1장을 뽑는다. 추가: 이번 트릭에서 전술 카드를 사용하지 않았다면 칩 +1.",
    "terms": [
      "드로우",
      "칩"
    ],
    "image": null,
    "packId": "legacy",
    "art": "custom"
  },
  {
    "id": "legacy.s2",
    "name": "빙결 수정",
    "short": "빙결 수정",
    "suit": "S",
    "rank": 2,
    "description": "발동: 이 카드로 트릭 승리 시 적 우세 -1. 추가: 다음 적 카드 예측 단계 +1.",
    "terms": [
      "트릭",
      "우세",
      "예측"
    ],
    "image": null,
    "packId": "legacy",
    "art": "crystal2"
  },
  {
    "id": "legacy.s4",
    "name": "그림자 단검",
    "short": "그림자 단검",
    "suit": "S",
    "rank": 4,
    "description": "발동: 이 카드로 트릭 승리 시 적에게 피해 4.",
    "terms": [
      "트릭",
      "피해"
    ],
    "image": null,
    "packId": "legacy",
    "art": "dagger4"
  },
  {
    "id": "legacy.s6",
    "name": "강철 톱니",
    "short": "강철 톱니",
    "suit": "S",
    "rank": 6,
    "description": "효과: 이 카드의 적용 숫자 +1. 승리 시 다음 트릭까지 우세 +1.",
    "terms": [
      "적용 값",
      "우세",
      "트릭"
    ],
    "image": null,
    "packId": "legacy",
    "art": "gear6"
  },
  {
    "id": "legacy.s8",
    "name": "심연 거울",
    "short": "심연 거울",
    "suit": "S",
    "rank": 8,
    "description": "발동: 이번 트릭 종료 후 직전에 낸 내 카드 1장을 복사해 덱 맨 위에 올린다.",
    "terms": [
      "트릭",
      "덱"
    ],
    "image": null,
    "packId": "legacy",
    "art": "mirror8"
  },
  {
    "id": "legacy.s10",
    "name": "황금 망원경",
    "short": "황금 망원경",
    "suit": "S",
    "rank": 10,
    "description": "발동: 내 다음 카드와 적 다음 카드의 예측 단계를 각각 +2.",
    "terms": [
      "예측"
    ],
    "image": null,
    "packId": "legacy",
    "art": "scope10"
  },
  {
    "id": "legacy.sq",
    "name": "얼음 여왕",
    "short": "얼음 여왕",
    "suit": "S",
    "rank": 12,
    "description": "효과: 쇼다운에 포함되면 최종 위력 +6. 추가: 하트가 아닌 적 카드에 승리 시 체력 2 회복.",
    "terms": [
      "쇼다운",
      "트릭"
    ],
    "image": null,
    "packId": "legacy",
    "art": "icequeen"
  },
  {
    "id": "legacy.h2",
    "name": "촛불",
    "short": "촛불",
    "suit": "H",
    "rank": 2,
    "description": "발동: 이 카드가 손패에 있을 때 첫 패배 1회를 무효로 하고 이 카드를 버린다.",
    "terms": [
      "패배",
      "버림"
    ],
    "image": null,
    "packId": "legacy",
    "art": "candle2"
  },
  {
    "id": "legacy.h3",
    "name": "새벽 깃털",
    "short": "새벽 깃털",
    "suit": "H",
    "rank": 3,
    "description": "발동: 이 카드가 쇼다운에 포함되면 최종 위력 +3. 추가: 다음에 내는 하트 카드의 적용 숫자 +1.",
    "terms": [
      "쇼다운",
      "최종 위력",
      "적용 값"
    ],
    "image": null,
    "packId": "legacy",
    "art": "feather3"
  },
  {
    "id": "legacy.h6",
    "name": "약초 주머니",
    "short": "약초 주머니",
    "suit": "H",
    "rank": 6,
    "description": "발동: 이 카드로 트릭 승리 시 체력 2 회복. 쇼다운 승리 시 추가로 체력 1 회복.",
    "terms": [
      "트릭",
      "쇼다운",
      "회복"
    ],
    "image": "assets/cards/legacy/H6.png",
    "packId": "legacy",
    "art": "herb6"
  },
  {
    "id": "legacy.h7",
    "name": "연심 나침반",
    "short": "연심 나침반",
    "suit": "H",
    "rank": 7,
    "description": "발동: 내 다음 카드와 적 다음 카드의 예측 단계를 각각 +1. 이 카드로 승리 시 칩 +1.",
    "terms": [
      "예측",
      "트릭",
      "칩"
    ],
    "image": null,
    "packId": "legacy",
    "art": "compass7"
  },
  {
    "id": "legacy.h10",
    "name": "축복의 종",
    "short": "축복의 종",
    "suit": "H",
    "rank": 10,
    "description": "발동: 이 카드가 손패에 있을 때 첫 패배 1회를 무효로 하고 체력 1 회복.",
    "terms": [
      "패배",
      "손패",
      "회복"
    ],
    "image": null,
    "packId": "legacy",
    "art": "bell10"
  },
  {
    "id": "legacy.hq",
    "name": "장미 여왕",
    "short": "장미 여왕",
    "suit": "H",
    "rank": 12,
    "description": "효과: 쇼다운에 포함되면 최종 위력 +7. 추가: 하트 카드 2장 이상 포함 시 위력 +3.",
    "terms": [
      "쇼다운",
      "최종 위력"
    ],
    "image": null,
    "packId": "legacy",
    "art": "queenq"
  },
  {
    "id": "legacy.d2",
    "name": "별 병약",
    "short": "별 병약",
    "suit": "D",
    "rank": 2,
    "description": "발동: 이 카드로 트릭 승리 시 칩 +2. 추가: 다이아 카드 1장 드로우.",
    "terms": [
      "트릭",
      "칩",
      "드로우"
    ],
    "image": "assets/cards/legacy/D2.png",
    "packId": "legacy",
    "art": "potion2"
  },
  {
    "id": "legacy.d4",
    "name": "탐험 지도",
    "short": "탐험 지도",
    "suit": "D",
    "rank": 4,
    "description": "발동: 이 카드로 트릭 승리 시 적 다음 카드의 예측 단계 +2. 쇼다운에 포함되면 최종 위력 +2.",
    "terms": [
      "트릭",
      "예측",
      "쇼다운"
    ],
    "image": null,
    "packId": "legacy",
    "art": "map4"
  },
  {
    "id": "legacy.d5",
    "name": "메모리 패치",
    "short": "메모리 패치",
    "suit": "D",
    "rank": 5,
    "description": "효과: 쇼다운에 순수 카드가 3장 이상이면 위력 +5.",
    "terms": [
      "순수",
      "쇼다운"
    ],
    "image": null,
    "packId": "legacy",
    "art": "patch"
  },
  {
    "id": "legacy.d9",
    "name": "학원비 영수증",
    "short": "학원비 영수증",
    "suit": "D",
    "rank": 9,
    "description": "발동: 이 카드를 내면 칩 1을 지불. 쇼다운에 포함되면 위력 +8.",
    "terms": [
      "칩",
      "쇼다운"
    ],
    "image": "assets/cards/legacy/D9.png",
    "packId": "legacy",
    "art": "receipt"
  },
  {
    "id": "legacy.dj",
    "name": "최종수정본_v7_진짜최종",
    "short": "진짜최종",
    "suit": "D",
    "rank": 11,
    "description": "발동: 이 카드를 낼 때 전술 카드 2장을 뽑는다.",
    "terms": [
      "드로우",
      "전술"
    ],
    "image": null,
    "packId": "legacy",
    "art": "document"
  },
  {
    "id": "legacy.dk",
    "name": "빚쟁이의 계약",
    "short": "빚쟁이의 계약",
    "suit": "D",
    "rank": 13,
    "description": "발동: 이 카드를 처음 내면 칩 +3. 쇼다운에서는 위험한 추가 위력을 얻는다.",
    "terms": [
      "칩",
      "쇼다운"
    ],
    "image": null,
    "packId": "legacy",
    "art": "contract"
  },
  {
    "id": "legacy.s3",
    "name": "만능 열쇠",
    "short": "만능 열쇠",
    "suit": "S",
    "rank": 3,
    "description": "발동: 이 카드로 트릭 승리 시 칩 +1. 다음에 내는 카드의 적용 숫자 +1.",
    "terms": [
      "트릭",
      "칩",
      "적용 값"
    ],
    "image": null,
    "packId": "legacy",
    "art": "key3"
  },
  {
    "id": "legacy.sk",
    "name": "흑왕관",
    "short": "흑왕관",
    "suit": "S",
    "rank": 13,
    "description": "효과: 이 카드가 쇼다운의 가장 높은 카드면 최종 위력 +8.",
    "terms": [
      "쇼다운"
    ],
    "image": null,
    "packId": "legacy",
    "art": "crownk"
  },
  {
    "id": "legacy.ha",
    "name": "루비 성배",
    "short": "루비 성배",
    "suit": "H",
    "rank": 14,
    "description": "발동: 이 카드로 트릭 승리 시 체력 3 회복, 칩 +1.",
    "terms": [
      "트릭",
      "칩"
    ],
    "image": null,
    "packId": "legacy",
    "art": "chalicea"
  },
  {
    "id": "legacy.h9",
    "name": "장미 봉인",
    "short": "장미 봉인",
    "suit": "H",
    "rank": 9,
    "description": "발동: 이 카드가 쇼다운에 포함되면 최종 위력 +5. 추가: 하트 족보의 위력 +2.",
    "terms": [
      "쇼다운",
      "족보",
      "최종 위력"
    ],
    "image": "assets/cards/legacy/H9.png",
    "packId": "legacy",
    "art": "letter9"
  },
  {
    "id": "legacy.hj",
    "name": "익살 광대",
    "short": "익살 광대",
    "suit": "H",
    "rank": 11,
    "description": "발동: 이 카드로 트릭 승리 시 전술 패 1장 드로우. 추가: 이번 라운드에 하트 카드 위력 +1.",
    "terms": [
      "트릭",
      "전술 패",
      "드로우"
    ],
    "image": "assets/cards/legacy/HJ.png",
    "packId": "legacy",
    "art": "jesterj"
  },
  {
    "id": "legacy.d3",
    "name": "묶음 서류",
    "short": "묶음 서류",
    "suit": "D",
    "rank": 3,
    "description": "발동: 이 카드가 쇼다운에 포함되면 최종 위력 +4. 승리 시 골드 +8.",
    "terms": [
      "쇼다운",
      "골드"
    ],
    "image": null,
    "packId": "legacy",
    "art": "papers3"
  },
  {
    "id": "legacy.d10",
    "name": "황혼 패스",
    "short": "황혼 패스",
    "suit": "D",
    "rank": 10,
    "description": "발동: 이 카드가 쇼다운에 포함되면 최종 위력 +6. 승리 시 칩 +2.",
    "terms": [
      "쇼다운",
      "최종 위력",
      "칩"
    ],
    "image": null,
    "packId": "legacy",
    "art": "twilightpass"
  },
  {
    "id": "legacy.ca",
    "name": "푸른 포털",
    "short": "푸른 포털",
    "suit": "C",
    "rank": 14,
    "description": "발동: 이 카드로 트릭 승리 시 전술 패 1장 드로우. 추가: 다음 카드의 적용 숫자 +1.",
    "terms": [
      "트릭",
      "드로우"
    ],
    "image": null,
    "packId": "legacy",
    "art": "portal"
  },
  {
    "id": "legacy.c2",
    "name": "황금 메달",
    "short": "황금 메달",
    "suit": "C",
    "rank": 2,
    "description": "발동: 이 카드가 쇼다운에 포함되면 최종 위력 +3. 승리 시 칩 +1.",
    "terms": [
      "쇼다운",
      "칩"
    ],
    "image": null,
    "packId": "legacy",
    "art": "medal"
  },
  {
    "id": "legacy.c7",
    "name": "연쇄 사슬",
    "short": "연쇄 사슬",
    "suit": "C",
    "rank": 7,
    "description": "발동: 이번 트릭 동안 적 인텐트의 수치 보정을 2만큼 낮춘다.",
    "terms": [
      "트릭",
      "인텐트"
    ],
    "image": null,
    "packId": "legacy",
    "art": "chain"
  },
  {
    "id": "legacy.c9",
    "name": "응시의 눈",
    "short": "응시의 눈",
    "suit": "C",
    "rank": 9,
    "description": "발동: 내 다음 카드와 적 다음 카드의 예측 단계를 각각 +2 한다.",
    "terms": [
      "예측"
    ],
    "image": "assets/cards/legacy/C9.png",
    "packId": "legacy",
    "art": "eye"
  },
  {
    "id": "legacy.cj",
    "name": "황동 의수",
    "short": "황동 의수",
    "suit": "C",
    "rank": 11,
    "description": "발동: 이 카드로 트릭 승리 시 위력 +4를 추가로 얻고 칩 +1.",
    "terms": [
      "트릭",
      "위력",
      "칩"
    ],
    "image": null,
    "packId": "legacy",
    "art": "gauntlet"
  }
];

// Phase 3 effect metadata. Cards outside this registry are intentionally documented-only.
const IMPLEMENTED_CARD_EFFECTS = {
  'pack01.black_bullet': [{trigger:'on_trick_win',action:'damage_enemy',value:3},{trigger:'on_showdown_score',action:'showdown_power',value:4}],
  'pack01.phoenix': [{trigger:'on_trick_win',action:'heal_player',value:4}],
  'pack01.golden_hand': [{trigger:'on_trick_win',action:'gain_chips',value:1,condition:'tactic_or_chip_used'}],
  'pack01.dirty_gambler': [{trigger:'on_trick_win',action:'gain_chips',value:2,condition:'effective_rank_at_most',conditionValue:5}],
  'pack01.recursive_function': [{trigger:'on_trick_win',handler:'repeat_last_named'}],
  'pack01.scheduled_delivery': [{trigger:'on_play',action:'reserve_next_win_damage',value:6}],
  'pack01.emergency_guard': [{trigger:'on_play',action:'gain_shield',value:5}],
  'pack01.sharp_glass': [{trigger:'on_trick_win',action:'apply_enemy_bleed',value:2}],
  'pack01.ambush_observer': [{trigger:'after_card_slotted',action:'increase_enemy_forecast',value:2,condition:'slot_is',conditionValue:3},{trigger:'on_showdown_score',action:'showdown_power',value:4,condition:'slot_is',conditionValue:3}],
  'pack01.battery_1pct': [{trigger:'on_showdown_score',action:'showdown_power',value:15}],
  'legacy.d8': [{trigger:'on_play',handler:'lucky_dice'}],
  'legacy.c4': [{trigger:'on_play',action:'draw_tactic',value:1},{trigger:'on_trick_win',action:'gain_chips',value:1}],
  'legacy.s9': [{trigger:'on_trick_win',handler:'sheathed_blade'}],
  'legacy.h5': [{trigger:'on_trick_loss',action:'heal_player',value:3},{trigger:'on_showdown_score',action:'showdown_power',value:3}],
  'legacy.dq': [{trigger:'on_showdown_score',action:'showdown_power',value:8,condition:'slot_at_least',conditionValue:4}],
  'legacy.c6': [{trigger:'on_trick_win',action:'gain_edge',value:1,condition:'same_suit'}],
  'legacy.sj': [{trigger:'on_trick_win',handler:'black_signature'}],
  'legacy.hk': [{trigger:'on_play',action:'gain_shield',value:4},{trigger:'on_trick_win',action:'heal_player',value:2}],
  'legacy.da': [{trigger:'on_showdown_score',handler:'royal_seal'}],
  'legacy.c10': [{trigger:'on_play',action:'draw_tactic',value:1},{trigger:'on_play',action:'gain_chips',value:1,condition:'no_tactic_modifier'}]
};
for (const card of CARD_DEFINITIONS) {
  card.implemented = Object.hasOwn(IMPLEMENTED_CARD_EFFECTS, card.id);
  card.effects = IMPLEMENTED_CARD_EFFECTS[card.id] || [];
}
const CARD_DEFINITION_BY_ID = Object.fromEntries(CARD_DEFINITIONS.map(card => [card.id, card]));
const CARD_DEFINITION_BY_BASE = Object.fromEntries(CARD_DEFINITIONS.map(card => [`${card.suit}${card.rank}`, card]));
const CARD_PACKS = Object.freeze({ pack01: Object.freeze({ id: 'pack01', name: '신규 1팩', cardIds: Object.freeze(CARD_DEFINITIONS.filter(card => card.packId === 'pack01').map(card => card.id)) }) });
if (typeof module !== 'undefined') module.exports = { CARD_DEFINITIONS, CARD_DEFINITION_BY_ID, CARD_DEFINITION_BY_BASE, CARD_PACKS };
