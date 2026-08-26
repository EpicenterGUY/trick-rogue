const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const Links=require('../card-system-links.js');
const Persistence=require('../run-persistence.js');

function battleState(overrides={}){
  const history=overrides.history||Effects.newHistory();
  return{
    setIndex:1,trick:1,chip:0,maxChip:5,chipEconomy:{balance:0,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0},
    mods:{paint:false,plus:0,reverse:false,double:false},reservations:[],slots:[],discard:[],deck:[],hand:[],
    statuses:{player:{shield:0,bleed:0,vulnerable:0,mark:0},enemy:{shield:0,bleed:0,vulnerable:0,mark:0}},
    setHistory:{wins:0,losses:0,draws:0},history,
    ...overrides,history,setHistory:overrides.setHistory||{wins:0,losses:0,draws:0}
  };
}

function executeCard(cardOrId,trigger,{battle=battleState(),perform=null,...extra}={}){
  const card=typeof cardOrId==='string'?Cards.createDefinitionCard(cardOrId,{uid:`test-${cardOrId}-${Math.random()}`}):cardOrId;
  const calls=[];
  const context={
    card,battle,history:battle.history,setHistory:battle.setHistory,setIndex:battle.setIndex,trick:battle.trick,
    slotIndex:Number.isInteger(extra.slotIndex)?extra.slotIndex:Math.max(0,battle.slots.findIndex(entry=>(entry.card||entry)===card)),
    slots:battle.slots,enemyCard:battle.enemyCard,currentTrump:battle.trump,random:()=>0,
    perform:perform||((action,value,effect)=>calls.push([action,value,effect])),...extra
  };
  const count=Effects.run(trigger,card,context);
  return{card,battle,context,calls,count};
}

function plainEffectCard(id,action,value){return{uid:`uid-${id}`,cardId:id,effects:[{trigger:'on_play',action,value,duration:'trick'}]}}
function pure(rank=7,suit='H',uid=`pure-${suit}-${rank}`){return Cards.createCardRecord({suit,rank,metadata:{uid}})}

test('우선 개선 카드 정의는 실제 Cards 레지스트리에서 시스템 연결형 효과로 교체된다',()=>{
  const expected=[
    'pack01.recursive_function','pack01.ambush_observer','pack02.trump_signal','pack02.long_game','pack02.loaded_die','pack02.last_word',
    'pack03.time_bomb','pack03.bad_check','pack03.russian_roulette','pack04.copycat','pack04.midpoint','pack04.reverse_odds',
    'boss.theater.encore','boss.theater.curtain_call','boss.observatory.fog_mirror','boss.observatory.redaction','boss.frontier.war_tax','boss.frontier.entrench'
  ];
  for(const id of expected){const def=Cards.CARD_DEFINITION_BY_ID[id];assert.ok(def,id);assert.equal(def.redesignStage,Links.STAGE,id);assert.deepEqual(Effects.validateEffectList(def.effects),[],id)}
  assert.match(Cards.CARD_DEFINITION_BY_ID['pack03.bad_check'].description,/부채 10/);
  assert.match(Cards.CARD_DEFINITION_BY_ID['pack04.copycat'].description,/정확한 숫자/);
  assert.match(Cards.CARD_DEFINITION_BY_ID['boss.frontier.war_tax'].description,/칩 \+1/);
});

test('효과 이력은 복사 가능한 수치 효과의 출처·트릭·슬롯을 공용 구조로 기록한다',()=>{
  const battle=battleState({trick:2}),source=plainEffectCard('test.damage','damage_enemy',4);
  executeCard(source,'on_play',{battle,slotIndex:1});
  const record=Links.ensureState(battle).effectHistory.at(-1);
  assert.deepEqual(record,{type:'damage_enemy',value:4,sourceCardId:'test.damage',sourceCardUid:'uid-test.damage',copied:false,setIndex:1,trickIndex:2,slotIndex:1});
});

