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

test('효과 카드 20장은 하나의 공용 카탈로그로 평탄화된다',()=>{
  assert.equal(Catalog.EFFECT_CARD_DEFINITIONS.length,20);
  assert.equal(new Set(Catalog.EFFECT_CARD_IDS).size,20);
  assert.equal(Cards.CARD_DEFINITIONS.length,20);
  assert.deepEqual(Cards.defaultEnabledPacks(),['all-effects']);
  assert.deepEqual(Object.keys(Cards.CARD_PACKS),['all-effects']);
  assert.equal(Cards.CARD_PACKS['all-effects'].cards.length,20);
});

test('예전 pack 선택값은 저장 호환만 하고 보상 풀을 더 이상 분리하지 않는다',()=>{
  const all=Cards.rewardCardIds();
  assert.equal(all.length,20);
  assert.deepEqual(Cards.rewardCardIds(['pack01']),all);
  assert.deepEqual(Cards.rewardCardIds(['pack02']),all);
  assert.deepEqual(Cards.rewardCardIds(['pack01','pack02']),all);
  assert.throws(()=>Cards.rewardCardIds(['unknown-pack']),/Unknown legacy card collection reference/);
});

test('기존 효과 카드 20장은 표준 52장 숫자와 무늬를 사용한다',()=>{
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

test('검은 탄환과 비열한 승부사 메타데이터는 실제 효과와 일치한다',()=>{
  const bullet=Cards.CARD_DEFINITION_BY_ID['pack01.black_bullet'];
  const gambler=Cards.CARD_DEFINITION_BY_ID['pack01.dirty_gambler'];
  assert.equal(bullet.terms.includes('우세'),false);
  assert.ok(bullet.terms.includes('피해'));
  assert.ok(gambler.terms.includes('칩'));
  const tags=Economy.gameplayTagsForDefinition(bullet);
  assert.ok(tags.includes('damage'));
  assert.equal(tags.includes('advantage'),false);
});

test('트럼프 신호는 최종 트릭 무늬가 트럼프일 때만 칩을 준다',()=>{
  assert.equal(Effects.conditions.effective_suit_is_trump({card:{suit:'S'},effectiveSuit:'H',battle:{trump:'H'}}),true);
  assert.equal(Effects.conditions.effective_suit_is_trump({card:{suit:'H'},effectiveSuit:'S',battle:{trump:'H'}}),false);
  const hit=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'H',battle:{trump:'H'}});
  const miss=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'S',battle:{trump:'H'}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['gain_chips',1]]);
  assert.equal(miss.calls.length,0);
});

test('리버 티켓은 저장된 리버 적중 결과에만 반응한다',()=>{
  assert.equal(Effects.conditions.river_hit({battle:{riverSnapshot:{candidates:[{suit:'H',rank:5}]},riverHit:null}}),false);
  assert.equal(Effects.conditions.river_hit({battle:{riverHit:{active:true}}}),true);
  const hit=runCard('pack02.river_ticket','on_showdown_score',{battle:{riverHit:{active:true}}});
  const miss=runCard('pack02.river_ticket','on_showdown_score',{battle:{riverSnapshot:{candidates:[{suit:'H',rank:5}]},riverHit:{active:false}}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['showdown_power',8]]);
  assert.equal(miss.calls.length,0);
});

test('정석 승부와 후반 가속은 순수 카드 및 4~5번 슬롯 조건을 읽는다',()=>{
  const pure={uid:'pure',suit:'S',rank:2,printedSuit:'S',printedRank:2,effects:[]};
  const clean=runCard('pack02.clean_cut','on_showdown_score',{slots:[pure]});
  const dirty=runCard('pack02.clean_cut','on_showdown_score',{slots:[Cards.createDefinitionCard('pack02.first_strike')]});
  assert.deepEqual(clean.calls.map(x=>[x.action,x.value]),[['showdown_power',5]]);
  assert.equal(dirty.calls.length,0);
  assert.deepEqual(runCard('pack02.afterburner','after_card_slotted',{slotIndex:3}).calls.map(x=>[x.action,x.value]),[['gain_chips',1]]);
  assert.equal(runCard('pack02.afterburner','after_card_slotted',{slotIndex:2}).calls.length,0);
});

test('선수필승은 트럼프 무늬로 트릭을 이긴 경우에만 피해 6을 준다',()=>{
  const hit=runCard('pack02.first_strike','on_trick_win',{effectiveSuit:'H',battle:{trump:'H'}});
  const miss=runCard('pack02.first_strike','on_trick_win',{effectiveSuit:'S',battle:{trump:'H'}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['damage_enemy',6]]);
  assert.equal(miss.calls.length,0);
});

test('트럼프 단조는 손패 교환을 사용한 트릭에만 트럼프화와 숫자 +2를 얻는다',()=>{
  const hit=runCard('pack02.trump_forge','on_play',{history:{chipsSpent:2}});
  const miss=runCard('pack02.trump_forge','on_play',{history:{chipsSpent:0}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['set_next_trick_suit_to_trump',undefined],['increase_next_trick_rank',2]]);
  assert.equal(miss.calls.length,0);
});

test('보험 교환과 원본주의의 조건은 그대로 유지된다',()=>{
  const insured=runCard('pack02.insurance_exchange','on_play',{history:{chipsSpent:2}});
  const noSpend=runCard('pack02.insurance_exchange','on_play',{history:{chipsSpent:0}});
  assert.deepEqual(insured.calls.map(x=>[x.action,x.value]),[['gain_shield',6]]);
  assert.equal(noSpend.calls.length,0);
  const original=runCard('pack02.originalist','on_trick_win',{printedRank:12,printedSuit:'D',effectiveRank:12,effectiveSuit:'D'});
  const modified=runCard('pack02.originalist','on_trick_win',{printedRank:12,printedSuit:'D',effectiveRank:15,effectiveSuit:'D'});
  assert.deepEqual(original.calls.map(x=>[x.action,x.value]),[['damage_enemy',6]]);
  assert.equal(modified.calls.length,0);
});

test('우세 청산과 누적 이자는 기존 명시 조건에서만 발동한다',()=>{
  const advantage=runCard('pack02.advantage_settlement','on_showdown_score',{advantage:{playerActive:true}});
  const noAdvantage=runCard('pack02.advantage_settlement','on_showdown_score',{advantage:{playerActive:false}});
  assert.deepEqual(advantage.calls.map(x=>[x.action,x.value]),[['showdown_power',10]]);
  assert.equal(noAdvantage.calls.length,0);
  assert.deepEqual(runCard('pack02.long_game','on_showdown_score',{setHistory:{wins:4}}).calls.map(x=>[x.action,x.value]),[['showdown_power',12]]);
  assert.equal(runCard('pack02.long_game','on_showdown_score',{setHistory:{wins:3}}).calls.length,0);
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
