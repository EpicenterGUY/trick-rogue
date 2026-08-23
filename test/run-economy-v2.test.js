const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const BattleCore=require('../battle-core.js');
const RunFlow=require('../run-flow-v2.js');
const Relics=require('../relics.js');
const Economy=require('../run-economy-v2.js');

function seq(values){let i=0;return()=>values[i++%values.length]}
function pure(suit='S',rank=8,id='p'){return Cards.createCardRecord({suit,rank,metadata:{uid:id}})}
function runState(overrides={}){return{runSeed:123,actId:'region_theater',gold:200,hp:30,maxHp:60,deck:[pure('S',8,'a'),pure('H',8,'b'),pure('D',8,'c'),pure('C',8,'d'),pure('S',9,'e'),pure('H',9,'f')],relics:[],...overrides}}
function regionNode(id='r1',type='battle'){return{id,type,regionPlan:{regionId:'region_theater',rewardWeights:{neutral:.65,theme:.35}}}}
function runtime(run){return{run,RunFlowV2:RunFlow,RelicSystem:Relics,...Cards,newUid:(()=>{let n=0;return()=>`u${++n}`})()}}

test('8-C 카드 보상 후보 풀은 네임드/일반 효과 카드와 순수 카드를 함께 포함한다',()=>{
  const catalog=Economy.candidateCatalog(Cards);
  assert.ok(catalog.some(item=>item.kind==='definition'&&item.definitionId==='core.paint'));
  assert.ok(catalog.some(item=>item.kind==='definition'&&item.definitionId==='pack01.black_bullet'));
  assert.ok(catalog.some(item=>item.kind==='pure'));
});

test('지역 카드 보상은 65/35 경향을 실제 후보 선택에 사용하되 다른 카드군을 차단하지 않는다',()=>{
  const run=runState(),node=regionNode();
  const theme=Economy.generateCardOffer(run,node,{count:1,rng:seq([.90,.10]),runtimeRoot:runtime(run)});
  const neutral=Economy.generateCardOffer(run,node,{count:1,rng:seq([.10,.10]),runtimeRoot:runtime(run)});
  assert.equal(theme[0].sourceCategory,'theme');
  assert.equal(neutral[0].sourceCategory,'neutral');
  assert.ok(Economy.rewardPools(run,node,runtime(run)).neutral.some(item=>item.definitionId==='core.scout'));
});

test('전투 카드 보상은 노드마다 결정적으로 3장을 고정하고 중복 후보를 만들지 않는다',()=>{
  const run=runState(),node=regionNode(),root=runtime(run);
  const first=Economy.ensureRewardOffer(run,node,root),second=Economy.ensureRewardOffer(run,node,root);
  assert.equal(first.length,3);
  assert.deepEqual(first,second);
  assert.equal(new Set(first.map(item=>item.key)).size,3);
});

test('전투 보상은 1장만 추가할 수 있고 건너뛰기는 덱과 골드를 바꾸지 않는다',()=>{
  const a=runState(),node=regionNode(),root=runtime(a),offer=Economy.ensureRewardOffer(a,node,root),before=a.deck.length;
  const claimed=Economy.claimCardReward(a,node,offer[0].key,{runtimeRoot:root});
  assert.equal(claimed.ok,true);assert.equal(a.deck.length,before+1);
  assert.equal(Economy.claimCardReward(a,node,offer[1].key,{runtimeRoot:root}).reason,'claimed');

  const b=runState({gold:77}),rootB=runtime(b),beforeB=b.deck.length;
  assert.equal(Economy.skipCardReward(b,node).ok,true);
  assert.equal(b.deck.length,beforeB);assert.equal(b.gold,77);
});

test('1단계 강화는 인쇄값/쇼다운값을 보존하고 트릭 적용 숫자만 +1하며 순수 카드 분류를 유지한다',()=>{
  const card=pure('S',8,'upgrade'),printed={suit:card.printedSuit,rank:card.printedRank};
  assert.equal(Cards.isPureCard(card),true);
  assert.equal(Economy.upgradeCard(card).ok,true);
  assert.equal(card.upgradeLevel,1);assert.equal(card.effectiveRankBonus,1);assert.equal(card.trickRankModifier,1);
  assert.deepEqual({suit:card.printedSuit,rank:card.printedRank},printed);
  assert.equal(BattleCore.showdownValue(card,'Rank'),8);
  assert.equal(BattleCore.resolveTrickValue(card,'H').finalValue,9);
  assert.equal(Cards.isPureCard(card),true);
  assert.equal(Economy.upgradeCard(card).reason,'max_upgrade');
});

