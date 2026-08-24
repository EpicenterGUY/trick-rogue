const test=require('node:test');
const assert=require('node:assert/strict');
const Layout=require('../battle-layout.js');

test('M3 모바일 맵은 화면 대부분을 차지하던 58% 높이 대신 제한된 밀도 높이를 사용한다',()=>{
  assert.match(Layout.STYLE_TEXT,/#mapWrap\{[^}]*height:min\(44dvh,360px\)[^}]*min-height:280px[^}]*max-height:360px/);
});

test('M3 모바일 맵 노드는 축소하면서 기존 좌표 중심을 3px 보정한다',()=>{
  assert.equal(Layout.MOBILE_MAP_NODE_WIDTH,66);assert.equal(Layout.MOBILE_MAP_NODE_HEIGHT,48);
  assert.match(Layout.STYLE_TEXT,/#mapGrid \.node\{width:66px;height:48px;margin-left:3px;margin-top:3px\}/);
});

test('맵 연결선과 노드는 같은 10px 내부 좌표계를 사용한다',()=>{
  assert.match(Layout.STYLE_TEXT,/#mapWrap\{[^}]*padding:10px/);
  assert.match(Layout.STYLE_TEXT,/#mapSvg\{left:10px;top:10px;right:auto;bottom:auto\}/);
});

test('선택 가능·잠김·완료 노드는 선이 비치지 않는 불투명 상태에서 명도 차이로 구분한다',()=>{
  assert.match(Layout.STYLE_TEXT,/#mapGrid \.node\.current\{[^}]*opacity:1[^}]*filter:none/);
  assert.match(Layout.STYLE_TEXT,/#mapGrid \.node\.lock\{opacity:1;filter:grayscale\(1\) brightness\(\.42\)/);
  assert.match(Layout.STYLE_TEXT,/#mapGrid \.node\.done\{opacity:1;filter:saturate\(\.35\) brightness\(\.58\)/);
  assert.match(Layout.STYLE_TEXT,/#mapSvg line\{[^}]*stroke-width:3px[^}]*opacity:\.58/);
});

test('맵 자원 HUD는 HP·골드와 덱·빌드를 2열 두 줄로 묶고 부가 정보는 한 단계 약하게 보인다',()=>{
  assert.match(Layout.STYLE_TEXT,/#mapScreen>\.section \.row\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(Layout.STYLE_TEXT,/#mapScreen>\.section \.badge:nth-child\(n\+3\)\{font-size:9px/);
});

test('현재 덱 7장 미리보기는 가로 스크롤 대신 화면 폭에 맞는 7열 그리드를 사용한다',()=>{
  assert.equal(Layout.MOBILE_MAP_DECK_COLUMNS,7);
  assert.match(Layout.STYLE_TEXT,/#mapDeckStrip\{[^}]*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)[^}]*overflow:hidden/);
  assert.match(Layout.STYLE_TEXT,/#mapDeckStrip \.miniCard\{min-width:0;width:100%;height:auto;aspect-ratio:100\/148\}/);
});

test('폐기한 카드팩 개념의 신규 1팩 버튼은 모바일 맵의 핵심 동선에서 숨긴다',()=>{
  assert.match(Layout.STYLE_TEXT,/#mapScreen>\.topbar \.pixelBtn\[onclick="showNewPack\(\)"\]\{display:none\}/);
});
