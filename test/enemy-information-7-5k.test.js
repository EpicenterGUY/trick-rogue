const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EnemyInformation=require('../enemy-information.js');

function card(suit,rank,extra={}){return{suit,rank,...extra}}

function fakeDocument(){
  const elements={
    enemyStage:{dataset:{},style:{},className:'stageCard show',innerHTML:'',onclick:null},
    intentSub:{textContent:''},
    enemyForecast:{textContent:''}
  };
  const head={children:[],appendChild(node){this.children.push(node);if(node.id)elements[node.id]=node}};
  return{
    elements,head,
    getElementById(id){return elements[id]||null},
    createElement(tag){return{tagName:tag,id:'',textContent:''}}
  };
}

test('7.5-K 기본 강도 구간은 낮음 2~6 / 중간 7~10 / 높음 J~A다',()=>{
  assert.equal(EnemyInformation.strengthLabel(2),'낮음');
  assert.equal(EnemyInformation.strengthLabel(6),'낮음');
  assert.equal(EnemyInformation.strengthLabel(7),'중간');
  assert.equal(EnemyInformation.strengthLabel(10),'중간');
  assert.equal(EnemyInformation.strengthLabel(11),'높음');
  assert.equal(EnemyInformation.strengthLabel(14),'높음');
});

test('기본 공개 모델은 정확한 숫자와 무늬, 내부 선택 근거를 노출하지 않는다',()=>{
  const enemyCard=card('H',12,{
    enemyIntent:'무늬 차단',enemyIntentDetail:'플레이어가 쌓는 무늬를 견제한다.',
    enemyIntentReason:'플레이어가 쌓는 H 무늬를 견제',enemyMemorySnapshot:{lastPlayerSuit:'H'}
  });
  const model=EnemyInformation.publicEnemyModel(enemyCard,'S');
  assert.equal(model.knowledge,'partial');
  assert.equal(model.strengthLabel,'높음');
  assert.equal(model.isTrump,false);
  assert.equal(model.intent.title,'무늬 차단');
  assert.equal('rank'in model,false);
  assert.equal('suit'in model,false);
  assert.equal('enemyIntentReason'in model,false);
  assert.equal('enemyMemorySnapshot'in model,false);
  assert.doesNotMatch(JSON.stringify(model),/H 무늬를 견제/);
});

test('부분 예고는 정확한 무늬 대신 현재 카드의 트럼프 여부만 알려준다',()=>{
  assert.equal(EnemyInformation.partialHint(card('D',6),'D'),'낮음 · 트럼프');
  assert.equal(EnemyInformation.partialHint(card('H',9),'D'),'중간 · 비트럼프');
});

test('다음 적 카드 정보는 기본 숨김, 1단계 부분, 2단계 근사, 3단계 정확 공개로 증가한다',()=>{
  const battle={trump:'S',nextEnemyPreview:card('S',12),enemyForecast:0};
  assert.equal(EnemyInformation.previewText(battle),'???');
  battle.enemyForecast=1;
  assert.equal(EnemyInformation.previewText(battle),'높음 · 트럼프');
  battle.enemyForecast=2;
  assert.match(EnemyInformation.previewText(battle),/^높음 · 트럼프 · Q 근처$/);
  assert.doesNotMatch(EnemyInformation.previewText(battle),/♠/);
  battle.enemyForecast=3;
  assert.equal(EnemyInformation.previewText(battle),'♠Q');
});

test('정찰 공개 플래그는 예측 단계와 무관하게 다음 카드의 정확한 숫자와 무늬를 공개한다',()=>{
  const battle={trump:'C',nextEnemyPreview:card('H',14),enemyForecast:0,reveal:true};
  const root={TacticMigrationSupport:{isNextEnemyPreviewRevealed(state){return state.reveal===true}}};
  assert.equal(EnemyInformation.previewKnowledgeLevel(battle,root),EnemyInformation.KNOWLEDGE.EXACT);
  assert.equal(EnemyInformation.previewText(battle,root),'♥A');
});

