const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Personality=require('../card-personality-runtime.js');
const Economy=require('../run-economy-v2.js');
const Persistence=require('../run-persistence.js');
const Compendium=require('../compendium-8-h.js');
const Showdown=require('../showdown-resolution.js');
const CardTextMode=require('../card-text-mode.js');

function pure(suit,rank,uid=`pure-${suit}-${rank}`){return Cards.createCardRecord({suit,rank,metadata:{uid}})}
function run(card,trigger,context={}){const calls=[];const next={card,history:Effects.newHistory(),setHistory:{wins:0,losses:0,draws:0},perform:(action,value)=>calls.push([action,value]),...context};const count=Effects.run(trigger,card,next);return{count,calls,context:next}}

test('개성화 후에도 순수 52장은 효과 카드와 독립적으로 모두 존재한다',()=>{
  const base=Cards.createBaseCardSlots();assert.equal(base.length,52);assert.ok(base.every(card=>Cards.isPureCard(card)&&card.effects.length===0));
  const pureS7=base.find(card=>card.suit==='S'&&card.rank===7),bullet=Cards.createDefinitionCard('pack01.black_bullet',{uid:'effect-s7'});
  assert.ok(pureS7);assert.deepEqual([pureS7.printedSuit,pureS7.printedRank],[bullet.printedSuit,bullet.printedRank]);assert.equal(Cards.isPureCard(bullet),false);
});

test('전체 효과 카드 ID는 중복 없고 인쇄 숫자/무늬는 표준 규격이다',()=>{
  const all=Cards.ALL_CARD_DEFINITIONS;assert.equal(new Set(all.map(card=>card.id)).size,all.length);
  assert.ok(all.every(card=>['S','H','D','C'].includes(card.suit)));assert.ok(all.every(card=>Number.isInteger(card.rank)&&card.rank>=2&&card.rank<=14));
});

test('정찰은 다음 적 카드를 공개하고 정확히 다음 트릭 1회의 낮은 인쇄 숫자 역전 승리만 보상한다',()=>{
  const scout=Cards.createDefinitionCard('core.scout',{uid:'scout'}),battle={setIndex:1,trick:2,reservations:[]};
  const played=run(scout,'on_play',{battle,printedRank:9,printedSuit:'D'});
  assert.equal(played.count,2);assert.deepEqual(played.calls,[['reveal_next_enemy_card',undefined]]);assert.equal(battle.reservations.length,1);
  const reservation=battle.reservations[0];assert.deepEqual([reservation.eligibleSet,reservation.eligibleTrick],[1,3]);

  const rewards=[];globalThis.battle={setIndex:1,trick:3,slots:[{card:{printedSuit:'C',printedRank:4,suit:'C',rank:4}}],enemyCard:{printedSuit:'H',printedRank:8,suit:'H',rank:8}};
  try{assert.deepEqual(Effects.resolveNextWinReservations([reservation],{set:1,trick:3},true,(a,v)=>rewards.push([a,v])),[])}finally{delete globalThis.battle}
  assert.deepEqual(rewards,[['gain_chips',1]]);

  const missRewards=[];globalThis.battle={setIndex:1,trick:3,slots:[{card:{printedSuit:'C',printedRank:10,suit:'C',rank:10}}],enemyCard:{printedSuit:'H',printedRank:8,suit:'H',rank:8}};
  try{assert.deepEqual(Effects.resolveNextWinReservations([reservation],{set:1,trick:3},true,(a,v)=>missRewards.push([a,v])),[])}finally{delete globalThis.battle}
  assert.deepEqual(missRewards,[]);
});

test('정찰 예약은 5번째 트릭에서 사용하면 다음 세트 1번째 트릭을 가리킨다',()=>{
  assert.deepEqual(Personality.nextTurn({setIndex:2,trick:5}),{set:3,trick:1});
});

test('더블다운 패배는 소비한 칩을 환불하지 않는다',()=>{
  const card=Cards.createDefinitionCard('core.double',{uid:'double-loss'}),battle={setIndex:1,trick:2,chip:2,history:Effects.newHistory(),chipEconomy:{balance:2,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}};
  const played=run(card,'on_play',{battle,history:battle.history});assert.equal(played.count,2);assert.equal(battle.chip,1);assert.equal(battle.chipEconomy.balance,1);
  const loss=run(card,'on_trick_loss',{battle,history:battle.history});assert.equal(loss.count,0);assert.equal(battle.chip,1);assert.equal(battle.chipEconomy.balance,1);
});

