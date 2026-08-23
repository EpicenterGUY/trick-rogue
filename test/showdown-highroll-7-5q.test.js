const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const HighRoll=require('../showdown-highroll.js');
const Fold=require('../fold-experiment.js');
const RunStart=require('../run-start-v2.js');

function createRuntime({enemyHp=20,plannedDamage=35,damageApplied=null}={}){
  const state={setIndex:2,enemy:{hp:enemyHp,maxHp:enemyHp},showdownTrace:[]};
  const shown=[];
  const archive={attacks:{player:{plannedAmount:plannedDamage},enemy:{plannedAmount:5}},finalized:true};
  const root={
    battle:state,
    setTimeout(fn){fn();return 1},
    showShowdownStep(label,value,className){shown.push({label,value,className})},
    damageEnemy(amount){
      const applied=damageApplied==null?Math.min(state.enemy.hp,amount):Math.min(state.enemy.hp,damageApplied);
      state.enemy.hp-=applied;
      return applied;
    },
    async showdown(){
      const dealt=root.damageEnemy(plannedDamage,'showdown',{source:'showdown_player_attack',attacker:'player',target:'enemy'});
      archive.attacks.player.dealt=dealt;
      archive.attacks.player.hpBefore=enemyHp;
      archive.attacks.player.hpAfter=state.enemy.hp;
      state.showdownBreakdown=archive;
      state.lastShowdownBreakdown=archive;
      state.showdownHistory=[archive];
      return archive;
    }
  };
  HighRoll.wrapShowdown(root);
  return{root,state,shown,archive};
}

test('7.5-Q 압승은 적 남은 체력의 175% 이상, 대압승은 250% 이상에서 판정한다',()=>{
  assert.equal(HighRoll.OVERKILL_THRESHOLD,1.75);
  assert.equal(HighRoll.MEGA_OVERKILL_THRESHOLD,2.5);
  assert.equal(HighRoll.classifyOverkill({plannedDamage:34,hpBefore:20,targetDefeated:true}).tier,'none');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:35,hpBefore:20,targetDefeated:true}).tier,'overkill');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:49,hpBefore:20,targetDefeated:true}).tier,'overkill');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:50,hpBefore:20,targetDefeated:true}).tier,'mega_overkill');
});

test('12HP 초반 일반전은 차이 피해 20을 평범한 큰 승리로 두고 21/30부터 압승/대압승 연출을 사용한다',()=>{
  assert.equal(HighRoll.classifyOverkill({plannedDamage:20,hpBefore:12,targetDefeated:true}).tier,'none');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:21,hpBefore:12,targetDefeated:true}).tier,'overkill');
  assert.equal(HighRoll.classifyOverkill({plannedDamage:30,hpBefore:12,targetDefeated:true}).tier,'mega_overkill');
});

test('비율이 높아도 적이 실제로 생존하면 압승으로 판정하지 않는다',()=>{
  const result=HighRoll.classifyOverkill({plannedDamage:100,hpBefore:20,targetDefeated:false});
  assert.equal(result.tier,'none');
  assert.equal(result.qualified,false);
});

test('압승 비율은 HP 상한으로 잘린 실제 손실량이 아니라 최종 쇼다운 공격 예정 피해를 사용한다',async()=>{
  const {root,state,archive}=createRuntime({enemyHp:20,plannedDamage:50});
  await root.showdown();
  assert.equal(archive.attacks.player.dealt,20);
  assert.equal(archive.highRoll.plannedDamage,50);
  assert.equal(archive.highRoll.hpBefore,20);
  assert.equal(archive.highRoll.ratio,2.5);
  assert.equal(archive.highRoll.tier,'mega_overkill');
  assert.equal(state.enemy.hp,0);
});

test('Q 래퍼는 플레이어의 정식 쇼다운 공격 출처만 고점 판정 대상으로 삼는다',async()=>{
  const state={setIndex:1,enemy:{hp:20,maxHp:20},showdownTrace:[]};
  const archive={attacks:{player:{plannedAmount:35}},finalized:true};
  const root={
    battle:state,
    damageEnemy(amount){const dealt=Math.min(state.enemy.hp,amount);state.enemy.hp-=dealt;return dealt},
    async showdown(){
      root.damageEnemy(1,'showdown',{source:'card_effect',attacker:'player',target:'enemy'});
      root.damageEnemy(35,'showdown',{source:'showdown_player_attack',attacker:'player',target:'enemy'});
      state.showdownBreakdown=archive;state.lastShowdownBreakdown=archive;state.showdownHistory=[archive];return archive;
    }
  };
  HighRoll.wrapShowdown(root);
  await root.showdown();
  assert.equal(state.highRollHistory.length,1);
  assert.equal(state.highRollLast.source,'showdown_player_attack');
  assert.equal(state.highRollLast.hpBefore,19);
});

test('압승 결과는 쇼다운 기록과 플레이어 공격 기록에 함께 보존되고 추적 로그에 남는다',async()=>{
  const {root,state,archive}=createRuntime({enemyHp:20,plannedDamage:35});
  await root.showdown();
  assert.equal(archive.highRoll.stage,'7.5-Q');
  assert.equal(archive.highRoll.label,'압승');
  assert.equal(archive.attacks.player.highRoll.tier,'overkill');
  assert.equal(state.highRollHistory.length,1);
  assert(state.showdownTrace.some(line=>line.includes('고점: 압승')));
});

test('고점 연출은 압승/대압승에만 표시하고 기본 보상은 연출 전용 0으로 둔다',async()=>{
  const overkill=createRuntime({enemyHp:20,plannedDamage:35});
  await overkill.root.showdown();
  assert.equal(overkill.shown.at(-1).label,'압승');
  assert.equal(overkill.shown.at(-1).className,'overkill');
  assert.deepEqual(overkill.archive.highRoll.reward,{type:'none',amount:0});
  assert.equal(overkill.archive.highRoll.rewardPolicy,'spectacle_only');

  const normal=createRuntime({enemyHp:20,plannedDamage:30});
  await normal.root.showdown();
  assert.equal(normal.shown.length,0);
  assert.equal(normal.archive.highRoll.tier,'none');
});

test('플레이어 60HP와 폴드 8HP는 고점 연출 조정과 독립된 현재 위험 예산으로 유지한다',()=>{
  assert.equal(RunStart.BASE_HP,60);
  assert.equal(Fold.DEFAULT_FOLD_HP_LOSS,8);
  assert.ok(Fold.DEFAULT_FOLD_HP_LOSS/RunStart.BASE_HP>0.13);
  assert.ok(Fold.DEFAULT_FOLD_HP_LOSS/RunStart.BASE_HP<0.14);
});

test('브라우저 로더는 쇼다운 계산기 다음에 Q 고점 계층을 붙이고 이후 전투 단계로 이어진다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert(source.includes("loadScript('showdown-highroll.js','trick-showdown-highroll-runtime')"));
  assert(source.includes("if(root.ShowdownResolution){loadShowdownHighRoll();return;}"));
  assert(source.includes("if(root.ShowdownHighRoll){loadEncounterTempo();return;}"));
});
