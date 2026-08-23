const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');

function constantRng(value){return()=>value}

test('8-A 시작 카드군은 무소속을 포함하고 모두 12장 · 순수 7~8 · 핵심 4~5 구성을 지킨다',()=>{
  assert.ok(RunStart.STARTERS.some(starter=>starter.id==='free'));
  assert.equal(RunStart.validateStarterRegistry(Cards).length,0);
  for(const starter of RunStart.STARTERS){
    assert.equal(RunStart.starterCardCount(starter),12);
    assert.ok(starter.pureSlots.length>=7&&starter.pureSlots.length<=8);
    assert.ok(starter.effectCardIds.length>=4&&starter.effectCardIds.length<=5);
  }
});

test('8-A 스타터 덱은 실제 52장 규격 카드만 만들고 순수 카드를 충분히 남긴다',()=>{
  for(const starter of RunStart.STARTERS){
    const deck=RunStart.buildStarterDeck(starter.id,Cards,{});
    assert.equal(deck.length,12);
    assert.equal(deck.filter(Cards.isPureCard).length,starter.pureSlots.length);
    for(const card of deck){
      assert.ok(['S','H','D','C'].includes(card.suit));
      assert.ok(Number.isInteger(card.rank));
      assert.ok(card.rank>=2&&card.rank<=14);
    }
  }
});

test('시작 특성은 무작위 후보 3개를 중복 없이 제시하고 그중 하나를 선택하는 구조다',()=>{
  const offers=RunStart.offerTraits(constantRng(0),3);
  assert.equal(offers.length,3);
  assert.equal(new Set(offers.map(trait=>trait.id)).size,3);
  const selection=RunStart.createSelection(constantRng(0));
  assert.equal(selection.traitOfferIds.length,3);
  assert.ok(selection.traitOfferIds.includes(selection.traitId));
});

test('런 정체성은 고정 캐릭터 대신 시작 카드군 + 시작 특성을 저장한다',()=>{
  const run={hp:1,maxHp:1,gold:1,deck:[]};
  RunStart.applyIdentityToRun(run,{starterId:'free',traitId:'extra_gold'},Cards,{});
  assert.equal(run.starterId,'free');
  assert.equal(run.traitId,'extra_gold');
  assert.deepEqual(run.identity,{starterId:'free',traitId:'extra_gold'});
  assert.equal(run.deck.length,12);
  assert.equal(run.hp,60);
  assert.equal(run.maxHp,60);
  assert.equal(run.gold,80);
  assert.equal(run.char.id,'starter_identity');
  assert.equal(run.char.compatibilityOnly,true);
  assert.equal(run.pack.compatibilityOnly,true);
});

test('튼튼한 몸 특성은 특정 카드군을 강제하지 않고 시작 체력만 단순 보정한다',()=>{
  const run={hp:60,maxHp:60,gold:60};
  RunStart.applyTraitToRun(run,'durable');
  assert.equal(run.hp,66);
  assert.equal(run.maxHp,66);
  assert.equal(run.gold,60);
});

test('선행 관측 특성은 전투 시작 예측만 올리고 같은 전투에 중복 적용되지 않는다',()=>{
  const battle={myForecast:0,enemyForecast:0,maxChip:5,chip:0};
  const first=RunStart.applyTraitToBattle(battle,'foresight',{});
  const second=RunStart.applyTraitToBattle(battle,'foresight',{});
  assert.equal(first.forecast,1);
  assert.equal(battle.myForecast,1);
  assert.equal(battle.enemyForecast,1);
  assert.equal(second.duplicate,true);
  assert.equal(battle.myForecast,1);
});

test('비상용 칩 특성은 칩 경제 공식 경로를 사용해 전투 시작 칩을 지급한다',()=>{
  const battle={maxChip:5,chip:0};
  const root={ChipEconomy:{grantChips(state,amount){const before=state.chip;state.chip=Math.min(state.maxChip,state.chip+amount);return{gained:state.chip-before}}}};
  const result=RunStart.applyTraitToBattle(battle,'pocket_chip',root);
  assert.equal(result.chips,1);
  assert.equal(battle.chip,1);
});

test('카드군은 클래스가 아니므로 다른 카드군/무소속 카드 획득을 차단하지 않는다',()=>{
  assert.equal(RunStart.canAcquireCard({starterId:'sniper'},{cardId:'anything'}),true);
  assert.equal(RunStart.canAcquireCard({starterId:'photographer'},{cardId:'neutral'}),true);
});

test('브라우저 beginRun 어댑터는 기존 런 초기화 뒤 새 시작 정체성과 12장 스타터를 덮어쓴다',()=>{
  RunStart.resetForTests();
  RunStart.resetSelection(constantRng(0));
  const root={
    ...Cards,
    run:null,
    beginRun(){this.run={hp:62,maxHp:62,gold:60,deck:Cards.createBaseCardSlots(),char:{id:'keeper'},pack:{id:'steady'}};return this.run},
    renderMap(){this.rendered=(this.rendered||0)+1}
  };
  assert.equal(RunStart.wrapBeginRun(root),true);
  root.beginRun();
  assert.equal(root.run.deck.length,12);
  assert.equal(root.run.starterId,'free');
  assert.ok(root.run.traitId);
  assert.equal(root.run.char.id,'starter_identity');
  assert.equal(root.rendered,1);
});

test('8-A 런타임은 적 부분정보·덱 경계 등 기존 전투 어댑터 뒤, 최종 전투 레이아웃 전에 로드된다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/enemy-information\.js/);
  assert.match(source,/run-start-v2\.js/);
  assert.match(source,/battle-layout\.js/);
  assert.match(source,/function loadRunStartV2\(\)/);
  assert.match(source,/if\(root\.EnemyInformation\)\{loadRunStartV2\(\);return;\}/);
  assert.match(source,/loadScript\('run-start-v2\.js','trick-run-start-v2-runtime'/);
  assert.match(source,/if\(root\.RunStartV2\)\{loadBattleLayoutFinal\(\);return;\}/);
});
