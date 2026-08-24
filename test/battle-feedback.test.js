const assert=require('node:assert/strict');
const test=require('node:test');
const Feedback=require('../battle-feedback.js');
test('피해량별 흔들림은 작은 피해, 일반 피해, 큰 피해로 단계화된다',()=>{assert.equal(Feedback.damageTier(1),'small');assert.equal(Feedback.damageTier(2),'small');assert.equal(Feedback.damageTier(3),'normal');assert.equal(Feedback.damageTier(7),'normal');assert.equal(Feedback.damageTier(8),'large')});
test('흔들림 프로필은 0~6px와 80~150ms 범위 안에 있다',()=>{assert.deepEqual(Feedback.SHAKE_PROFILES.small,{amplitude:1,duration:80});assert.deepEqual(Feedback.SHAKE_PROFILES.normal,{amplitude:3,duration:110});assert.deepEqual(Feedback.SHAKE_PROFILES.large,{amplitude:4,duration:135});assert.deepEqual(Feedback.SHAKE_PROFILES.showdown,{amplitude:6,duration:150})});
test('연속 흔들림은 기존 애니메이션을 취소하고 교체한다',()=>{let cancelled=0;const animations=[];const element={animate(frames,options){const animation={frames,options,cancel(){cancelled++},finished:new Promise(()=>{})};animations.push(animation);return animation}};const controller=Feedback.createController({element});controller.damage(4);controller.shake('showdown');assert.equal(cancelled,1);assert.equal(animations[1].options.duration,150)});
test('새 시작 화면 런타임은 구 시작 화면을 즉시 숨기고 기존 체인과 같은 데이터 키로 선로드한다',()=>{
  const scripts=[],events={},startScreen={style:{}};
  const doc={
    readyState:'loading',
    getElementById(id){return id==='startScreen'?startScreen:null},
    addEventListener(type,listener){events[type]=listener},
    querySelector(selector){return selector===Feedback.RUN_START_SELECTOR?scripts.find(script=>script.dataset.trickRunStartV2Runtime)||null:null},
    createElement(){const handlers={};return{dataset:{},handlers,addEventListener(type,listener){handlers[type]=listener}}},
    head:{appendChild(script){scripts.push(script)}}
  };
  const root={setTimeout(){throw new Error('DOMContentLoaded 전에는 폴링하면 안 된다')}};
  assert.equal(Feedback.loadRunStartV2Runtime(doc,root),true);
  assert.equal(startScreen.style.visibility,'hidden');
  assert.equal(scripts.length,1);
  assert.equal(scripts[0].src,'run-start-v2.js');
  assert.equal(scripts[0].async,false);
  assert.equal(scripts[0].dataset.trickRunStartV2Runtime,'true');
  scripts[0].handlers.load();
  assert.equal(scripts[0].dataset.loaded,'true');
  assert.equal(typeof events.DOMContentLoaded,'function');
});
test('새 시작 화면 설치가 준비되면 최신 화면을 렌더한 뒤 숨김을 해제한다',()=>{
  const startScreen={style:{visibility:'hidden'}};let rendered=0,installed=0;
  const doc={readyState:'complete',getElementById(id){return id==='startScreen'?startScreen:null}};
  const root={RunStartV2:{installBrowser(){installed++;return true},renderStart(){rendered++}}};
  assert.equal(Feedback.installRunStartV2WhenReady(doc,root),true);
  assert.equal(installed,1);assert.equal(rendered,1);assert.equal(startScreen.style.visibility,'');
});
test('용어 사전 동기화 런타임은 브라우저 문서에 한 번만 연결된다',()=>{const scripts=[];const doc={querySelector(selector){return selector==='script[data-trick-rule-glossary-sync]'?scripts[0]||null:null},createElement(){return{dataset:{}}},head:{appendChild(script){scripts.push(script)}}};assert.equal(Feedback.loadRuleGlossaryRuntime(doc),true);assert.equal(scripts.length,1);assert.equal(scripts[0].src,'rules-glossary-sync.js');assert.equal(scripts[0].dataset.trickRuleGlossarySync,'true');assert.equal(Feedback.loadRuleGlossaryRuntime(doc),false);assert.equal(scripts.length,1)});
test('개발자 도구는 dev=1에서만 한 번 로드되고 완료 모듈은 본체 로드 뒤 연결된다',()=>{const scripts=[];const doc={querySelector(selector){if(selector==='script[data-trick-dev-tools]')return scripts.find(script=>script.dataset.trickDevTools)||null;if(selector==='script[data-trick-dev-m2]')return scripts.find(script=>script.dataset.trickDevM2)||null;return null},createElement(){return{dataset:{}}},head:{appendChild(script){scripts.push(script)}}};assert.equal(Feedback.isDeveloperMode('?dev=1'),true);assert.equal(Feedback.isDeveloperMode('?debug=1'),false);assert.equal(Feedback.isDeveloperMode('?dev=0'),false);assert.equal(Feedback.loadDeveloperToolsRuntime(doc,{search:'?debug=1'}),false);assert.equal(scripts.length,0);assert.equal(Feedback.loadDeveloperToolsRuntime(doc,{search:'?dev=1'}),true);assert.equal(scripts.length,1);assert.equal(scripts[0].src,'dev-tools.js');assert.equal(scripts[0].dataset.trickDevTools,'true');scripts[0].onload();assert.equal(scripts.length,2);assert.equal(scripts[1].src,'dev-m2-runtime.js');assert.equal(scripts[1].dataset.trickDevM2,'true');assert.equal(Feedback.loadDeveloperToolsRuntime(doc,{search:'?dev=1'}),false);assert.equal(Feedback.loadDeveloperM2Runtime(doc,{search:'?dev=1'}),false);assert.equal(scripts.length,2)});
