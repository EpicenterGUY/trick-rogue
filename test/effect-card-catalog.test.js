const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Economy=require('../run-economy-v2.js');
const Catalog=require('../card-packs/index.js');

function performLog(){const calls=[];return{calls,perform(action,value,effect){calls.push({action,value,effect})}}}
function runCard(id,trigger,context={}){
  const card=Cards.createDefinitionCard(id,{uid:`test-${id}`});const log=performLog();
  const next={card,history:{chipsSpent:0},setHistory:{wins:0,losses:0,draws:0},...context,perform:log.perform};
  const count=Effects.run(trigger,card,next);return{card,count,calls:log.calls,context:next};
}
function pure(suit='S',rank=2){return Cards.createCardRecord({suit,rank,metadata:{uid:`pure-${suit}${rank}`}})}
const pairs=result=>result.calls.map(x=>[x.action,x.value]);

test('효과 카드 23장은 하나의 공용 카탈로그로 평탄화된다',()=>{
  assert.equal(Catalog.EFFECT_CARD_DEFINITIONS.length,23);assert.equal(new Set(Catalog.EFFECT_CARD_IDS).size,23);assert.equal(Cards.CARD_DEFINITIONS.length,23);
  assert.deepEqual(Cards.defaultEnabledPacks(),['all-effects']);assert.deepEqual(Object.keys(Cards.CARD_PACKS),['all-effects']);assert.equal(Cards.CARD_PACKS['all-effects'].cards.length,23);
});
test('예전 pack 선택값은 저장 호환만 하고 보상 풀을 분리하지 않는다',()=>{const all=Cards.rewardCardIds();assert.equal(all.length,23);assert.deepEqual(Cards.rewardCardIds(['pack01']),all);assert.deepEqual(Cards.rewardCardIds(['pack02']),all);assert.deepEqual(Cards.rewardCardIds(['pack01','pack02']),all);assert.throws(()=>Cards.rewardCardIds(['unknown-pack']),/Unknown legacy card collection reference/)});
test('효과 카드 23장은 표준 52장 숫자와 무늬를 사용하고 ID가 중복되지 않는다',()=>{const cards=Catalog.EFFECT_CARD_DEFINITIONS;assert.ok(cards.every(card=>['S','H','D','C'].includes(card.suit)));assert.ok(cards.every(card=>Number.isInteger(card.rank)&&card.rank>=2&&card.rank<=14));assert.equal(new Set(cards.map(card=>card.id)).size,cards.length)});
test('현재 표시명과 저장용 ID는 그대로 유지한다',()=>{const expected={'pack02.trump_signal':'트럼프 시그널','pack02.river_ticket':'리버 콜','pack02.clean_cut':'클래식 핸드','pack02.afterburner':'라스트 스퍼트','pack02.first_strike':'선수필승','pack02.long_game':'복리','pack02.advantage_settlement':'캐시아웃','pack02.trump_forge':'트럼프 포지','pack02.insurance_exchange':'교환 보험','pack02.originalist':'있는 그대로','pack02.advance_payment':'선지급','pack02.consolation_prize':'위로금','pack02.last_word':'마지막 한 수'};for(const[id,name]of Object.entries(expected))assert.equal(Cards.CARD_DEFINITION_BY_ID[id].name,name,id)});