test('재귀 함수는 낼 때 직전 효과를 고정 기록하고 중간 효과와 무관하게 승리 시 그 효과를 재생한다',()=>{
  const battle=battleState({trick:2}),damage=plainEffectCard('test.damage','damage_enemy',4),shield=plainEffectCard('test.shield','gain_shield',6);
  executeCard(damage,'on_play',{battle,slotIndex:0});
  const recursive=Cards.createDefinitionCard('pack01.recursive_function',{uid:'recursive'});battle.slots=[{card:damage},{card:recursive}];
  executeCard(recursive,'on_play',{battle,card:recursive,slotIndex:1});
  assert.equal(Links.formatEffectRecord(recursive.cardEffectMemory.recursive_effect.value),'피해 4');
  executeCard(shield,'on_play',{battle,slotIndex:2});
  const replay=[];executeCard(recursive,'on_trick_win',{battle,card:recursive,slotIndex:1,perform:(a,v,e)=>replay.push([a,v,e?.copied])});
  assert.deepEqual(replay.map(row=>row.slice(0,2)),[['damage_enemy',4]]);
  assert.equal(Links.ensureState(battle).effectHistory.at(-1).copied,true);
  assert.equal(Links.ensureState(battle).effectHistory.at(-1).sourceCardId,'test.damage');
});

test('재귀 함수는 자기 자신 또는 이미 복사된 효과를 새 기록 대상으로 사용하지 않는다',()=>{
  const battle=battleState();
  Links.appendEffectRecord(battle,{type:'damage_enemy',value:9,sourceCardId:'pack01.recursive_function',copied:false,setIndex:1,trickIndex:1,slotIndex:0});
  Links.appendEffectRecord(battle,{type:'gain_shield',value:8,sourceCardId:'test.other',copied:true,setIndex:1,trickIndex:1,slotIndex:0});
  const card=Cards.createDefinitionCard('pack01.recursive_function',{uid:'recursive-self'});
  executeCard(card,'on_play',{battle});
  assert.equal(card.cardEffectMemory?.recursive_effect,undefined);
});

test('복리는 낼 때 승리 수를 기록하고 이후 트릭 승리마다 기록이 실제로 불어난다',()=>{
  const battle=battleState({trick:2,setHistory:{wins:1,losses:0,draws:0}}),card=Cards.createDefinitionCard('pack02.long_game',{uid:'compound'});battle.slots=[{card:pure(5,'S')},{card}];
  executeCard(card,'on_play',{battle,slotIndex:1});
  assert.equal(card.cardEffectMemory.compound_wins.value,1);
  battle.trick=3;executeCard(pure(4,'C','next-win'),'on_trick_win',{battle,slotIndex:2});
  assert.equal(card.cardEffectMemory.compound_wins.value,2);
  const calls=[];executeCard(card,'on_showdown_score',{battle,slotIndex:1,perform:(a,v)=>calls.push([a,v])});
  assert.deepEqual(calls,[['showdown_power',4]]);
});

test('부도수표는 부채 10에서 시작해 이후 승리마다 3씩 갚고 0 아래로 내려가지 않는다',()=>{
  const battle=battleState({trick:1}),card=Cards.createDefinitionCard('pack03.bad_check',{uid:'bad-check'});battle.slots=[{card}];
  const played=executeCard(card,'on_play',{battle,slotIndex:0});assert.deepEqual(played.calls.map(c=>c.slice(0,2)),[['increase_next_trick_rank',8]]);assert.equal(card.cardEffectMemory.bad_check_debt.value,10);
  for(let trick=2;trick<=5;trick++){battle.trick=trick;executeCard(pure(3+trick,'H',`debt-${trick}`),'on_trick_win',{battle,slotIndex:trick-1})}
  assert.equal(card.cardEffectMemory.bad_check_debt.value,0);
  const calls=[];executeCard(card,'on_showdown_score',{battle,slotIndex:0,perform:(a,v)=>calls.push([a,v])});assert.deepEqual(calls,[]);
});

