const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','battle-hand-polish.js'),'utf8');

test('iOS/Safari 트릭 연출은 최소 판독 시간을 상수로 보장한다',()=>{
  assert.match(source,/const CARD_COMMIT_MIN_MS=220;/);
  assert.match(source,/const TRICK_RESULT_MIN_MS=980;/);
  assert.match(source,/function keepMinimum\(startedAt,minMs\)/);
});

test('동작 줄이기에서는 모션만 생략하고 카드 제출 대기 시간을 건너뛰지 않는다',()=>{
  assert.doesNotMatch(source,/if\(!src\|\|!appEl\|\|!vs\|\|reduced\(\)\)return;/);
  assert.match(source,/if\(!src\|\|!appEl\|\|!vs\|\|reduced\(\)\)\{\s*await keepMinimum\(startedAt,CARD_COMMIT_MIN_MS\);/);
});

test('동작 줄이기에서도 트릭 승패 표시를 최소 시간 유지한다',()=>{
  assert.doesNotMatch(source,/!player\?\.classList\.contains\('show'\)\|\|reduced\(\)\)return/);
  assert.match(source,/if\(reduced\(\)\)\{[\s\S]*?await keepMinimum\(startedAt,TRICK_RESULT_MIN_MS\);[\s\S]*?return;/);
});

test('Safari Web Animations 조기 종료가 전체 판정 시간을 단축하지 않는다',()=>{
  assert.match(source,/Promise\.allSettled\(\[ea\.finished,pa\.finished\]\)/);
  assert.match(source,/await keepMinimum\(startedAt,TRICK_RESULT_MIN_MS\);/);
});

function fakeClassList(show=false){
  const values=new Set(show?['show']:[]);
  return{contains:value=>values.has(value),add:value=>values.add(value),remove:value=>values.delete(value),toggle(value,on){if(on===false)values.delete(value);else values.add(value)}};
}
function fakeElement(show=false){
  return{classList:fakeClassList(show),dataset:{},style:{},getBoundingClientRect(){return{left:0,top:0,width:100,height:100}},querySelector(){return null}};
}
function reducedMotionRuntime(){
  const elements={enemyStage:fakeElement(true),playerStage:fakeElement(true),versus:fakeElement(false),battleScreen:fakeElement(false)};
  const sandbox={
    console,performance,setTimeout,clearTimeout,innerWidth:390,innerHeight:844,
    matchMedia(){return{matches:true}},
    wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))},
    document:{
      getElementById(id){return elements[id]||null},
      querySelectorAll(){return[]},
      createElement(){return fakeElement(false)},
      body:{appendChild(){}},
      documentElement:{appendChild(){}}
    },
    MutationObserver:class{observe(){}},
    closeOverlay(){},renderBattle(){},presentDamage(){},clearStageAnimationStyles(){},
    BattleFeedback:{damageTier(){return'small'}},
    battle:{selected:null},
    burstAt(){},sfx(){}
  };
  vm.runInNewContext(source,sandbox,{filename:'battle-hand-polish.js'});
  return sandbox;
}

test('reduced-motion 실제 런타임도 트릭 결과를 최소 약 1초 유지한다',async()=>{
  const runtime=reducedMotionRuntime(),started=performance.now();
  await runtime.animateTrickResult(1);
  const elapsed=performance.now()-started;
  assert.ok(elapsed>=900,`승패 표시가 너무 빨리 끝남: ${Math.round(elapsed)}ms`);
});
