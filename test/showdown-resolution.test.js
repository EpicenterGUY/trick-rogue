const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BattleCore=require('../battle-core.js');
const Resolution=require('../showdown-resolution.js');

const cards=(ranks,suits=['S','H','D','C','S'])=>ranks.map((rank,index)=>({rank,suit:suits[index]}));

test('7.5-C 족보 기본 위력은 밸런스 테스트용 5/10/14/18/24/26/32/42/60 표를 사용한다',()=>{
  const cases=[
    [cards([2,5,8,11,13]),'high_card','하이카드',5],
    [cards([2,2,5,8,11]),'pair','페어',10],
    [cards([2,2,5,5,11]),'two_pair','투페어',14],
    [cards([2,2,2,8,11]),'three_kind','트리플',18],
    [cards([2,3,4,5,6]),'straight','스트레이트',24],
    [cards([2,5,8,11,13],['H','H','H','H','H']),'flush','플러시',26],
    [cards([2,2,2,5,5]),'full_house','풀하우스',32],
    [cards([2,2,2,2,11]),'four_kind','포카드',42],
    [cards([9,10,11,12,13],['D','D','D','D','D']),'straight_flush','스트레이트 플러시',60]
  ];
  for(const [hand,id,name,power] of cases){const result=Resolution.evaluatePoker(hand,{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)});assert.equal(result.id,id);assert.equal(result.name,name);assert.equal(result.power,power)}
});

test('에이스 로우 스트레이트도 7.5-C 족보 판정에서 유지된다',()=>{const result=Resolution.evaluatePoker(cards([14,2,3,4,5]),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)});assert.equal(result.id,'straight');assert.equal(result.power,24)});

test('breakdown은 기본 위력, 덧셈, 추가 배율을 분리하고 배율 합계를 한 번만 적용한다',()=>{
  const playerHand=Resolution.evaluatePoker(cards([2,3,4,5,6]),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)}),enemyHand=Resolution.evaluatePoker(cards([2,5,8,11,13]),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)}),model=Resolution.createBreakdown({playerHand,enemyHand,setIndex:1});
  Resolution.addAdditive(model,'player',{label:'카드 효과',value:6,source:'card'});Resolution.addAdditive(model,'player',{label:'계약',value:4,source:'contract'});Resolution.addMultiplier(model,'player',{label:'우세',factor:1.25,source:'advantage'});Resolution.addMultiplier(model,'player',{label:'고난도 조건',factor:1.5,source:'condition'});Resolution.finalizeBreakdown(model);
  assert.equal(model.player.basePower,24);assert.equal(model.player.additiveTotal,10);assert.equal(model.player.preMultiplierPower,34);assert.deepEqual(model.player.multipliers.map(entry=>entry.bonus),[0.25,0.5]);assert.equal(model.player.multiplierBonusTotal,0.75);assert.equal(model.player.finalMultiplier,1.75);assert.equal(model.player.finalPower,60);assert.equal(model.enemy.finalPower,5);assert.equal(model.attacks.player.plannedAmount,60);assert.equal(model.attacks.enemy.plannedAmount,5);assert.equal('damage' in model,false,'위력 차이 단일 피해 모델을 만들지 않는다');
});

test('7.5-P 우세는 덧셈 점수를 직접 바꾸지 않고 일반 추가 배율 +25%로 등록된다',()=>{
  const playerHand=Resolution.evaluatePoker(cards([2,3,4,5,6])),enemyHand=Resolution.evaluatePoker(cards([2,5,8,11,13])),model=Resolution.createBreakdown({playerHand,enemyHand});
  Resolution.addAdditive(model,'player',{label:'카드 효과',value:4});Resolution.addActiveAdvantageMultipliers(null,null,model,{playerActive:true,enemyActive:false,multiplier:1.25,playerSource:'test'});Resolution.finalizeBreakdown(model);
  assert.equal(model.player.preMultiplierPower,28);assert.equal(model.player.multipliers.length,1);assert.equal(model.player.multipliers[0].id,'advantage');assert.equal(model.player.multipliers[0].bonus,0.25);assert.equal(model.player.finalMultiplier,1.25);assert.equal(model.player.finalPower,35);
});