test('시한폭탄은 피해 6을 예약하고 이후 승리마다 +3되어 정확한 트릭에 폭발한다',()=>{
  const battle=battleState({trick:1}),card=Cards.createDefinitionCard('pack03.time_bomb',{uid:'bomb'});battle.slots=[{card}];executeCard(card,'on_play',{battle,slotIndex:0});
  assert.equal(battle.reservations.length,1);assert.equal(battle.reservations[0].value,6);assert.equal(battle.reservations[0].eligibleTrick,3);
  battle.trick=2;executeCard(pure(8,'C','bomb-win-2'),'on_trick_win',{battle,slotIndex:1});assert.equal(battle.reservations[0].value,9);
  battle.trick=3;executeCard(pure(9,'D','bomb-win-3'),'on_trick_win',{battle,slotIndex:2});assert.equal(battle.reservations[0].value,12);
  const calls=[];battle.reservations=Effects.resolveNextWinReservations(battle.reservations,{set:1,trick:3},true,(a,v)=>calls.push([a,v]));assert.deepEqual(calls,[['damage_enemy',12]]);assert.equal(battle.reservations.length,0);
});

test('시한폭탄은 4~5번째 트릭에서 세트 밖 예약을 만들지 않는다',()=>{for(const trick of [4,5]){const battle=battleState({trick});executeCard('pack03.time_bomb','on_play',{battle});assert.deepEqual(battle.reservations,[])}});

test('사기 주사위는 칩을 소비한 트릭에서 무작위 하한이 7로 올라간다',()=>{
  const plain=battleState();executeCard('pack02.loaded_die','on_play',{battle:plain,random:()=>0});assert.equal(plain.mods.plus,-4);
  const spent=battleState();spent.history.chipsSpent=1;executeCard('pack02.loaded_die','on_play',{battle:spent,random:()=>0});assert.equal(spent.mods.plus,1);
});

test('러시안 룰렛은 정확 정보와 선행 칩 소비가 모두 있을 때 실패를 한 번 재굴림한다',()=>{
  const enemy={suit:'H',rank:12,printedSuit:'H',printedRank:12},battle=battleState({enemyCard:enemy});battle.enemyInformation={currentExact:true,currentCard:enemy};battle.history.chipsSpent=1;
  const rolls=[0,0.5],result=executeCard('pack03.russian_roulette','on_play',{battle,random:()=>rolls.shift()});assert.equal(battle.mods.plus,4);assert.deepEqual(result.card.cardEffectMemory.roulette_result.value,{failed:false,rerolled:true,finalRank:14});
  const hidden=battleState({enemyCard:enemy});hidden.history.chipsSpent=1;const fail=executeCard('pack03.russian_roulette','on_play',{battle:hidden,random:()=>0});assert.equal(hidden.mods.plus,-8);assert.equal(fail.card.cardEffectMemory.roulette_result.value.rerolled,false);
});

test('카피캣과 중간값은 내기 전 정확 정보 여부를 존중해 정보 시스템을 우회하지 않는다',()=>{
  const enemy={suit:'H',rank:8,printedSuit:'H',printedRank:8};
  const hidden=battleState({enemyCard:enemy});const copyHidden=executeCard('pack04.copycat','before_compare',{battle:hidden});assert.deepEqual(copyHidden.calls.map(c=>c.slice(0,2)),[['increase_next_trick_rank',2]]);
  const midHidden=executeCard('pack04.midpoint','before_compare',{battle:battleState({enemyCard:enemy})});assert.equal(midHidden.battle.mods.plus,0);assert.deepEqual(midHidden.calls,[]);
  const known=battleState({enemyCard:enemy});known.enemyInformation={currentExact:true,currentCard:enemy};executeCard('pack04.copycat','before_compare',{battle:known});assert.equal(known.mods.plus,-6,'A(14) -> 적 8');
  const knownMid=battleState({enemyCard:{...enemy,rank:6,printedRank:6}});knownMid.enemyInformation={currentExact:true,currentCard:knownMid.enemyCard};executeCard('pack04.midpoint','before_compare',{battle:knownMid});assert.equal(knownMid.mods.plus,-2,'10과 6의 중간 8');
});

