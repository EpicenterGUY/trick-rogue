const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const UI=require('../game-ui.js');

function docWithInfo(text){return{getElementById(id){return id==='drawInfo'?{textContent:text}:null}}}

test('전투 덱 HUD는 실제 전투 덱과 버림 더미 배열을 우선 표시한다',()=>{
  const state={deck:[1,2,3],discard:[4,5,6,7],drawPile:[1,2,3,4,5]};
  assert.deepEqual(UI.pileCounts(state,docWithInfo('교환 2회 · 덱 99 · 버림 99')),{deck:3,discard:4,exchange:2});
});

test('전투 배열이 없는 레거시 화면도 기존 덱/버림 텍스트에서 수량을 복구한다',()=>{
  assert.deepEqual(UI.pileCounts({},docWithInfo('교환 1회 · 덱 7 · 버림 5')),{deck:7,discard:5,exchange:1});
});

test('지역은 전역 게임 UI 테마 이름으로 안정적으로 변환된다',()=>{
  assert.equal(UI.themeForRegion('region_theater'),'theater');
  assert.equal(UI.themeForRegion('region_observatory'),'observatory');
  assert.equal(UI.themeForRegion('region_frontier'),'frontier');
  assert.equal(UI.themeForRegion('final'),'final');
  assert.equal(UI.themeForRegion('unknown'),'neutral');
});

test('전역 UI 스타일은 시작/맵/전투 덱/모달/8장 마켓을 한 패스에서 다룬다',()=>{
  for(const selector of ['#startScreen .hero.pixel','#mapWrap.pixel','#battlePileHud','#overlay .modal','#overlay .brmCard'])assert.match(UI.STYLE_TEXT,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(UI.STYLE_TEXT,/\.pileStack:before/);
  assert.match(UI.STYLE_TEXT,/DECK|battlePile/);
});

test('브라우저 로더는 BattleLayout → M5 텔레메트리 → GameUI 순서로 설치한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/game-ui\.js/);
  assert.match(source,/trick-game-ui-runtime/);
  assert.match(source,/run-balance-telemetry\.js/);
  assert.match(source,/trick-run-balance-telemetry-runtime/);
  assert.match(source,/function loadBattleLayoutFinal\(\)\{\s*if\(root\.BattleLayout\)\{loadRunBalanceTelemetry\(\);return;\}/);
  assert.match(source,/loadScript\('battle-layout\.js','trick-battle-layout-runtime'\)/);
  assert.match(source,/addEventListener\?\.\('load',loadRunBalanceTelemetry/);
  assert.match(source,/function loadRunBalanceTelemetry\(\)[\s\S]*?loadGameUi/);
});


test('전역 UI 동기화는 같은 덱 숫자를 다시 쓰지 않아 감시기 재귀 갱신을 만들지 않는다',()=>{
  const writes={deck:0,discard:0,exchange:0};
  function tracked(key,initial){let text=String(initial);return{get textContent(){return text},set textContent(value){writes[key]++;text=String(value)}}}
  const nodes={handPanel:{parentNode:{}},battlePileHud:{dataset:{}},drawInfo:{textContent:'덱 3 · 버림 4'},battleDeckCount:tracked('deck','3'),battleDiscardCount:tracked('discard','4'),battleExchangeCount:tracked('exchange','전투 덱')};
  const doc={getElementById(id){return nodes[id]||null}};
  UI.syncPileHud(doc,{deck:[1,2,3],discard:[1,2,3,4]},{});
  UI.syncPileHud(doc,{deck:[1,2,3],discard:[1,2,3,4]},{});
  assert.deepEqual(writes,{deck:0,discard:0,exchange:0});
});

test('전역 UI 감시기는 childList를 감시하지 않아 HUD 내부 쓰기를 다시 감지하지 않는다',()=>{
  const Original=global.MutationObserver;let options=null;
  global.MutationObserver=class{constructor(callback){this.callback=callback}observe(_target,next){options=next}};
  const app={},doc={getElementById(id){return id==='app'?app:null},body:{}};
  try{
    assert.equal(UI.observe({document:doc}),true);
    assert.equal(options.attributes,true);
    assert.equal(Object.prototype.hasOwnProperty.call(options,'childList'),false);
  }finally{global.MutationObserver=Original}
});

test('시작 화면은 최신 시작 런타임 준비 전부터 숨겨 구버전 화면 플래시를 막는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(source,/<section class="screen active" id="startScreen" style="visibility:hidden">/);
});
