const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Retirement=require('../legacy-tactic-retirement.js');

function plainCard(uid){return{uid,suit:'S',rank:7,named:null,definition:null,cardId:null,effects:[]}}

test('3-3A 시작 패키지는 레거시 전술 10장 대신 일반 효과 카드 10장을 지정한다',()=>{
  for(const [packId,ids] of Object.entries(Retirement.PACKAGE_CARD_IDS)){
    assert.equal(ids.length,10,packId);
    for(const id of ids){
      const def=Cards.CARD_DEFINITION_BY_ID[id];
      assert(def,`${packId}: ${id}`);
      assert.equal(def.category,'general',id);
      assert(def.effects.length>0,id);
    }
  }
});

test('시작 패키지 적용은 덱 크기를 유지하면서 효과 없는 카드 10장을 효과 카드로 교체한다',()=>{
  const deck=Array.from({length:20},(_,i)=>plainCard(`plain-${i}`));
  const before=deck.length;
  const replaced=Retirement.applyPackageToDeck(deck,'steady',Cards);
  assert.equal(replaced,10);
  assert.equal(deck.length,before);
  assert.equal(deck.filter(card=>card.definition?.legacyTacticId).length,10);
  assert.equal(deck.filter(Retirement.isPlainCard).length,10);
});

test('런과 전투의 레거시 전술 상태는 빈 호환 상태로 은퇴한다',()=>{
  const run={tactics:[{id:'paint'}]};
  const battle={tdeck:[1],thand:[2],tdisc:[3],selectedTactic:'x',tacticsOpen:true,tacticUsing:true};
  Retirement.retireRunTactics(run);
  Retirement.retireBattleTactics(battle);
  assert.deepEqual(run.tactics,[]);
  assert.equal(run.tacticSystemRetired,true);
  assert.deepEqual(battle.tdeck,[]);
  assert.deepEqual(battle.thand,[]);
  assert.deepEqual(battle.tdisc,[]);
  assert.equal(battle.selectedTactic,null);
  assert.equal(battle.tacticsOpen,false);
  assert.equal(battle.tacticUsing,false);
  assert.equal(battle.tacticSystemRetired,true);
});

test('황금손은 전술 드로우 대신 다음 트릭 손패 +1로 재설계되고 재귀 함수 설명에서 전술 의존이 사라진다',()=>{
  const golden=Cards.CARD_DEFINITION_BY_ID['pack01.golden_hand'];
  const recursive=Cards.CARD_DEFINITION_BY_ID['pack01.recursive_function'];
  const goldenDetail=Cards.CARD_DETAIL_BY_ID['pack01.golden_hand'];
  const recursiveDetail=Cards.CARD_DETAIL_BY_ID['pack01.recursive_function'];
  const snapshot={
    goldenEffects:golden.effects,goldenDescription:golden.description,goldenTerms:golden.terms,
    goldenDetail:{...goldenDetail},recursiveDescription:recursive.description,recursiveTerms:recursive.terms,recursiveDetail:{...recursiveDetail}
  };
  try{
    assert.equal(Retirement.patchNamedDefinitions(Cards),true);
    assert.deepEqual(golden.effects.map(effect=>effect.action),['gain_chips','grant_next_trick_hand_capacity']);
    assert.equal(golden.effects.some(effect=>effect.action==='draw_tactic'),false);
    assert.match(goldenDetail.effect,/다음 트릭/);
    assert.doesNotMatch(goldenDetail.effect,/전술/);
    assert.doesNotMatch(recursiveDetail.extra,/전술/);
  }finally{
    golden.effects=snapshot.goldenEffects;golden.description=snapshot.goldenDescription;golden.terms=snapshot.goldenTerms;
    Object.assign(goldenDetail,snapshot.goldenDetail);
    recursive.description=snapshot.recursiveDescription;recursive.terms=snapshot.recursiveTerms;
    Object.assign(recursiveDetail,snapshot.recursiveDetail);
  }
});

test('마이그레이션 런타임은 브라우저에서 3-3A 은퇴 런타임을 자동 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','migrated-tactic-runtime.js'),'utf8');
  assert.match(source,/legacy-tactic-retirement\.js/);
  assert.match(source,/loadRetirementRuntime/);
});

test('3-3A 은퇴 런타임은 전술 UI 숨김, 시작 패키지, 상점 정찰 카드 전환 어댑터를 제공한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','legacy-tactic-retirement.js'),'utf8');
  for(const token of ['hideTacticUi','applyStartingPackage','installShopAdapter','core.scout','tacticSystemRetired'])assert.match(source,new RegExp(token));
});