test('역배당은 칩 1을 실제로 지불했을 때만 반전되고 승리 보상은 +3이다',()=>{
  const paid=battleState({chip:1,chipEconomy:{balance:1,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}}),card=Cards.createDefinitionCard('pack04.reverse_odds',{uid:'reverse-paid'}),calls=[];paid.slots=[{card}];
  executeCard(card,'on_play',{battle:paid,perform:(a,v)=>calls.push([a,v])});assert.equal(paid.chip,0);assert.deepEqual(calls,[['set_reverse_compare',undefined]]);
  calls.length=0;executeCard(card,'on_trick_win',{battle:paid,perform:(a,v)=>calls.push([a,v])});assert.deepEqual(calls,[['gain_chips',3]]);
  const empty=battleState(),emptyCalls=[];executeCard('pack04.reverse_odds','on_play',{battle:empty,perform:(a,v)=>emptyCalls.push([a,v])});assert.deepEqual(emptyCalls,[]);assert.equal(empty.mods.reverse,false);
});

test('트럼프 시그널은 자연 트럼프 +1, 효과로 바뀐 트럼프는 추가 +1을 준다',()=>{
  const natural=executeCard('pack02.trump_signal','on_trick_win',{battle:battleState({trump:'S'}),trickSuit:'S',currentTrump:'S'});assert.deepEqual(natural.calls.map(c=>c.slice(0,2)),[['gain_chips',1]]);
  const painted=executeCard('pack02.trump_signal','on_trick_win',{battle:battleState({trump:'H'}),trickSuit:'H',currentTrump:'H'});assert.deepEqual(painted.calls.map(c=>c.slice(0,2)),[['gain_chips',1],['gain_chips',1]]);
});

test('마지막 한 수는 5번 슬롯 기본 +5와 실제 승리 추가 +5를 분리한다',()=>{
  const card=Cards.createDefinitionCard('pack02.last_word',{uid:'last'}),battle=battleState();battle.slots=[...Array(4)].map((_,i)=>({card:pure(2+i,'C',`l${i}`),result:0}));battle.slots.push({card,result:1});
  const win=executeCard(card,'on_showdown_score',{battle,slotIndex:4});assert.deepEqual(win.calls.map(c=>c.slice(0,2)),[['showdown_power',5],['showdown_power',5]]);
  battle.slots[4].result=-1;const loss=executeCard(card,'on_showdown_score',{battle,slotIndex:4});assert.deepEqual(loss.calls.map(c=>c.slice(0,2)),[['showdown_power',5]]);
});

test('잠복 관측자는 3번 슬롯에서 정보가 이미 정확하면 예측 대신 무료 손패 교환을 준비한다',()=>{
  const next={suit:'D',rank:13},exact=battleState({nextEnemyPreview:next,enemyForecast:3}),card=Cards.createDefinitionCard('pack01.ambush_observer',{uid:'observer'});exact.slots=[{}, {}, {card}];
  const ready=executeCard(card,'after_card_slotted',{battle:exact,slotIndex:2});assert.deepEqual(ready.calls,[]);assert.equal(Links.ensureState(exact).freeHandExchange.count,1);
  const partial=battleState({nextEnemyPreview:next,enemyForecast:1}),forecast=executeCard('pack01.ambush_observer','after_card_slotted',{battle:partial,slotIndex:2});assert.deepEqual(forecast.calls.map(c=>c.slice(0,2)),[['increase_enemy_forecast',2]]);
});

test('무료 관측 교환은 칩을 쓰지 않고 선택 손패를 덱 아래로 보내고 1장을 뽑는다',()=>{
  const outgoing=pure(3,'S','outgoing'),incoming=pure(11,'H','incoming'),battle=battleState({hand:[outgoing],deck:[incoming],selected:'outgoing',chip:2,chipEconomy:{balance:2,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}});Links.ensureState(battle).freeHandExchange={count:1,sourceCardUid:'observer',sourceCardId:'pack01.ambush_observer'};
  const result=Links.useFreeHandExchange({battle});assert.equal(result.ok,true);assert.equal(battle.hand[0],incoming);assert.equal(battle.deck[0],outgoing);assert.equal(battle.chip,2);assert.equal(battle.history.cardsDrawn,1);
});

