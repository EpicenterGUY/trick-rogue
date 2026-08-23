const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BattleCore=require('../battle-core.js');
const Advantage=require('../showdown-advantage.js');

function battleState(){return{setIndex:1,phase:'trick',slots:[{card:{id:'a'}},{card:{id:'b'}}],showdownTrace:[]}}
function rootWithCore(state=battleState()){return{BattleCore:{...BattleCore},battle:state}}

test('7.5-P 기본 쇼다운은 무늬 장수 차이만으로 우세를 만들지 않는다',()=>{
  const root=rootWithCore();Advantage.installBrowser(root);
  const resolved=root.BattleCore.resolveShowdownAdvantage({playerCards:[{suit:'S'},{suit:'S'},{suit:'S'}],enemyCards:[{suit:'S'}]});
  assert.equal(resolved.automaticSuitComparison,false);assert.equal(resolved.playerActive,false);assert.equal(resolved.enemyActive,false);
  assert.equal('playerAdvantageCount' in resolved,false);assert.equal('playerAdvantages' in resolved,false);
  assert.deepEqual(root.BattleCore.applyShowdownAdvantage(20,18,resolved),{playerPower:20,enemyPower:18});
  assert.equal(root.BattleCore.showdownAdvantageBonus(['S']),0);assert.equal('SHOWDOWN_ADVANTAGE_POWER' in root.BattleCore,false);
});

test('명시적으로 획득한 우세만 +25% 추가 배율 상태가 된다',()=>{
  const state=battleState();Advantage.grantAdvantage(state,'player',{source:'test-crown'});const resolved=Advantage.snapshot(state);
  assert.equal(resolved.playerActive,true);assert.equal(resolved.playerSource,'test-crown');assert.equal(resolved.multiplier,1.25);
  assert.equal('playerAdvantageCount' in resolved,false);assert.equal('playerAdvantages' in resolved,false);
});

test('우세 런타임은 점수를 직접 곱하지 않고 N 배율 풀에 넘길 상태만 제공한다',()=>{
  const state=battleState(),calls=[];const root=rootWithCore(state);
  root.runCardEffects=function(trigger,_card,extra){calls.push(trigger);if(trigger==='on_showdown_score')extra.score.value+=4;return 1};
  Advantage.installBrowser(root);Advantage.grantAdvantage(state,'player',{source:'combo'});
  const resolved=root.BattleCore.resolveShowdownAdvantage();const score={value:20};
  root.runCardEffects('on_showdown_score',state.slots[0].card,{score,advantage:resolved});
  root.runCardEffects('on_showdown_score',state.slots[1].card,{score,advantage:resolved});
  assert.equal(score.value,28);assert.deepEqual(root.BattleCore.applyShowdownAdvantage(score.value,20,resolved),{playerPower:28,enemyPower:20});
  assert.equal('lastPlayerPreMultiplier' in state.advantageState,false);assert.equal('lastPlayerPostMultiplier' in state.advantageState,false);
});

test('적 우세도 하나의 명시적 +25% 상태로만 기록된다',()=>{
  const state=battleState();Advantage.grantAdvantage(state,'enemy',{source:'boss-rule'});const resolved=Advantage.snapshot(state);
  assert.equal(resolved.enemyActive,true);assert.equal(resolved.enemySource,'boss-rule');assert.equal(resolved.multiplier,1.25);
  assert.equal(Advantage.formatAdvantage(resolved),'적 +25%');
});

test('on_showdown_advantage 별도 점수 트리거를 더 이상 가로채지 않는다',()=>{
  const state=battleState();let calls=0;const root=rootWithCore(state);root.runCardEffects=function(){calls++;return 1};
  Advantage.installBrowser(root);root.runCardEffects('on_showdown_advantage',{},{});assert.equal(calls,1,'구식 트리거를 우세 런타임이 특별 처리하지 않는다');
});

test('우세는 다음 세트 시작 효과 전에 제거된다',()=>{
  const state=battleState(),seen=[];const root=rootWithCore(state);root.runCardEffects=function(trigger){if(trigger==='on_set_start')seen.push(Advantage.hasAdvantage(state,'player'))};
  Advantage.installBrowser(root);Advantage.grantAdvantage(state,'player',{source:'fifth-trick'});state.setIndex=2;root.runCardEffects('on_set_start',{}, {setIndex:2});
  assert.deepEqual(seen,[false]);assert.equal(Advantage.hasAdvantage(state,'player'),false);
});

test('쇼다운 trace에서 구버전 무늬 우세/+3 문구를 제거하고 +25% 추가 배율만 남긴다',()=>{
  const state=battleState();state.showdownTrace=['족보: 스트레이트 24','플레이어 우세: ♠ / 기본 +3','적 우세: 없음','카드 효과: +5','최종 위력: 36 : 20'];
  Advantage.grantAdvantage(state,'player',{source:'crown'});const trace=Advantage.patchShowdownTrace(state,Advantage.snapshot(state));
  assert(!trace.some(line=>line.includes('기본 +3')));assert(!trace.some(line=>line.startsWith('플레이어 우세:')));
  assert(trace.includes('우세: 플레이어 추가 배율 +25%'));assert(trace.includes('카드 효과: +5'));
});

test('우세 HUD는 평소 숨고 명시적 우세가 있을 때만 나타난다',()=>{
  const state=battleState(),textNode={nodeType:3,nodeValue:'쇼다운 무늬 우세'},panel={style:{display:''},childNodes:[]},edge={textContent:'쇼다운에서 판정',parentElement:null};panel.childNodes=[textNode];edge.parentElement=panel;
  const root=rootWithCore(state);root.document={getElementById(id){return id==='edgeText'?edge:null}};Advantage.installBrowser(root);
  assert.equal(panel.style.display,'none');assert.equal(edge.textContent,'');Advantage.grantAdvantage(state,'player',{source:'momentum'});Advantage.syncAdvantageHud(root);
  assert.equal(panel.style.display,'');assert.equal(textNode.nodeValue,'우세');assert.equal(edge.textContent,'나 +25%');
});

test('적 행동 부트스트랩은 런 결과 뒤, 전투 레이아웃 전에 우세 런타임을 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert(source.includes("loadScript('showdown-advantage.js','trick-showdown-advantage-runtime')"));assert(source.includes("if(root.ShowdownAdvantage){loadBattleLayoutRuntime();return;}"));
  assert(source.includes("loadScript('battle-layout.js','trick-battle-layout-runtime')"));assert(source.includes('if(root.RunResults){loadBattleLayout();return;}'));
});
