const test=require('node:test');
const assert=require('node:assert/strict');
const Layout=require('../battle-layout.js');

function classes(){const set=new Set();return{toggle(name,on){if(on)set.add(name);else set.delete(name)},has:name=>set.has(name),values:set}}
function element(text=''){return{classList:classes(),textContent:text}}

test('M3 전투 HUD는 우세가 없을 때 HP 2열, 실제 우세가 있을 때만 가운데 우세 열을 연다',()=>{
  assert.match(Layout.STYLE_TEXT,/#statusTop\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(Layout.STYLE_TEXT,/#statusTop \.midStat\{display:none!important\}/);
  assert.match(Layout.STYLE_TEXT,/#statusTop\.has-showdown-advantage\{grid-template-columns:minmax\(0,1fr\) minmax\(72px,88px\) minmax\(0,1fr\)\}/);
  assert.match(Layout.STYLE_TEXT,/#statusTop\.has-showdown-advantage \.midStat\{display:block!important/);
});

test('핵심 전투 정보인 트릭·트럼프·칩은 겹치는 절대배치 대신 3열 정보 스트립을 사용한다',()=>{
  assert.match(Layout.STYLE_TEXT,/#battleScreen \.arenaMeta\{position:relative;top:auto;right:auto;display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(Layout.STYLE_TEXT,/#battleScreen \.arenaMeta \.badge\{[^}]*border-width:1px/);
});

test('예측은 수치가 있을 때만 행을 열고 플레이어·적 정보를 각각 숨길 수 있다',()=>{
  assert.deepEqual(Layout.battleHudState({myForecast:0,enemyForecast:0,advantageState:{}}),{advantage:false,playerForecast:false,enemyForecast:false,forecastActive:false});
  assert.deepEqual(Layout.battleHudState({myForecast:2,enemyForecast:0,advantageState:{player:true}}),{advantage:true,playerForecast:true,enemyForecast:false,forecastActive:true});
  assert.match(Layout.STYLE_TEXT,/#battleScreen \.forecastRow\{display:none\}/);
  assert.match(Layout.STYLE_TEXT,/#battleScreen \.forecastRow\.is-active\{display:grid/);
  assert.match(Layout.STYLE_TEXT,/#battleScreen \.forecastRow:not\(\.has-player-forecast\)>:first-child\{display:none\}/);
  assert.match(Layout.STYLE_TEXT,/#battleScreen \.forecastRow:not\(\.has-enemy-forecast\)>:last-child\{display:none\}/);
});

test('상태 없음 안내는 빈 공간을 만들지 않고 실제 상태가 있을 때만 상태 행이 남는다',()=>{
  assert.match(Layout.STYLE_TEXT,/#statuses\.is-empty\{display:none\}/);
  const statusTop=element(),forecast=element(),statuses=element('상태 없음');
  const doc={getElementById(id){return id==='statusTop'?statusTop:id==='statuses'?statuses:null},querySelector(sel){return sel==='.forecastRow'?forecast:null}};
  assert.equal(Layout.syncBattleHud(doc,{myForecast:1,enemyForecast:0,advantageState:{enemy:true}}),true);
  assert.equal(statusTop.classList.has('has-showdown-advantage'),true);
  assert.equal(forecast.classList.has('is-active'),true);assert.equal(forecast.classList.has('has-player-forecast'),true);assert.equal(forecast.classList.has('has-enemy-forecast'),false);
  assert.equal(statuses.classList.has('is-empty'),true);
  statuses.textContent='보호막 3';Layout.syncBattleHud(doc,{myForecast:0,enemyForecast:0,advantageState:{}});assert.equal(statuses.classList.has('is-empty'),false);
});

test('renderBattle 래퍼는 기존 렌더 후 HUD 동기화를 실행하고 중복 설치하지 않는다',()=>{
  let renders=0;const statusTop=element(),forecast=element(),statuses=element('상태 없음');
  const doc={getElementById(id){return id==='statusTop'?statusTop:id==='statuses'?statuses:null},querySelector(sel){return sel==='.forecastRow'?forecast:null}};
  const root={document:doc,battle:{myForecast:0,enemyForecast:2,advantageState:{}},renderBattle(){renders++;return 7}};
  assert.equal(Layout.wrapRenderBattle(root),true);const wrapped=root.renderBattle;assert.equal(root.renderBattle(),7);assert.equal(renders,1);assert.equal(forecast.classList.has('has-enemy-forecast'),true);assert.equal(Layout.wrapRenderBattle(root),true);assert.equal(root.renderBattle,wrapped);
});

test('전투 상단 버튼은 정보 배지보다 버튼처럼 보이는 별도 배경과 테두리를 유지한다',()=>{
  assert.match(Layout.STYLE_TEXT,/#battleScreen>\.topbar \.pixelBtn\{background:#171d28;box-shadow:0 0 0 1px #3b465c inset;opacity:\.9\}/);
});
