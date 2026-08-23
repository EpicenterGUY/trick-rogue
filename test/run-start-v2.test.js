const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');

function constantRng(value){return()=>value}

test('8-A 새 런은 특정 카드군 대신 공용 스타터 1종만 노출하고 12장 · 순수 6~8 · 공용 효과 4~6 규칙을 지킨다',()=>{
  assert.equal(RunStart.STARTERS.length,1);
  assert.equal(RunStart.STARTERS[0].id,'common');
  assert.equal(RunStart.validateStarterRegistry(Cards).length,0);
  const starter=RunStart.STARTERS[0];
  assert.equal(RunStart.starterCardCount(starter),12);
  assert.ok(starter.pureSlots.length>=6&&starter.pureSlots.length<=8);
  assert.ok(starter.effectCardIds.length>=4&&starter.effectCardIds.length<=6);
  const commonPool=new Set(RunStart.commonCardPoolIds(Cards));
  assert.ok(starter.effectCardIds.every(id=>commonPool.has(id)));
});

test('구버전 무소속/저격수/사진가 스타터는 삭제하지 않고 숨김 보관하며 새 런에서는 공용 스타터로 치환한다',()=>{
  assert.deepEqual(RunStart.ARCHIVED_STARTERS.map(starter=>starter.id),['free','sniper','photographer']);
  assert.ok(RunStart.ARCHIVED_STARTERS.every(starter=>starter.hidden===true&&starter.archived===true));
  assert.equal(RunStart.STARTERS.some(starter=>['free','sniper','photographer'].includes(starter.id)),false);
  for(const legacyId of ['free','sniper','photographer']){
    assert.equal(RunStart.normalizeStarterId(legacyId),'common');
    assert.equal(RunStart.starterDefinition(legacyId).id,'common');
    assert.equal(RunStart.archivedStarterDefinition(legacyId).id,legacyId);
  }
});

test('공용 스타터 덱은 실제 52장 규격 12장이고 순수 7장 + 공용 효과 5장으로 손패 순환과 칩 활용을 포함한다',()=>{
  const deck=RunStart.buildStarterDeck('common',Cards,{});
  assert.equal(deck.length,12);
  assert.equal(deck.filter(Cards.isPureCard).length,7);
  const effectIds=deck.filter(card=>card.definition).map(card=>card.definition.id);
  assert.deepEqual(effectIds,RunStart.COMMON_STARTER_EFFECT_CARD_IDS);
  assert.ok(effectIds.includes('core.draw'));
  assert.ok(effectIds.includes('core.burn'));
  assert.ok(effectIds.includes('core.clean'));
  for(const card of deck){
    assert.ok(['S','H','D','C'].includes(card.suit));
    assert.ok(Number.isInteger(card.rank));
    assert.ok(card.rank>=2&&card.rank<=14);
  }
});

test('초반 공통지역 카드풀은 general/common 공용 효과 카드만 쓰고 네임드·지역 카드 보상은 노출하지 않는다',()=>{
  const named=Cards.rewardCardIds(Cards.defaultEnabledPacks());
  const opening=RunStart.rewardPoolForRun({actId:'common',runFlow:{phase:'common'}},{cardsApi:Cards,namedRewardIds:named});
  assert.deepEqual(opening,RunStart.commonCardPoolIds(Cards));
  assert.ok(opening.length>=RunStart.COMMON_STARTER_EFFECT_CARD_IDS.length);
  assert.ok(opening.every(id=>Cards.CARD_DEFINITION_BY_ID[id]?.category==='general'));
  assert.ok(opening.every(id=>Cards.CARD_DEFINITION_BY_ID[id]?.rarity==='common'));
  assert.equal(opening.some(id=>named.includes(id)),false);

  const later=RunStart.rewardPoolForRun({actId:'region_frontier',runFlow:{phase:'region'}},{cardsApi:Cards,namedRewardIds:named});
  assert.deepEqual(later,named,'지역 진입 뒤 기존 네임드/지역 카드 정의는 그대로 보관한다');
});

test('시작 특성은 무작위 후보 3개를 중복 없이 제시하고 그중 하나를 선택하는 구조다',()=>{
  const offers=RunStart.offerTraits(constantRng(0),3);
  assert.equal(offers.length,3);
  assert.equal(new Set(offers.map(trait=>trait.id)).size,3);
  const selection=RunStart.createSelection(constantRng(0));
  assert.equal(selection.starterId,'common');
  assert.equal(selection.traitOfferIds.length,3);
  assert.ok(selection.traitOfferIds.includes(selection.traitId));
});

