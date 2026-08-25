const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EnemyContent=require('../enemy-content-9-b.js');
const EnemyBehavior=require('../enemy-behavior-core.js');

function regionNode(type,regionId,enemyTag='standard'){return{id:`${regionId}-${type}`,type,regionPlan:{regionId,enemyTag}}}
function battleState(contentId,type='battle',hp=60,maxHp=60){return{node:{type,enemyContentId:contentId},type,enemy:{hp,maxHp,name:'기존 적',aiMemory:EnemyBehavior.createEnemyMemory()},setIndex:1,trick:1,trump:'H',slots:[],enemySlots:[],setHistory:{wins:0,losses:0,draws:0},bossRules:[{id:'legacy-managed',encounterManaged:true,effects:[]}],encounterRules:[{id:'legacy-managed'}],encounterRulesInitialized:true,field:null,fieldSource:null,fieldHistory:[],rulesOverride:{}}}

test('9-B는 일반 적 2종, 엘리트 1종, 지역 보스 3종을 제공한다',()=>{
  assert.deepEqual(Object.values(EnemyContent.CONTENT).map(x=>x.type).sort(),['battle','battle','boss','boss','boss','elite']);
  assert.deepEqual(Object.keys(EnemyContent.CONTENT).sort(),['fog_archivist','fog_curator','frontier_bailiff','frontier_marshal','masked_croupier','three_face_dealer']);
});

test('9-B 적 콘텐츠 정의와 AI 패턴/상태 효과는 전부 유효하다',()=>{
  assert.deepEqual(EnemyContent.validateContent(),[]);
  for(const entry of Object.values(EnemyContent.CONTENT))for(const pattern of entry.behavior.patterns){assert(pattern.minRank>=2);assert(pattern.maxRank<=14);assert(pattern.intent);assert(EnemyBehavior.SUIT_POLICIES.includes(pattern.suitPolicy))}
});

test('유랑극장 변칙 일반전은 가면 딜러, 관측소 관측·방해 일반전은 안개 기록관을 고른다',()=>{
  assert.equal(EnemyContent.contentIdForNode(regionNode('battle','region_theater','trickster')),'masked_croupier');
  assert.equal(EnemyContent.contentIdForNode(regionNode('battle','region_observatory','observer')),'fog_archivist');
  assert.equal(EnemyContent.contentIdForNode(regionNode('battle','region_observatory','disruptor')),'fog_archivist');
  assert.equal(EnemyContent.contentIdForNode(regionNode('battle','region_frontier','standard')),null);
});

test('지역별 보스는 서로 다르고 최종 보스는 기존 탑의 감시자를 유지한다',()=>{
  assert.equal(EnemyContent.contentIdForNode(regionNode('elite','region_frontier','armored')),'frontier_bailiff');
  assert.equal(EnemyContent.contentIdForNode(regionNode('boss','region_theater','trickster')),'three_face_dealer');
  assert.equal(EnemyContent.contentIdForNode(regionNode('boss','region_observatory','observer')),'fog_curator');
  assert.equal(EnemyContent.contentIdForNode(regionNode('boss','region_frontier','aggressive')),'frontier_marshal');
  assert.equal(EnemyContent.contentIdForNode({id:'final-boss',type:'boss'},{actId:'final'}),null);
});

test('노드 준비는 전투 타입을 바꾸지 않고 콘텐츠 ID만 붙인다',()=>{
  const node=regionNode('elite','region_frontier','aggressive');const type=node.type;
  assert.equal(EnemyContent.prepareNode(node,{actId:'region_frontier'}),'frontier_bailiff');assert.equal(node.type,type);assert.equal(node.enemyContentId,'frontier_bailiff');
});

test('가면 딜러는 초반 위장과 후반 고랭크 전환의 가중치가 실제로 달라진다',()=>{
  const profile=EnemyContent.CONTENT.masked_croupier.behavior;
  const early=EnemyBehavior.patternWeightTable(profile.patterns,{trick:1,setHistory:{},enemyMemory:{}});
  const late=EnemyBehavior.patternWeightTable(profile.patterns,{trick:5,setHistory:{wins:2,losses:0},enemyMemory:{}});
  assert(early.find(x=>x.id==='masked_feint').effectiveWeight>early.find(x=>x.id==='masked_reveal').effectiveWeight);
  assert(late.find(x=>x.id==='masked_reveal').effectiveWeight>late.find(x=>x.id==='masked_feint').effectiveWeight);
});

test('안개 기록관은 플레이어 공개 쇼다운 무늬를 따라가며 비공개 손패는 입력으로 요구하지 않는다',()=>{
  const entry=EnemyContent.CONTENT.fog_archivist,random=()=>0;
  const play=EnemyContent.chooseContentPlay(entry,{trick:3,trump:'S',playerSuitCounts:{S:0,H:3,D:0,C:0},enemySuitCounts:{S:0,H:0,D:0,C:0},setHistory:{},enemyMemory:{}},random);
  assert.equal(play.card.suit,'H');assert.equal(play.contentId,'fog_archivist');assert.equal('playerHand' in play.card,false);
});

