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
  for(const [hand,id,name,power] of cases){
    const result=Resolution.evaluatePoker(hand,{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)});
    assert.equal(result.id,id);assert.equal(result.name,name);assert.equal(result.power,power);
  }
});

test('에이스 로우 스트레이트도 7.5-C 족보 판정에서 유지된다',()=>{
  const result=Resolution.evaluatePoker(cards([14,2,3,4,5]),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)});
  assert.equal(result.id,'straight');
  assert.equal(result.power,24);
});

test('breakdown은 기본 위력, 덧셈, 희귀 배율을 분리하고 배율을 덧셈 뒤 순서대로 적용한다',()=>{
  const playerHand=Resolution.evaluatePoker(cards([2,3,4,5,6]),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)});
  const enemyHand=Resolution.evaluatePoker(cards([2,5,8,11,13]),{valueResolver:(card,key)=>BattleCore.showdownValue(card,key)});
  const model=Resolution.createBreakdown({playerHand,enemyHand,setIndex:1});
  Resolution.addAdditive(model,'player',{label:'카드 효과',value:6,source:'card'});
  Resolution.addAdditive(model,'player',{label:'계약',value:4,source:'contract'});
  Resolution.addMultiplier(model,'player',{label:'우세',factor:1.25,source:'advantage'});
  Resolution.addMultiplier(model,'player',{label:'고난도 조건',factor:1.5,source:'condition'});
  Resolution.finalizeBreakdown(model);
  assert.equal(model.player.basePower,24);
  assert.equal(model.player.additiveTotal,10);
  assert.equal(model.player.preMultiplierPower,34);
  assert.deepEqual(model.player.multipliers.map(entry=>[entry.before,entry.after]),[[34,43],[43,65]]);
  assert.equal(model.player.finalPower,65);
  assert.equal(model.enemy.finalPower,5);
  assert.deepEqual(model.damage,{target:'enemy',amount:60});
});

test('7.5-A 임시 score 배율은 7.5-C 전용 배율 단계 전에 원래 덧셈 값으로 되돌릴 수 있다',()=>{
  const state={setIndex:2,advantageState:{appliedSet:2,lastPlayerPreMultiplier:28,lastPlayerPostMultiplier:35}},score={value:35};
  assert.equal(Resolution.undoLegacyAdvantageScale(state,score),true);
  assert.equal(score.value,28);
});

test('브라우저 쇼다운은 쇼다운 전 효과로 값 변경을 끝낸 뒤 족보→덧셈→배율→피해 순으로 계산한다',async()=>{
  const playerSlots=cards([2,3,4,5,9]).map((card,index)=>({card:{...card,uid:`p${index}`}}));
  const enemySlots=cards([2,5,8,11,13]).map((card,index)=>({card:{...card,uid:`e${index}`}}));
  const events=[];
  const battle={
    node:{id:'battle-1'},type:'battle',enemy:{hp:100,maxHp:100},
    slots:playerSlots,enemySlots,discard:[],hand:[],deck:[],effects:[],reservations:[],
    setIndex:1,trick:5,phase:'trick',setHistory:BattleCore.createSetHistory(),history:{},
    maxHandSize:3,slotBonus:0,chip:2,maxChip:5,mods:{paint:false,plus:0,reverse:false,double:false},trump:'H',
    advantageState:{player:true,enemy:false,playerSource:'test-edge',enemySource:null,grantedSet:1,appliedSet:null,scoreBase:null,lastPlayerPreMultiplier:null,lastPlayerPostMultiplier:null}
  };
  const root={
    battle,run:{hp:50,maxHp:50},
    BattleCore:{...BattleCore,resolveShowdownAdvantage(){return{mode:'explicit',automaticSuitComparison:false,multiplier:1.25,playerActive:true,enemyActive:false,playerSource:'test-edge',enemySource:null,playerAdvantageCount:1,enemyAdvantageCount:0,playerAdvantages:[],enemyAdvantages:[],playerSuitCounts:{},enemySuitCounts:{}}}},
    ShowdownAdvantage:{ADVANTAGE_MULTIPLIER:1.25,consumeAdvantage(state){state.advantageState.player=false;state.advantageState.enemy=false}},
    CardEffects:{newHistory(){return{effectsUsed:false,effectUseCount:0,chipsSpent:0,cardsDrawn:0,damageDealt:0,healingDone:0}}},
    showdown(){throw new Error('legacy showdown should be replaced')},poker(){throw new Error('legacy poker should be replaced')},
    sfx(){},renderBattle(){},showShowdownStep(){},wait:async()=>{},flash(){},
    runCardEffects(trigger,card,extra){
      events.push(trigger);
      if(trigger==='before_showdown'&&card===playerSlots[0].card)playerSlots[4].card.showdownRank=6;
      if(trigger==='on_showdown_score')extra.score.value+=2;
      return 1;
    },
    damageEnemy(amount){this.damage=amount;this.battle.enemy.hp-=amount;return amount},
    damagePlayer(amount){this.playerDamage=amount;this.run.hp-=amount;return amount},
    drawSetTrump(){return'S'},drawP(){},nextEnemy(){},loseRun(){this.lost=true},async winBattle(){this.won=true}
  };
  Resolution.installBrowser(root);
  const result=await root.showdown();
  assert(events.slice(0,5).every(trigger=>trigger==='before_showdown'));
  assert.equal(result.player.hand.id,'straight','5번째 카드의 쇼다운 숫자 변경이 족보 계산 전에 반영된다');
  assert.equal(result.player.basePower,24);
  assert.equal(result.player.additiveTotal,10);
  assert.equal(result.player.preMultiplierPower,34);
  assert.equal(result.riverCompletion.active,true,'쇼다운 전 효과가 5번째 카드로 스트레이트를 완성했으므로 리버 완성이다');
  assert.deepEqual(result.player.multipliers.map(entry=>entry.id),['river_completion','advantage']);
  assert.deepEqual(result.player.multipliers.map(entry=>[entry.before,entry.after]),[[34,43],[43,54]]);
  assert.equal(result.player.finalPower,54);
  assert.equal(root.damage,49);
  assert.equal(battle.chip,2,'세트가 넘어가도 칩 잔액을 리셋하지 않는다');
  assert.equal(battle.setIndex,2);
  assert.deepEqual(battle.showdownTrace,Resolution.traceLines(result));
});

test('7.5-C 런타임은 칩 경제 뒤, 전투 레이아웃 전에 로드된다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert(source.includes("loadScript('showdown-resolution.js','trick-showdown-resolution-runtime')"));
  assert(source.includes("if(root.ShowdownResolution){loadBattleLayoutFinal();return;}"));
  assert(source.includes("if(root.ChipEconomy){loadBattleLayoutFile();return;}"));
  assert(source.includes("if(script?.dataset?.loaded==='true')loadBattleLayoutFinal();else script?.addEventListener?.('load',loadBattleLayoutFinal,{once:true});"));
  assert(source.includes("loadScript('battle-layout.js','trick-battle-layout-runtime')"));
});
