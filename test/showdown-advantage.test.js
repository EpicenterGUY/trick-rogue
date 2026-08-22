const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BattleCore=require('../battle-core.js');
const Advantage=require('../showdown-advantage.js');

function battleState(){
  return{
    setIndex:1,phase:'trick',slots:[{card:{id:'a'}},{card:{id:'b'}}],
    showdownTrace:[]
  };
}

function rootWithCore(state=battleState()){
  return{BattleCore:{...BattleCore},battle:state};
}

test('7.5-A 기본 쇼다운은 무늬 장수 차이만으로 우세를 만들지 않는다',()=>{
  const root=rootWithCore();
  Advantage.installBrowser(root);
  const resolved=root.BattleCore.resolveShowdownAdvantage({
    playerCards:[{suit:'S'},{suit:'S'},{suit:'S'},{suit:'H'},{suit:'D'}],
    enemyCards:[{suit:'S'},{suit:'H'},{suit:'H'},{suit:'D'},{suit:'C'}]
  });
  assert.equal(resolved.automaticSuitComparison,false);
  assert.equal(resolved.playerActive,false);
  assert.equal(resolved.playerAdvantageCount,0);
  assert.deepEqual(resolved.playerAdvantages,[]);
  assert.deepEqual(root.BattleCore.applyShowdownAdvantage(20,18,resolved),{playerPower:20,enemyPower:18});
  assert.equal(root.BattleCore.showdownAdvantageBonus(['S']),0);
  assert.equal(root.BattleCore.SHOWDOWN_ADVANTAGE_POWER,0);
});

test('명시적으로 획득한 우세만 ×1.25 상태가 된다',()=>{
  const state=battleState();
  Advantage.grantAdvantage(state,'player',{source:'test-crown'});
  const resolved=Advantage.snapshot(state);
  assert.equal(resolved.playerActive,true);
  assert.equal(resolved.playerAdvantageCount,1);
  assert.equal(resolved.playerSource,'test-crown');
  assert.deepEqual(resolved.playerAdvantages,[],'우세는 더 이상 특정 무늬 목록을 만들지 않는다');
  assert.deepEqual(Advantage.applyExplicitShowdownAdvantage(24,20,resolved),{playerPower:30,enemyPower:20});
});

test('플레이어 우세 배율은 쇼다운 덧셈 효과가 끝난 뒤 정확히 한 번 적용된다',()=>{
  const state=battleState();
  const calls=[];
  const root=rootWithCore(state);
  root.runCardEffects=function(trigger,_card,extra){
    calls.push(trigger);
    if(trigger==='on_showdown_score')extra.score.value+=4;
    return 1;
  };
  Advantage.installBrowser(root);
  Advantage.grantAdvantage(state,'player',{source:'combo'});
  const resolved=root.BattleCore.resolveShowdownAdvantage({playerCards:[],enemyCards:[]});
  assert.equal(resolved.deferPlayerMultiplier,true);
  assert.deepEqual(root.BattleCore.applyShowdownAdvantage(20,20,resolved),{playerPower:20,enemyPower:20});
  const score={value:20};
  root.runCardEffects('on_showdown_score',state.slots[0].card,{slotIndex:0,score,advantage:resolved});
  assert.equal(score.value,24);
  root.runCardEffects('on_showdown_score',state.slots[1].card,{slotIndex:1,score,advantage:resolved});
  assert.equal(score.value,35,'20 + 4 + 4 이후 ×1.25가 적용된다');
  root.runCardEffects('on_showdown_score',state.slots[1].card,{slotIndex:1,score,advantage:resolved});
  assert.equal(score.value,39,'같은 세트에서 우세 배율은 두 번 적용되지 않고 원래 카드 효과만 실행된다');
  assert.equal(state.advantageState.lastPlayerPreMultiplier,28);
  assert.equal(state.advantageState.lastPlayerPostMultiplier,35);
});

test('적 우세도 명시적 상태일 때만 ×1.25가 적용된다',()=>{
  const state=battleState(),root=rootWithCore(state);
  Advantage.installBrowser(root);
  Advantage.grantAdvantage(state,'enemy',{source:'boss-rule'});
  const resolved=root.BattleCore.resolveShowdownAdvantage({playerCards:[],enemyCards:[]});
  assert.deepEqual(root.BattleCore.applyShowdownAdvantage(20,24,resolved),{playerPower:20,enemyPower:30});
});

