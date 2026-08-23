const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Tempo=require('../encounter-tempo.js');
const BattleCore=require('../battle-core.js');
const Resolution=require('../showdown-resolution.js');

const cards=(ranks,suits=['S','H','D','C','S'])=>ranks.map((rank,index)=>({rank,suit:suits[index]}));

test('7.5-E 템포 프로필은 초반 일반/강한 일반/엘리트/보스 체력 곡선을 고정한다',()=>{
  assert.deepEqual(Tempo.validateProfiles(),[]);
  assert.equal(Tempo.TEMPO_PROFILES.battle_early.hp,24);
  assert.equal(Tempo.TEMPO_PROFILES.battle_strong.hp,36);
  assert.equal(Tempo.TEMPO_PROFILES.elite.hp,64);
  assert.equal(Tempo.TEMPO_PROFILES.boss.hp,120);
});

test('일반전은 액트 초입과 이후 전투를 서로 다른 템포로 분류한다',()=>{
  assert.equal(Tempo.resolveTempoId({type:'battle',row:0}),'battle_early');
  assert.equal(Tempo.resolveTempoId({type:'battle',row:1}),'battle_strong');
  assert.equal(Tempo.resolveTempoId({type:'battle',row:3}),'battle_strong');
  assert.equal(Tempo.resolveTempoId({type:'elite',row:3}),'elite');
  assert.equal(Tempo.resolveTempoId({type:'boss',row:4}),'boss');
  assert.equal(Tempo.resolveTempoId({type:'battle',row:0,tempoTier:'battle_strong'}),'battle_strong','명시적 템포 지정이 위치 추론보다 우선한다');
});

test('쇼다운 피해 밴드는 10~30 / 30~50 / 50~80 / 100+ 기준을 프로그램적으로 조회할 수 있다',()=>{
  assert.equal(Tempo.damageBand(9).id,'low');
  assert.equal(Tempo.damageBand(10).id,'ordinary');
  assert.equal(Tempo.damageBand(29).id,'ordinary');
  assert.equal(Tempo.damageBand(30).id,'good');
  assert.equal(Tempo.damageBand(50).id,'synergy');
  assert.equal(Tempo.damageBand(80).id,'synergy');
  assert.equal(Tempo.damageBand(99).id,'synergy');
  assert.equal(Tempo.damageBand(100).id,'burst');
});

test('기준 피해에서 목표 세트 수가 일반 1~2 / 엘리트 2~3 / 보스 3+에 들어온다',()=>{
  const early=Tempo.assessDamage('battle_early',30);
  const strong=Tempo.assessDamage('battle_strong',20);
  const elite=Tempo.assessDamage('elite',24);
  const boss=Tempo.assessDamage('boss',40);
  assert.deepEqual([early.expectedSets,strong.expectedSets,elite.expectedSets,boss.expectedSets],[1,2,3,3]);
  assert.equal(early.withinTarget,true);
  assert.equal(strong.withinTarget,true);
  assert.equal(elite.withinTarget,true);
  assert.equal(boss.withinTarget,true);
});

test('강한 시너지 피해는 일반 적을 확실히 압도하고 보스는 여전히 여러 세트를 요구한다',()=>{
  assert.equal(Tempo.expectedSets(Tempo.profileFor('battle_early').hp,50),1);
  assert.equal(Tempo.expectedSets(Tempo.profileFor('battle_strong').hp,50),1);
  assert.equal(Tempo.expectedSets(Tempo.profileFor('elite').hp,50),2);
  assert.equal(Tempo.expectedSets(Tempo.profileFor('boss').hp,50),3);
});

