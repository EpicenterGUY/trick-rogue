const test=require('node:test');
const assert=require('node:assert/strict');
const Layout=require('../battle-layout.js');

function classList(){const set=new Set();return{toggle(name,on){if(on)set.add(name);else set.delete(name)},contains:name=>set.has(name)}}
function cardElement(){const props={};return{style:{setProperty(key,value){props[key]=value}},props}}
function fakeDoc(cards=[]){
  const screen={dataset:{},classList:classList()},handRow={querySelectorAll:selector=>selector==='.card'?cards:[],querySelector:selector=>selector==='.card.sel'?null:null};
  const statusTop={classList:classList()},forecast={classList:classList()},statuses={classList:classList(),textContent:''};
  return{screen,handRow,statusTop,forecast,statuses,getElementById(id){return{id:screen,battleScreen:screen,handRow,statusTop,statuses}[id]||null},querySelector(selector){return selector==='.forecastRow'?forecast:null}};
}

test('전투 테마는 세 지역과 최종지역을 별도 게임 보드 색으로 구분한다',()=>{
  assert.equal(Layout.battleRegionId({actId:'region_theater'}),'region_theater');
  assert.equal(Layout.battleRegionId({runFlow:{currentRegionId:'region_observatory'}}),'region_observatory');
  assert.equal(Layout.battleRegionId({actId:'region_frontier'}),'region_frontier');
  assert.equal(Layout.battleRegionId({actId:'final'}),'final');
  assert.equal(Layout.battleRegionId({actId:'common'}),'common');
  for(const id of ['region_theater','region_observatory','region_frontier','final'])assert.match(Layout.STYLE_TEXT,new RegExp(`data-battle-region=\\"${id}\\"`));
});

test('손패는 카드 수에 맞춰 가운데를 기준으로 부채꼴 배치를 계산한다',()=>{
  assert.deepEqual(Layout.handFanModel(3).map(x=>x.angle),[-5,0,5]);
  assert.deepEqual(Layout.handFanModel(4).map(x=>x.angle),[-7.5,-2.5,2.5,7.5]);
  assert.equal(Layout.handFanModel(0).length,0);
});

test('전투 렌더 동기화는 지역 테마와 손패 fan CSS 변수만 갱신하고 전투 상태는 변경하지 않는다',()=>{
  const cards=[cardElement(),cardElement(),cardElement()],doc=fakeDoc(cards),run={actId:'region_frontier',hp:31,gold:20},before=JSON.stringify(run);
  assert.equal(Layout.syncBattlePresentation(doc,run),true);
  assert.equal(doc.screen.dataset.battleRegion,'region_frontier');
  assert.equal(cards[0].props['--fan-angle'],'-5deg');assert.equal(cards[1].props['--fan-angle'],'0deg');assert.equal(cards[2].props['--fan-angle'],'5deg');
  assert.equal(JSON.stringify(run),before);
});

test('모바일 전투 CSS는 패널식 화면 대신 테이블·쇼다운 레일·부채꼴 손패·행동 바로 구성된다',()=>{
  const css=Layout.STYLE_TEXT;
  assert.match(css,/#arena\.pixel\{[^}]*border:0/);
  assert.match(css,/#slotRow:before\{content:\"SHOWDOWN\"/);
  assert.match(css,/#handRow \.card\{[^}]*--fan-angle/);
  assert.match(css,/#inspect\.pixel\{[^}]*border-top:1px solid var\(--battle-accent-soft\)/);
  assert.match(css,/#playBtn\{[^}]*background:linear-gradient\(180deg,var\(--battle-accent\),var\(--battle-accent-soft\)\)/);
});

test('기존 모바일 HUD 동기화와 새 게임 보드 동기화는 같은 renderBattle 래퍼에서 함께 실행된다',()=>{
  const cards=[cardElement()],doc=fakeDoc(cards),run={actId:'region_theater'},battle={myForecast:0,enemyForecast:0,advantageState:{player:false,enemy:false}};
  const root={document:doc,run,battle,renders:0,renderBattle(){this.renders++}};
  assert.equal(Layout.wrapRenderBattle(root),true);root.renderBattle();
  assert.equal(root.renders,1);assert.equal(doc.screen.dataset.battleRegion,'region_theater');assert.equal(root.renderBattle.__tricklogMobileHudM3,true);
});
