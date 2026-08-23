const test=require('node:test');
const assert=require('node:assert/strict');
const Bridge=require('../compendium-8-h-runtime-bridge.js');

test('모바일 도감 항목은 버튼을 바깥 컨테이너로 쓰지 않아 키워드 버튼과 중첩되지 않는다',()=>{
  const html=Bridge.itemHtml({
    kind:'card',id:'sample',name:'샘플 카드',suit:'H',rank:10,category:'general',
    description:'트럼프 카드라면 쇼다운 위력 +3.'
  },0);
  assert.match(html,/^<article class="compFixItem"/);
  assert.match(html,/class="compKeyword"/);
  assert.doesNotMatch(html,/^<button[^>]*class="compFixItem"/);
  assert.match(html,/샘플 카드/);
  assert.match(html,/10♥/);
});

test('도감은 모바일에서 전체 화면 내부 스크롤 구조를 사용한다',()=>{
  const css=Bridge.layoutCss();
  assert.match(css,/#overlay\.compFixOpen/);
  assert.match(css,/height:100%!important/);
  assert.match(css,/\.compFixList\{flex:1;min-height:0;overflow-y:auto/);
  assert.match(css,/\.compFixHelp\[hidden\]\{display:none\}/);
});

test('시작 화면은 런 시작과 도감을 가로 배치해 런 시작 버튼이 아래로 밀리지 않는다',()=>{
  const css=Bridge.layoutCss();
  assert.match(css,/#startScreen \.startBottom\.compFixStartBottom/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) 86px/);
  assert.match(css,/\[data-open-compendium\].*order:2/);
  assert.match(css,/\.compFixStartBottom>\.primary\{order:1/);
});

test('새 도감 렌더는 카드 목록을 한 항목 단위 article로 묶는다',()=>{
  Bridge.resetForTests();
  const html=Bridge.fixedCompendiumHtml({run:null});
  assert.match(html,/data-comp-fix-shell/);
  assert.match(html,/class="compFixList"/);
  assert.match(html,/<article class="compFixItem/);
  assert.doesNotMatch(html,/class="compCardRow"/);
});
