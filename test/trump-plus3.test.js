const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BattleCore=require('../battle-core.js');
const EncounterRules=require('../encounter-rules.js');
const EnemyBehavior=require('../enemy-behavior.js');

function battleState(){return{type:'battle',setIndex:1,trick:1,enemy:{hp:30,maxHp:30},hand:[],slots:[],bossRules:[],field:null,statuses:{player:{},enemy:{}},reservations:[],setHistory:{wins:0,losses:0,draws:0}}}
function sequence(...values){let i=0;return()=>values[i++]??0}

test('7.5-G 트럼프는 절대 승리권이 아니라 양쪽에 대칭적인 +3 보정이다',()=>{
  assert.equal(BattleCore.trickValue({suit:'S',rank:3},'S'),6);
  assert.equal(BattleCore.trickValue({suit:'H',rank:13},'S'),13);
  assert.equal(BattleCore.compareTrick({suit:'S',rank:3},{suit:'H',rank:13},'S'),-1);
  assert.equal(BattleCore.compareTrick({suit:'S',rank:10},{suit:'H',rank:12},'S'),1);
});

test('7.5-G 역상 규칙은 트럼프 여부 분기 없이 최종 적용 숫자 비교만 뒤집는다',()=>{
  const state=battleState();
  EncounterRules.initializeBattle(state);
  const trumpLow={suit:'H',rank:2};
  const offTrumpHigh={suit:'C',rank:10};
  assert.equal(EncounterRules.compareTrickWithRules(trumpLow,offTrumpHigh,'H',state),-1);
  EncounterRules.setFieldFromSource(state,'inversion_zone',{type:'event',id:'test'});
  assert.equal(EncounterRules.compareTrickWithRules(trumpLow,offTrumpHigh,'H',state),1);

  const trumpTen={suit:'H',rank:10};
  const queen={suit:'C',rank:12};
  assert.equal(EncounterRules.compareTrickWithRules(trumpTen,queen,'H',{...state,field:null,rulesOverride:{}}),1);
  assert.equal(EncounterRules.compareTrickWithRules(trumpTen,queen,'H',state),-1);
});

test('7.5-G 적 AI가 트럼프 무늬를 골라도 낮은 숫자면 높은 비트럼프에게 질 수 있다',()=>{
  const play=EnemyBehavior.chooseEnemyPlay('elite',{trick:4,trump:'D',setHistory:{wins:2,losses:0}},sequence(0.9,0));
  assert.equal(play.patternId,'trump_hunt');
  assert.equal(play.card.suit,'D');
  assert.equal(play.card.rank,6);
  assert.equal(BattleCore.trickValue(play.card,'D'),9);
  assert.equal(BattleCore.compareTrick(play.card,{suit:'H',rank:13},'D'),-1);
});

test('7.5-G 브라우저 호환 어댑터는 트릭 숫자 14 상한을 제거하고 +3 최종값을 표시한다',()=>{
  BattleCore.resetBrowserTrumpAdapterForTests();
  const elements={
    trumpText:{textContent:'♠'},
    inspectApply:{textContent:''}
  };
  const document={
    getElementById(id){return elements[id]||null},
    querySelector(){return null},
    querySelectorAll(){return[]}
  };
  const root={
    document,
    BattleCore,
    battle:{trump:'S',mods:{plus:3,paint:false,reverse:false}},
    effective(card){return BattleCore.effectiveCard(card,{rank:Math.min(14,card.rank+this.battle.mods.plus),suit:card.suit})},
    compare(card,enemy){return BattleCore.compareTrick(this.effective(card),BattleCore.effectiveCard(enemy),this.battle.trump)},
    classifyWin(){return null},
    renderBattle(){elements.trumpText.textContent='♠'},
    inspectCard(){elements.inspectApply.textContent='인쇄 ♥Q → 트릭 ♥A · 예상 승리'},
    showTerm(){},showTerms(){}
  };
  assert.equal(BattleCore.installBrowserTrumpAdapter(root),true);
  const queen={suit:'H',rank:12};
  assert.equal(root.effective(queen).trickRank,15);
  assert.equal(root.compare({suit:'S',rank:3},{suit:'H',rank:13}),-1);
  root.renderBattle();
  assert.equal(elements.trumpText.textContent,'♠ +3');
  root.inspectCard(queen,false);
  assert.match(elements.inspectApply.textContent,/계산: 12/);
  assert.match(elements.inspectApply.textContent,/최종 15/);
});

test('7.5-G 브라우저 리버스는 같은 무늬 여부와 무관하게 최종 적용 숫자 비교 전체를 뒤집는다',()=>{
  BattleCore.resetBrowserTrumpAdapterForTests();
  const root={
    document:{getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}},
    BattleCore,
    battle:{trump:'H',mods:{plus:0,paint:false,reverse:true}},
    effective(card){return BattleCore.effectiveCard(card)},
    compare(){return 0}
  };
  BattleCore.installBrowserTrumpAdapter(root);
  assert.equal(root.compare({suit:'H',rank:2},{suit:'C',rank:10}),1);
  assert.equal(root.compare({suit:'H',rank:10},{suit:'C',rank:12}),-1);
});

test('7.5-G 실제 판정 코드에는 한쪽 트럼프 자동 승리 분기가 남지 않는다',()=>{
  const core=fs.readFileSync(path.join(__dirname,'..','battle-core.js'),'utf8');
  const encounter=fs.readFileSync(path.join(__dirname,'..','encounter-rules.js'),'utf8');
  assert.doesNotMatch(core,/playerTrump\s*!==\s*enemyTrump/);
  assert.doesNotMatch(encounter,/return\s+playerTrump\s*\?\s*1\s*:\s*-1/);
  assert.match(core,/DEFAULT_TRUMP_BONUS=3/);
});