test('검은 탄환은 일반 승리 피해 4, 정확히 5번 슬롯 승리면 총 8 피해다',()=>{
  assert.deepEqual(pairs(runCard('pack01.black_bullet','on_trick_win',{slotIndex:2})),[['damage_enemy',4]]);
  assert.deepEqual(pairs(runCard('pack01.black_bullet','on_trick_win',{slotIndex:4})),[['damage_enemy',4],['damage_enemy',4]]);
  assert.equal(runCard('pack01.black_bullet','on_showdown_score',{slotIndex:4}).calls.length,0);
});
test('불사조는 저체력에서 추가 3을 먼저 판정한 뒤 기본 4를 회복한다',()=>{
  assert.deepEqual(pairs(runCard('pack01.phoenix','on_trick_win',{playerHp:5,playerMaxHp:10})),[['heal_player',3],['heal_player',4]]);
  assert.deepEqual(pairs(runCard('pack01.phoenix','on_trick_win',{playerHp:6,playerMaxHp:10})),[['heal_player',4]]);
});
test('골든 핸드·로우 블러프·재귀 함수는 기존 역할을 유지한다',()=>{
  assert.deepEqual(pairs(runCard('pack01.golden_hand','on_trick_win')),[['gain_chips',1],['grant_next_trick_hand_capacity',1]]);
  assert.deepEqual(pairs(runCard('pack01.dirty_gambler','on_trick_win',{effectiveRank:5})),[['gain_chips',2]]);assert.equal(runCard('pack01.dirty_gambler','on_trick_win',{effectiveRank:6}).calls.length,0);
  assert.equal(Cards.CARD_DEFINITION_BY_ID['pack01.recursive_function'].effects[0].handler,'repeat_last_named_numeric');
});
test('예약 사격은 바로 다음 트릭 승리 피해를 8로 예약한다',()=>{assert.deepEqual(pairs(runCard('pack01.scheduled_delivery','on_play')),[['reserve_next_win_damage',8]])});
test('비상 방패는 보호막 6과 쇼다운 잔존 보호막 +6을 연결한다',()=>{
  assert.deepEqual(pairs(runCard('pack01.emergency_guard','on_play',{battle:{statuses:{player:{shield:0}}}})),[['gain_shield',6]]);
  assert.deepEqual(pairs(runCard('pack01.emergency_guard','on_showdown_score',{battle:{statuses:{player:{shield:1}}}})),[['showdown_power',6]]);
  assert.equal(runCard('pack01.emergency_guard','on_showdown_score',{battle:{statuses:{player:{shield:0}}}}).calls.length,0);
});
test('유리 칼날은 기존 출혈이 있으면 피해 3을 먼저 주고 이후 출혈 3을 부여한다',()=>{
  assert.deepEqual(pairs(runCard('pack01.sharp_glass','on_trick_win',{battle:{statuses:{enemy:{bleed:2}}}})),[['damage_enemy',3],['apply_enemy_bleed',3]]);
  assert.deepEqual(pairs(runCard('pack01.sharp_glass','on_trick_win',{battle:{statuses:{enemy:{bleed:0}}}})),[['apply_enemy_bleed',3]]);
});
test('잠복 관측자와 잔량 1%의 슬롯 효과는 유지한다',()=>{
  assert.deepEqual(pairs(runCard('pack01.ambush_observer','after_card_slotted',{slotIndex:2})),[['increase_enemy_forecast',2]]);
  assert.equal(runCard('pack01.ambush_observer','after_card_slotted',{slotIndex:1}).calls.length,0);
  assert.deepEqual(pairs(runCard('pack01.battery_1pct','on_showdown_score',{slotIndex:4})),[['showdown_power',12]]);
});

