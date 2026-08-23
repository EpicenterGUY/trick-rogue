const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Economy=require('../run-economy-v2.js');
const Compendium=require('../compendium-8-h.js');
const Persistence=require('../run-persistence.js');
const Showdown=require('../showdown-resolution.js');

function pure(suit,rank,uid=`pure-${suit}${rank}`){return Cards.createCardRecord({suit,rank,metadata:{uid}})}

test('순수 기본 카드 슬롯은 정확히 52장이고 전부 고유 효과가 없다',()=>{
  const cards=Cards.createBaseCardSlots();
  assert.equal(cards.length,52);
  assert.ok(cards.every(card=>Cards.isPureCard(card)));
  assert.ok(cards.every(card=>Effects.isPureCard(card)));
  assert.ok(cards.every(card=>card.definition===null&&card.named===null&&card.cardId===null&&card.effects.length===0));
});

test('순수 52장은 각 무늬 13장, 각 랭크 2~A가 4장씩 존재한다',()=>{
  const cards=Cards.createBaseCardSlots();
  for(const suit of ['S','H','D','C'])assert.equal(cards.filter(card=>card.suit===suit).length,13);
  for(let rank=2;rank<=14;rank++)assert.equal(cards.filter(card=>card.rank===rank).length,4);
  assert.equal(new Set(cards.map(card=>`${card.suit}:${card.rank}`)).size,52);
});

test('효과 카드가 존재해도 같은 인쇄 숫자/무늬의 순수 카드가 제거되지 않는다',()=>{
  const base=Cards.createBaseCardSlots();
  const pureS3=base.find(card=>card.suit==='S'&&card.rank===3);
  const plus2=Cards.createDefinitionCard('core.plus2',{uid:'effect-s3'});
  const pureD4=base.find(card=>card.suit==='D'&&card.rank===4);
  const paint=Cards.createDefinitionCard('core.paint',{uid:'effect-d4'});
  assert.ok(pureS3);assert.ok(plus2);assert.ok(pureD4);assert.ok(paint);
  assert.equal(Cards.isPureCard(pureS3),true);assert.equal(Cards.isPureCard(plus2),false);
  assert.equal(Cards.isPureCard(pureD4),true);assert.equal(Cards.isPureCard(paint),false);
  assert.deepEqual([pureS3.suit,pureS3.rank],[plus2.suit,plus2.rank]);
  assert.deepEqual([pureD4.suit,pureD4.rank],[paint.suit,paint.rank]);
});

test('카드 정체성은 인쇄값이 아니라 definition ID와 UID로 구분되며 같은 인쇄값을 한 덱에 넣을 수 있다',()=>{
  const pureS7=pure('S',7,'pure-s7');
  const bullet=Cards.createDefinitionCard('pack01.black_bullet',{uid:'bullet-s7'});
  const deck=[pureS7,bullet];
  assert.equal(deck.length,2);
  assert.equal(deck[0].uid,'pure-s7');assert.equal(deck[0].cardId,null);
  assert.equal(deck[1].uid,'bullet-s7');assert.equal(deck[1].cardId,'pack01.black_bullet');
  assert.deepEqual(deck.map(card=>[card.printedSuit,card.printedRank]),[['S',7],['S',7]]);
});

test('인쇄값 조회 보조 맵은 복수 정의를 보존하지만 순수 카드 생성에는 관여하지 않는다',()=>{
  assert.ok(Array.isArray(Cards.CARD_DEFINITIONS_BY_BASE.S7));
  assert.ok(Cards.CARD_DEFINITIONS_BY_BASE.S7.some(def=>def.id==='pack01.black_bullet'));
  assert.ok(Array.isArray(Cards.GENERAL_EFFECT_CARDS_BY_BASE.S3));
  assert.ok(Cards.GENERAL_EFFECT_CARDS_BY_BASE.S3.some(def=>def.id==='core.plus2'));
  const pureS3=Cards.createBaseCardSlots().find(card=>card.suit==='S'&&card.rank===3);
  assert.equal(pureS3.definition,null);assert.equal(pureS3.cardId,null);assert.equal(pureS3.effects.length,0);
});

