const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EnemyBehavior=require('../enemy-behavior.js');

function sequence(...values){let index=0;return()=>values[index++]??0}

test('4-2 적 행동 프로필은 일반/엘리트/보스의 전술 가중치와 무늬 정책을 데이터로 가진다',()=>{
  assert.deepEqual(EnemyBehavior.validateProfiles(),[]);
  assert.deepEqual(Object.keys(EnemyBehavior.PROFILES).sort(),['battle','boss','elite']);
  for(const profile of Object.values(EnemyBehavior.PROFILES)){
    assert(profile.patterns.length>=2);
    for(const pattern of profile.patterns){
      assert(pattern.minRank>=2&&pattern.maxRank<=14);
      assert(pattern.intent.length>0);
      assert(EnemyBehavior.SUIT_POLICIES.includes(pattern.suitPolicy));
      assert.equal('effects' in pattern,false);
      assert.equal('field' in pattern,false);
      assert.equal('phase' in pattern,false);
    }
  }
});

test('폐허 약탈자의 맥락 없는 기본 선택은 기존 55% 고랭크 / 45% 전범위 경계를 보존한다',()=>{
  const high=EnemyBehavior.chooseEnemyPlay('battle',{},sequence(0.54,0,0));
  const wild=EnemyBehavior.chooseEnemyPlay('battle',{},sequence(0.55,0,0));
  assert.equal(high.patternId,'high_pressure');
  assert.equal(high.card.rank,8);
  assert.equal(high.card.suit,'S');
  assert.equal(wild.patternId,'wild_card');
  assert.equal(wild.card.rank,2);
});

test('엘리트와 보스는 4-2에서도 숫자 생성 범위를 6~14 안으로 유지한다',()=>{
  for(const type of ['elite','boss']){
    const low=EnemyBehavior.chooseEnemyPlay(type,{},sequence(0,0,0,0));
    const high=EnemyBehavior.chooseEnemyPlay(type,{},sequence(0,0.999999,0.999999,0.999999));
    assert.equal(low.card.rank,6,type);
    assert.equal(high.card.rank,14,type);
    assert(['S','H','D','C'].includes(low.card.suit));
    assert(['S','H','D','C'].includes(high.card.suit));
  }
});

test('후반 트릭이면서 적이 밀리면 폐허 약탈자의 고랭크 압박 가중치가 올라간다',()=>{
  const context={trick:4,setHistory:{wins:2,losses:1}};
  const table=EnemyBehavior.patternWeightTable(EnemyBehavior.PROFILES.battle.patterns,context);
  const high=table.find(entry=>entry.id==='high_pressure');
  const wild=table.find(entry=>entry.id==='wild_card');
  assert.equal(high.baseWeight,55);
  assert.equal(high.effectiveWeight,90);
  assert.equal(wild.effectiveWeight,45);
  const play=EnemyBehavior.chooseEnemyPlay('battle',context,sequence(0.66,0,0));
  assert.equal(play.patternId,'high_pressure');
});

test('무늬 견제 정책은 플레이어가 더 많이 쌓은 쇼다운 무늬를 따라간다',()=>{
  const pattern={suitPolicy:'contest_player'};
  const context={playerSuitCounts:{S:0,H:2,D:0,C:0},enemySuitCounts:{S:0,H:0,D:1,C:0}};
  assert.equal(EnemyBehavior.chooseSuit(pattern,context,sequence(0)),'H');
});

test('트럼프 압박 패턴은 현재 트럼프를 실제 적 카드 무늬로 선택한다',()=>{
  const context={trick:4,trump:'D',setHistory:{wins:2,losses:0},playerSuitCounts:{S:0,H:0,D:0,C:0},enemySuitCounts:{S:0,H:0,D:0,C:0}};
  const play=EnemyBehavior.chooseEnemyPlay('elite',context,sequence(0.9,0));
  assert.equal(play.patternId,'trump_hunt');
  assert.equal(play.card.suit,'D');
  assert.equal(play.card.enemyIntent,'트럼프 압박');
});

