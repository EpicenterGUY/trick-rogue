const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardEffects=require('../effects.js');
const CombatEffects=require('../combat-effects.js');
const BattleEvents=require('../battle-events.js');
const PureSynergies=require('../pure-synergies-9-d.js');

let uid=0;
function pure(suit='S',rank=2,extra={}){return{suit,rank,uid:`pure-${++uid}`,...extra}}
function effect(suit='H',rank=3){return{suit,rank,uid:`effect-${++uid}`,cardId:`effect.${uid}`,effects:[{trigger:'on_play',action:'gain_shield',value:1,duration:'trick'}]}}
function runWith(pureCards,effectCards=0){return{deck:[...Array.from({length:pureCards},(_,i)=>pure(['S','H','D','C'][i%4],2+(i%13))),...Array.from({length:effectCards},(_,i)=>effect(['H','D'][i%2],2+(i%13)))]}}
function battleState(slots=[]){return{setIndex:1,trick:5,phase:'showdown',chip:0,hand:[],slots:slots.map(card=>({card})),enemySlots:[],statuses:{player:{shield:0},enemy:{}},reservations:[],setHistory:{wins:0,losses:0,draws:0}}}

test('9-D는 순수 카드 빌드 시너지 4종을 기존 passive 효과 경로에 정의한다',()=>{
  assert.equal(PureSynergies.STAGE,'9-D');
  assert.deepEqual(Object.keys(PureSynergies.PURE_SYNERGY_DEFINITIONS),['classic_line','lean_core','clean_showdown','pure_five']);
  assert.deepEqual(PureSynergies.validateSynergyRegistry(),[]);
  for(const definition of Object.values(PureSynergies.PURE_SYNERGY_DEFINITIONS)){
    assert.equal(definition.effectOwnerType,'passive');
    assert.ok(definition.effects.every(effect=>effect.duration==='run'));
  }
});

test('순수 덱 통계는 실제 런 덱만 보고 고유 효과 없는 강화 카드를 계속 순수로 센다',()=>{
  const upgraded=pure('S',14,{upgradeLevel:1,effectiveRankBonus:1,trickRankModifier:1});
  const run={deck:[upgraded,pure('H',9),effect('D',5)]};
  assert.equal(CardEffects.isPureCard(upgraded),true);
  assert.deepEqual(PureSynergies.pureDeckStats(run),{size:3,pure:2,effect:1,ratio:2/3});
});

test('기본적인 순수 8/12 덱은 정석 편성이 공짜로 활성화되지 않는다',()=>{
  const run=runWith(8,4),stats=PureSynergies.pureDeckStats(run);
  assert.equal(stats.ratio,8/12);
  assert.equal(PureSynergies.activeSynergyIds(run).includes('classic_line'),false);
});

test('효과 카드 제거로 순수 8/11이 되면 정석 편성이 활성화된다',()=>{
  const run=runWith(8,4);run.deck.pop();
  assert.equal(PureSynergies.pureDeckStats(run).ratio,8/11);
  assert.deepEqual(PureSynergies.activeSynergyIds(run),['classic_line']);
});

test('정석 압축은 10장 이하·순수 7장 이상·70% 이상을 동시에 요구한다',()=>{
  const active=runWith(7,3),tooLarge=runWith(8,3),tooDirty=runWith(6,4);
  assert.equal(PureSynergies.isSynergyActive(PureSynergies.synergyDefinition('lean_core'),active),true);
  assert.equal(PureSynergies.isSynergyActive(PureSynergies.synergyDefinition('lean_core'),tooLarge),false);
  assert.equal(PureSynergies.isSynergyActive(PureSynergies.synergyDefinition('lean_core'),tooDirty),false);
});

test('9-D 조건은 쇼다운의 순수 카드 3장과 정확히 순수 5장을 구분한다',()=>{
  const three={battle:battleState([pure(),pure('H'),pure('D'),effect(),effect('C')])};
  const five={battle:battleState([pure(),pure('H'),pure('D'),pure('C'),pure('S',6)])};
  assert.equal(CardEffects.conditions.pure_cards_in_showdown_at_least(three,{conditionValue:3}),true);
  assert.equal(CardEffects.conditions.all_showdown_cards_pure(three),false);
  assert.equal(CardEffects.conditions.all_showdown_cards_pure(five),true);
});