test('리버 콜은 실제 4장 riverSnapshot과 고정된 riverHit 결과를 사용한다',()=>{
  const firstFour=[pure('S',2),pure('H',3),pure('D',4),pure('C',5)],snapshot=Showdown.createRiverSnapshot(firstFour,{setIndex:1});assert(snapshot.candidateCount>0);
  const hit=Showdown.resolveRiverHit(snapshot,pure('S',6),{setIndex:1}),miss=Showdown.resolveRiverHit(snapshot,pure('S',9),{setIndex:1});assert.equal(hit.active,true);assert.equal(miss.reason,'candidate_miss');
  const card=Cards.createDefinitionCard('pack02.river_ticket',{uid:'river-call'});
  assert.deepEqual(run(card,'on_showdown_score',{slotIndex:4,battle:{riverSnapshot:snapshot,riverHit:hit}}).calls,[['showdown_power',12]]);
  assert.deepEqual(run(card,'on_showdown_score',{slotIndex:4,battle:{riverSnapshot:snapshot,riverHit:miss}}).calls,[['showdown_power',-4]]);
});

test('리버 후보가 애초에 없었다면 리버 콜 실패 페널티가 없다',()=>{
  const card=Cards.createDefinitionCard('pack02.river_ticket',{uid:'river-empty'}),battle={riverSnapshot:{candidateCount:0},riverHit:{active:false,reason:'candidate_miss',candidateCount:0}};
  assert.equal(run(card,'on_showdown_score',{slotIndex:4,battle}).count,0);
});

test('복리 기록은 카드 인스턴스와 세트 번호에 묶이고 다음 세트의 낡은 기록은 사용하지 않는다',()=>{
  const card=Cards.createDefinitionCard('pack02.long_game',{uid:'compound'}),calls=[];
  const set1={card,battle:{setIndex:1,setHistory:{wins:3}},setHistory:{wins:3},perform:(a,v)=>calls.push([a,v])};Effects.run('on_play',card,set1);calls.length=0;Effects.run('on_showdown_score',card,set1);assert.deepEqual(calls,[['showdown_power',8]]);
  calls.length=0;const set2={...set1,battle:{setIndex:2,setHistory:{wins:0}},setHistory:{wins:0}};Effects.run('on_showdown_score',card,set2);assert.deepEqual(calls,[]);
});

test('공용 효과 카드도 보상 후보와 도감에 별도 정의로 노출된다',()=>{
  const candidates=Economy.candidateCatalog(Cards),compendium=Compendium.cardCatalog();
  for(const id of ['core.paint','core.double','core.fakeid']){assert.ok(candidates.some(item=>item.key===`def:${id}`),id);assert.ok(compendium.some(item=>item.id===id),id)}
});

test('저장/불러오기 후 카드 ID와 최신 effect 정의가 복원된다',()=>{
  const original=Cards.createDefinitionCard('core.fakeid',{uid:'saved-fake'}),runState={runSeed:17,actId:'common',actIndex:0,hp:60,maxHp:60,gold:50,map:[],available:new Set(),completed:new Set(),currentNodeId:null,runComplete:false,deck:[original]};
  const text=Persistence.stringifySave(runState,{now:0,reason:'personality'}),restored=Persistence.parseSave(text,{runtimeRoot:Cards}).runState.deck[0];
  assert.equal(restored.cardId,'core.fakeid');assert.equal(restored.definition,Cards.CARD_DEFINITION_BY_ID['core.fakeid']);assert.deepEqual(restored.effects,Cards.CARD_DEFINITION_BY_ID['core.fakeid'].effects);
  assert.equal(restored.effects[0].action,'copy_previous_showdown_rank');
});

test('도감/카드 앞면 설명에는 변경 전 핵심 수치가 남지 않는다',()=>{
  assert.match(Cards.CARD_DEFINITION_BY_ID['pack01.black_bullet'].description,/피해 4/);assert.doesNotMatch(Cards.CARD_DEFINITION_BY_ID['pack01.black_bullet'].description,/위력 \+3/);
  assert.match(Cards.CARD_DETAIL_BY_ID['pack01.scheduled_delivery'].effect,/피해 8/);
  assert.match(CardTextMode.COMPACT_TEXT['core.plus2'].summary,/\+3/);assert.match(CardTextMode.COMPACT_TEXT['core.double'].summary,/칩 1/);
  assert.match(Cards.CARD_DEFINITION_BY_ID['core.fakeid'].description,/이전 쇼다운 카드의 숫자를 복사/);
});
