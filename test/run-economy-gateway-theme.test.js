const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const RunFlow=require('../run-flow-v2.js');
const Relics=require('../relics.js');
const RunStart=require('../run-start-v2.js');
const Economy=require('../run-economy-v2.js');

function seq(values){let index=0;return()=>values[index++%values.length]}
function pure(suit='S',rank=8,id='p'){return Cards.createCardRecord({suit,rank,metadata:{uid:id}})}
function runtime(run){return{run,RunStartV2:RunStart,RunFlowV2:RunFlow,RelicSystem:Relics,...Cards,newUid:(()=>{let n=0;return()=>`u${++n}`})()}}

function gatewayState(){
  const sourceRegionIds=['region_theater','region_frontier'];
  const run={
    runSeed:777,
    actId:'final_gateway',
    gold:120,hp:40,maxHp:60,
    deck:[pure('S',8,'a'),pure('H',8,'b'),pure('D',8,'c'),pure('C',8,'d'),pure('S',9,'e'),pure('H',9,'f')],
    relics:[],
    runFlow:{phase:'gateway',currentRegionId:null,visitedRegionIds:[...sourceRegionIds],completedRegionIds:[...sourceRegionIds]}
  };
  const node={
    id:'gateway-reward',type:'battle',
    regionPlan:{
      regionId:'final_gateway',
      regionIds:[...sourceRegionIds],
      sourceRegionIds:[...sourceRegionIds],
      rewardWeights:{neutral:.65,theme:.35}
    }
  };
  return{run,node,sourceRegionIds};
}

test('최종 관문 보상은 방문한 두 지역 태그 합집합을 theme 풀로 사용한다',()=>{
  const {run,node,sourceRegionIds}=gatewayState(),root=runtime(run),pools=Economy.rewardPools(run,node,root);
  assert.equal(pools.regionId,'final_gateway');
  assert.deepEqual(pools.regionIds,sourceRegionIds);
  assert.deepEqual(pools.weights,{neutral:.65,theme:.35});
  assert.ok(pools.theme.length>0);
  assert.ok(pools.neutral.length>0);

  const reverse=Economy.candidateFromDefinition(Cards.CARD_DEFINITION_BY_ID['core.reverse']);
  const guard=Economy.candidateFromDefinition(Cards.CARD_DEFINITION_BY_ID['pack01.emergency_guard']);
  const scout=Economy.candidateFromDefinition(Cards.CARD_DEFINITION_BY_ID['core.scout']);

  assert.ok(Economy.candidateAffinity(reverse,sourceRegionIds)>0,'유랑극장 성향 카드가 관문 theme에 포함');
  assert.ok(Economy.candidateAffinity(guard,sourceRegionIds)>0,'황야 전선 성향 카드가 관문 theme에 포함');
  assert.equal(Economy.candidateAffinity(scout,sourceRegionIds),0,'두 방문 지역과 무관한 카드는 neutral');
  assert.ok(pools.theme.some(item=>item.definitionId==='core.reverse'));
  assert.ok(pools.theme.some(item=>item.definitionId==='pack01.emergency_guard'));
  assert.ok(pools.neutral.some(item=>item.definitionId==='core.scout'));
});

test('최종 관문에서 theme 추첨된 카드는 실제 방문 지역 태그와 matchedTags를 유지한다',()=>{
  const {run,node,sourceRegionIds}=gatewayState(),root=runtime(run);
  const offer=Economy.generateCardOffer(run,node,{count:1,rng:seq([.90,.02]),runtimeRoot:root});
  assert.equal(offer.length,1);
  assert.equal(offer[0].sourceCategory,'theme');
  assert.equal(offer[0].regionId,'final_gateway');
  assert.deepEqual(offer[0].regionIds,sourceRegionIds);
  assert.ok(offer[0].matchedTags.length>0);
  const preferred=Economy.regionThemeTags(sourceRegionIds);
  assert.ok(offer[0].matchedTags.every(tag=>preferred.has(tag)));
});

test('일반 지역 보상은 기존 단일 지역 65/35 분류를 그대로 유지한다',()=>{
  const run={runSeed:33,actId:'region_observatory',gold:50,hp:50,maxHp:60,deck:[pure()],relics:[],runFlow:{phase:'region',currentRegionId:'region_observatory'}};
  const node={id:'obs-reward',type:'battle',regionPlan:{regionId:'region_observatory',regionIds:['region_observatory'],sourceRegionIds:['region_observatory'],rewardWeights:{neutral:.65,theme:.35}}};
  const pools=Economy.rewardPools(run,node,runtime(run));
  assert.deepEqual(pools.regionIds,['region_observatory']);
  assert.deepEqual(pools.weights,{neutral:.65,theme:.35});
  assert.ok(pools.theme.every(item=>Economy.candidateAffinity(item,'region_observatory')>0));
  assert.ok(pools.neutral.every(item=>Economy.candidateAffinity(item,'region_observatory')===0));
});
