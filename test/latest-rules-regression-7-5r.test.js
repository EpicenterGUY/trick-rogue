const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const BattleCore=require('../battle-core.js');
const Cards=require('../cards.js');
const DeckBoundaries=require('../deck-boundaries.js');
const Chips=require('../chip-economy.js');
const EnemyInformation=require('../enemy-information.js');
const ShowdownAdvantage=require('../showdown-advantage.js');
const Resolution=require('../showdown-resolution.js');
const EncounterRules=require('../encounter-rules.js');
const TrumpFields=require('../trump-fields.js');
const HighRoll=require('../showdown-highroll.js');
const Effects=require('../effects.js');

const ROOT=path.join(__dirname,'..');
const SUITS=['S','H','D','C'];
const RANKS=[2,3,4,5,6,7,8,9,10,11,12,13,14];

function read(file){return fs.readFileSync(path.join(ROOT,file),'utf8')}
function card(id,suit='S',rank=2){return{id,uid:id,suit,rank,printedSuit:suit,printedRank:rank}}
function makeDeck(count=12){return Array.from({length:count},(_,index)=>card(`c${index}`,SUITS[index%4],RANKS[index%13]))}
function pokerCards(ranks,suits=['S','H','D','C','S']){return ranks.map((rank,index)=>({rank,suit:suits[index]}))}
function hand(power,name='테스트 족보'){return{id:'test',name,power,ranks:[2,3,4,5,6],suits:['S','H','D','C','S']}}

test('7.5-R 카드 규격은 표준 순수 52장을 항상 보존하고 공용 효과 카드는 별도 정의로 둔다',()=>{
  assert.deepEqual(BattleCore.SUITS,SUITS);
  assert.equal(Cards.BASE_CARD_SLOTS.length,52);
  assert.equal(new Set(Cards.BASE_CARD_SLOTS.map(slot=>`${slot.suit}:${slot.rank}`)).size,52);
  assert(Cards.BASE_CARD_SLOTS.every(slot=>SUITS.includes(slot.suit)&&RANKS.includes(slot.rank)));
  const base=Cards.createBaseCardSlots();
  assert.equal(base.length,52);
  assert.equal(base.filter(Cards.isPureCard).length,52);
  assert.equal(base.filter(card=>card.definition?.category==='general').length,0);
  assert.equal(Cards.GENERAL_EFFECT_CARD_DEFINITIONS.length,12);
  assert.ok(base.some(card=>card.suit==='S'&&card.rank===3&&Cards.isPureCard(card)));
  assert.equal(Cards.CARD_DEFINITION_BY_ID['core.plus2'].suit,'S');
  assert.equal(Cards.CARD_DEFINITION_BY_ID['core.plus2'].rank,3);
  assert.throws(()=>Cards.createCardRecord({suit:'X',rank:2}),/Unknown card suit/);
  assert.throws(()=>Cards.createCardRecord({suit:'S',rank:0}),/Invalid card rank/);
  assert.throws(()=>Cards.createCardRecord({suit:'S',rank:15}),/Invalid card rank/);
  assert.throws(()=>Cards.createCardRecord({suit:'S',rank:2.5}),/Invalid card rank|/);
});

test('7.5-R 실제 시작 전투 덱은 기본 12장이고 10~14장 설정 범위를 지킨다',()=>{
  assert.equal(DeckBoundaries.MIN_STARTING_DECK_SIZE,10);
  assert.equal(DeckBoundaries.DEFAULT_STARTING_DECK_SIZE,12);
  assert.equal(DeckBoundaries.MAX_STARTING_DECK_SIZE,14);
  const source=Cards.createBaseCardSlots();
  for(const size of [10,12,14])assert.equal(DeckBoundaries.selectStartingDeck(source,{targetSize:size}).length,size);
  DeckBoundaries.installBattleCoreAdapter(BattleCore);
  const state=BattleCore.createBattleState({deck:makeDeck(12),shuffleFn:cards=>cards});
  assert.equal(state.hand.length,3);
  assert.equal(state.deck.length,9);
  assert.deepEqual(state.showdownCards,[]);
});

