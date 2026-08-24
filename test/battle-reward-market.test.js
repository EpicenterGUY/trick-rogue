const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');
const RunFlow=require('../run-flow-v2.js');
const Relics=require('../relics.js');
const Economy=require('../run-economy-v2.js');

function pure(suit='S',rank=8,id='p'){return Cards.createCardRecord({suit,rank,metadata:{uid:id}})}
function runState(overrides={}){return{runSeed:321,actId:'region_theater',gold:100,hp:40,maxHp:60,deck:[pure('S',8,'a'),pure('H',8,'b'),pure('D',8,'c'),pure('C',8,'d'),pure('S',9,'e')],relics:[],...overrides}}
function node(id='reward-market',type='battle'){return{id,type,regionPlan:{regionId:'region_theater',rewardWeights:{neutral:.65,theme:.35}}}}
function runtime(run){return{run,RunStartV2:RunStart,RunFlowV2:RunFlow,RelicSystem:Relics,...Cards,newUid:(()=>{let n=0;return()=>`m${++n}`})()}}

function candidate(kind){
  const catalog=Economy.candidateCatalog(Cards);
  if(kind==='pure')return catalog.find(item=>item.kind==='pure');
  if(kind==='general')return catalog.find(item=>item.definitionId==='core.draw');
  return catalog.find(item=>item.definitionId==='pack01.black_bullet');
}

test('전투 카드 마켓은 노드마다 중복 없는 8장을 결정적으로 고정한다',()=>{
  const run=runState(),root=runtime(run),battle=node();
  const first=Economy.createRewardMarketState(run,battle,{runtimeRoot:root});
  const second=Economy.createRewardMarketState(run,battle,{runtimeRoot:root});
  assert.equal(first,second);
  assert.equal(first.offers.length,Economy.BATTLE_MARKET_OFFER_COUNT);
  assert.equal(first.offers.length,8);
  assert.equal(new Set(first.offers.map(card=>card.key)).size,8);
  assert.deepEqual(first.purchased,{});
  assert.equal(first.finished,false);
});

test('전투 카드 마켓 가격은 순수 12G / 일반 효과 20G / 추가 효과 32G다',()=>{
  assert.deepEqual(Economy.BATTLE_MARKET_PRICES,{pure:12,general:20,effect:32});
  assert.equal(Economy.battleRewardPrice(candidate('pure')),12);
  assert.equal(Economy.battleRewardPrice(candidate('general')),20);
  assert.equal(Economy.battleRewardPrice(candidate('effect')),32);
});

test('골드가 허용하는 동안 한 전투 보상에서 여러 카드를 살 수 있다',()=>{
  const run=runState({gold:100}),root=runtime(run),battle=node('multi'),market=Economy.createRewardMarketState(run,battle,{runtimeRoot:root});
  const picks=[candidate('pure'),candidate('general'),candidate('effect')];
  market.offers=picks;
  const before=run.deck.length;
  assert.equal(Economy.buyBattleRewardCard(run,battle,picks[0].key,{runtimeRoot:root}).ok,true);
  assert.equal(Economy.buyBattleRewardCard(run,battle,picks[1].key,{runtimeRoot:root}).ok,true);
  assert.equal(Economy.buyBattleRewardCard(run,battle,picks[2].key,{runtimeRoot:root}).ok,true);
  assert.equal(run.gold,36);
  assert.equal(run.deck.length,before+3);
  assert.equal(Object.keys(market.purchased).length,3);
  assert.equal(Economy.buyBattleRewardCard(run,battle,picks[0].key,{runtimeRoot:root}).reason,'purchased');
  assert.equal(run.gold,36);
});

test('골드가 부족하면 구매하지 않고 골드와 덱을 보존한다',()=>{
  const run=runState({gold:11}),root=runtime(run),battle=node('poor'),market=Economy.createRewardMarketState(run,battle,{runtimeRoot:root}),pick=candidate('pure');
  market.offers=[pick];const before=run.deck.length;
  const result=Economy.buyBattleRewardCard(run,battle,pick.key,{runtimeRoot:root});
  assert.equal(result.ok,false);assert.equal(result.reason,'gold');assert.equal(result.cost,12);
  assert.equal(run.gold,11);assert.equal(run.deck.length,before);
});

test('마켓을 나가면 구매 이력을 저장하고 다시 구매할 수 없다',()=>{
  const run=runState({gold:50}),root=runtime(run),battle=node('finish'),market=Economy.createRewardMarketState(run,battle,{runtimeRoot:root}),pick=candidate('general');
  market.offers=[pick];
  assert.equal(Economy.buyBattleRewardCard(run,battle,pick.key,{runtimeRoot:root}).ok,true);
  const closed=Economy.finishBattleRewardMarket(run,battle);
  assert.equal(closed.ok,true);assert.deepEqual(closed.purchases,[pick.key]);assert.equal(closed.skipped,false);
  assert.equal(Economy.rewardMarketFinished(run,battle.id),true);
  assert.equal(Economy.rewardClaim(run,battle.id).market,true);
  assert.equal(Economy.buyBattleRewardCard(run,battle,pick.key,{runtimeRoot:root}).reason,'finished');
});

test('아무것도 사지 않고 나가면 골드는 유지되고 skipped로 기록한다',()=>{
  const run=runState({gold:77}),root=runtime(run),battle=node('skip');
  Economy.createRewardMarketState(run,battle,{runtimeRoot:root});
  const before=run.deck.length,closed=Economy.finishBattleRewardMarket(run,battle);
  assert.equal(closed.ok,true);assert.equal(closed.skipped,true);
  assert.equal(run.gold,77);assert.equal(run.deck.length,before);
});

test('보상 UI는 8장 4열 미니 카드와 상세 구매, 마켓 나가기를 렌더한다',()=>{
  const run=runState({gold:52}),battle=node('ui'),shown=[];
  const root={...runtime(run),battle:{node:battle},artHtml:()=>'<svg></svg>',showModal:html=>shown.push(html)};
  const offer=Economy.showBattleCardReward(root,battle);
  assert.equal(offer.length,8);assert.equal(shown.length,1);
  const html=shown[0];
  assert.match(html,/전투 카드 마켓/);
  assert.match(html,/8장 중 원하는 카드를 골드가 허용하는 만큼 구매/);
  assert.match(html,/grid-template-columns:repeat\(4/);
  assert.match(html,/순수 12G/);assert.match(html,/일반 효과 20G/);assert.match(html,/추가 효과 32G/);
  assert.match(html,/마켓 나가기/);
});