test('전선 집행관은 기본 철갑 규칙을 제거하고 세트 시작 보호막 2 + 플레이어 취약 1만 등록한다',()=>{
  const state=battleState('frontier_bailiff','elite',64,64);const applied=EnemyContent.applyBattleContent(state);
  assert.equal(applied.id,'frontier_bailiff');assert.equal(state.enemy.name,'전선 집행관');assert.equal(state.encounterProfileId,'content9b:frontier_bailiff');
  assert.equal(state.bossRules.some(rule=>rule.id==='legacy-managed'),false);assert.deepEqual(state.encounterRules.map(rule=>rule.id),['bailiff_collection']);
  assert.deepEqual(state.encounterRules[0].effects.map(effect=>[effect.value.target,effect.value.statusId,effect.value.amount]),[['enemy','shield',2],['player','vulnerable',1]]);
});

test('삼면 딜러는 66%/33% 경계로 세 얼굴을 바꾸고 마지막 페이즈가 0%까지 덮는다',()=>{
  const boss=EnemyContent.CONTENT.three_face_dealer;
  assert.equal(EnemyContent.phaseFor(boss,.9).id,'face_1');assert.equal(EnemyContent.phaseFor(boss,.65).id,'face_2');assert.equal(EnemyContent.phaseFor(boss,.32).id,'face_3');assert.equal(EnemyContent.phaseFor(boss,0).id,'face_3');
  const state=battleState('three_face_dealer','boss',120,120);EnemyContent.applyBattleContent(state);assert.equal(state.bossPhase.id,'face_1');
  state.enemy.hp=70;let transition=EnemyContent.syncContentEncounter(state);assert.equal(transition.changed,true);assert.equal(state.bossPhase.id,'face_2');assert.deepEqual(state.encounterRules[0].effects.map(e=>e.value.statusId),['shield','bleed']);
  state.enemy.hp=30;transition=EnemyContent.syncContentEncounter(state);assert.equal(transition.changed,true);assert.equal(state.bossPhase.id,'face_3');assert.deepEqual(state.encounterRules[0].effects.map(e=>e.value.statusId),['shield','vulnerable']);
});

test('커스텀 genEnemyCard 어댑터는 기존 적 계획의 세트/트릭 시점을 보존하면서 콘텐츠 AI 카드로 바꾼다',()=>{
  const state=battleState('masked_croupier','battle',36,36);state.node.regionPlan={regionId:'region_theater',enemyTag:'trickster'};
  const runtime={battle:state,genEnemyCard:()=>({suit:'C',rank:2,enemyPlannedSet:2,enemyPlannedTrick:4})};
  const oldRandom=Math.random;Math.random=()=>0;try{assert.equal(EnemyContent.wrapGenEnemyCard(runtime),true);const card=runtime.genEnemyCard();assert.equal(card.enemyContentId,'masked_croupier');assert.equal(card.enemyPlannedSet,2);assert.equal(card.enemyPlannedTrick,4);assert(card.rank>=2&&card.rank<=14)}finally{Math.random=oldRandom}
});

test('startBattle 어댑터는 첫 카드 효과가 실행되기 전에 새 엘리트 규칙으로 교체한다',()=>{
  let seenProfile=null;const node=regionNode('elite','region_frontier','armored');
  const runtime={run:{actId:'region_frontier'},battle:null,renderBattle(){},runCardEffects(){seenProfile=runtime.battle.encounterProfileId},startBattle(n){runtime.battle=battleState(n.enemyContentId,'elite',64,64);runtime.battle.node=n;runtime.runCardEffects('on_set_start');return runtime.battle}};
  assert.equal(EnemyContent.wrapStartBattle(runtime),true);runtime.startBattle(node);assert.equal(seenProfile,'content9b:frontier_bailiff');assert.equal(runtime.battle.encounterRules[0].id,'bailiff_collection');
});

test('damageEnemy 어댑터는 지역 보스 체력이 경계를 넘은 직후 새 페이즈를 동기화한다',()=>{
  const state=battleState('three_face_dealer','boss',90,120);EnemyContent.applyBattleContent(state);let renders=0;
  const runtime={battle:state,renderBattle(){renders++},damageEnemy(amount){state.enemy.hp=Math.max(0,state.enemy.hp-amount);return amount}};
  assert.equal(EnemyContent.wrapDamageEnemy(runtime),true);runtime.damageEnemy(20);assert.equal(state.bossPhase.id,'face_2');assert.equal(renders,1);
});

test('9-B는 필드를 자동 생성하거나 트럼프 자동 승리·전술 덱을 새 적 규칙으로 재도입하지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-content-9-b.js'),'utf8');
  assert.doesNotMatch(source,/defaultField\s*:/);assert.doesNotMatch(source,/tacticDeck|tacticHand|trumpAutoWin|advantage_count_at_least/);
  for(const entry of Object.values(EnemyContent.CONTENT)){assert.equal(entry.defaultField,undefined);for(const phase of entry.phases||[])assert.equal(phase.rule.rulesOverride,undefined)}
});

test('최종 전투 레이아웃 로더는 9-B 적 콘텐츠를 브라우저에서 자동 연결한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-layout.js'),'utf8');assert.match(source,/enemy-content-9-b\.js/);assert.match(source,/loadEnemyContent/);
});
