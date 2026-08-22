const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EnemyBehavior=require('../enemy-behavior.js');

function sequence(...values){let index=0;return()=>values[index++]??0}

test('4-3 적 행동 프로필은 일반/엘리트/보스마다 서로 다른 성격과 전술 정책을 가진다',()=>{
  assert.deepEqual(EnemyBehavior.validateProfiles(),[]);
  assert.deepEqual(Object.keys(EnemyBehavior.PROFILES).sort(),['battle','boss','elite']);
  const archetypes=new Set();
  for(const profile of Object.values(EnemyBehavior.PROFILES)){
    assert(profile.personality.archetype.length>0);
    assert(profile.personality.summary.length>0);
    archetypes.add(profile.personality.archetype);
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
  assert.equal(archetypes.size,3);
  assert.equal(EnemyBehavior.PROFILES.battle.personality.archetype,'트릭 집착형');
  assert.equal(EnemyBehavior.PROFILES.elite.personality.archetype,'트럼프 사냥형');
  assert.equal(EnemyBehavior.PROFILES.boss.personality.archetype,'쇼다운 차단형');
});

test('폐허 약탈자의 중립 맥락 선택은 기존 55% 고랭크 / 45% 전범위 경계를 보존한다',()=>{
  const neutral={trick:3,setHistory:{wins:0,losses:0},playerSuitCounts:{S:0,H:0,D:0,C:0},enemySuitCounts:{S:0,H:0,D:0,C:0}};
  const high=EnemyBehavior.chooseEnemyPlay('battle',neutral,sequence(0.54,0,0));
  const wild=EnemyBehavior.chooseEnemyPlay('battle',neutral,sequence(0.55,0,0));
  assert.equal(high.patternId,'high_pressure');
  assert.equal(high.card.rank,8);
  assert.equal(high.card.suit,'S');
  assert.equal(wild.patternId,'wild_card');
  assert.equal(wild.card.rank,2);
});

test('엘리트와 보스는 4-3에서도 숫자 생성 범위를 6~14 안으로 유지한다',()=>{
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

test('적 전투 기억은 직전 결과, 반복 무늬, 반복 행동과 누적 사용 횟수를 기록한다',()=>{
  const battle={
    type:'battle',setIndex:1,trick:1,enemy:{},
    slots:[{card:{suit:'H',rank:4}}],enemyCard:{enemyBehaviorId:'high_pressure'}
  };
  EnemyBehavior.recordBattleMemory(battle,'player');
  battle.trick=2;
  battle.slots.push({card:{suit:'H',rank:7}});
  battle.enemyCard={enemyBehaviorId:'high_pressure'};
  const memory=EnemyBehavior.recordBattleMemory(battle,'enemy');
  assert.equal(memory.lastResult,'enemy');
  assert.equal(memory.lastPlayerSuit,'H');
  assert.equal(memory.playerSuitRun,2);
  assert.equal(memory.lastBehaviorId,'high_pressure');
  assert.equal(memory.behaviorRepeat,2);
  assert.equal(memory.patternCounts.high_pressure,2);
  assert.deepEqual(memory.results,{player:1,enemy:1,draw:0});
  assert.equal(memory.seenTricks,2);
});

test('적 성격은 기억을 행동 가중치에 사용한다',()=>{
  const raiderContext={
    trick:3,setHistory:{wins:0,losses:0},
    enemyMemory:{lastResult:'player',lastBehaviorId:null,behaviorRepeat:0,playerSuitRun:0}
  };
  const raider=EnemyBehavior.patternWeightTable(EnemyBehavior.PROFILES.battle.patterns,raiderContext);
  assert.equal(raider.find(x=>x.id==='high_pressure').effectiveWeight,70);
  assert.equal(raider.find(x=>x.id==='wild_card').effectiveWeight,45);

  const watcherContext={
    trick:3,setHistory:{wins:0,losses:0},
    playerSuitCounts:{S:0,H:0,D:0,C:0},enemySuitCounts:{S:0,H:0,D:0,C:0},
    enemyMemory:{lastPlayerSuit:'H',playerSuitRun:2,lastResult:null}
  };
  const watcher=EnemyBehavior.patternWeightTable(EnemyBehavior.PROFILES.boss.patterns,watcherContext);
  assert.equal(watcher.find(x=>x.id==='watcher_pressure').effectiveWeight,50);
  assert.equal(watcher.find(x=>x.id==='suit_denial').effectiveWeight,75);
});

test('같은 행동을 반복하면 repeat_self 조건으로 해당 패턴 가중치를 조절할 수 있다',()=>{
  const context={
    trick:3,setHistory:{wins:0,losses:0},
    enemyMemory:{lastBehaviorId:'high_pressure',behaviorRepeat:2}
  };
  assert.equal(EnemyBehavior.conditionMet('repeat_self',context,EnemyBehavior.PROFILES.battle.patterns[0]),true);
  assert.equal(EnemyBehavior.conditionMet('repeat_self',context,EnemyBehavior.PROFILES.battle.patterns[1]),false);
  assert.equal(EnemyBehavior.tacticalWeight(EnemyBehavior.PROFILES.battle.patterns[0],context),55*.75);
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

test('인텐트는 행동 이름뿐 아니라 실제 선택 근거와 적 성격을 함께 제공한다',()=>{
  const context={
    trick:4,trump:'D',setHistory:{wins:2,losses:0},
    playerSuitCounts:{S:0,H:0,D:0,C:0},enemySuitCounts:{S:0,H:0,D:0,C:0},
    enemyMemory:{lastResult:'player'}
  };
  const play=EnemyBehavior.chooseEnemyPlay('elite',context,sequence(0.9,0));
  assert.equal(play.personality.archetype,'트럼프 사냥형');
  assert.equal(play.intent.personality,'트럼프 사냥형');
  assert.match(play.intent.reason,/후반 트릭|직전 트릭 패배|트럼프 D/);
  assert.equal(play.card.enemyIntentReason,play.intent.reason);
  assert.equal(play.card.enemyPersonality,'트럼프 사냥형');
  assert.equal(play.card.enemyMemorySnapshot.lastResult,'player');
});

test('applyIntent는 기존 인텐트 UI 필드에 판단 근거를 덧붙이고 성격 메타데이터를 보존한다',()=>{
  const state={enemy:{intent:'기존',sub:'기존 설명'}};
  const card={
    enemyIntent:'무늬 차단',enemyIntentDetail:'플레이어의 무늬를 막는다.',
    enemyIntentReason:'H 무늬 반복을 기억해 차단',enemyBehaviorId:'suit_denial',enemyPersonality:'쇼다운 차단형'
  };
  assert.equal(EnemyBehavior.applyIntent(state,card),true);
  assert.equal(state.enemy.intent,'무늬 차단');
  assert.match(state.enemy.sub,/판단: H 무늬 반복을 기억해 차단/);
  assert.equal(state.enemy.behaviorId,'suit_denial');
  assert.equal(state.enemy.personality,'쇼다운 차단형');
  assert.equal(state.enemy.intentReason,'H 무늬 반복을 기억해 차단');
});

test('전투 맥락은 공개 정보와 적 자신의 기억만 AI에 전달하고 플레이어 손패는 전달하지 않는다',()=>{
  const state={
    setIndex:2,trick:3,trump:'C',
    slots:[{card:{suit:'H',rank:3}},{card:{suit:'S',showdownSuit:'H',rank:8}}],
    enemySlots:[{card:{suit:'D',rank:9}}],
    setHistory:{wins:1,losses:0,draws:1,lastResult:'draw',winStreak:0,lossStreak:0},
    enemy:{aiMemory:{profileId:'raider',lastResult:'player',lastPlayerSuit:'H',playerSuitRun:2}},
    hand:[{suit:'C',rank:14}]
  };
  const context=EnemyBehavior.battleContext(state);
  assert.equal(context.setIndex,2);
  assert.equal(context.trick,3);
  assert.equal(context.trump,'C');
  assert.deepEqual(context.playerSuitCounts,{S:0,H:2,D:0,C:0});
  assert.deepEqual(context.enemySuitCounts,{S:0,H:0,D:1,C:0});
  assert.equal(context.setHistory.wins,1);
  assert.equal(context.enemyMemory.lastResult,'player');
  assert.equal(context.enemyMemory.playerSuitRun,2);
  assert.equal('hand' in context,false);
});

test('recordTrickResult 어댑터는 세트 마지막 트릭도 리셋 전에 적 기억에 기록한다',()=>{
  const battle={
    type:'battle',setIndex:1,trick:5,setHistory:{trickResults:[]},enemy:{},
    slots:[{card:{suit:'C',rank:10}}],enemyCard:{enemyBehaviorId:'wild_card'}
  };
  const root={
    battle,
    BattleCore:{
      recordTrickResult(context,result){
        const normalized=result===1?'player':result===-1?'enemy':'draw';
        context.setHistory.trickResults.push(normalized);
        return normalized;
      }
    }
  };
  assert.equal(EnemyBehavior.installResultMemoryAdapter(root),true);
  assert.equal(root.BattleCore.recordTrickResult(battle,1),'player');
  assert.equal(battle.enemy.aiMemory.lastResult,'player');
  assert.equal(battle.enemy.aiMemory.lastTrick,5);
  assert.equal(battle.enemy.aiMemory.lastPlayerSuit,'C');
  assert.equal(battle.enemy.aiMemory.patternCounts.wild_card,1);
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
  assert.equal(battle.enemy.personality,'트릭 집착형');
  assert(battle.enemy.aiMemory);

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

test('적 카드 선택 결과는 인텐트·행동 ID·전술 가중치·기억 스냅샷을 함께 제공한다',()=>{
  const play=EnemyBehavior.chooseEnemyPlay('battle',{setIndex:2,trick:4,trump:'H',enemyMemory:{lastResult:'player'}},sequence(0,0.5,0,0.25));
  assert.equal(play.profileId,'raider');
  assert.equal(play.patternId,play.card.enemyBehaviorId);
  assert.equal(play.intent.title,play.card.enemyIntent);
  assert.equal(play.context.setIndex,2);
  assert.equal(play.context.trick,4);
  assert.equal(play.context.trump,'H');
  assert.equal(play.context.enemyMemory.lastResult,'player');
  assert(play.weights.some(entry=>entry.id===play.patternId));
});

test('effects.js는 적 행동 런타임을 브라우저에서 자동 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','effects.js'),'utf8');
  assert.match(source,/loadEnemyBehaviorRuntime\(\)/);
  assert.match(source,/enemy-behavior\.js/);
  assert.match(source,/data-trick-enemy-behavior-runtime|trickEnemyBehaviorRuntime/);
});