test('전투 시작 어댑터는 기존 적 정의를 유지하면서 현재 노드에 맞는 HP와 템포 메타데이터만 덮어쓴다',()=>{
  const state={};
  const root={
    startBattle(node){this.battle={node,type:node.type,enemy:{name:'폐허 약탈자',hp:58,maxHp:58,intent:'고랭크 압박'},encounter:{}}},
    renderBattle(){this.rendered=(this.rendered||0)+1}
  };
  Tempo.wrapStartBattle(root);
  root.startBattle({id:'n2',type:'battle',row:1});
  assert.equal(root.battle.enemy.name,'폐허 약탈자');
  assert.equal(root.battle.enemy.intent,'고랭크 압박');
  assert.equal(root.battle.enemy.hp,36);
  assert.equal(root.battle.enemy.maxHp,36);
  assert.equal(root.battle.tempo.id,'battle_strong');
  assert.equal(root.battle.encounter.tempo.id,'battle_strong');
  assert.equal(root.rendered,1);
});

test('강한 일반 적이 첫 쇼다운을 버티면 5트릭 종료가 아니라 다음 세트로 자연스럽게 이어진다',async()=>{
  const state={
    node:{id:'n2',type:'battle',row:1},type:'battle',enemy:{name:'폐허 약탈자',hp:58,maxHp:58},
    slots:cards([2,3,4,5,6]).map((card,index)=>({card:{...card,uid:`p${index}`}})),
    enemySlots:cards([2,5,8,11,13]).map((card,index)=>({card:{...card,uid:`e${index}`}})),
    discard:[],hand:[],deck:[],effects:[],reservations:[],setIndex:1,trick:5,phase:'trick',
    setHistory:{trickResults:['player','enemy','player','enemy','player'],wins:3,losses:2,draws:0},history:{},
    maxHandSize:3,slotBonus:0,chip:2,maxChip:5,mods:{paint:false,plus:0,reverse:false,double:false},trump:'H'
  };
  Tempo.applyTempoToBattle(state,state.node);
  const root={
    battle:state,run:{hp:50,maxHp:50},
    BattleCore:{...BattleCore,resolveShowdownAdvantage(){return{mode:'explicit',automaticSuitComparison:false,multiplier:1.25,playerActive:false,enemyActive:false,playerAdvantageCount:0,enemyAdvantageCount:0,playerAdvantages:[],enemyAdvantages:[],playerSuitCounts:{},enemySuitCounts:{}}}},
    CardEffects:{newHistory(){return{}}},sfx(){},renderBattle(){},showShowdownStep(){},wait:async()=>{},flash(){},runCardEffects(){return 0},
    damageEnemy(amount){this.damage=amount;this.battle.enemy.hp-=amount;return amount},damagePlayer(){},
    drawSetTrump(){return'S'},drawP(){},nextEnemy(){this.nextEnemyCalled=true},loseRun(){},async winBattle(){this.won=true}
  };
  const result=await Resolution.resolveRuntimeShowdown(root);
  assert.equal(result.player.basePower,24);
  assert.equal(result.enemy.basePower,5);
  assert.equal(result.riverCompletion.active,true,'5번째 6이 스트레이트를 완성해 리버 ×1.25가 적용된다');
  assert.equal(result.damage.amount,25);
  assert.equal(state.enemy.hp,11);
  assert.equal(state.setIndex,2);
  assert.equal(state.trick,1);
  assert.equal(state.phase,'trick');
  assert.equal(root.nextEnemyCalled,true);
  assert.notEqual(root.won,true);
});

test('7.5-E 런타임은 쇼다운 계산 뒤, 후속 규칙 체인을 거쳐 전투 레이아웃 전에 로드된다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert(source.includes("loadScript('encounter-tempo.js','trick-encounter-tempo-runtime')"));
  assert(source.includes("if(root.ShowdownResolution){loadEncounterTempo();return;}"));
  assert(source.includes("if(root.EncounterTempo){loadDeckBoundaries();return;}"));
  assert(source.includes("loadScript('deck-boundaries.js','trick-deck-boundaries-runtime')"));
  assert(source.includes("loadScript('enemy-information.js','trick-enemy-information-runtime')"));
  assert(source.includes("loadScript('battle-layout.js','trick-battle-layout-runtime')"));
});