test('앙코르는 패배를 다음 트릭 첫 수치 효과의 50% 재생 예약으로 바꾼다',()=>{
  const battle=battleState({trick:1}),encore=Cards.createDefinitionCard('boss.theater.encore',{uid:'encore'});battle.slots=[{card:encore}];executeCard(encore,'on_trick_loss',{battle,slotIndex:0});assert.equal(Links.ensureState(battle).effectReplayReservations.length,1);
  battle.trick=2;const shield=plainEffectCard('test.next-shield','gain_shield',5),calls=[];executeCard(shield,'on_play',{battle,slotIndex:1,perform:(a,v)=>calls.push([a,v])});assert.deepEqual(calls,[['gain_shield',5],['gain_shield',3]]);assert.equal(Links.ensureState(battle).effectReplayReservations.length,0);
});

test('안개 거울은 무승부를 적 인쇄 숫자 복사와 다음 카드 정확 공개로 연결한다',()=>{
  const enemy={suit:'S',rank:13,printedSuit:'S',printedRank:13},battle=battleState({enemyCard:enemy}),card=Cards.createDefinitionCard('boss.observatory.fog_mirror',{uid:'fog'}),calls=[];battle.slots=[{card,result:0}];executeCard(card,'on_trick_draw',{battle,slotIndex:0,perform:(a,v)=>calls.push([a,v])});assert.equal(card.showdownRank,13);assert.deepEqual(calls,[['reveal_next_enemy_card',undefined]]);
});

test('전시 징수는 칩 공간이 있으면 칩, 가득 찼으면 피해로 오버플로를 바꾼다',()=>{
  const room=battleState({chip:4,chipEconomy:{balance:4,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}}),roomCalls=[];executeCard('boss.frontier.war_tax','on_trick_win',{battle:room,perform:(a,v)=>roomCalls.push([a,v])});assert.deepEqual(roomCalls,[['gain_chips',1]]);
  const full=battleState({chip:5,chipEconomy:{balance:5,lastBaseWinKey:null,lastExchangeKey:null,exchanges:0}}),fullCalls=[];executeCard('boss.frontier.war_tax','on_trick_win',{battle:full,perform:(a,v)=>fullCalls.push([a,v])});assert.deepEqual(fullCalls,[['gain_chips',1],['damage_enemy',5]]);
});

test('기록 말소는 해제 가능한 부정 상태를 정보로, 제거할 상태가 없으면 보호막으로 바꾼다',()=>{
  const afflicted=battleState();afflicted.statuses.player.vulnerable=2;const card=Cards.createDefinitionCard('boss.observatory.redaction',{uid:'redaction'}),calls=[];executeCard(card,'on_trick_win',{battle:afflicted,perform:(a,v)=>calls.push([a,v])});assert.equal(afflicted.statuses.player.vulnerable,0);assert.deepEqual(calls,[['reveal_next_enemy_card',undefined]]);
  const clean=battleState(),cleanCalls=[];executeCard('boss.observatory.redaction','on_trick_win',{battle:clean,perform:(a,v)=>cleanCalls.push([a,v])});assert.deepEqual(cleanCalls,[['gain_shield',3]]);
});

test('진지 구축은 무승부를 보호막과 슬롯 고정으로 바꾸고 고정 상태를 쇼다운 +5로 이어간다',()=>{
  const battle=battleState(),card=Cards.createDefinitionCard('boss.frontier.entrench',{uid:'entrench'});battle.slots=[{card,result:0}];const draw=executeCard(card,'on_trick_draw',{battle,slotIndex:0});assert.deepEqual(draw.calls.map(c=>c.slice(0,2)),[['gain_shield',5]]);assert.deepEqual(card.showdownSlotLock,{setIndex:1,slotIndex:0});
  const showdown=executeCard(card,'on_showdown_score',{battle,slotIndex:0});assert.deepEqual(showdown.calls.map(c=>c.slice(0,2)),[['showdown_power',5]]);
});