test('보상 후보는 순수 52장을 모두 포함하고 효과/네임드 카드를 그 위에 별도로 더한다',()=>{
  const catalog=Economy.candidateCatalog(Cards);
  const pureCandidates=catalog.filter(item=>item.kind==='pure');
  assert.equal(pureCandidates.length,52);
  assert.equal(new Set(pureCandidates.map(item=>item.key)).size,52);
  assert.ok(pureCandidates.some(item=>item.key==='pure:S3'));
  assert.ok(catalog.some(item=>item.key==='def:core.plus2'));
  assert.ok(pureCandidates.some(item=>item.key==='pure:S7'));
  assert.ok(catalog.some(item=>item.key==='def:pack01.black_bullet'));
});

test('도감 순수 필터는 정확히 52장이고 공용 효과/pack 카드와 별도 항목이다',()=>{
  const catalog=Compendium.cardCatalog();
  assert.equal(catalog.filter(item=>item.category==='pure').length,52);
  assert.equal(catalog.filter(item=>item.category==='general').length,12);
  assert.equal(catalog.filter(item=>item.packId==='pack01').length,10);
  assert.equal(catalog.filter(item=>item.packId==='pack02').length,10);
  assert.equal(catalog.length,84);
  assert.ok(catalog.some(item=>item.id==='pure.S3'));
  assert.ok(catalog.some(item=>item.id==='core.plus2'));
});

test('순수 카드에 캠프식 트릭 숫자 강화 메타데이터를 붙여도 순수 판정을 유지한다',()=>{
  const card=pure('C',7,'upgrade-c7');
  card.upgradeLevel=1;card.effectiveRankBonus=1;card.trickRankModifier=1;card.upgrade={level:1,trickBonus:1};
  assert.equal(Cards.isPureCard(card),true);
  assert.equal(Effects.isPureCard(card),true);
  assert.equal(card.definition,null);assert.equal(card.cardId,null);assert.equal(card.effects.length,0);
});

test('저장/불러오기 후 같은 S3 순수 카드와 숫자 +2 S3가 서로 뒤바뀌지 않는다',()=>{
  const run={runSeed:7,actId:'common',actIndex:0,hp:60,maxHp:60,gold:60,map:[],available:new Set(),completed:new Set(),currentNodeId:null,runComplete:false,deck:[pure('S',3,'pure-s3'),Cards.createDefinitionCard('core.plus2',{uid:'plus2-s3'})]};
  const text=Persistence.stringifySave(run,{now:0,reason:'pure-52'});
  const restored=Persistence.parseSave(text,{runtimeRoot:Cards}).runState;
  assert.equal(restored.deck.length,2);
  assert.equal(restored.deck[0].uid,'pure-s3');assert.equal(restored.deck[0].cardId,null);assert.equal(restored.deck[0].definition,null);assert.equal(Cards.isPureCard(restored.deck[0]),true);
  assert.equal(restored.deck[1].uid,'plus2-s3');assert.equal(restored.deck[1].cardId,'core.plus2');assert.equal(restored.deck[1].definition,Cards.CARD_DEFINITION_BY_ID['core.plus2']);assert.equal(Cards.isPureCard(restored.deck[1]),false);
});

test('리버 적중은 카드 ID가 아니라 인쇄 숫자+무늬 기준이라 순수 S7과 검은 탄환 S7이 같은 아웃을 적중한다',()=>{
  const four=[pure('S',3,'a'),pure('H',4,'b'),pure('D',5,'c'),pure('C',6,'d')];
  const snapshot=Showdown.createRiverSnapshot(four,{setIndex:1});
  assert.ok(snapshot.candidateKeys.includes('S:7'));
  const pureHit=Showdown.resolveRiverHit(snapshot,pure('S',7,'river-pure'),{setIndex:1});
  const effectHit=Showdown.resolveRiverHit(snapshot,Cards.createDefinitionCard('pack01.black_bullet',{uid:'river-effect'}),{setIndex:1});
  assert.equal(pureHit.active,true);assert.equal(effectHit.active,true);
  assert.equal(pureHit.fifth.key,'S:7');assert.equal(effectHit.fifth.key,'S:7');
  assert.equal(pureHit.matchedCandidate.key,effectHit.matchedCandidate.key);
});

test('포커 족보는 같은 인쇄값을 가진 서로 다른 카드 인스턴스를 각각 한 장으로 계산한다',()=>{
  const entries=[pure('S',7,'pure-s7'),Cards.createDefinitionCard('pack01.black_bullet',{uid:'named-s7'}),pure('H',7,'h7'),pure('D',7,'d7'),pure('C',9,'c9')];
  const hand=Showdown.evaluatePoker(entries);
  assert.equal(hand.id,'four_kind');
  assert.deepEqual(hand.ranks,[7,7,7,7,9]);
});