test('7.5-R 트릭 승패는 무늬 변경→트럼프→숫자→상태/필드의 단일 최종 적용값만 사용한다',()=>{
  const trace=BattleCore.resolveTrickValue(card('x','H',4),'S',{effectiveSuit:'S',cardRankModifier:2,statusModifier:-1,fieldModifier:1});
  assert.deepEqual(trace.stages.map(stage=>stage.id),['printed','suit','trump','number','status_field']);
  assert.equal(trace.printedRank,4);
  assert.equal(trace.effectiveSuit,'S');
  assert.equal(trace.trumpBonus,3);
  assert.equal(trace.finalValue,9);
  assert.equal(BattleCore.compareTrick(card('low-trump','S',3),card('high','H',7),'S'),-1,'낮은 트럼프는 자동 승리하지 않는다');
  assert.equal(BattleCore.compareTrick(card('winning-trump','S',10),card('queen','H',12),'S'),1);
  assert.equal(BattleCore.compareTrick(card('tie-trump','S',9),card('tie-high','H',12),'S'),0);
  assert.equal(BattleCore.resolveTrickValue(card('ace','S',14),'S').finalValue,17,'적용 숫자는 14를 넘을 수 있다');
  assert.equal(BattleCore.showdownValue(BattleCore.effectiveCard(card('printed','H',8),{rankModifier:5,suit:'S'}),'Rank'),8,'쇼다운은 명시적 변경이 없으면 인쇄값을 쓴다');
});

test('7.5-R 5번째 트릭도 먼저 보충하고 쇼다운 뒤 사용한 5장만 버린 채 손패·드로우 덱을 유지한다',()=>{
  DeckBoundaries.installBattleCoreAdapter(BattleCore);
  const state=BattleCore.createBattleState({deck:makeDeck(12),shuffleFn:cards=>cards});
  for(let trick=1;trick<=5;trick++){
    BattleCore.playCard(state,0);
    assert.equal(state.hand.length,3,`${trick}번째 트릭 손패 보충 실패`);
    assert.equal(state.showdownCards.length,trick);
    assert.equal(state.discard.length,0);
    BattleCore.endTrick(state,'player');
  }
  assert.equal(state.phase,'showdown');
  const handBefore=state.hand.map(entry=>entry.id),deckBefore=state.deck.map(entry=>entry.id);
  BattleCore.finishShowdown(state);
  assert.equal(state.setIndex,2);
  assert.equal(state.trickIndex,1);
  assert.equal(state.discard.length,5);
  assert.deepEqual(state.hand.map(entry=>entry.id),handBefore);
  assert.deepEqual(state.deck.map(entry=>entry.id),deckBefore);
  assert.deepEqual(state.showdownCards,[]);
});

test('7.5-R 칩은 승리 +1·최대 5·2칩 손패 교환·트릭당 1회·세트 유지·전투 종료 초기화를 함께 지킨다',()=>{
  const state={phase:'trick',animating:false,setIndex:1,trick:1,chip:0,maxChip:0,hand:[card('a'),card('b'),card('c')],deck:[card('d'),card('e')],discard:[],history:{chipsSpent:0,cardsDrawn:0}};
  Chips.initializeBattleChipState(state,{balance:4});
  assert.equal(Chips.rewardTrickWin(state).gained,1);
  assert.equal(state.chip,5);
  const exchange=Chips.exchangeHandCard(state,'b');
  assert.equal(exchange.ok,true);
  assert.equal(state.chip,3);
  assert.deepEqual(state.hand.map(entry=>entry.id),['a','e','c']);
  assert.deepEqual(state.deck.map(entry=>entry.id),['b','d']);
  assert.equal(Chips.exchangeHandCard(state,'a').reason,'already_exchanged');
  state.setIndex=2;state.trick=1;
  assert.equal(Chips.exchangeAvailability(state,'a').ok,true);
  assert.equal(state.chip,3,'세트 전환으로 칩을 초기화하지 않는다');
  Chips.resetBattleChipState(state);
  assert.equal(state.chip,0);
  assert.equal(state.chipEconomy.balance,0);
});

test('7.5-R 적 정보는 제출 전 부분 예고이고 정찰 또는 제출 뒤에만 정확 정보를 공개한다',()=>{
  const enemy=card('enemy','H',12);
  const partial=EnemyInformation.publicEnemyModel(enemy,'S');
  assert.equal(partial.knowledge,'partial');
  assert.equal(partial.strengthLabel,'높음');
  assert.equal('rank'in partial,false);
  assert.equal('suit'in partial,false);
  const battle={trump:'S',enemyCard:enemy,playerStage:null,nextEnemyPreview:card('next','D',13),enemyForecast:0,reveal:true};
  assert.equal(EnemyInformation.currentEnemyExact(battle),false);
  assert.equal(EnemyInformation.previewText(battle,{TacticMigrationSupport:{isNextEnemyPreviewRevealed:state=>state.reveal===true}}),'♦K');
  battle.playerStage=card('player','C',8);
  assert.equal(EnemyInformation.currentEnemyExact(battle),true);
  assert.equal(EnemyInformation.currentEnemyModel(battle).rank,12);
});

