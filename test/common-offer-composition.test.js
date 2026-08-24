const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');
const RunFlow=require('../run-flow-v2.js');
const Relics=require('../relics.js');
const Economy=require('../run-economy-v2.js');

function seq(values){let i=0;return()=>values[i++%values.length]}
function pure(suit='S',rank=8,id='p'){return Cards.createCardRecord({suit,rank,metadata:{uid:id}})}
function commonRun(seed=123){return{runSeed:seed,actId:'common',runFlow:{phase:'common'},gold:200,hp:60,maxHp:60,deck:[pure('S',8,'a'),pure('H',8,'b'),pure('D',8,'c'),pure('C',8,'d'),pure('S',9,'e'),pure('H',9,'f')],relics:[]}}
function regionRun(seed=123){return{runSeed:seed,actId:'region_theater',gold:200,hp:60,maxHp:60,deck:[pure('S',8,'a'),pure('H',8,'b'),pure('D',8,'c'),pure('C',8,'d'),pure('S',9,'e'),pure('H',9,'f')],relics:[]}}
function runtime(run){return{run,RunStartV2:RunStart,RunFlowV2:RunFlow,RelicSystem:Relics,...Cards,newUid:(()=>{let n=0;return()=>`u${++n}`})()}}
function assertCommonComposition(offer){
  assert.equal(offer.length,3);
  assert.equal(new Set(offer.map(card=>card.key)).size,3);
  assert.ok(offer.some(card=>card.kind==='pure'),'순수 카드가 최소 1장이어야 함');
  assert.ok(offer.some(card=>card.kind==='definition'),'공용 효과 카드가 최소 1장이어야 함');
  const allowed=new Set(RunStart.COMMON_CARD_POOL_IDS);
  assert.ok(offer.filter(card=>card.kind==='definition').every(card=>allowed.has(card.definitionId)));
  assert.equal(offer.some(card=>card.definitionId?.startsWith('pack01.')||card.definitionId?.startsWith('pack02.')),false);
}

test('공통지역 3장 보상은 RNG와 무관하게 순수 1장과 공용 효과 1장을 최소 보장한다',()=>{
  const patterns=[
    [.01,.02,.03,.04,.05],
    [.99,.98,.97,.96,.95],
    [.12,.87,.33,.71,.44],
    [.5,.5,.5,.5,.5]
  ];
  for(const [index,pattern] of patterns.entries()){
    const run=commonRun(100+index),root=runtime(run),node={id:`reward-${index}`,type:'battle'};
    const offer=Economy.generateCardOffer(run,node,{count:3,rng:seq(pattern),runtimeRoot:root});
    assertCommonComposition(offer);
  }
});

test('공통지역 상점의 카드 3장도 전투 보상과 같은 순수/효과 최소 구성을 사용한다',()=>{
  for(const seed of [1,2,3,99,777]){
    const run=commonRun(seed),root=runtime(run),node={id:`shop-${seed}`,type:'shop'};
    const shop=Economy.createShopState(run,node,{runtimeRoot:root});
    assertCommonComposition(shop.cardOffers);
  }
});

test('공통지역의 실제 61종 풀 자체는 52 순수 + 9 공용 효과로 유지된다',()=>{
  const run=commonRun(),root=runtime(run),pools=Economy.rewardPools(run,{id:'pool',type:'battle'},root);
  assert.equal(pools.catalog.length,61);
  assert.equal(pools.catalog.filter(card=>card.kind==='pure').length,52);
  assert.equal(pools.catalog.filter(card=>card.kind==='definition').length,9);
});

test('1장만 요청하는 내부 호출에는 두 종류 보장 규칙을 강제하지 않는다',()=>{
  const run=commonRun(),root=runtime(run),node={id:'single',type:'battle'};
  const offer=Economy.generateCardOffer(run,node,{count:1,rng:()=>0,runtimeRoot:root});
  assert.equal(offer.length,1);
  assert.equal(new Set(offer.map(card=>card.key)).size,1);
});

test('지역 진입 후 보상은 기존 65/35 지역 경향 판정을 그대로 사용한다',()=>{
  const run=regionRun(),root=runtime(run),node={id:'region',type:'battle',regionPlan:{regionId:'region_theater',rewardWeights:{neutral:.65,theme:.35}}};
  const pools=Economy.rewardPools(run,node,root);
  assert.equal(pools.openingCommon,false);
  assert.deepEqual(pools.weights,{neutral:.65,theme:.35});
  const theme=Economy.generateCardOffer(run,node,{count:1,rng:seq([.90,.10]),runtimeRoot:root});
  const neutral=Economy.generateCardOffer(run,node,{count:1,rng:seq([.10,.10]),runtimeRoot:root});
  assert.equal(theme[0].sourceCategory,'theme');
  assert.equal(neutral[0].sourceCategory,'neutral');
});
