const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const BattleCore=require('../battle-core.js');
const RunStart=require('../run-start-v2.js');
const RunFlow=require('../run-flow-v2.js');
const Relics=require('../relics.js');
const Economy=require('../run-economy-v2.js');

function seq(values){let i=0;return()=>values[i++%values.length]}
function pure(suit='S',rank=8,id='p'){return Cards.createCardRecord({suit,rank,metadata:{uid:id}})}
function runState(overrides={}){return{runSeed:123,actId:'region_theater',gold:200,hp:30,maxHp:60,deck:[pure('S',8,'a'),pure('H',8,'b'),pure('D',8,'c'),pure('C',8,'d'),pure('S',9,'e'),pure('H',9,'f')],relics:[],...overrides}}
function regionNode(id='r1',type='battle'){return{id,type,regionPlan:{regionId:'region_theater',rewardWeights:{neutral:.65,theme:.35}}}}
function runtime(run){return{run,RunStartV2:RunStart,RunFlowV2:RunFlow,RelicSystem:Relics,...Cards,newUid:(()=>{let n=0;return()=>`u${++n}`})()}}

test('8-C 전체 카드 카탈로그는 네임드/일반 효과 카드와 순수 카드를 함께 보관한다',()=>{
  const catalog=Economy.candidateCatalog(Cards);
  assert.ok(catalog.some(item=>item.kind==='definition'&&item.definitionId==='core.paint'));
  assert.ok(catalog.some(item=>item.kind==='definition'&&item.definitionId==='pack01.black_bullet'));
  assert.ok(catalog.some(item=>item.kind==='pure'));
});

test('공통지역 보상 풀은 40장 순수 + 12장 공용 효과의 52장만 사용하고 네임드/지역 카드를 숨긴다',()=>{
  const run=runState({actId:'common',runFlow:{phase:'common'}}),node={id:'c0',type:'battle'},root=runtime(run);
  const pools=Economy.rewardPools(run,node,root);
  assert.equal(pools.openingCommon,true);
  assert.equal(pools.regionId,null);
  assert.deepEqual(pools.weights,{neutral:1,theme:0});
  assert.equal(pools.theme.length,0);
  assert.equal(pools.catalog.length,52);
  assert.equal(pools.catalog.filter(candidate=>candidate.kind==='pure').length,40);
  assert.equal(pools.catalog.filter(candidate=>candidate.kind==='definition').length,12);
  const commonIds=new Set(RunStart.COMMON_CARD_POOL_IDS);
  assert.ok(pools.catalog.filter(candidate=>candidate.kind==='definition').every(candidate=>commonIds.has(candidate.definitionId)));
  assert.equal(pools.catalog.some(candidate=>candidate.definitionId==='pack01.black_bullet'),false);
});

test('공통지역 전투 보상과 상점은 모두 같은 52장 공용 풀에서만 3장을 제시한다',()=>{
  const run=runState({actId:'common',runFlow:{phase:'common'}}),root=runtime(run),battle={id:'c1',type:'battle'},shopNode={id:'cshop',type:'shop'};
  const reward=Economy.generateCardOffer(run,battle,{count:3,rng:seq([.2,.4,.6,.8]),runtimeRoot:root});
  const shop=Economy.createShopState(run,shopNode,{runtimeRoot:root});
  const allowed=candidate=>candidate.kind==='pure'||RunStart.COMMON_CARD_POOL_IDS.includes(candidate.definitionId);
  assert.equal(reward.length,3);assert.equal(shop.cardOffers.length,3);
  assert.ok(reward.every(allowed));assert.ok(shop.cardOffers.every(allowed));
  assert.equal(reward.some(candidate=>candidate.definitionId?.startsWith('pack01.')),false);
  assert.equal(shop.cardOffers.some(candidate=>candidate.definitionId?.startsWith('pack01.')),false);
});

