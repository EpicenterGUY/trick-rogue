const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EnemyBehavior=require('../enemy-behavior.js');

function sequence(...values){let index=0;return()=>values[index++]??0}

test('4-1 적 행동 프로필은 일반/엘리트/보스의 카드 선택 규칙과 인텐트를 데이터로 가진다',()=>{
  assert.deepEqual(EnemyBehavior.validateProfiles(),[]);
  assert.deepEqual(Object.keys(EnemyBehavior.PROFILES).sort(),['battle','boss','elite']);
  for(const profile of Object.values(EnemyBehavior.PROFILES)){
    assert(profile.patterns.length>0);
    for(const pattern of profile.patterns){
      assert(pattern.minRank>=2&&pattern.maxRank<=14);
      assert(pattern.intent.length>0);
      assert.equal('effects' in pattern,false);
      assert.equal('field' in pattern,false);
      assert.equal('phase' in pattern,false);
    }
  }
});

test('폐허 약탈자는 기존 55% 고랭크 / 45% 전범위 성향을 데이터 기반으로 보존한다',()=>{
  const high=EnemyBehavior.chooseEnemyPlay('battle',{},sequence(0.54,0,0));
  const wild=EnemyBehavior.chooseEnemyPlay('battle',{},sequence(0.55,0,0));
  assert.equal(high.patternId,'high_pressure');
  assert.equal(high.card.rank,8);
  assert.equal(high.card.suit,'S');
  assert.equal(wild.patternId,'wild_card');
  assert.equal(wild.card.rank,2);
});

test('엘리트와 보스는 4-1에서 특수 규칙 없이 기존 6~14 숫자 범위만 보존한다',()=>{
  for(const type of ['elite','boss']){
    const low=EnemyBehavior.chooseEnemyPlay(type,{},sequence(0,0,0));
    const high=EnemyBehavior.chooseEnemyPlay(type,{},sequence(0,0.999999,0.999999));
    assert.equal(low.card.rank,6,type);
    assert.equal(high.card.rank,14,type);
    assert(['S','H','D','C'].includes(low.card.suit));
    assert(['S','H','D','C'].includes(high.card.suit));
  }
});

test('적 카드 선택 결과는 현재 트릭 인텐트와 추적 가능한 행동 ID를 함께 제공한다',()=>{
  const play=EnemyBehavior.chooseEnemyPlay('battle',{setIndex:2,trick:4,trump:'H'},sequence(0,0.5,0.25));
  assert.equal(play.profileId,'raider');
  assert.equal(play.patternId,play.card.enemyBehaviorId);
  assert.equal(play.intent.title,play.card.enemyIntent);
  assert.equal(play.context.setIndex,2);
  assert.equal(play.context.trick,4);
  assert.equal(play.context.trump,'H');
});

test('브라우저 어댑터는 기존 nextEnemy 흐름을 유지하면서 생성기와 인텐트만 데이터화한다',()=>{
  const battle={type:'battle',setIndex:1,trick:1,trump:'S',enemy:{intent:'기존',sub:'기존 설명'},nextEnemyPreview:null,enemyCard:null};
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
  assert(['S','H','D','C'].includes(battle.enemyCard.suit));
  assert(battle.enemyCard.rank>=2&&battle.enemyCard.rank<=14);
  assert(battle.enemyCard.enemyBehaviorId);
  assert.equal(battle.enemy.intent,battle.enemyCard.enemyIntent);
  assert.equal(battle.enemy.sub,battle.enemyCard.enemyIntentDetail);
  assert(battle.nextEnemyPreview.enemyBehaviorId);
  assert.equal(root.genEnemyCard.__enemyBehaviorAdapter,true);
  assert.equal(root.nextEnemy.__enemyBehaviorAdapter,true);
});

test('effects.js는 4-1 적 행동 런타임을 브라우저에서 자동 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','effects.js'),'utf8');
  assert.match(source,/loadEnemyBehaviorRuntime\(\)/);
  assert.match(source,/enemy-behavior\.js/);
  assert.match(source,/data-trick-enemy-behavior-runtime|trickEnemyBehaviorRuntime/);
});