test('커튼콜은 승리 출혈을 5번 슬롯 쇼다운에서 남은 출혈 위력으로 변환한다',()=>{
  const battle=battleState(),card=Cards.createDefinitionCard('boss.theater.curtain_call',{uid:'curtain'});battle.slots=[{},{},{},{},{card,result:1}];const win=executeCard(card,'on_trick_win',{battle,slotIndex:4});assert.deepEqual(win.calls.map(c=>c.slice(0,2)),[['apply_enemy_bleed',2]]);battle.statuses.enemy.bleed=4;const showdown=executeCard(card,'on_showdown_score',{battle,slotIndex:4});assert.deepEqual(showdown.calls.map(c=>c.slice(0,2)),[['showdown_power',4]]);
});

test('고정된 진지 구축 슬롯은 자리바꿈의 이전 슬롯 대상이 되지 않는다',()=>{
  const locked=Cards.createDefinitionCard('boss.frontier.entrench',{uid:'locked'});locked.showdownSlotLock={setIndex:1,slotIndex:0};const swap=Cards.createDefinitionCard('pack04.seat_swap',{uid:'swap'}),battle=battleState({slots:[{card:locked},{card:swap}]});const result=executeCard(swap,'on_play',{battle,slotIndex:1});assert.equal(result.count,0);assert.equal(locked.showdownRank,undefined);assert.equal(swap.showdownRank,undefined);
});

test('카드 상세 상태 문자열은 메모리와 예약을 플레이어가 계산 가능한 형태로 노출한다',()=>{
  const battle=battleState({trick:2}),recursive=Cards.createDefinitionCard('pack01.recursive_function',{uid:'ui-rec'});Links.setMemory(recursive,'recursive_effect',{type:'damage_enemy',value:4,sourceCardId:'x',copied:false},{battle});assert.deepEqual(Links.cardStateLines(recursive,battle),['기록: 피해 4']);
  const debt=Cards.createDefinitionCard('pack03.bad_check',{uid:'ui-debt'});Links.setMemory(debt,'bad_check_debt',7,{battle});assert.deepEqual(Links.cardStateLines(debt,battle),['부채: 7']);
  const bomb=Cards.createDefinitionCard('pack03.time_bomb',{uid:'ui-bomb'});battle.reservations=[{type:'dynamic_delayed_damage',sourceCardUid:'ui-bomb',eligibleSet:1,eligibleTrick:3,value:9}];assert.deepEqual(Links.cardStateLines(bomb,battle),['폭발까지 1트릭 · 예상 피해 9']);
});

test('구조화된 카드 메모리와 슬롯 고정 메타데이터는 런 저장 왕복에서 보존된다',()=>{
  const card=Cards.createDefinitionCard('pack01.recursive_function',{uid:'save-rec'});Links.setMemory(card,'recursive_effect',{type:'damage_enemy',value:4,sourceCardId:'pack01.black_bullet',copied:false},{setIndex:1});card.showdownSlotLock={setIndex:1,slotIndex:2};
  const run={runSeed:99,actId:'common',actIndex:1,hp:60,maxHp:60,gold:0,map:[],available:new Set(),completed:new Set(),currentNodeId:null,runComplete:false,deck:[card]};const restored=Persistence.parseSave(Persistence.stringifySave(run,{now:0,reason:'system-links'}),{runtimeRoot:Cards}).runState.deck[0];assert.equal(restored.cardEffectMemory.recursive_effect.value.type,'damage_enemy');assert.equal(restored.cardEffectMemory.recursive_effect.value.value,4);assert.deepEqual(restored.showdownSlotLock,{setIndex:1,slotIndex:2});
});