test('캠프 휴식은 최대 체력의 30%를 회복하되 최대 체력을 넘지 않는다',()=>{
  const run=runState({hp:50,maxHp:60});
  assert.equal(Economy.campHeal(run),10);assert.equal(run.hp,60);
  assert.equal(Economy.campHeal(run),0);assert.equal(run.hp,60);
});

test('상점 카드 목록은 같은 노드에서 고정되고 카드 구매는 45G를 한 번만 지불한다',()=>{
  const run=runState(),node=regionNode('shop1','shop'),root=runtime(run);
  const first=Economy.createShopState(run,node,{runtimeRoot:root}),again=Economy.createShopState(run,node,{runtimeRoot:root});
  assert.equal(first,again);assert.equal(first.cardOffers.length,3);
  const key=first.cardOffers[0].key,before=run.deck.length;
  assert.equal(Economy.buyShopCard(run,node,key,{runtimeRoot:root}).ok,true);
  assert.equal(run.gold,155);assert.equal(run.deck.length,before+1);
  assert.equal(Economy.buyShopCard(run,node,key,{runtimeRoot:root}).reason,'purchased');assert.equal(run.gold,155);
});

test('상점 유물은 미보유 유물 하나를 80G에 판매하고 중복 구매하지 않는다',()=>{
  const run=runState(),node=regionNode('shop2','shop'),root=runtime(run),shop=Economy.createShopState(run,node,{runtimeRoot:root});
  assert.ok(shop.relicId);const id=shop.relicId;
  const result=Economy.buyShopRelic(run,node,{runtimeRoot:root});
  assert.equal(result.ok,true);assert.equal(run.gold,120);assert.ok(run.relics.some(relic=>relic.id===id));
  assert.equal(Economy.buyShopRelic(run,node,{runtimeRoot:root}).reason,'purchased');
});

test('상점 카드 제거는 모든 카드에 열려 있고 45G/상점당 1회/최소 5장 경계를 지킨다',()=>{
  const run=runState(),node=regionNode('shop3','shop'),root=runtime(run),removed=run.deck[2];
  const result=Economy.removeShopCard(run,node,2,{runtimeRoot:root});
  assert.equal(result.ok,true);assert.equal(result.card,removed);assert.equal(run.gold,155);assert.equal(run.deck.length,5);
  assert.equal(Economy.removeShopCard(run,node,0,{runtimeRoot:root}).reason,'used');
  const fresh=runState({deck:[pure('S',2),pure('H',2),pure('D',2),pure('C',2),pure('S',3)]});
  assert.equal(Economy.removeShopCard(fresh,regionNode('shop4','shop'),0,{runtimeRoot:runtime(fresh)}).reason,'minimum');
});

test('엘리트/보스는 유물 보상을 먼저 유지하고 일반전은 바로 8-C 카드 보상으로 간다',()=>{
  Economy.resetForTests();
  const run=runState(),calls=[];
  const root={run,RunFlowV2:RunFlow,RelicSystem:{isRelicRewardNode:node=>node.type!=='battle',rewardClaimed:()=>false},showReward(node){calls.push(`legacy:${node.type}`)},showCamp(){},showShop(){},beginRun(){},showModal(){}};
  Economy.wrapShowReward(root);
  root.showReward(regionNode('n','battle'));assert.equal(calls.length,0);assert.ok(run.economyState.rewards.n);
  root.showReward(regionNode('e','elite'));assert.deepEqual(calls,['legacy:elite']);
});

test('8-C 브라우저 로더는 8-B 런 흐름 뒤 경제 계층을 거쳐 최종 전투 레이아웃으로 간다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/run-economy-v2\.js/);
  assert.match(source,/if\(root\.RunFlowV2\)\{loadRunEconomyV2\(\);return;\}/);
  assert.match(source,/if\(root\.RunEconomyV2\)/);
  assert.match(source,/RelicSystem\?\.wrapShowReward/);
});
