const assert = require('node:assert/strict');
const test = require('node:test');
const { CARD_DEFINITION_BY_ID } = require('../cards.js');
const Effects = require('../effects.js');

function execute(id,trigger,overrides={}) {
  const calls=[];
  const card={suit:'S',rank:7,named:CARD_DEFINITION_BY_ID[id]};
  const context={card,enemyCard:{suit:'H',rank:8},history:Effects.newHistory(),effectiveRank:card.rank,slotIndex:0,slots:[],mods:{paint:false,plus:0,reverse:false,double:false},enemyForecast:0,lastNamed:null,random:()=>0,perform:(...args)=>calls.push(args),...overrides};
  Effects.run(trigger,card,context);return calls;
}
test('검은 탄환은 승리 피해와 쇼다운 위력을 적용한다',()=>{assert.deepEqual(execute('pack01.black_bullet','on_trick_win')[0].slice(0,2),['damage_enemy',3]);assert.equal(execute('pack01.black_bullet','on_showdown_score')[0][1],4)});
test('불사조는 승리 시 4 회복한다',()=>assert.equal(execute('pack01.phoenix','on_trick_win')[0][1],4));
test('황금손은 전술 또는 칩 사용 이력이 있어야 한다',()=>{assert.equal(execute('pack01.golden_hand','on_trick_win').length,0);assert.equal(execute('pack01.golden_hand','on_trick_win',{history:{...Effects.newHistory(),chipsSpent:1}})[0][1],1)});
test('비열한 승부사는 적용 숫자 5 이하에서만 칩을 준다',()=>{assert.equal(execute('pack01.dirty_gambler','on_trick_win',{effectiveRank:5})[0][1],2);assert.equal(execute('pack01.dirty_gambler','on_trick_win',{effectiveRank:6}).length,0)});
test('예약 발송은 다음 승리 피해 예약을 만든다',()=>assert.deepEqual(execute('pack01.scheduled_delivery','on_play')[0].slice(0,2),['reserve_next_win_damage',6]));
test('날 선 유리는 출혈 2를 부여한다',()=>assert.equal(execute('pack01.sharp_glass','on_trick_win')[0][1],2));
test('응급 보호구는 즉시 보호막 5를 준다',()=>assert.equal(execute('pack01.emergency_guard','on_play')[0][1],5));
test('배터리 1%는 쇼다운 위력 15를 준다',()=>assert.equal(execute('pack01.battery_1pct','on_showdown_score')[0][1],15));

const { CARD_DEFINITIONS, CARD_PACKS, BASE_CARD_SLOTS, createBaseCardSlots, defaultEnabledPacks, rewardCardIds } = require('../cards.js');
test('활성 네임드 레지스트리에는 pack01 10장만 존재한다',()=>{
  assert.equal(CARD_DEFINITIONS.length,10);
  assert.equal(CARD_PACKS.pack01.cards.length,10);
  assert.deepEqual(Object.keys(CARD_PACKS),['pack01']);
  assert(CARD_DEFINITIONS.every(card=>card.id.startsWith('pack01.')));
});
test('모든 보상 후보는 활성 pack01 네임드 카드다',()=>{
  const rewards=rewardCardIds(defaultEnabledPacks());
  assert.equal(rewards.length,10);
  assert.deepEqual(new Set(rewards),new Set(CARD_PACKS.pack01.cardIds));
  assert(rewards.every(id=>CARD_DEFINITION_BY_ID[id]));
  assert.deepEqual(rewardCardIds([]),[]);
});
test('네임드가 없는 기본 슬롯은 효과 없는 순수 카드로 생성된다',()=>{
  const pure=createBaseCardSlots();
  assert.equal(pure.length,52);
  assert(pure.every(card=>card.named===null&&card.cardId===null));
});
test('기본 트럼프의 52개 suit/rank 슬롯이 중복 없이 유지된다',()=>{
  assert.equal(BASE_CARD_SLOTS.length,52);
  assert.equal(new Set(BASE_CARD_SLOTS.map(card=>`${card.suit}${card.rank}`)).size,52);
  for(const suit of ['S','H','D','C'])assert.deepEqual(BASE_CARD_SLOTS.filter(card=>card.suit===suit).map(card=>card.rank),Array.from({length:13},(_,i)=>i+2));
});
test('pack01 화면·덱·전투·보상은 동일 정의와 이미지를 참조한다',()=>{
  for(const definition of CARD_PACKS.pack01.cards){
    const deckCard={named:CARD_DEFINITION_BY_ID[definition.id],cardId:definition.id};
    const battleCard={...deckCard};
    assert.strictEqual(definition,CARD_DEFINITION_BY_ID[definition.id]);
    assert.strictEqual(deckCard.named,battleCard.named);
    assert.equal(deckCard.named.image,definition.image);
    assert(rewardCardIds(['pack01']).includes(definition.id));
  }
});