test('on_showdown_advantage는 우세가 없으면 더 이상 기본 필수 트리거로 실행되지 않는다',()=>{
  const state=battleState();
  let calls=0;
  const root=rootWithCore(state);
  root.runCardEffects=function(){calls++;return 1};
  Advantage.installBrowser(root);
  assert.equal(root.runCardEffects('on_showdown_advantage',{},{}),0);
  assert.equal(calls,0);
  Advantage.grantAdvantage(state,'player',{source:'effect'});
  const snapshot=Advantage.snapshot(state,{deferPlayerMultiplier:true});
  root.runCardEffects('on_showdown_advantage',{}, {advantage:snapshot});
  assert.equal(calls,1);
});

test('우세는 다음 세트 시작 효과 전에 제거된다',()=>{
  const state=battleState();
  const seen=[];
  const root=rootWithCore(state);
  root.runCardEffects=function(trigger){if(trigger==='on_set_start')seen.push(Advantage.hasAdvantage(state,'player'))};
  Advantage.installBrowser(root);
  Advantage.grantAdvantage(state,'player',{source:'fifth-trick'});
  assert.equal(Advantage.hasAdvantage(state,'player'),true);
  state.setIndex=2;
  root.runCardEffects('on_set_start',{}, {setIndex:2});
  assert.deepEqual(seen,[false]);
  assert.equal(Advantage.hasAdvantage(state,'player'),false);
});

test('쇼다운 trace에서 구버전 무늬 우세/+3 문구를 제거하고 명시적 배율만 남긴다',()=>{
  const state=battleState();
  state.showdownTrace=['족보: 스트레이트 24','플레이어 우세: ♠ / 기본 +3','적 우세: 없음','카드 효과: +5','최종 위력: 36 : 20'];
  Advantage.grantAdvantage(state,'player',{source:'crown'});
  state.advantageState.scoreBase=24;
  state.advantageState.lastPlayerPreMultiplier=29;
  const trace=Advantage.patchShowdownTrace(state,Advantage.snapshot(state));
  assert(!trace.some(line=>line.includes('기본 +3')));
  assert(!trace.some(line=>line.startsWith('플레이어 우세:')));
  assert(trace.includes('우세: 플레이어 최종 ×1.25'));
  assert(trace.includes('카드 효과: +5'));
});

test('우세 HUD는 평소 숨고 명시적 우세가 있을 때만 나타난다',()=>{
  const state=battleState();
  const textNode={nodeType:3,nodeValue:'쇼다운 무늬 우세'};
  const panel={style:{display:''},childNodes:[textNode]};
  const edge={textContent:'쇼다운에서 판정',parentElement:panel};
  const root=rootWithCore(state);
  root.document={getElementById(id){return id==='edgeText'?edge:null}};
  Advantage.installBrowser(root);
  assert.equal(panel.style.display,'none');
  assert.equal(edge.textContent,'');
  Advantage.grantAdvantage(state,'player',{source:'momentum'});
  Advantage.syncAdvantageHud(root);
  assert.equal(panel.style.display,'');
  assert.equal(textNode.nodeValue,'우세');
  assert.equal(edge.textContent,'나 ×1.25');
});

test('적 행동 부트스트랩은 런 결과 뒤, 전투 레이아웃 전에 7.5-A 우세 런타임을 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert(source.includes("loadScript('showdown-advantage.js','trick-showdown-advantage-runtime')"));
  assert(source.includes("if(root.ShowdownAdvantage){loadBattleLayoutRuntime();return;}"));
  assert(source.includes("if(script?.dataset?.loaded==='true')loadBattleLayoutRuntime();else script?.addEventListener?.('load',loadBattleLayoutRuntime,{once:true});"));
  assert(source.includes("loadScript('battle-layout.js','trick-battle-layout-runtime')"));
  assert(source.includes('if(root.RunResults){loadBattleLayout();return;}'));
});
