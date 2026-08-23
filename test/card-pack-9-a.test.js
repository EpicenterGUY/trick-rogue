const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');

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

test('9-A pack02는 기본 활성 10장 카드팩으로 등록되고 pack01을 그대로 보존한다',()=>{
  assert.equal(Cards.CARD_PACKS.pack01.cards.length,10);
  assert.equal(Cards.CARD_PACKS.pack02.cards.length,10);
  assert.deepEqual(Cards.defaultEnabledPacks(),['pack01','pack02']);
  assert.equal(Cards.CARD_DEFINITIONS.length,20);
  assert.ok(Cards.CARD_PACKS.pack02.cards.every(card=>card.implemented&&card.effects.length>0));
});

test('pack02 10장은 표준 52장 숫자/무늬만 사용하고 팩 내부 인쇄 슬롯이 겹치지 않는다',()=>{
  const cards=Cards.CARD_PACKS.pack02.cards;
  const keys=cards.map(card=>`${card.suit}${card.rank}`);
  assert.equal(new Set(keys).size,10);
  assert.ok(cards.every(card=>['S','H','D','C'].includes(card.suit)));
  assert.ok(cards.every(card=>Number.isInteger(card.rank)&&card.rank>=2&&card.rank<=14));
});

test('활성 카드팩 선택에 따라 pack01/pack02 보상 풀이 독립적으로 열리고 기본은 20장이다',()=>{
  assert.equal(Cards.rewardCardIds(['pack01']).length,10);
  assert.ok(Cards.rewardCardIds(['pack01']).every(id=>id.startsWith('pack01.')));
  assert.equal(Cards.rewardCardIds(['pack02']).length,10);
  assert.ok(Cards.rewardCardIds(['pack02']).every(id=>id.startsWith('pack02.')));
  assert.equal(Cards.rewardCardIds().length,20);
});

test('pack02 정의 카드는 인쇄값과 고유 effects를 그대로 가진 실제 카드 레코드로 생성된다',()=>{
  const card=Cards.createDefinitionCard('pack02.river_ticket');
  assert.equal(card.suit,'H');assert.equal(card.rank,5);
  assert.equal(card.printedSuit,'H');assert.equal(card.printedRank,5);
  assert.equal(card.cardId,'pack02.river_ticket');
  assert.equal(card.effects[0].condition,'river_hit');
  assert.notEqual(card.effects,Cards.CARD_PACKS.pack02.cards[1].effects);
});

test('트럼프 신호는 인쇄 무늬가 아니라 최종 트릭 무늬가 트럼프일 때만 칩을 준다',()=>{
  assert.equal(Effects.conditions.effective_suit_is_trump({card:{suit:'S'},effectiveSuit:'H',battle:{trump:'H'}}),true);
  assert.equal(Effects.conditions.effective_suit_is_trump({card:{suit:'H'},effectiveSuit:'S',battle:{trump:'H'}}),false);
  const hit=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'H',battle:{trump:'H'}});
  const miss=runCard('pack02.trump_signal','on_trick_win',{effectiveSuit:'S',battle:{trump:'H'}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['gain_chips',1]]);
  assert.equal(miss.calls.length,0);
});

test('리버 티켓은 4트릭 후보 존재가 아니라 저장된 리버 적중 결과에만 반응한다',()=>{
  assert.equal(Effects.conditions.river_hit({battle:{riverSnapshot:{candidates:[{suit:'H',rank:5}]},riverHit:null}}),false);
  assert.equal(Effects.conditions.river_hit({battle:{riverHit:{active:true}}}),true);
  const hit=runCard('pack02.river_ticket','on_showdown_score',{battle:{riverHit:{active:true}}});
  const miss=runCard('pack02.river_ticket','on_showdown_score',{battle:{riverSnapshot:{candidates:[{suit:'H',rank:5}]},riverHit:{active:false}}});
  assert.deepEqual(hit.calls.map(x=>[x.action,x.value]),[['showdown_power',8]]);
  assert.equal(miss.calls.length,0);
});

