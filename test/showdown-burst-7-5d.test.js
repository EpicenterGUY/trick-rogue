const test=require('node:test');
const assert=require('node:assert/strict');
const BattleCore=require('../battle-core.js');
const Resolution=require('../showdown-resolution.js');

const cards=(ranks,suits=['S','H','D','C','S'])=>ranks.map((rank,index)=>({rank,suit:suits[index]}));

test('7.5-D는 5번째 카드로 처음 페어가 완성될 때 리버 완성으로 판정한다',()=>{
  const river=Resolution.detectRiverCompletion(cards([2,5,8,11,2],['S','H','D','C','H']));
  assert.equal(river.active,true);
  assert.equal(river.before.id,'high_card');
  assert.equal(river.after.id,'pair');
  assert.equal(river.multiplier,1.25);
  assert.deepEqual(river.fifth,{rank:2,suit:'H'});
});

test('4장 시점에 이미 있던 족보가 5번째 카드 뒤에도 유지되면 리버 완성이 아니다',()=>{
  const pair=Resolution.detectRiverCompletion(cards([2,2,5,8,11]));
  assert.equal(pair.before.id,'pair');
  assert.equal(pair.after.id,'pair');
  assert.equal(pair.active,false);

  const quads=Resolution.detectRiverCompletion(cards([7,7,7,7,12]));
  assert.equal(quads.before.id,'four_kind');
  assert.equal(quads.after.id,'four_kind');
  assert.equal(quads.active,false);
});

test('5번째 카드가 투페어를 풀하우스로 올리거나 스트레이트/플러시를 완성하면 리버 완성이다',()=>{
  const fullHouse=Resolution.detectRiverCompletion(cards([2,2,5,5,2]));
  assert.equal(fullHouse.before.id,'two_pair');
  assert.equal(fullHouse.after.id,'full_house');
  assert.equal(fullHouse.active,true);

  const straight=Resolution.detectRiverCompletion(cards([2,3,4,5,6]));
  assert.equal(straight.before.id,'high_card');
  assert.equal(straight.after.id,'straight');
  assert.equal(straight.active,true);

  const flush=Resolution.detectRiverCompletion(cards([2,5,8,11,13],['H','H','H','H','H']));
  assert.equal(flush.before.id,'high_card');
  assert.equal(flush.after.id,'flush');
  assert.equal(flush.active,true);
});

test('5전 전승 배율은 정확히 다섯 트릭을 모두 이긴 세트에서만 활성화된다',()=>{
  const perfect=Resolution.detectPerfectSet({trickResults:['player','player','player','player','player']});
  assert.equal(perfect.active,true);
  assert.equal(perfect.multiplier,1.5);
  assert.equal(perfect.wins,5);

  assert.equal(Resolution.detectPerfectSet({trickResults:['player','player','player','player','draw']}).active,false);
  assert.equal(Resolution.detectPerfectSet({trickResults:['player','player','player','player']}).active,false);
  assert.equal(Resolution.detectPerfectSet({wins:5,trickResults:[]}).active,false,'승수 숫자만 조작해서는 전승 배율이 생기지 않는다');
});

test('리버→우세→5전 전승 순으로 덧셈 뒤 희귀 배율을 적용하고 각 단계 전후 값을 기록한다',()=>{
  const hand=Resolution.evaluatePoker(cards([2,3,4,5,6]));
  const enemy=Resolution.evaluatePoker(cards([2,5,8,11,13]));
  const model=Resolution.createBreakdown({playerHand:hand,enemyHand:enemy,setIndex:1});
  Resolution.addAdditive(model,'player',{id:'test_add',label:'카드 효과',value:6,source:'test'});
  Resolution.addRiverCompletionMultiplier(model,cards([2,3,4,5,6]));
  Resolution.addMultiplier(model,'player',{id:'advantage',label:'우세',factor:1.25,source:'test'});
  Resolution.addPerfectSetMultiplier(model,{trickResults:['player','player','player','player','player']});
  Resolution.finalizeBreakdown(model);

  assert.equal(model.player.preMultiplierPower,30);
  assert.deepEqual(model.player.multipliers.map(entry=>entry.id),['river_completion','advantage','perfect_set']);
  assert.deepEqual(model.player.multipliers.map(entry=>[entry.before,entry.after]),[[30,38],[38,48],[48,72]]);
  assert.equal(model.player.finalPower,72);
  assert.equal(model.player.multiplierProduct,1.875*1.25);
  assert.equal(model.riverCompletion.active,true);
  assert.equal(model.perfectSet.active,true);
});

test('실제 쇼다운 런타임에서도 리버 완성 + 5전 전승은 플레이어 공격 전체 위력으로 적용되고 적이 생존하면 반격한다',async()=>{
  const playerSlots=cards([2,3,4,5,6]).map((card,index)=>({card:{...card,uid:`p${index}`}}));
  const enemySlots=cards([2,5,8,11,13]).map((card,index)=>({card:{...card,uid:`e${index}`}}));
  const state={
    node:{id:'battle-1'},type:'battle',enemy:{hp:100,maxHp:100},
    slots:playerSlots,enemySlots,discard:[],hand:[],deck:[],effects:[],reservations:[],
    setIndex:1,trick:5,phase:'trick',setHistory:{trickResults:['player','player','player','player','player'],wins:5,losses:0,draws:0},history:{},
    maxHandSize:3,slotBonus:0,chip:5,maxChip:5,mods:{paint:false,plus:0,reverse:false,double:false},trump:'H'
  };
  const root={
    battle:state,run:{hp:50,maxHp:50},
    BattleCore:{...BattleCore,resolveShowdownAdvantage(){return{mode:'explicit',automaticSuitComparison:false,multiplier:1.25,playerActive:false,enemyActive:false,playerAdvantageCount:0,enemyAdvantageCount:0,playerAdvantages:[],enemyAdvantages:[],playerSuitCounts:{},enemySuitCounts:{}}}},
    CardEffects:{newHistory(){return{}}},
    sfx(){},renderBattle(){},showShowdownStep(){},wait:async()=>{},flash(){},runCardEffects(){return 0},
    damageEnemy(amount){this.damage=amount;this.battle.enemy.hp-=amount;return amount},
    damagePlayer(amount){this.playerDamage=amount;this.run.hp-=amount;return amount},
    drawSetTrump(){return'S'},drawP(){},nextEnemy(){},loseRun(){this.lost=true},async winBattle(){this.won=true}
  };

  const result=await Resolution.resolveRuntimeShowdown(root);
  assert.deepEqual(result.player.multipliers.map(entry=>entry.id),['river_completion','perfect_set']);
  assert.deepEqual(result.player.multipliers.map(entry=>[entry.before,entry.after]),[[24,30],[30,45]]);
  assert.equal(result.player.finalPower,45);
  assert.equal(result.enemy.finalPower,5);
  assert.equal(result.attacks.player.plannedAmount,45);
  assert.equal(result.attacks.player.dealt,45);
  assert.equal(result.attacks.enemy.plannedAmount,5);
  assert.equal(result.attacks.enemy.dealt,5);
  assert.equal(result.attackSequence.enemyAttackCancelled,false);
  assert.equal(root.damage,45);
  assert.equal(root.playerDamage,5);
  assert.equal(state.enemy.hp,55);
  assert.equal(root.run.hp,45);
  assert.equal(result.riverCompletion.active,true);
  assert.equal(result.perfectSet.active,true);
  assert(result.player.multipliers[0].metadata.before.id==='high_card');
  assert(result.player.multipliers[0].metadata.after.id==='straight');
});