test('지역 카드 보상은 65/35 경향을 실제 후보 선택에 사용하되 다른 카드군을 차단하지 않는다',()=>{
  const run=runState(),node=regionNode(),root=runtime(run);
  const theme=Economy.generateCardOffer(run,node,{count:1,rng:seq([.90,.10]),runtimeRoot:root});
  const neutral=Economy.generateCardOffer(run,node,{count:1,rng:seq([.10,.10]),runtimeRoot:root});
  assert.equal(theme[0].sourceCategory,'theme');
  assert.equal(neutral[0].sourceCategory,'neutral');
  const pools=Economy.rewardPools(run,node,root);
  assert.equal(pools.openingCommon,false);
  assert.ok(pools.neutral.some(item=>item.definitionId==='core.scout'));
  assert.ok(pools.catalog.some(item=>item.definitionId==='pack01.black_bullet'),'지역 진입 뒤 네임드 카드는 다시 후보 풀에 존재한다');
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

test('공통지역에서 받은 공용 효과 카드는 네임드가 아닌 일반 효과 카드로 덱에 들어간다',()=>{
  const run=runState({actId:'common',runFlow:{phase:'common'}}),node={id:'c2',type:'battle'},root=runtime(run);
  const offer=Economy.ensureRewardOffer(run,node,root),definition=offer.find(candidate=>candidate.kind==='definition');
  assert.ok(definition,'결정적 3장에 효과 카드가 없을 수 있어 직접 공용 후보를 사용한다');
  const before=run.deck.length,result=Economy.claimCardReward(run,node,definition.key,{runtimeRoot:root});
  assert.equal(result.ok,true);assert.equal(run.deck.length,before+1);
  assert.equal(result.card.definition.category,'general');
  assert.equal(result.card.named,null);
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
  const root={run,RunStartV2:RunStart,RunFlowV2:RunFlow,RelicSystem:{isRelicRewardNode:node=>node.type!=='battle',rewardClaimed:()=>false},...Cards,showReward(node){calls.push(`legacy:${node.type}`)},showCamp(){},showShop(){},beginRun(){},showModal(){}};
  Economy.wrapShowReward(root);
  root.showReward(regionNode('n','battle'));assert.equal(calls.length,0);assert.ok(run.economyState.rewards.n);
  root.showReward(regionNode('e','elite'));assert.deepEqual(calls,['legacy:elite']);
});

test('RunStart 임시 보상 래퍼가 먼저 설치돼 있어도 8-C는 유물 보상 원본을 정확히 우회하고 카드 보상은 경제 레이어가 소유한다',()=>{
  Economy.resetForTests();
  const run=runState({actId:'common',runFlow:{phase:'common'}}),calls=[];
  function legacy(node){calls.push(`legacy:${node.type}`)}
  function startWrapper(node){calls.push(`start:${node.type}`)}
  startWrapper.__runStartV2CommonPool=true;startWrapper.__original=legacy;
  const root={run,RunStartV2:RunStart,RunFlowV2:RunFlow,RelicSystem:{isRelicRewardNode:node=>node.type==='elite',rewardClaimed:()=>false},...Cards,showReward:startWrapper,showCamp(){},showShop(){},beginRun(){},showModal(){}};
  Economy.wrapShowReward(root);
  root.showReward({id:'elite-common',type:'elite'});
  assert.deepEqual(calls,['legacy:elite']);
  root.showReward({id:'battle-common',type:'battle'});
  assert.equal(calls.includes('start:battle'),false);
  assert.ok(run.economyState.rewards['battle-common']);
});

test('8-C 브라우저 로더는 8-B 런 흐름 뒤 경제 계층을 거쳐 최종 전투 레이아웃으로 간다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/run-economy-v2\.js/);
  assert.match(source,/if\(root\.RunFlowV2\)\{loadRunEconomyV2\(\);return;\}/);
  assert.match(source,/if\(root\.RunEconomyV2\)/);
  assert.match(source,/RelicSystem\?\.wrapShowReward/);
});
