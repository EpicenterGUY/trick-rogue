const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Scene=require('../battle-scene-v2.js');

test('트릭 결과 메타는 플레이어/적/동점을 직관적으로 구분한다',()=>{
  assert.equal(Scene.outcomeMeta(1).label,'플레이어 승리');
  assert.equal(Scene.outcomeMeta(-1).label,'적 승리');
  assert.equal(Scene.outcomeMeta(0).label,'동점');
});

test('모바일 전투씬은 결과창을 작은 리본으로 만들고 중앙 카드를 가리는 대형 팝업을 쓰지 않는다',()=>{
  const css=Scene.styleText();
  assert.match(css,/#trickOutcomeBanner\{[^}]*max-width:142px/);
  assert.match(css,/trickOutcomeRibbon/);
  assert.match(css,/#versus\{min-height:124px/);
});

test('전투씬은 트릭 충돌 뒤 양쪽 카드를 다시 벌려 승패를 보이게 한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-scene-v2.js'),'utf8');
  assert.match(source,/enemyEnd=result<0\?'translateX\(0\) scale\(1\.08\)'/);
  assert.match(source,/playerEnd=result>0\?'translateX\(0\) scale\(1\.08\)'/);
  assert.match(source,/trickWinner/);
  assert.match(source,/trickLoser/);
});

test('트릭 승패가 끝난 뒤에만 플레이한 카드가 쇼다운 슬롯으로 정착한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-scene-v2.js'),'utf8');
  const resultWait=source.indexOf("banner=showOutcome(root,result,values);await wait(root,t.result)");
  const settle=source.indexOf('await animateSlotSettle(root,player,isReduced)');
  assert.ok(resultWait>=0,'승패 결과 표시가 있어야 한다');
  assert.ok(settle>resultWait,'쇼다운 슬롯 정착은 승패 표시 뒤여야 한다');
  assert.ok(Scene.TIMING.slot>=100&&Scene.TIMING.slot<=220,'슬롯 정착은 짧은 마무리 연출이어야 한다');
  assert.match(Scene.styleText(),/trickSlotGhost/);
  assert.match(Scene.styleText(),/slotSettleFlash/);
});

test('내기 직후 카드 이동은 쇼다운 슬롯을 미리 목표로 삼거나 확대 충격을 만들지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-hand-polish.js'),'utf8');
  const start=source.indexOf('animateCardFlight=async function(card)');
  const end=source.indexOf('/* Trick clash',start);
  assert.ok(start>=0&&end>start);
  const flight=source.slice(start,end);
  assert.doesNotMatch(flight,/showdown-slot/);
  assert.doesNotMatch(flight,/scale\(1\.0[4-9]|scale\(1\.1/);
  assert.match(flight,/field\.width\*\.76/);
});

test('덱/버림 HUD와 손패는 세로 공간을 줄인 전투 자원 바로 배치된다',()=>{
  const css=Scene.styleText();
  assert.match(css,/#battlePileHud\{height:40px/);
  assert.match(css,/\.pileStack\{width:27px/);
  assert.match(css,/#handRow\{min-height:126px/);
  assert.match(css,/#handRow \.card\{min-width:84px/);
  assert.match(css,/#handRow \.card\{[^}]*margin-left:-6px/);
  assert.match(css,/#handRow \.card\{[^}]*rotate\(0deg\)/);
});

test('battle-layout은 전투씬 v2 런타임을 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','battle-layout.js'),'utf8');
  assert.match(source,/battle-scene-v2\.js/);
  assert.match(source,/loadBattleSceneV2/);
});