test('쇼다운 전 효과로 최종 족보가 바뀌어도 리버는 5번째 카드 선택 시점 후보 적중만 인정한다',async()=>{
  const playerSlots=cards([2,3,4,5,9]).map((card,index)=>({card:{...card,uid:`p${index}`}}));
  const enemySlots=cards([2,5,8,11,13]).map((card,index)=>({card:{...card,uid:`e${index}`}}));
  const events=[],attacks=[];
  const battle={node:{id:'battle-1'},type:'battle',enemy:{hp:100,maxHp:100},slots:playerSlots,enemySlots,discard:[],hand:[],deck:[],effects:[],reservations:[],setIndex:1,trick:5,phase:'trick',setHistory:BattleCore.createSetHistory(),history:{},maxHandSize:3,slotBonus:0,chip:2,maxChip:5,mods:{paint:false,plus:0,reverse:false,double:false},trump:'H',advantageState:{player:true,enemy:false,playerSource:'test-edge',enemySource:null,grantedSet:1}};
  battle.riverSnapshot=Resolution.createRiverSnapshot(playerSlots.slice(0,4),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key),setIndex:battle.setIndex});
  const root={battle,run:{hp:50,maxHp:50},BattleCore:{...BattleCore,resolveShowdownAdvantage(){return{mode:'explicit',automaticSuitComparison:false,multiplier:1.25,playerActive:true,enemyActive:false,playerSource:'test-edge',enemySource:null}}},ShowdownAdvantage:{ADVANTAGE_MULTIPLIER:1.25,consumeAdvantage(state){state.advantageState.player=false;state.advantageState.enemy=false}},CardEffects:{newHistory(){return{effectsUsed:false,effectUseCount:0,chipsSpent:0,cardsDrawn:0,damageDealt:0,healingDone:0}}},showdown(){throw new Error('legacy showdown should be replaced')},poker(){throw new Error('legacy poker should be replaced')},sfx(){},renderBattle(){},showShowdownStep(){},wait:async()=>{},flash(){},runCardEffects(trigger,card,extra){events.push(trigger);if(trigger==='before_showdown'&&card===playerSlots[0].card)playerSlots[4].card.showdownRank=6;if(trigger==='on_showdown_score')extra.score.value+=2;return 1},damageEnemy(amount,feedback,metadata){attacks.push(['player',amount,feedback,metadata]);this.battle.enemy.hp-=amount;return amount},damagePlayer(amount,feedback,metadata){attacks.push(['enemy',amount,feedback,metadata]);this.run.hp-=amount;return amount},drawSetTrump(){return'S'},drawP(){},nextEnemy(){},loseRun(){this.lost=true},async winBattle(){this.won=true}};
  Resolution.installBrowser(root);const result=await root.showdown();
  assert(events.slice(0,5).every(trigger=>trigger==='before_showdown'));assert.equal(result.riverHit.active,false,'5번째 카드 선택 당시 9는 스트레이트 후보가 아니므로 리버는 불발이다');assert.equal(result.riverHit.reason,'candidate_miss');assert.equal(result.riverHit.fifth.rank,9,'쇼다운 전 효과가 9를 6으로 바꾸기 전에 리버 적중을 잠근다');assert.equal(result.player.hand.id,'straight','쇼다운 전 효과로 최종 포커 족보 자체는 스트레이트가 될 수 있다');assert.equal(result.player.basePower,24);assert.equal(result.player.additiveTotal,10);assert.equal(result.player.preMultiplierPower,34);assert.deepEqual(result.player.multipliers.map(entry=>entry.id),['advantage']);assert.equal(result.player.multipliers[0].bonus,0.25);assert.equal(result.player.finalMultiplier,1.25);assert.equal(result.player.finalPower,43);assert.equal(result.enemy.finalPower,5);assert.deepEqual(attacks.map(entry=>entry.slice(0,3)),[['player',43,'showdown'],['enemy',5,'showdown']]);assert.equal(attacks[0][3].source,'showdown_player_attack');assert.equal(attacks[1][3].source,'showdown_enemy_attack');assert.equal(result.attacks.player.dealt,43);assert.equal(result.attacks.enemy.dealt,5);assert.equal(result.attackSequence.enemyAttackCancelled,false);assert.equal(battle.enemy.hp,57);assert.equal(root.run.hp,45);assert.equal(battle.chip,2,'세트가 넘어가도 칩 잔액을 리셋하지 않는다');assert.equal(battle.setIndex,2);assert.deepEqual(battle.showdownTrace,Resolution.traceLines(result));
});

test('7.5-C 런타임은 칩 경제 뒤, Q 고점 계층과 7.5-E 템포 단계보다 먼저 로드된다',()=>{const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');assert(source.includes("loadScript('showdown-resolution.js','trick-showdown-resolution-runtime')"));assert(source.includes("if(root.ShowdownResolution){loadShowdownHighRoll();return;}"));assert(source.includes("if(root.ShowdownHighRoll){loadEncounterTempo();return;}"));assert(source.includes("if(root.ChipEconomy){loadBattleLayoutFile();return;}"));assert(source.includes("if(script?.dataset?.loaded==='true')loadShowdownHighRoll();else script?.addEventListener?.('load',loadShowdownHighRoll,{once:true});"));assert(source.includes("loadScript('encounter-tempo.js','trick-encounter-tempo-runtime')"))});