test('런 정체성은 공용 시작 덱 + 시작 특성을 저장하고 구버전 스타터 요청도 공용으로 정규화한다',()=>{
  const run={hp:1,maxHp:1,gold:1,deck:[]};
  RunStart.applyIdentityToRun(run,{starterId:'sniper',traitId:'extra_gold'},Cards,{});
  assert.equal(run.starterId,'common');
  assert.equal(run.traitId,'extra_gold');
  assert.deepEqual(run.identity,{starterId:'common',traitId:'extra_gold'});
  assert.equal(run.deck.length,12);
  assert.equal(run.hp,60);
  assert.equal(run.maxHp,60);
  assert.equal(run.gold,80);
  assert.equal(run.char.id,'starter_identity');
  assert.equal(run.char.compatibilityOnly,true);
  assert.equal(run.pack.name,'공용 시작 덱');
  assert.equal(run.pack.compatibilityOnly,true);
});

test('튼튼한 몸 특성은 카드풀을 강제하지 않고 시작 체력만 단순 보정한다',()=>{
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

test('공용 스타터는 클래스가 아니므로 이후 어떤 카드도 획득 차단하지 않는다',()=>{
  assert.equal(RunStart.canAcquireCard({starterId:'common'},{cardId:'anything'}),true);
  assert.equal(RunStart.canAcquireCard({starterId:'common'},{cardId:'pack01.black_bullet'}),true);
});

test('공통지역 showReward 래퍼는 기존 네임드 보상 화면 대신 공용 효과 카드 3장 화면을 사용하고 지역에서는 원본으로 돌아간다',()=>{
  RunStart.resetForTests();
  const node={id:'c0'},calls={legacy:0,html:''};
  const root={
    ...Cards,
    run:{actId:'common',runFlow:{phase:'common'},deck:RunStart.buildStarterDeck('common',Cards,{}),map:[node]},
    Math:{random:constantRng(0)},
    makeGeneral(id){return Cards.createDefinitionCard(id,{uid:`reward-${id}`})},
    artHtml(){return'<span>card</span>'},
    showModal(html){calls.html=html},
    showReward(){calls.legacy++}
  };
  assert.equal(RunStart.wrapShowReward(root),true);
  root.showReward(node);
  assert.equal(calls.legacy,0);
  assert.match(calls.html,/공통지역 카드 보상/);
  assert.match(calls.html,/공용 효과 카드/);
  assert.match(calls.html,/RunStartV2\.takeOpeningReward/);

  root.run.actId='region_frontier';root.run.runFlow.phase='region';root.showReward(node);
  assert.equal(calls.legacy,1);
});

test('공통지역 보상 선택은 공용 효과 카드를 실제 일반 효과 카드 형태로 덱에 추가한다',()=>{
  const node={id:'c0'},calls={close:0,complete:0};
  const run={actId:'common',runFlow:{phase:'common'},deck:RunStart.buildStarterDeck('common',Cards,{}),map:[node]};
  const root={
    ...Cards,run,
    makeGeneral(id){return Cards.createDefinitionCard(id,{uid:`picked-${id}`})},
    closeOverlay(){calls.close++},
    completeNode(picked){assert.equal(picked,node);calls.complete++}
  };
  const before=run.deck.length,result=RunStart.takeOpeningReward('core.scout','add','c0',root);
  assert.equal(result.ok,true);
  assert.equal(run.deck.length,before+1);
  assert.equal(run.deck.at(-1).definition.id,'core.scout');
  assert.equal(run.deck.at(-1).named,null);
  assert.equal(calls.close,1);
  assert.equal(calls.complete,1);
});

test('브라우저 beginRun 어댑터는 기존 런 초기화 뒤 공용 시작 정체성과 12장 스타터를 덮어쓴다',()=>{
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
  assert.equal(root.run.starterId,'common');
  assert.ok(root.run.traitId);
  assert.equal(root.run.char.id,'starter_identity');
  assert.equal(root.rendered,1);
});

test('8-A 시작 정체성 뒤 8-B 런 흐름과 8-C 경제 계층을 거쳐 최종 전투 레이아웃을 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/enemy-information\.js/);
  assert.match(source,/run-start-v2\.js/);
  assert.match(source,/run-flow-v2\.js/);
  assert.match(source,/run-economy-v2\.js/);
  assert.match(source,/battle-layout\.js/);
  assert.match(source,/function loadRunStartV2\(\)/);
  assert.match(source,/function loadRunFlowV2\(\)/);
  assert.match(source,/function loadRunEconomyV2\(\)/);
  assert.match(source,/if\(root\.EnemyInformation\)\{loadRunStartV2\(\);return;\}/);
  assert.match(source,/loadScript\('run-start-v2\.js','trick-run-start-v2-runtime'/);
  assert.match(source,/if\(root\.RunStartV2\)\{loadRunFlowV2\(\);return;\}/);
  assert.match(source,/loadScript\('run-flow-v2\.js','trick-run-flow-v2-runtime'/);
  assert.match(source,/if\(root\.RunFlowV2\)\{loadRunEconomyV2\(\);return;\}/);
  assert.match(source,/loadScript\('run-economy-v2\.js','trick-run-economy-v2-runtime'/);
  assert.match(source,/if\(root\.RunEconomyV2\)\{finishRunEconomyV2\(\);return;\}/);
});
