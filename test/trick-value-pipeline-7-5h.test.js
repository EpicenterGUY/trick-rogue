const test=require('node:test');
const assert=require('node:assert/strict');
const BattleCore=require('../battle-core.js');

test('7.5-H 무늬 변경을 먼저 확정한 뒤 트럼프 +3과 숫자 보정을 적용한다',()=>{
  const card=BattleCore.effectiveCard({rank:8,suit:'H'},{suit:'S',rankModifier:2});
  const trace=BattleCore.resolveTrickValue(card,'S');
  assert.equal(trace.printedRank,8);
  assert.equal(trace.printedSuit,'H');
  assert.equal(trace.effectiveSuit,'S');
  assert.equal(trace.trumpApplied,true);
  assert.equal(trace.trumpBonus,3);
  assert.equal(trace.cardRankModifier,2);
  assert.equal(trace.valueAfterTrump,11);
  assert.equal(trace.valueAfterCardEffects,13);
  assert.equal(trace.finalValue,13);
  assert.deepEqual(trace.stages.map(stage=>stage.id),['printed','suit','trump','number','status_field']);
});

test('7.5-H 원래 트럼프 무늬여도 효과로 무늬가 바뀌면 트럼프 보너스를 잃는다',()=>{
  const changed=BattleCore.effectiveCard({rank:10,suit:'S'},{suit:'H'});
  const trace=BattleCore.resolveTrickValue(changed,'S');
  assert.equal(trace.printedSuit,'S');
  assert.equal(trace.effectiveSuit,'H');
  assert.equal(trace.trumpApplied,false);
  assert.equal(trace.trumpBonus,0);
  assert.equal(trace.finalValue,10);
});

test('7.5-H 카드 숫자 보정 뒤 상태와 필드 보정을 마지막 단계에서 합산한다',()=>{
  const card=BattleCore.effectiveCard({rank:11,suit:'D'},{rankModifier:3});
  const trace=BattleCore.resolveTrickValue(card,'D',{statusModifier:-2,fieldModifier:4});
  assert.equal(trace.valueAfterTrump,14);
  assert.equal(trace.valueAfterCardEffects,17);
  assert.equal(trace.statusModifier,-2);
  assert.equal(trace.fieldModifier,4);
  assert.equal(trace.finalValue,19);
});

test('7.5-H 플레이어와 적은 같은 계산기를 쓰되 각자 다른 상태/필드 보정을 받을 수 있다',()=>{
  const player={rank:9,suit:'S'};
  const enemy={rank:13,suit:'H'};
  assert.equal(BattleCore.compareTrick(player,enemy,'S'),-1);
  assert.equal(BattleCore.compareTrick(player,enemy,'S',{
    player:{statusModifier:2},
    enemy:{fieldModifier:-1}
  }),1);
  assert.equal(BattleCore.resolveTrickValue(player,'S',{statusModifier:2}).finalValue,14);
  assert.equal(BattleCore.resolveTrickValue(enemy,'S',{fieldModifier:-1}).finalValue,12);
});

test('7.5-H 적용 숫자는 14를 넘을 수 있고 쇼다운 인쇄값은 변하지 않는다',()=>{
  const card=BattleCore.effectiveCard({rank:14,suit:'C'},{rankModifier:4});
  const trace=BattleCore.resolveTrickValue(card,'C',{statusModifier:1,fieldModifier:2});
  assert.equal(trace.finalValue,24);
  assert.equal(card.trickRank,18);
  assert.equal(BattleCore.showdownValue(card,'Rank'),14);
  assert.equal(BattleCore.showdownValue(card,'Suit'),'C');
});

test('7.5-H 기존 modifier 옵션도 트럼프 뒤 기타 숫자 보정으로 호환한다',()=>{
  const trace=BattleCore.resolveTrickValue({rank:7,suit:'H'},'H',{modifier:5});
  assert.equal(trace.trumpBonus,3);
  assert.equal(trace.otherNumberModifier,5);
  assert.equal(trace.finalValue,15);
  assert.equal(BattleCore.trickValue({rank:7,suit:'H'},'H',{modifier:5}),15);
});

test('7.5-H 브라우저 카드 상세는 단계별 최종 적용값 계산선을 보여준다',()=>{
  BattleCore.resetBrowserTrumpAdapterForTests();
  const elements={inspectApply:{textContent:''},trumpText:{textContent:'♠'}};
  const root={
    document:{
      getElementById(id){return elements[id]||null},
      querySelector(){return null},
      querySelectorAll(){return[]}
    },
    BattleCore,
    battle:{trump:'S',mods:{plus:2,paint:true,reverse:false}},
    effective(card){return BattleCore.effectiveCard(card)},
    compare(){return 0},
    inspectCard(){elements.inspectApply.textContent='인쇄 ♥8'},
    renderBattle(){},
    showTerm(){},
    showTerms(){}
  };
  assert.equal(BattleCore.installBrowserTrumpAdapter(root),true);
  root.inspectCard({rank:8,suit:'H'},false);
  assert.match(elements.inspectApply.textContent,/무늬 ♥→♠/);
  assert.match(elements.inspectApply.textContent,/트럼프 \+3/);
  assert.match(elements.inspectApply.textContent,/숫자 \+2/);
  assert.match(elements.inspectApply.textContent,/최종 13/);
});