test('트럼프 시그널은 최종 트릭 무늬가 트럼프일 때만 칩 2다',()=>{const hit=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'H',battle:{trump:'H'}}),miss=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'S',battle:{trump:'H'}});assert.deepEqual(pairs(hit),[['gain_chips',2]]);assert.equal(miss.calls.length,0)});
test('리버 콜은 5번 슬롯 적중 +12, 후보가 있었던 실패 -4, 후보 없음 0이다',()=>{
  assert.deepEqual(pairs(runCard('pack02.river_ticket','on_showdown_score',{slotIndex:4,battle:{riverSnapshot:{candidateCount:4},riverHit:{active:true,reason:'candidate_hit',candidateCount:4}}})),[['showdown_power',12]]);
  assert.deepEqual(pairs(runCard('pack02.river_ticket','on_showdown_score',{slotIndex:4,battle:{riverSnapshot:{candidateCount:4},riverHit:{active:false,reason:'candidate_miss',candidateCount:4}}})),[['showdown_power',-4]]);
  assert.equal(runCard('pack02.river_ticket','on_showdown_score',{slotIndex:4,battle:{riverSnapshot:{candidateCount:0},riverHit:{active:false,reason:'candidate_miss',candidateCount:0}}}).calls.length,0);
  assert.equal(runCard('pack02.river_ticket','on_showdown_score',{slotIndex:3,battle:{riverSnapshot:{candidateCount:4},riverHit:{active:true,reason:'candidate_hit',candidateCount:4}}}).calls.length,0);
});
test('클래식 핸드와 라스트 스퍼트는 기존 조건을 유지한다',()=>{const three=[pure('S',2),pure('H',3),pure('D',4)];assert.deepEqual(pairs(runCard('pack02.clean_cut','on_showdown_score',{slots:three})),[['showdown_power',7]]);assert.deepEqual(pairs(runCard('pack02.afterburner','after_card_slotted',{slotIndex:3})),[['gain_chips',1]]);assert.deepEqual(pairs(runCard('pack02.afterburner','after_card_slotted',{slotIndex:4})),[['gain_chips',2]])});
test('선수필승은 1번째 트릭에만 +4와 승리 피해 4를 준다',()=>{
  assert.deepEqual(pairs(runCard('pack02.first_strike','on_play',{battle:{trick:1}})),[['increase_next_trick_rank',4]]);
  assert.deepEqual(pairs(runCard('pack02.first_strike','on_trick_win',{battle:{trick:1}})),[['damage_enemy',4]]);
  assert.equal(runCard('pack02.first_strike','on_play',{battle:{trick:2}}).calls.length,0);assert.equal(runCard('pack02.first_strike','on_trick_win',{battle:{trick:5}}).calls.length,0);
});
test('복리는 낼 때 승리 횟수를 스냅샷하고 쇼다운에서 0/2/4/8 계단을 적용한다',()=>{
  for(const[wins,expected]of [[0,0],[1,2],[2,4],[3,8],[4,8]]){
    const card=Cards.createDefinitionCard('pack02.long_game',{uid:`long-${wins}`}),calls=[],context={card,battle:{setIndex:1,setHistory:{wins}},setHistory:{wins},perform:(a,v)=>calls.push([a,v])};
    Effects.run('on_play',card,context);calls.length=0;Effects.run('on_showdown_score',card,context);
    assert.deepEqual(calls,expected?[['showdown_power',expected]]:[],`wins=${wins}`);
  }
});
test('캐시아웃·트럼프 포지·교환 보험·있는 그대로는 최신 효과를 유지한다',()=>{
  assert.deepEqual(pairs(runCard('pack02.advantage_settlement','on_showdown_score',{advantage:{playerActive:true}})),[['showdown_power',10]]);
  assert.deepEqual(pairs(runCard('pack02.trump_forge','on_play',{history:{chipsSpent:2}})),[['set_next_trick_suit_to_trump',undefined],['increase_next_trick_rank',2]]);
  assert.deepEqual(pairs(runCard('pack02.insurance_exchange','on_play',{history:{chipsSpent:2}})),[['gain_shield',6]]);
  assert.deepEqual(pairs(runCard('pack02.originalist','on_trick_win',{printedRank:12,printedSuit:'D',effectiveRank:12,effectiveSuit:'D'})),[['damage_enemy',4]]);
});
test('선지급·위로금·마지막 한 수는 회귀하지 않는다',()=>{
  assert.deepEqual(pairs(runCard('pack02.advance_payment','on_trick_win')),[['damage_enemy',6]]);assert.deepEqual(pairs(runCard('pack02.advance_payment','on_showdown_score')),[['showdown_power',-5]]);
  assert.deepEqual(pairs(runCard('pack02.consolation_prize','on_trick_loss')),[['gain_chips',2]]);assert.equal(runCard('pack02.consolation_prize','on_trick_draw').calls.length,0);
  assert.deepEqual(pairs(runCard('pack02.last_word','on_showdown_score',{slotIndex:4})),[['showdown_power',9]]);assert.equal(runCard('pack02.last_word','on_showdown_score',{slotIndex:3}).calls.length,0);
});

test('검은 탄환 메타데이터와 런 경제 태그는 실제 즉시 피해 효과와 일치한다',()=>{const bullet=Cards.CARD_DEFINITION_BY_ID['pack01.black_bullet'];assert.ok(bullet.terms.includes('피해'));assert.equal(bullet.terms.includes('우세'),false);const tags=Economy.gameplayTagsForDefinition(bullet);assert.ok(tags.includes('damage'));assert.equal(tags.includes('advantage'),false)});
test('효과 카드 소스는 폐기 규칙을 다시 만들지 않는다',()=>{const source=fs.readFileSync(path.join(__dirname,'..','card-packs','pack02.js'),'utf8');assert.doesNotMatch(source,/tacticDeck|tacticHand|전술\s*덱|전술\s*손패/);assert.doesNotMatch(source,/trump.*auto.*win|트럼프.*자동.*승리|한쪽.*트럼프.*승리/i);assert.doesNotMatch(source,/advantageMargin|showdownAdvantagePower|우세\s*무늬\s*개수/)});
test('카탈로그는 단일 효과 카드 풀을 유지한다',()=>{const registry=fs.readFileSync(path.join(__dirname,'..','card-packs','index.js'),'utf8');assert.match(registry,/EFFECT_CARD_DEFINITIONS/);assert.equal(Catalog.CARD_PACK_LIST.length,1);assert.equal(Catalog.CARD_PACK_LIST[0].id,'all-effects')});