test('정석 승부와 후반 가속은 순수 카드 및 4~5번 슬롯 조건을 각각 실제 영역에서 읽는다',()=>{
  const pure={uid:'pure',suit:'S',rank:2,printedSuit:'S',printedRank:2,effects:[]};
  const clean=runCard('pack02.clean_cut','on_showdown_score',{slots:[pure]});
  const dirty=runCard('pack02.clean_cut','on_showdown_score',{slots:[Cards.createDefinitionCard('pack02.first_strike')]});
  assert.deepEqual(clean.calls.map(x=>[x.action,x.value]),[['showdown_power',5]]);
  assert.equal(dirty.calls.length,0);
  assert.deepEqual(runCard('pack02.afterburner','after_card_slotted',{slotIndex:3}).calls.map(x=>[x.action,x.value]),[['gain_chips',1]]);
  assert.equal(runCard('pack02.afterburner','after_card_slotted',{slotIndex:2}).calls.length,0);
});

test('보험 교환은 이번 트릭 칩 소비, 원본주의는 무보정 최종 트릭값 조건을 사용한다',()=>{
  const insured=runCard('pack02.insurance_exchange','on_play',{history:{chipsSpent:2}});
  const noSpend=runCard('pack02.insurance_exchange','on_play',{history:{chipsSpent:0}});
  assert.deepEqual(insured.calls.map(x=>[x.action,x.value]),[['gain_shield',6]]);
  assert.equal(noSpend.calls.length,0);
  const original=runCard('pack02.originalist','on_trick_win',{printedRank:12,printedSuit:'D',effectiveRank:12,effectiveSuit:'D'});
  const modified=runCard('pack02.originalist','on_trick_win',{printedRank:12,printedSuit:'D',effectiveRank:15,effectiveSuit:'D'});
  assert.deepEqual(original.calls.map(x=>[x.action,x.value]),[['damage_enemy',6]]);
  assert.equal(modified.calls.length,0);
});

test('우세 청산과 누적 이자는 명시적 우세와 세트 3승 조건에서만 발동한다',()=>{
  const advantage=runCard('pack02.advantage_settlement','on_showdown_score',{advantage:{playerActive:true}});
  const noAdvantage=runCard('pack02.advantage_settlement','on_showdown_score',{advantage:{playerActive:false}});
  assert.deepEqual(advantage.calls.map(x=>[x.action,x.value]),[['showdown_power',10]]);
  assert.equal(noAdvantage.calls.length,0);
  assert.deepEqual(runCard('pack02.long_game','on_showdown_score',{setHistory:{wins:3}}).calls.map(x=>[x.action,x.value]),[['showdown_power',8]]);
  assert.equal(runCard('pack02.long_game','on_showdown_score',{setHistory:{wins:2}}).calls.length,0);
});

test('pack02는 폐기된 전술 덱·트럼프 자동 승리·상시 무늬 우세 규칙을 다시 만들지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-packs','pack02.js'),'utf8');
  assert.doesNotMatch(source,/tacticDeck|tacticHand|전술\s*덱|전술\s*손패/);
  assert.doesNotMatch(source,/trump.*auto.*win|트럼프.*자동.*승리|한쪽.*트럼프.*승리/i);
  assert.doesNotMatch(source,/advantageMargin|showdownAdvantagePower|우세\s*무늬\s*개수/);
});

test('브라우저 부트스트랩은 pack02를 카드팩 레지스트리보다 먼저 불러오도록 연결한다',()=>{
  const pack01=fs.readFileSync(path.join(__dirname,'..','card-packs','pack01.js'),'utf8');
  const registry=fs.readFileSync(path.join(__dirname,'..','card-packs','index.js'),'utf8');
  assert.match(pack01,/card-packs\/pack02\.js/);
  assert.match(pack01,/data-trick-pack02-bootstrap/);
  assert.match(registry,/root\.PACK02_CARDS/);
  assert.match(registry,/id:'pack02'/);
});
