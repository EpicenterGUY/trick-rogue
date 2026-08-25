const test=require('node:test');
const assert=require('node:assert/strict');
const Cards=require('../cards.js');
const Effects=require('../effects.js');
const EnemyContent=require('../enemy-content-9-b.js');
const Economy=require('../run-economy-v2.js');

const IDS=['boss.theater.encore','boss.theater.curtain_call','boss.observatory.fog_mirror','boss.observatory.redaction','boss.frontier.war_tax','boss.frontier.entrench'];
function effectCalls(id,trigger){const card=Cards.createDefinitionCard(id,{uid:'test-'+id}),calls=[];Effects.run(trigger,card,{card,history:{chipsSpent:0},perform:(action,value)=>calls.push([action,value])});return calls}

test('지역 보스 시그니처 카드 6장은 플레이어도 쓰는 실제 카드 정의다',()=>{
  for(const id of IDS){const def=Cards.CARD_DEFINITION_BY_ID[id];assert(def,id);assert.equal(def.category,'boss_signature');assert(def.signatureBossId);assert(def.signatureRegionId)}
  assert.deepEqual(effectCalls('boss.theater.encore','on_trick_loss'),[['gain_shield',5]]);
  assert.deepEqual(effectCalls('boss.theater.curtain_call','on_trick_win'),[['apply_enemy_bleed',2]]);
  assert.deepEqual(effectCalls('boss.observatory.redaction','on_trick_win'),[['damage_enemy',3],['gain_shield',2]]);
  assert.deepEqual(effectCalls('boss.frontier.war_tax','on_trick_win'),[['damage_enemy',5]]);
});

test('세 지역 보스는 각자 자기 시그니처 카드를 실제 적 카드로 꺼낼 수 있다',()=>{
  const cases=[['three_face_dealer','boss.theater.curtain_call'],['fog_curator','boss.observatory.fog_mirror'],['frontier_marshal','boss.frontier.war_tax']];
  for(const[bossId,expected]of cases){const play=EnemyContent.chooseContentPlay(EnemyContent.CONTENT[bossId],{trick:3,trump:'S',setHistory:{},enemyMemory:{}},()=>0);assert.equal(play.card.cardId,expected,bossId);assert.equal(play.card.enemySignatureCard,true);assert.equal(play.card.definition.id,expected)}
});

test('보스가 시그니처 카드를 쓰면 같은 효과가 보스 기준 자신/상대로 뒤집혀 발동한다',()=>{
  const play=EnemyContent.chooseContentPlay(EnemyContent.CONTENT.three_face_dealer,{trick:3,trump:'S',setHistory:{},enemyMemory:{}},()=>0);
  const state={enemyCard:play.card,enemy:{hp:80,maxHp:80},statuses:{player:{bleed:0},enemy:{shield:0}},setIndex:1,trick:2};
  assert.equal(EnemyContent.resolveEnemySignatureTrigger(state,'on_trick_win',{runtimeRoot:{}}),1);assert.equal(state.statuses.player.bleed,2);
  const encore={...Cards.createDefinitionCard('boss.theater.encore',{uid:'encore'}),enemySignatureCard:true};state.enemyCard=encore;
  assert.equal(EnemyContent.resolveEnemySignatureTrigger(state,'on_trick_loss',{runtimeRoot:{}}),1);assert.equal(state.statuses.enemy.shield,5);
});

test('시그니처 카드는 보스 처치 전 보상 풀에서 잠기고 처치 뒤 2.5배 가중치로 해금된다',()=>{
  const run={runSeed:77,actId:'region_theater',runFlow:{phase:'region',currentRegionId:'region_theater'}};const node={id:'t0',type:'battle',regionPlan:{regionId:'region_theater',rewardWeights:{neutral:.65,theme:.35}}};
  assert.equal(Economy.rewardPools(run,node).catalog.some(card=>card.signatureBossId),false);
  const unlocked=Economy.unlockBossSignatures(run,'three_face_dealer');assert.equal(unlocked.length,2);
  const after=Economy.rewardPools(run,node).catalog.filter(card=>card.signatureBossId==='three_face_dealer');assert.equal(after.length,2);assert.ok(after.every(card=>Economy.candidateRewardWeight(card,run)===2.5));
});

test('지역 보스 직후 카드 보상에는 방금 해금한 시그니처 카드가 최소 1장 보장된다',()=>{
  const run={runSeed:88,actId:'region_frontier',runFlow:{phase:'region',currentRegionId:'region_frontier'}};Economy.unlockBossSignatures(run,'frontier_marshal');
  const node={id:'wb',type:'boss',enemyContentId:'frontier_marshal',regionPlan:{regionId:'region_frontier',rewardWeights:{neutral:.65,theme:.35}}};
  const offer=Economy.generateCardOffer(run,node,{count:3,rng:()=>0});assert.equal(offer.length,3);assert.ok(offer.some(card=>card.signatureBossId==='frontier_marshal'));
});