test('정찰로 정확히 본 다음 카드는 현재 카드로 넘어온 뒤에도 정확 공개 기억을 유지한다',()=>{
  const preview=card('D',13);
  const battle={trump:'H',enemy:{},enemyCard:card('C',4),nextEnemyPreview:preview,enemyForecast:0,reveal:true,playerStage:null,phase:'trick'};
  const root={
    battle,
    TacticMigrationSupport:{isNextEnemyPreviewRevealed(state){return state.reveal===true}},
    nextEnemy(){this.battle.enemyCard=this.battle.nextEnemyPreview;this.battle.nextEnemyPreview=card('S',3);this.battle.reveal=false}
  };
  assert.equal(EnemyInformation.installNextEnemyAdapter(root),true);
  root.nextEnemy();
  assert.equal(battle.enemyCard,preview);
  assert.equal(EnemyInformation.currentEnemyExact(battle),true);
  assert.equal(EnemyInformation.currentEnemyModel(battle).rank,13);
  root.nextEnemy();
  assert.equal(EnemyInformation.currentEnemyExact(battle),false);
});

test('카드를 내기 전에는 현재 적 카드가 부분 정보이고 제출 확정 뒤에는 실제 카드가 공개된다',()=>{
  const battle={trump:'S',enemy:{intent:'고랭크 압박'},enemyCard:card('H',11),playerStage:null,phase:'trick'};
  assert.equal(EnemyInformation.currentEnemyModel(battle).knowledge,'partial');
  assert.equal(EnemyInformation.currentEnemyExact(battle),false);
  battle.playerStage=card('C',8);
  const exact=EnemyInformation.currentEnemyModel(battle);
  assert.equal(exact.knowledge,'exact');
  assert.equal(exact.suit,'H');
  assert.equal(exact.rank,11);
});

test('브라우저 어댑터는 제출 전 적 카드 아트를 가리고 공개 인텐트에서 내부 판단 근거를 제거한다',()=>{
  const document=fakeDocument();
  const battle={
    trump:'S',phase:'trick',playerStage:null,enemyForecast:1,
    enemy:{intent:'무늬 차단',sub:'플레이어가 쌓는 H 무늬를 견제 · 판단: H 무늬 선택',personality:'쇼다운 차단형'},
    enemyCard:card('H',12,{enemyIntent:'무늬 차단',enemyIntentDetail:'플레이어가 쌓는 무늬를 견제한다.',enemyPersonality:'쇼다운 차단형'}),
    nextEnemyPreview:card('S',6)
  };
  let inspected=0;
  const root={
    document,battle,
    forecastText(){return'LEGACY';},
    nextEnemy(){},
    inspectStageCard(){inspected++;return true},
    renderBattle(){
      document.elements.enemyStage.innerHTML='<div>♥Q</div>';
      document.elements.enemyStage.onclick=()=>this.inspectStageCard('enemy');
      document.elements.enemyStage.style.cursor='pointer';
      document.elements.intentSub.textContent=battle.enemy.sub;
      document.elements.enemyForecast.textContent='LEGACY';
    }
  };
  assert.equal(EnemyInformation.installBrowserRuntime(root),true);
  root.renderBattle();
  const stage=document.elements.enemyStage;
  assert.equal(stage.dataset.enemyInformation,'partial');
  assert.match(stage.innerHTML,/높음/);
  assert.match(stage.innerHTML,/비트럼프/);
  assert.doesNotMatch(stage.innerHTML,/♥|Q/);
  assert.equal(stage.onclick,null);
  assert.equal(root.inspectStageCard('enemy'),false);
  assert.equal(inspected,0);
  assert.doesNotMatch(document.elements.intentSub.textContent,/판단:|H 무늬 선택/);
  assert.equal(document.elements.enemyForecast.textContent,'낮음 · 트럼프');

  battle.playerStage=card('C',8);
  root.renderBattle();
  assert.equal(stage.dataset.enemyInformation,'exact');
  assert.match(stage.innerHTML,/♥Q/);
  assert.equal(root.inspectStageCard('enemy'),true);
  assert.equal(inspected,1);
});

test('7.5-K 런타임은 덱 경계 뒤, 최종 전투 레이아웃 전에 로드된다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/deck-boundaries\.js/);
  assert.match(source,/enemy-information\.js/);
  assert.match(source,/battle-layout\.js/);
  assert.match(source,/EnemyInformation/);
  assert.match(source,/loadEnemyInformation/);
  assert.match(source,/loadScript\('enemy-information\.js','trick-enemy-information-runtime'/);
});