test('7.5-R 포커 족보·A2345·4트릭 리버 아웃 스냅샷을 최신 정의로 고정한다',()=>{
  const expected={high_card:5,pair:10,two_pair:14,three_kind:18,straight:24,flush:26,full_house:32,four_kind:42,straight_flush:60};
  assert.deepEqual(Object.fromEntries(Object.entries(Resolution.POKER_HANDS).map(([id,value])=>[id,value.power])),expected);
  assert.equal(Resolution.evaluatePoker(pokerCards([14,2,3,4,5])).id,'straight');
  const four=pokerCards([6,7,8,9],['S','H','D','C']);
  const snapshot=Resolution.createRiverSnapshot(four,{setIndex:1});
  assert.equal(snapshot.capturedAfterTrick,4);
  assert.equal(snapshot.frozen,true);
  const straightRanks=new Set(snapshot.candidates.filter(candidate=>candidate.target.id==='straight').map(candidate=>candidate.rank));
  assert(straightRanks.has(5));
  assert(straightRanks.has(10));
  assert.equal(Resolution.resolveRiverHit(snapshot,{rank:5,suit:'S'},{setIndex:1}).hit,true);
  assert.equal(Resolution.resolveRiverHit(snapshot,{rank:2,suit:'S'},{setIndex:1}).hit,false);
});

test('7.5-R 우세·리버·계약 배율은 +25%/+25%/+50%를 합산해 최종 ×2.0을 한 번만 적용한다',()=>{
  const advantageState={setIndex:1};
  ShowdownAdvantage.grantAdvantage(advantageState,'player',{source:'test'});
  const advantage=ShowdownAdvantage.snapshot(advantageState);
  assert.equal(advantage.automaticSuitComparison,false);
  assert.equal(advantage.multiplier,1.25);
  const model=Resolution.createBreakdown({playerHand:hand(10,'내 족보'),enemyHand:hand(5,'적 족보')});
  Resolution.addActiveAdvantageMultipliers(null,null,model,advantage);
  Resolution.applyRiverHitBonus(model,{active:true,hit:true,multiplier:1.25,target:{id:'straight'}});
  Resolution.addMultiplier(model,'player',{id:'contract',label:'계약',factor:1.5,source:'contract'});
  Resolution.finalizeBreakdown(model);
  assert.deepEqual(model.player.multipliers.map(entry=>entry.bonus),[0.25,0.25,0.5]);
  assert.equal(model.player.multiplierBonusTotal,1);
  assert.equal(model.player.finalMultiplier,2);
  assert.equal(model.player.finalPower,20);
});

test('7.5-R 쇼다운은 양쪽 최종 위력을 비교하고 높은 쪽만 차이 피해를 준다',()=>{
  const model=Resolution.createBreakdown({playerHand:hand(24,'내 족보'),enemyHand:hand(42,'적 족보')});
  Resolution.finalizeBreakdown(model);
  const battle={enemy:{hp:20,maxHp:20}},run={hp:50,maxHp:50};
  const root={
    damageEnemy(amount,feedback,metadata){this.calls.push(['player',amount,metadata.source,metadata.resolution]);battle.enemy.hp=Math.max(0,battle.enemy.hp-amount);return Math.min(20,amount)},
    damagePlayer(amount,feedback,metadata){this.calls.push(['enemy',amount,metadata.source,metadata.resolution]);run.hp=Math.max(0,run.hp-amount);return amount},
    flash(){},calls:[]
  };
  Resolution.resolveShowdownAttacks(root,battle,run,model);
  assert.equal(model.comparison.winner,'enemy');
  assert.equal(model.comparison.difference,18);
  assert.equal(model.attacks.player.plannedAmount,0);
  assert.equal(model.attacks.enemy.plannedAmount,18);
  assert.deepEqual(root.calls,[['enemy',18,'showdown_enemy_attack','power_difference']]);
  assert.equal(model.attackSequence.playerAttackCancelled,true);
  assert.equal(model.attackSequence.enemyAttackCancelled,false);
  assert.equal(battle.enemy.hp,20);
  assert.equal(run.hp,32);
  assert.equal('damage'in model,false);
});

