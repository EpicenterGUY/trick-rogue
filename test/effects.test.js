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
test('황금손은 실제 칩 소비 후 승리할 때만 칩과 전술 카드를 준다',()=>{
  assert.equal(execute('pack01.golden_hand','on_trick_win',{history:{...Effects.newHistory(),tacticsUsed:true}}).length,0);
  assert.deepEqual(execute('pack01.golden_hand','on_trick_win',{history:{...Effects.newHistory(),chipsSpent:1}}).map(call=>call.slice(0,2)),[['gain_chips',1],['draw_tactic',1]]);
});
test('비열한 승부사는 적용 숫자 5 이하에서만 칩을 준다',()=>{assert.equal(execute('pack01.dirty_gambler','on_trick_win',{effectiveRank:5})[0][1],2);assert.equal(execute('pack01.dirty_gambler','on_trick_win',{effectiveRank:6}).length,0)});
test('예약 발송은 다음 승리 피해 예약을 만든다',()=>assert.deepEqual(execute('pack01.scheduled_delivery','on_play')[0].slice(0,2),['reserve_next_win_damage',6]));
test('날 선 유리는 출혈 2를 부여한다',()=>assert.equal(execute('pack01.sharp_glass','on_trick_win')[0][1],2));
test('응급 보호구는 즉시 보호막 5를 준다',()=>assert.equal(execute('pack01.emergency_guard','on_play')[0][1],5));
test('재귀 함수는 직전 다른 네임드의 허용된 수치 효과 하나만 복사한다',()=>{
  assert.deepEqual(execute('pack01.recursive_function','on_trick_win',{lastNamed:{cardId:'pack01.black_bullet',action:'damage_enemy',value:3}})[0].slice(0,3),['damage_enemy',3,{copied:true}]);
  assert.equal(execute('pack01.recursive_function','on_trick_win',{lastNamed:{cardId:'pack01.recursive_function',action:'damage_enemy',value:3}}).length,0);
  assert.equal(execute('pack01.recursive_function','on_trick_win',{lastNamed:{cardId:'pack01.scheduled_delivery',action:'reserve_next_win_damage',value:6}}).length,0);
});
test('예약 발송은 바로 다음 트릭에만 남고 패배나 무승부에도 사라진다',()=>{
  const reservations=[{type:'nextWinDamage',value:6,eligibleTrick:2}];const calls=[];
  assert.equal(Effects.resolveNextWinReservations(reservations,1,true,(...args)=>calls.push(args)).length,1);
  assert.deepEqual(Effects.resolveNextWinReservations(reservations,2,true,(...args)=>calls.push(args)),[]);assert.deepEqual(calls,[['damage_enemy',6]]);
  assert.deepEqual(Effects.resolveNextWinReservations(reservations,2,false,()=>assert.fail()),[]);
});
test('배터리 1%는 손에 있을 때만 20% 확률로 소진되고 제출 성공 시 쇼다운 위력 15를 준다',()=>{
  let exhausted=0;const base={inHand:true,exhaust:()=>exhausted++};
  execute('pack01.battery_1pct','on_trick_end',{...base,random:()=>0.199});assert.equal(exhausted,1);
  execute('pack01.battery_1pct','on_trick_end',{...base,random:()=>0.2});execute('pack01.battery_1pct','on_trick_end',{...base,inHand:false,random:()=>0});assert.equal(exhausted,1);
  assert.equal(execute('pack01.battery_1pct','on_showdown_score')[0][1],15);
});
test('매복한 관측자는 3번 슬롯에서 예측만 +2 하고 쇼다운 위력은 올리지 않는다',()=>{
  assert.equal(execute('pack01.ambush_observer','after_card_slotted',{slotIndex:1}).length,0);
  assert.deepEqual(execute('pack01.ambush_observer','after_card_slotted',{slotIndex:2})[0].slice(0,2),['increase_enemy_forecast',2]);
  assert.equal(execute('pack01.ambush_observer','on_showdown_score',{slotIndex:2}).length,0);
});
test('pack01의 모든 효과는 trigger와 지속 범위를 명시하고 전부 구현 상태다',()=>{
  for(const card of Object.values(CARD_DEFINITION_BY_ID)){assert.equal(card.implemented,true);assert(card.effects.length);for(const effect of card.effects){assert(Effects.TRIGGERS.includes(effect.trigger));assert(['trick','set','battle','run'].includes(effect.duration));}}
});
test('on_showdown_advantage 트리거는 판정 결과를 context.advantage로 받는다',()=>{
  let received;
  const card={named:{implemented:true,effects:[{trigger:'on_showdown_advantage',handler:'capture'}]}};
  Effects.handlers.capture=context=>{received=context.advantage};
  const advantage={result:'player',playerWins:3,enemyWins:2,draws:0,powerBonus:6};
  Effects.run('on_showdown_advantage',card,{advantage});delete Effects.handlers.capture;
  assert.strictEqual(received,advantage);
});

const { CARD_DEFINITIONS, CARD_PACKS, BASE_CARD_SLOTS, createBaseCardSlots, defaultEnabledPacks, validateEnabledPacks, createRunPackState, rewardCardIds } = require('../cards.js');
test('활성 네임드 레지스트리에는 pack01 10장만 존재한다',()=>{
  assert.equal(CARD_DEFINITIONS.length,10);
  assert.equal(CARD_PACKS.pack01.cards.length,10);
  assert.deepEqual(Object.keys(CARD_PACKS),['pack01']);
  assert(CARD_DEFINITIONS.every(card=>card.id.startsWith('pack01.')));
});
test('활성/비활성 팩 설정에 따라 보상 후보가 달라진다',()=>{
  const activeRun=createRunPackState(defaultEnabledPacks());
  const inactiveRun=createRunPackState([]);
  const rewards=rewardCardIds(activeRun.enabledPacks);
  assert.equal(rewards.length,10);
  assert.deepEqual(new Set(rewards),new Set(CARD_PACKS.pack01.cardIds));
  assert(rewards.every(id=>CARD_DEFINITION_BY_ID[id]));
  assert.deepEqual(rewardCardIds(inactiveRun.enabledPacks),[]);
  assert.throws(()=>validateEnabledPacks(['pack99']),/Unknown enabledPacks reference/);
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
