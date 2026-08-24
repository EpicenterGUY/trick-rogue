const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Economy=require('../run-economy-v2.js');
const Catalog=require('../card-packs/index.js');

function performLog(){
  const calls=[];
  return {calls,perform(action,value,effect){calls.push({action,value,effect})}};
}
function runCard(id,trigger,context={}){
  const card=Cards.createDefinitionCard(id,{uid:`test-${id}`});
  const log=performLog();
  const next={history:{chipsSpent:0},...context,perform:log.perform};
  const count=Effects.run(trigger,card,next);
  return{card,count,calls:log.calls};
}
function pure(suit='S',rank=2){return Cards.createCardRecord({suit,rank,metadata:{uid:`pure-${suit}${rank}`}})}

test('효과 카드 23장은 하나의 공용 카탈로그로 평탄화된다',()=>{
  assert.equal(Catalog.EFFECT_CARD_DEFINITIONS.length,23);
  assert.equal(new Set(Catalog.EFFECT_CARD_IDS).size,23);
  assert.equal(Cards.CARD_DEFINITIONS.length,23);
  assert.deepEqual(Cards.defaultEnabledPacks(),['all-effects']);
  assert.deepEqual(Object.keys(Cards.CARD_PACKS),['all-effects']);
  assert.equal(Cards.CARD_PACKS['all-effects'].cards.length,23);
});

test('예전 pack 선택값은 저장 호환만 하고 보상 풀을 더 이상 분리하지 않는다',()=>{
  const all=Cards.rewardCardIds();
  assert.equal(all.length,23);
  assert.deepEqual(Cards.rewardCardIds(['pack01']),all);
  assert.deepEqual(Cards.rewardCardIds(['pack02']),all);
  assert.deepEqual(Cards.rewardCardIds(['pack01','pack02']),all);
  assert.throws(()=>Cards.rewardCardIds(['unknown-pack']),/Unknown legacy card collection reference/);
});

test('효과 카드 23장은 표준 52장 숫자와 무늬를 사용한다',()=>{
  const cards=Catalog.EFFECT_CARD_DEFINITIONS;
  assert.ok(cards.every(card=>['S','H','D','C'].includes(card.suit)));
  assert.ok(cards.every(card=>Number.isInteger(card.rank)&&card.rank>=2&&card.rank<=14));
});

test('기존 식별자는 유지되어 저장 데이터와 카드 생성이 깨지지 않는다',()=>{
  const card=Cards.createDefinitionCard('pack02.river_ticket');
  assert.equal(card.suit,'H');
  assert.equal(card.rank,5);
  assert.equal(card.printedSuit,'H');
  assert.equal(card.printedRank,5);
  assert.equal(card.cardId,'pack02.river_ticket');
  assert.equal(card.effects[0].condition,'river_hit');
});

test('게임 표시명은 새 네이밍을 사용하고 저장용 id는 유지한다',()=>{
  const expected={
    'pack02.trump_signal':'트럼프 시그널','pack02.river_ticket':'리버 콜','pack02.clean_cut':'클래식 핸드',
    'pack02.afterburner':'라스트 스퍼트','pack02.first_strike':'선수필승','pack02.long_game':'복리',
    'pack02.advantage_settlement':'캐시아웃','pack02.trump_forge':'트럼프 포지','pack02.insurance_exchange':'교환 보험',
    'pack02.originalist':'있는 그대로','pack02.advance_payment':'선지급','pack02.consolation_prize':'위로금','pack02.last_word':'마지막 한 수'
  };
  for(const[id,name]of Object.entries(expected))assert.equal(Cards.CARD_DEFINITION_BY_ID[id].name,name,id);
});

test('검은 탄환과 로우 블러프 메타데이터는 실제 효과와 일치한다',()=>{
  const bullet=Cards.CARD_DEFINITION_BY_ID['pack01.black_bullet'];
  const gambler=Cards.CARD_DEFINITION_BY_ID['pack01.dirty_gambler'];
  assert.equal(bullet.terms.includes('우세'),false);
  assert.ok(bullet.terms.includes('피해'));
  assert.ok(gambler.terms.includes('칩'));
  const tags=Economy.gameplayTagsForDefinition(bullet);
  assert.ok(tags.includes('damage'));
  assert.equal(tags.includes('advantage'),false);
});

