const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const RunStart=require('../run-start-v2.js');
const RunFlow=require('../run-flow-v2.js');
const Relics=require('../relics.js');
const Economy=require('../run-economy-v2.js');
const Market=require('../battle-reward-market.js');

function pure(suit='S',rank=8,id='p'){return Cards.createCardRecord({suit,rank,metadata:{uid:id}})}
function runState(overrides={}){return{runSeed:321,actId:'region_theater',gold:100,hp:40,maxHp:60,deck:[pure('S',8,'a'),pure('H',8,'b'),pure('D',8,'c'),pure('C',8,'d'),pure('S',9,'e')],relics:[],...overrides}}
function node(id='reward-market',type='battle'){return{id,type,regionPlan:{regionId:'region_theater',rewardWeights:{neutral:.65,theme:.35}}}}
function runtime(run){return{run,RunEconomyV2:Economy,RunStartV2:RunStart,RunFlowV2:RunFlow,RelicSystem:Relics,...Cards,newUid:(()=>{let n=0;return()=>`m${++n}`})()}}
function candidate(kind){const catalog=Economy.candidateCatalog(Cards);if(kind==='pure')return catalog.find(item=>item.kind==='pure');if(kind==='general')return catalog.find(item=>item.definitionId==='core.draw');return catalog.find(item=>item.definitionId==='pack01.black_bullet')}

test('최신 전투 카드 마켓은 노드마다 중복 없는 8장을 고정한다',()=>{
  const run=runState(),root=runtime(run),battle=node();
  const first=Market.marketState(run,battle,{runtimeRoot:root});
  const second=Market.marketState(run,battle,{runtimeRoot:root});
  assert.equal(first,second);assert.equal(first.offers.length,8);assert.equal(new Set(first.offers.map(card=>card.key)).size,8);assert.deepEqual(first.purchased,{});assert.equal(first.finished,false);
});

test('가격은 순수 12G / 일반 효과 20G / 특수 효과 32G다',()=>{
  assert.deepEqual(Market.PRICES,{pure:12,general:20,effect:32});
  assert.equal(Market.priceFor(candidate('pure')),12);assert.equal(Market.priceFor(candidate('general')),20);assert.equal(Market.priceFor(candidate('effect')),32);
});

test('골드가 허용하는 만큼 한 보상에서 여러 장을 구매한다',()=>{
  const run=runState({gold:100}),root=runtime(run),battle=node('multi'),market=Market.marketState(run,battle,{runtimeRoot:root});
  const picks=[candidate('pure'),candidate('general'),candidate('effect')];market.offers=picks;const before=run.deck.length;
  assert.equal(Market.buy(run,battle,picks[0].key,{runtimeRoot:root}).ok,true);
  assert.equal(Market.buy(run,battle,picks[1].key,{runtimeRoot:root}).ok,true);
  assert.equal(Market.buy(run,battle,picks[2].key,{runtimeRoot:root}).ok,true);
  assert.equal(run.gold,36);assert.equal(run.deck.length,before+3);assert.equal(Object.keys(market.purchased).length,3);
  assert.equal(Market.buy(run,battle,picks[0].key,{runtimeRoot:root}).reason,'purchased');
});

test('골드 부족과 마켓 종료는 덱/골드/구매 이력을 안전하게 보존한다',()=>{
  const poor=runState({gold:11}),poorRoot=runtime(poor),poorNode=node('poor'),poorMarket=Market.marketState(poor,poorNode,{runtimeRoot:poorRoot}),pick=candidate('pure');poorMarket.offers=[pick];const before=poor.deck.length;
  const denied=Market.buy(poor,poorNode,pick.key,{runtimeRoot:poorRoot});assert.equal(denied.reason,'gold');assert.equal(denied.cost,12);assert.equal(poor.gold,11);assert.equal(poor.deck.length,before);
  const run=runState({gold:50}),root=runtime(run),battle=node('finish'),market=Market.marketState(run,battle,{runtimeRoot:root}),general=candidate('general');market.offers=[general];
  assert.equal(Market.buy(run,battle,general.key,{runtimeRoot:root}).ok,true);const closed=Market.finish(run,battle,{runtimeRoot:root});assert.equal(closed.ok,true);assert.deepEqual(closed.purchases,[general.key]);assert.equal(Economy.rewardClaim(run,battle.id).market,true);assert.equal(Market.buy(run,battle,general.key,{runtimeRoot:root}).reason,'finished');
});

test('보스를 잡은 직후 마켓은 시그니처를 해금하고 8장 안에 최소 1장을 보장한다',()=>{
  const signature=Economy.signatureDefinitions(Cards)[0];assert(signature);
  const run=runState({actId:signature.signatureRegionId||'region_theater'}),root=runtime(run),boss={...node('signature-boss','boss'),enemyContentId:signature.signatureBossId};
  const market=Market.marketState(run,boss,{runtimeRoot:root});
  assert(Economy.isSignatureUnlocked(run,signature.id));assert.equal(market.offers.length,8);assert(market.offers.some(card=>card.signatureBossId===signature.signatureBossId));
});

test('유물 미수령 엘리트/보스는 마켓이 가로채지 않고 유물 보상을 먼저 유지한다',()=>{
  Market.resetForTests();const run=runState(),battle=node('elite-first','elite');let legacy=0;
  const root={...runtime(run),showReward(){legacy++;return'relic-first'}};Market.wrapShowReward(root);
  assert.equal(root.showReward(battle),'relic-first');assert.equal(legacy,1);
});

test('마켓 UI는 모바일 4x2 카드판, 선택 상세, 다중 구매와 나가기를 렌더한다',()=>{
  const run=runState({gold:52}),battle=node('ui'),shown=[];const root={...runtime(run),battle:{node:battle},artHtml:()=>'<svg></svg>',showModal:html=>shown.push(html)};
  const offer=Market.show(root,battle);assert.equal(offer.length,8);const html=shown.at(-1);assert.match(html,/카드 마켓/);assert.match(html,/8장 중 원하는 만큼 구매/);assert.match(html,/brmGrid/);assert.match(Market.marketCss(),/grid-template-columns:repeat\(4/);assert.match(html,/마켓 나가기/);
});

test('브라우저 부트스트랩은 RunEconomyV2 다음에 8장 마켓을 로드하고 최종 유물 래퍼를 유지한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  const economy=source.indexOf("loadScript('run-economy-v2.js'");const market=source.indexOf("loadScript('battle-reward-market.js'");const persistence=source.indexOf('root.RelicSystem?.wrapShowReward?.(root)');
  assert(economy>=0&&market>economy);assert(persistence>=0);assert.match(source,/loadBattleRewardMarket\(\)/);assert.match(source,/trick-battle-reward-market-runtime/);
});