test('전투 맥락은 공개 정보인 트럼프·완료 슬롯·세트 승패만 AI에 전달한다',()=>{
  const state={
    setIndex:2,trick:3,trump:'C',
    slots:[{card:{suit:'H',rank:3}},{card:{suit:'S',showdownSuit:'H',rank:8}}],
    enemySlots:[{card:{suit:'D',rank:9}}],
    setHistory:{wins:1,losses:0,draws:1,lastResult:'draw',winStreak:0,lossStreak:0},
    hand:[{suit:'C',rank:14}]
  };
  const context=EnemyBehavior.battleContext(state);
  assert.equal(context.setIndex,2);
  assert.equal(context.trick,3);
  assert.equal(context.trump,'C');
  assert.deepEqual(context.playerSuitCounts,{S:0,H:2,D:0,C:0});
  assert.deepEqual(context.enemySuitCounts,{S:0,H:0,D:1,C:0});
  assert.equal(context.setHistory.wins,1);
  assert.equal('hand' in context,false);
});

test('다음 적 카드는 한 트릭 앞서 계획되어 정찰 공개와 전술 AI가 같은 카드를 공유한다',()=>{
  const battle={
    type:'battle',setIndex:1,trick:1,trump:'S',enemy:{intent:'기존',sub:'기존 설명'},
    slots:[],enemySlots:[],setHistory:{wins:0,losses:0,draws:0},nextEnemyPreview:null,enemyCard:null
  };
  const root={
    battle,
    genEnemyCard(){return{suit:'C',rank:2}},
    nextEnemy(){
      this.battle.enemyCard=this.battle.nextEnemyPreview||this.genEnemyCard();
      this.battle.nextEnemyPreview=this.genEnemyCard();
    }
  };
  assert.equal(EnemyBehavior.installBrowserRuntime(root),true);
  root.nextEnemy();
  assert.equal(battle.enemyCard.enemyPlannedTrick,1);
  assert.equal(battle.nextEnemyPreview.enemyPlannedTrick,2);
  assert.equal(battle.enemy.intent,battle.enemyCard.enemyIntent);
  assert.equal(battle.enemy.behaviorId,battle.enemyCard.enemyBehaviorId);

  const preview=battle.nextEnemyPreview;
  battle.trick=2;
  battle.slots.push({card:{suit:'H',rank:7}});
  battle.enemySlots.push({card:{suit:'C',rank:8}});
  battle.setHistory.wins=1;
  root.nextEnemy();
  assert.equal(battle.enemyCard,preview);
  assert.equal(battle.enemyCard.enemyPlannedTrick,2);
  assert.equal(battle.nextEnemyPreview.enemyPlannedTrick,3);
  assert.equal(root.genEnemyCard.__enemyBehaviorAdapter,true);
  assert.equal(root.nextEnemy.__enemyBehaviorAdapter,true);
});

test('적 카드 선택 결과는 인텐트·행동 ID·전술 가중치 스냅샷을 함께 제공한다',()=>{
  const play=EnemyBehavior.chooseEnemyPlay('battle',{setIndex:2,trick:4,trump:'H'},sequence(0,0.5,0,0.25));
  assert.equal(play.profileId,'raider');
  assert.equal(play.patternId,play.card.enemyBehaviorId);
  assert.equal(play.intent.title,play.card.enemyIntent);
  assert.equal(play.context.setIndex,2);
  assert.equal(play.context.trick,4);
  assert.equal(play.context.trump,'H');
  assert(play.weights.some(entry=>entry.id===play.patternId));
});

test('effects.js는 적 행동 런타임을 브라우저에서 자동 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','effects.js'),'utf8');
  assert.match(source,/loadEnemyBehaviorRuntime\(\)/);
  assert.match(source,/enemy-behavior\.js/);
  assert.match(source,/data-trick-enemy-behavior-runtime|trickEnemyBehaviorRuntime/);
});