test('트럼프 시그널은 최종 트릭 무늬가 트럼프일 때만 칩 2를 준다',()=>{
  assert.equal(Effects.conditions.effective_suit_is_trump({card:{suit:'S'},effectiveSuit:'H',battle:{trump:'H'}}),true);
  assert.equal(Effects.conditions.effective_suit_is_trump({card:{suit:'H'},effectiveSuit:'S',battle:{trump:'H'}}),false);
  const hit=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'H',battle:{trump:'H'}});
  const miss=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'S',battle:{trump:'H'}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['gain_chips',2]]);
  assert.equal(miss.calls.length,0);
});

test('리버 콜은 저장된 리버 적중 결과에만 반응한다',()=>{
  assert.equal(Effects.conditions.river_hit({battle:{riverSnapshot:{candidates:[{suit:'H',rank:5}]},riverHit:null}}),false);
  assert.equal(Effects.conditions.river_hit({battle:{riverHit:{active:true}}}),true);
  const hit=runCard('pack02.river_ticket','on_showdown_score',{battle:{riverHit:{active:true}}});
  const miss=runCard('pack02.river_ticket','on_showdown_score',{battle:{riverSnapshot:{candidates:[{suit:'H',rank:5}]},riverHit:{active:false}}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['showdown_power',8]]);
  assert.equal(miss.calls.length,0);
});

test('클래식 핸드는 순수 카드 3장부터 +7을 주고 라스트 스퍼트는 4/5번 슬롯 보상이 갈린다',()=>{
  const threePure=[pure('S',2),pure('H',3),pure('D',4)];
  const twoPure=[pure('S',2),pure('H',3)];
  assert.deepEqual(runCard('pack02.clean_cut','on_showdown_score',{slots:threePure}).calls.map(x=>[x.action,x.value]),[['showdown_power',7]]);
  assert.equal(runCard('pack02.clean_cut','on_showdown_score',{slots:twoPure}).calls.length,0);
  assert.equal(runCard('pack02.clean_cut','on_showdown_score',{slots:[...twoPure,Cards.createDefinitionCard('pack02.first_strike')]}).calls.length,0);
  assert.deepEqual(runCard('pack02.afterburner','after_card_slotted',{slotIndex:3}).calls.map(x=>[x.action,x.value]),[['gain_chips',1]]);
  assert.deepEqual(runCard('pack02.afterburner','after_card_slotted',{slotIndex:4}).calls.map(x=>[x.action,x.value]),[['gain_chips',2]]);
  assert.equal(runCard('pack02.afterburner','after_card_slotted',{slotIndex:2}).calls.length,0);
});

test('선수필승은 트럼프 무늬로 트릭을 이긴 경우에만 피해 6을 준다',()=>{
  const hit=runCard('pack02.first_strike','on_trick_win',{effectiveSuit:'H',battle:{trump:'H'}});
  const miss=runCard('pack02.first_strike','on_trick_win',{effectiveSuit:'S',battle:{trump:'H'}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['damage_enemy',6]]);
  assert.equal(miss.calls.length,0);
});

test('트럼프 포지는 손패 교환을 사용한 트릭에만 트럼프화와 숫자 +2를 얻는다',()=>{
  const hit=runCard('pack02.trump_forge','on_play',{history:{chipsSpent:2}});
  const miss=runCard('pack02.trump_forge','on_play',{history:{chipsSpent:0}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['set_next_trick_suit_to_trump',undefined],['increase_next_trick_rank',2]]);
  assert.equal(miss.calls.length,0);
});

