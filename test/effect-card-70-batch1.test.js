const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const EnemyInformation=require('../enemy-information.js');
const Bridge=require('../compendium-8-h-runtime-bridge.js');
const SystemTags=require('../card-system-tags.js');

const IDS=Object.freeze([
  'effect70.observation_record',
  'effect70.reverse_table',
  'effect70.signal_flare',
  'effect70.film_roll'
]);
function definition(id){const value=Cards.CARD_DEFINITION_BY_ID[id];assert.ok(value,id);return value}
function makeBattle(rank=9){return{enemyCard:{suit:'S',rank,printedSuit:'S',printedRank:rank},mods:{plus:0},setIndex:1,trick:1,history:{chipsSpent:0},setHistory:{wins:0,losses:0,draws:0}}}
function reveal(battle){EnemyInformation.revealCurrentEnemyCard(battle);return battle}
function run(card,trigger,battle,calls=[]){
  return Effects.run(trigger,card,{card,battle,enemyCard:battle.enemyCard,setIndex:battle.setIndex,trick:battle.trick,history:battle.history,setHistory:battle.setHistory,perform:(action,value,effect)=>calls.push({action,value,effect})});
}

test('1차 배치는 정확히 네 장이며 공용 효과 풀에만 추가된다',()=>{
  for(const id of IDS)assert.ok(Cards.CARD_DEFINITION_BY_ID[id]);
  assert.equal(new Set(IDS).size,4);
  assert.equal(Cards.GENERAL_EFFECT_CARD_DEFINITIONS.length,12,'공용 코어 12장은 그대로 유지');
  const signatures=Cards.CARD_DEFINITIONS.filter(card=>card.signatureBossId||card.category==='boss_signature').length;
  assert.equal(signatures,6);
  assert.equal(Cards.CARD_DEFINITIONS.length-signatures,48,'일반 네임드 44 + 신규 4');
  assert.deepEqual(Cards.defaultEnabledPacks(),['all-effects']);
  assert.equal(Object.keys(Cards.CARD_PACKS).length,1);
});

test('도감 기준은 순수 52 / 효과 60 / 보스 시그니처 6 / 총 118장이다',()=>{
  const counts=Bridge.catalogCounts(null);
  assert.equal(counts.pure,52);
  assert.equal(counts.effect,60);
  assert.equal(counts.signature,6);
  assert.equal(counts.cards,118);
});

test('신규 네 장은 유효한 숫자·무늬·1~3개 공식 systemTags와 effect schema를 가진다',()=>{
  const expected={
    'effect70.observation_record':['예측','족보','쇼다운 개입'],
    'effect70.reverse_table':['예측','적용값 감소','칩'],
    'effect70.signal_flare':['직접 피해','예측'],
    'effect70.film_roll':['예측','손패']
  };
  const suits=[];
  for(const id of IDS){
    const card=definition(id);suits.push(card.suit);
    assert.ok(['S','H','D','C'].includes(card.suit));
    assert.ok(Number.isInteger(card.rank)&&card.rank>=2&&card.rank<=14);
    assert.deepEqual(card.systemTags,expected[id]);
    assert.deepEqual(SystemTags.validateDefinition(card),[]);
    assert.deepEqual(Effects.validateEffectList(card.effects,{requireTrigger:true,requireDuration:true}),[]);
  }
  assert.deepEqual([...suits].sort(),['C','D','H','S']);
});

test('정확 공개 판정은 플레이 후 자연 공개가 아니라 플레이 전에 확보한 EnemyInformation 상태만 사용한다',()=>{
  const battle=makeBattle(11);battle.playerStage={suit:'H',rank:6};
  const observation=Cards.createDefinitionCard('effect70.observation_record',{uid:'obs-hidden'});
  run(observation,'on_play',battle);
  assert.equal(observation.showdownRank,undefined,'playerStage가 있어도 사전 정확 공개가 아니면 기록 금지');
  const film=Cards.createDefinitionCard('effect70.film_roll',{uid:'film-hidden'}),calls=[];
  run(film,'on_play',battle,calls);
  assert.deepEqual(calls,[],'숨은 적 내부값으로 손패 보상을 발동하면 안 된다');
  const reverse=Cards.createDefinitionCard('effect70.reverse_table',{uid:'reverse-hidden'});
  run(reverse,'before_compare',battle);
  assert.equal(battle.mods.plus,0,'숨은 적 숫자로 트릭값을 바꾸면 안 된다');
});

test('관측 기록은 사전 정확 공개된 적 인쇄 숫자를 저장해 쇼다운 숫자로 사용한다',()=>{
  const battle=reveal(makeBattle(13)),card=Cards.createDefinitionCard('effect70.observation_record',{uid:'obs-exact'});
  run(card,'on_play',battle);
  assert.equal(card.rank,9);assert.equal(card.printedRank,9);assert.equal(card.showdownRank,13);
  card.showdownRank=9;
  run(card,'on_showdown_score',battle);
  assert.equal(card.showdownRank,13,'같은 세트의 기록값을 쇼다운에서 복원');
});

test('역산표는 정확 공개 시 적 인쇄 숫자 -1, 최소 2로 맞추고 그 트릭 패배 시 칩 +2를 준다',()=>{
  const battle=reveal(makeBattle(2)),card=Cards.createDefinitionCard('effect70.reverse_table',{uid:'reverse-exact'}),calls=[];
  run(card,'before_compare',battle,calls);
  assert.equal(card.printedRank,4);assert.equal(card.rank,4);assert.equal(4+battle.mods.plus,2,'최소 숫자 2');
  run(card,'on_trick_loss',battle,calls);
  assert.deepEqual(calls.map(({action,value})=>[action,value]),[['gain_chips',2]]);
  assert.equal(card.showdownRank,undefined,'쇼다운 숫자는 인쇄 4를 그대로 사용');
});

test('신호탄은 승리를 피해 2와 다음 적 정확 공개로 연결한다',()=>{
  const battle=makeBattle(8),card=Cards.createDefinitionCard('effect70.signal_flare',{uid:'flare'}),calls=[];
  run(card,'on_trick_win',battle,calls);
  assert.deepEqual(calls.map(({action,value})=>[action,value]),[['damage_enemy',2],['reveal_next_enemy_card',undefined]]);
});

test('필름 롤은 사전 정확 공개 때만 다음 트릭 손패 한도와 보충 드로우를 +1한다',()=>{
  const battle=reveal(makeBattle(10)),card=Cards.createDefinitionCard('effect70.film_roll',{uid:'film'}),calls=[];
  run(card,'on_play',battle,calls);
  assert.deepEqual(calls.map(({action,value})=>[action,value]),[['grant_next_trick_hand_capacity',1]]);
});
