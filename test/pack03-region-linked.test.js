const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Economy=require('../run-economy-v2.js');

function runCard(id,trigger,context={}){
  const card=Cards.createDefinitionCard(id,{uid:`test-${id}`});
  const calls=[];
  const next={history:{chipsSpent:0},...context,perform(action,value,effect){calls.push({action,value,effect})}};
  const count=Effects.run(trigger,card,next);
  return{card,count,calls};
}
function callPairs(result){return result.calls.map(entry=>[entry.action,entry.value])}

test('pack03 지역 연계팩은 기본 활성 10장으로 등록된다',()=>{
  const pack=Cards.CARD_PACKS.pack03;
  assert.ok(pack);
  assert.equal(pack.name,'지역 연계팩');
  assert.equal(pack.cards.length,10);
  assert.ok(pack.cards.every(card=>card.packId==='pack03'&&card.implemented&&card.effects.length>0));
  assert.ok(Cards.defaultEnabledPacks().includes('pack03'));
  assert.equal(Cards.rewardCardIds(['pack03']).length,10);
});

test('pack03 10장은 표준 52장 인쇄 규격을 사용하고 ID가 모두 고유하다',()=>{
  const cards=Cards.CARD_PACKS.pack03.cards;
  assert.equal(new Set(cards.map(card=>card.id)).size,10);
  assert.ok(cards.every(card=>['S','H','D','C'].includes(card.suit)));
  assert.ok(cards.every(card=>Number.isInteger(card.rank)&&card.rank>=2&&card.rank<=14));
});

test('유랑극장 3장은 트럼프·변칙·쇼다운값 태그로 실제 지역 친화도를 가진다',()=>{
  for(const id of ['pack03.finale_spotlight','pack03.reverse_script','pack03.trump_encore']){
    const definition=Cards.CARD_DEFINITION_BY_ID[id];
    const tags=Economy.gameplayTagsForDefinition(definition);
    assert.ok(Economy.candidateAffinity({gameplayTags:tags},'region_theater')>0,`${id}: ${tags.join(',')}`);
  }
});

test('안개 관측소 3장은 정보·예약·리버/슬롯 태그로 실제 지역 친화도를 가진다',()=>{
  for(const id of ['pack03.first_scene_preview','pack03.delayed_delivery','pack03.river_archivist']){
    const definition=Cards.CARD_DEFINITION_BY_ID[id];
    const tags=Economy.gameplayTagsForDefinition(definition);
    assert.ok(Economy.candidateAffinity({gameplayTags:tags},'region_observatory')>0,`${id}: ${tags.join(',')}`);
  }
});

test('황야 전선 3장은 칩·피해·상태·방어 태그로 실제 지역 친화도를 가진다',()=>{
  for(const id of ['pack03.blood_dividend','pack03.retreat_cover','pack03.draw_insurance']){
    const definition=Cards.CARD_DEFINITION_BY_ID[id];
    const tags=Economy.gameplayTagsForDefinition(definition);
    assert.ok(Economy.candidateAffinity({gameplayTags:tags},'region_frontier')>0,`${id}: ${tags.join(',')}`);
  }
});

test('교차 신호는 세 지역 모두에 친화도를 갖는 다지역 카드다',()=>{
  const tags=Economy.gameplayTagsForDefinition(Cards.CARD_DEFINITION_BY_ID['pack03.cross_signal']);
  for(const region of ['region_theater','region_observatory','region_frontier'])assert.ok(Economy.candidateAffinity({gameplayTags:tags},region)>0,region);
});

test('피날레 스포트라이트는 5번 슬롯에서만 자기 쇼다운값을 트럼프/+2로 바꾼다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.finale_spotlight','after_card_slotted',{slotIndex:4})),[
    ['set_last_showdown_suit_to_trump',undefined],['increase_last_showdown_rank',2]
  ]);
  assert.equal(runCard('pack03.finale_spotlight','after_card_slotted',{slotIndex:3}).calls.length,0);
});

test('역전 대본은 칩 교환을 쓴 트릭에서만 비교 반전과 칩 1 환급을 준다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.reverse_script','on_play',{history:{chipsSpent:2}})),[
    ['set_reverse_compare',undefined],['gain_chips',1]
  ]);
  assert.equal(runCard('pack03.reverse_script','on_play',{history:{chipsSpent:0}}).calls.length,0);
});

test('트럼프 앙코르는 세트 2승 이후에만 트럼프화와 보호막 2를 준다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.trump_encore','on_play',{setHistory:{wins:2}})),[
    ['set_next_trick_suit_to_trump',undefined],['gain_shield',2]
  ]);
  assert.equal(runCard('pack03.trump_encore','on_play',{setHistory:{wins:1}}).calls.length,0);
});

test('첫 장면 예고와 시차 배송은 지정 쇼다운 슬롯에서만 관측/예약 효과를 낸다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.first_scene_preview','after_card_slotted',{slotIndex:0})),[
    ['reveal_next_enemy_card',undefined],['grant_next_trick_hand_capacity',1]
  ]);
  assert.equal(runCard('pack03.first_scene_preview','after_card_slotted',{slotIndex:1}).calls.length,0);
  assert.deepEqual(callPairs(runCard('pack03.delayed_delivery','after_card_slotted',{slotIndex:1})),[['reserve_next_win_damage',8]]);
  assert.equal(runCard('pack03.delayed_delivery','after_card_slotted',{slotIndex:2}).calls.length,0);
});

test('리버 기록관은 실제 리버 적중에만 쇼다운 +4와 칩 +1을 준다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.river_archivist','on_showdown_score',{battle:{riverHit:{active:true}}})),[
    ['showdown_power',4],['gain_chips',1]
  ]);
  assert.equal(runCard('pack03.river_archivist','on_showdown_score',{battle:{riverHit:{active:false}}}).calls.length,0);
});

test('피의 배당은 최종 트릭 숫자 5 이하 승리에서만 출혈 2와 칩 1을 준다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.blood_dividend','on_trick_win',{effectiveRank:5})),[
    ['apply_enemy_bleed',2],['gain_chips',1]
  ]);
  assert.equal(runCard('pack03.blood_dividend','on_trick_win',{effectiveRank:6}).calls.length,0);
});

test('철수 엄호와 무승부 보험은 각각 패배/무승부를 자원으로 바꾼다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.retreat_cover','on_trick_loss')), [['gain_shield',4],['gain_chips',1]]);
  assert.deepEqual(callPairs(runCard('pack03.draw_insurance','on_trick_draw')), [['gain_shield',4],['gain_chips',2]]);
});

test('교차 신호는 칩 교환을 쓴 트릭에서만 트럼프화와 다음 적 카드 공개를 함께 준다',()=>{
  assert.deepEqual(callPairs(runCard('pack03.cross_signal','on_play',{history:{chipsSpent:2}})),[
    ['set_next_trick_suit_to_trump',undefined],['reveal_next_enemy_card',undefined]
  ]);
  assert.equal(runCard('pack03.cross_signal','on_play',{history:{chipsSpent:0}}).calls.length,0);
});

test('pack03는 폐기된 전술 덱·트럼프 자동승리·상시 무늬 우세를 재도입하지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-packs','pack03.js'),'utf8');
  assert.doesNotMatch(source,/tacticDeck|tacticHand|전술\s*덱|전술\s*손패/);
  assert.doesNotMatch(source,/trump.*auto.*win|트럼프.*자동.*승리|한쪽.*트럼프.*승리/i);
  assert.doesNotMatch(source,/advantageMargin|showdownAdvantagePower|우세\s*무늬\s*개수/);
});