test('7.5-R 필드는 기본 없음이며 트럼프 +5/+1/0, 손패 -1, 낮은 최종값 승리를 명시적으로만 적용한다',()=>{
  const state={type:'battle',setIndex:1,trick:1,phase:'trick',enemy:{hp:30,maxHp:30},deck:[],discard:[],hand:[],slots:[],bossRules:[],field:null,maxHandSize:3,statuses:{player:{},enemy:{}},reservations:[],setHistory:{wins:0,losses:0,draws:0}};
  EncounterRules.initializeBattle(state);
  assert.equal(state.field,null);
  assert.equal(TrumpFields.trumpBonusForState(state),3);
  assert.equal(TrumpFields.FIELD_DEFINITIONS.resonance_floor.rulesOverride.trumpBonus,5);
  assert.equal(TrumpFields.FIELD_DEFINITIONS.thin_signal.rulesOverride.trumpBonus,1);
  assert.equal(TrumpFields.FIELD_DEFINITIONS.outlaw_zone.rulesOverride.trumpBonus,0);
  assert.equal(TrumpFields.FIELD_DEFINITIONS.narrow_table.rulesOverride.maxHandModifier,-1);
  EncounterRules.setField(state,'inversion_zone');
  assert.equal(EncounterRules.compareTrickWithRules(card('low','H',3),card('high','D',10),'S',state),1);
});

test('7.5-R 압승은 남은 HP 대비 예정 피해 175%/250%와 실제 처치를 기준으로만 판정한다',()=>{
  assert.equal(HighRoll.classifyOverkill({plannedDamage:17.4,hpBefore:10,targetDefeated:true}).qualified,false);
  assert.equal(HighRoll.classifyOverkill({plannedDamage:17.5,hpBefore:10,targetDefeated:true}).tier,'overkill');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:24.9,hpBefore:10,targetDefeated:true}).tier,'overkill');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:25,hpBefore:10,targetDefeated:true}).tier,'mega_overkill');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:30,hpBefore:10,targetDefeated:false}).qualified,false);
  assert.deepEqual(HighRoll.classifyOverkill({plannedDamage:25,hpBefore:10,targetDefeated:true}).reward,{type:'none',amount:0});
});

test('7.5-R 세트 종료 런타임은 손패를 다시 뽑지 않고 새 트럼프만 공개한다',()=>{
  const source=read('showdown-resolution.js');
  assert.match(source,/state\.trump=runtimeRoot\.drawSetTrump\?\.\(state\)\?\?state\.trump/);
  assert.doesNotMatch(source,/state\.hand\s*=\s*\[\][\s\S]{0,120}drawP\?\.\(3\)/);
  assert.match(source,/state\.slots\.forEach\(slot=>state\.discard\.push\(slot\.card\)\)/);
});

test('7.5-R 활성 런타임에는 폐기된 전술 덱·트럼프 자동승리·상시 무늬 우세·사후 리버·연쇄 배율 코드가 없고 차이 피해 정산은 존재한다',()=>{
  const runtimeFiles=['battle-core.js','cards.js','effects.js','chip-economy.js','deck-boundaries.js','enemy-information.js','showdown-resolution.js','encounter-rules.js','trump-fields.js','index.html'];
  const sources=Object.fromEntries(runtimeFiles.map(file=>[file,read(file)]));
  const all=Object.values(sources).join('\n');
  for(const pattern of [/\btacticDeck\b/,/\btacticHand\b/,/\bdraw_tactic\b/,/\bplayTactic\b/,/\bequipTactic\b/,/run\.tactics\b/,/battle\.tactics\b/])assert.doesNotMatch(all,pattern);
  assert.equal(Effects.ACTIONS.includes('draw_tactic'),false);
  assert.doesNotMatch(sources['battle-core.js'],/SHOWDOWN_ADVANTAGE_POWER|advantageMargin|showdownAdvantagePower|advantage_count_at_least|on_showdown_advantage/);
  assert.doesNotMatch(sources['encounter-rules.js'],/advantageMargin|showdownAdvantagePower|lowRankWinsWhenSameTrumpState/);
  assert.doesNotMatch(sources['showdown-resolution.js'],/detectRiverCompletion|addRiverCompletionMultiplier/);
  assert.match(sources['showdown-resolution.js'],/Math\.abs\(playerPower-enemyPower\)/);
  assert.match(sources['showdown-resolution.js'],/power_comparison/);
  assert.match(sources['showdown-resolution.js'],/difference_damage/);
  assert.doesNotMatch(sources['showdown-resolution.js'],/order:\['player_attack','enemy_survival_check','enemy_attack'\]/);
  assert.doesNotMatch(sources['showdown-resolution.js'],/model\.damage=\{target:/);
  assert.doesNotMatch(sources['showdown-resolution.js'],/multiplierProduct\s*\*=/);
  assert.doesNotMatch(sources['battle-core.js'],/playerTrump\s*!==\s*enemyTrump|playerTrump\s*&&\s*!enemyTrump|enemyTrump\s*&&\s*!playerTrump/);
});