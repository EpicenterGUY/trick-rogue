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

test('브라우저 로더는 BattleLayout 완료 뒤 GameUI를 설치한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  assert.match(source,/game-ui\.js/);
  assert.match(source,/trick-game-ui-runtime/);
  assert.match(source,/function loadBattleLayoutFinal\(\)\{\s*if\(root\.BattleLayout\)\{loadGameUi\(\);return;\}/);
  assert.match(source,/loadScript\('battle-layout\.js','trick-battle-layout-runtime'\)/);
  assert.match(source,/addEventListener\?\.\('load',loadGameUi/);
});