test('교환 보험과 있는 그대로의 조건은 유지하고 있는 그대로 피해는 4다',()=>{
  const insured=runCard('pack02.insurance_exchange','on_play',{history:{chipsSpent:2}});
  const noSpend=runCard('pack02.insurance_exchange','on_play',{history:{chipsSpent:0}});
  assert.deepEqual(insured.calls.map(x=>[x.action,x.value]),[['gain_shield',6]]);
  assert.equal(noSpend.calls.length,0);
  const original=runCard('pack02.originalist','on_trick_win',{printedRank:12,printedSuit:'D',effectiveRank:12,effectiveSuit:'D'});
  const modified=runCard('pack02.originalist','on_trick_win',{printedRank:12,printedSuit:'D',effectiveRank:15,effectiveSuit:'D'});
  assert.deepEqual(original.calls.map(x=>[x.action,x.value]),[['damage_enemy',4]]);
  assert.equal(modified.calls.length,0);
});

test('캐시아웃과 복리는 기존 명시 조건에서만 발동한다',()=>{
  const advantage=runCard('pack02.advantage_settlement','on_showdown_score',{advantage:{playerActive:true}});
  const noAdvantage=runCard('pack02.advantage_settlement','on_showdown_score',{advantage:{playerActive:false}});
  assert.deepEqual(advantage.calls.map(x=>[x.action,x.value]),[['showdown_power',10]]);
  assert.equal(noAdvantage.calls.length,0);
  assert.deepEqual(runCard('pack02.long_game','on_showdown_score',{setHistory:{wins:4}}).calls.map(x=>[x.action,x.value]),[['showdown_power',12]]);
  assert.equal(runCard('pack02.long_game','on_showdown_score',{setHistory:{wins:3}}).calls.length,0);
});

test('M4 선지급은 트릭 승리의 즉시 피해와 쇼다운 손해를 동시에 가진다',()=>{
  const win=runCard('pack02.advance_payment','on_trick_win');
  const showdown=runCard('pack02.advance_payment','on_showdown_score');
  assert.deepEqual(win.calls.map(x=>[x.action,x.value]),[['damage_enemy',6]]);
  assert.deepEqual(showdown.calls.map(x=>[x.action,x.value]),[['showdown_power',-5]]);
});

test('M4 위로금은 이 카드로 트릭을 패배했을 때만 칩 2를 회수한다',()=>{
  const loss=runCard('pack02.consolation_prize','on_trick_loss');
  const win=runCard('pack02.consolation_prize','on_trick_win');
  assert.deepEqual(loss.calls.map(x=>[x.action,x.value]),[['gain_chips',2]]);
  assert.equal(win.calls.length,0);
});

test('M4 마지막 한 수는 정확히 5번 쇼다운 슬롯에서만 위력 9를 얻는다',()=>{
  const fifth=runCard('pack02.last_word','on_showdown_score',{slotIndex:4});
  const fourth=runCard('pack02.last_word','on_showdown_score',{slotIndex:3});
  assert.deepEqual(fifth.calls.map(x=>[x.action,x.value]),[['showdown_power',9]]);
  assert.equal(fourth.calls.length,0);
});

test('기존 효과 카드 소스는 폐기 규칙을 다시 만들지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-packs','pack02.js'),'utf8');
  assert.doesNotMatch(source,/tacticDeck|tacticHand|전술\s*덱|전술\s*손패/);
  assert.doesNotMatch(source,/trump.*auto.*win|트럼프.*자동.*승리|한쪽.*트럼프.*승리/i);
  assert.doesNotMatch(source,/advantageMargin|showdownAdvantagePower|우세\s*무늬\s*개수/);
});

test('카탈로그 레지스트리는 신규 팩 확장을 유도하지 않고 단일 효과 카드 풀을 선언한다',()=>{
  const registry=fs.readFileSync(path.join(__dirname,'..','card-packs','index.js'),'utf8');
  assert.match(registry,/EFFECT_CARD_DEFINITIONS/);
  assert.match(registry,/프로토타입 규칙: 효과 카드는 팩\/지역으로 활성화하거나 제한하지 않는다/);
  assert.doesNotMatch(registry,/name:'신규 1팩'|name:'조건부 고점팩'/);
  assert.equal(Catalog.CARD_PACK_LIST.length,1,'기존 cards.js 호환 어댑터는 단일 전체 컬렉션만 둔다');
});