test('정석 편성과 정석 압축이 모두 켜진 10장 순수 덱은 세트 시작 보호막 +2와 칩 +1을 받는다',()=>{
  PureSynergies.installCombatOwnerAdapter();
  const run=runWith(10,0),state=battleState();state.trick=1;state.phase='trick';
  BattleEvents.dispatchNonCardOwnersOnce('on_set_start',{state,runState:run});
  assert.equal(CombatEffects.getStatusValue(state.statuses,'player','shield'),2);
  assert.equal(state.chip,1);
});

test('무첨가 승부는 쇼다운에 순수 카드가 3장 이상일 때만 위력 +4를 준다',()=>{
  PureSynergies.installCombatOwnerAdapter();
  const run=runWith(10,0),three=battleState([pure(),pure('H'),pure('D'),effect(),effect('C')]),two=battleState([pure(),pure('H'),effect(),effect('D'),effect('C')]);
  const scoreThree={value:20};BattleEvents.dispatchNonCardOwnersOnce('on_showdown_score',{state:three,runState:run,extra:{score:scoreThree}});assert.equal(scoreThree.value,24);
  const scoreTwo={value:20};BattleEvents.dispatchNonCardOwnersOnce('on_showdown_score',{state:two,runState:run,extra:{score:scoreTwo}});assert.equal(scoreTwo.value,20);
});

test('순수 5장은 완전 순수 쇼다운에서 무첨가 승부 +4와 추가 +8을 함께 얻는다',()=>{
  PureSynergies.installCombatOwnerAdapter();
  const run=runWith(10,0),state=battleState([pure(),pure('H'),pure('D'),pure('C'),pure('S',7)]),score={value:20};
  BattleEvents.dispatchNonCardOwnersOnce('on_showdown_score',{state,runState:run,extra:{score}});
  assert.equal(score.value,32);
});

test('순수 시너지는 별도 저장 상태 없이 현재 덱 변화에 따라 즉시 다시 계산된다',()=>{
  const run=runWith(8,4);
  assert.deepEqual(PureSynergies.activeSynergyIds(run),[]);
  run.deck.pop();assert.deepEqual(PureSynergies.activeSynergyIds(run),['classic_line']);
  run.deck.pop();assert.deepEqual(PureSynergies.activeSynergyIds(run),['classic_line','lean_core']);
  run.deck.push(effect());run.deck.push(effect());assert.deepEqual(PureSynergies.activeSynergyIds(run),[]);
  assert.equal(Object.prototype.hasOwnProperty.call(run,'pureSynergyState'),false);
});

test('활성 순수 시너지는 기존 CombatEffects 소유자 목록에 passive로 합쳐진다',()=>{
  PureSynergies.installCombatOwnerAdapter();
  const owners=CombatEffects.activeEffectOwners(battleState(),runWith(10,0));
  const ids=owners.filter(owner=>owner.ownerType==='passive'&&String(owner.ownerId).startsWith('pure-synergy:')).map(owner=>owner.ownerId).sort();
  assert.deepEqual(ids,['pure-synergy:classic_line','pure-synergy:clean_showdown','pure-synergy:lean_core','pure-synergy:pure_five']);
});

test('순수 시너지 요약과 UI는 현재 순수 장수·비율·활성 수를 공개한다',()=>{
  const summary=PureSynergies.synergySummary(runWith(10,0));
  assert.equal(summary.count,4);assert.equal(summary.total,4);assert.deepEqual(summary.deck,{size:10,pure:10,effect:0,ratio:1});
  const source=fs.readFileSync(path.join(__dirname,'..','pure-synergies-9-d.js'),'utf8');
  assert.match(source,/mapPureSynergyBadge/);assert.match(source,/activePureSynergyButton/);assert.match(source,/순수 카드 시너지/);
});

test('전투 레이아웃 로더는 9-C 뒤에 9-D 순수 시너지를 자동 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-layout.js'),'utf8');
  assert.match(source,/pure-synergies-9-d\.js/);assert.match(source,/trick-pure-synergy-9-d/);
  assert(source.indexOf('loadContentExpansion(doc)')<source.indexOf('loadPureSynergies(doc)'));
});

test('9-D는 폐기된 전술 덱·트럼프 자동 승리·상시 무늬 우세를 재도입하지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','pure-synergies-9-d.js'),'utf8');
  assert.doesNotMatch(source,/tacticDeck|tacticHand|advantageMargin|showdownAdvantagePower|autoTrumpWin|trumpPriority/);
});