const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'battle-hand-polish.css'),'utf8');
const market=fs.readFileSync(path.join(ROOT,'battle-reward-market.js'),'utf8');
const compendium=fs.readFileSync(path.join(ROOT,'compendium-8-h.js'),'utf8');
const compendiumBridge=fs.readFileSync(path.join(ROOT,'compendium-8-h-runtime-bridge.js'),'utf8');

test('DEV 진입 버튼은 모바일 하단 CTA 영역에서 벗어난다',()=>{
  assert.match(css,/#trickDevRoot\{[\s\S]*?top:calc\(env\(safe-area-inset-top\) \+ 62px\)!important;[\s\S]*?bottom:auto!important;/);
  assert.match(css,/#trickDevToggle\{[\s\S]*?min-width:44px!important;[\s\S]*?min-height:30px!important;/);
  assert.match(css,/#app:has\(#overlay\.show\) #trickDevToggle:not\(\[aria-expanded="true"\]\)/);
});

test('시작 화면은 계속하기·런 시작·도감 3개 액션을 한 줄에 수용하고 세로 스크롤된다',()=>{
  assert.match(css,/#startScreen\{[\s\S]*?overflow-y:auto!important;/);
  assert.match(css,/#startScreen \.startBottom\.compFixStartBottom\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) 74px!important;/);
  assert.match(compendiumBridge,/startBottom\.classList\.add\('compFixStartBottom'\)/);
});

test('시작 헤더는 제목과 4무늬 장식을 절대 위치 대신 2열 레이아웃으로 배치한다',()=>{
  assert.match(css,/#startScreen \.hero\{[\s\S]*?display:grid!important;[\s\S]*?grid-template-columns:minmax\(0,1fr\) 84px!important;/);
  assert.match(css,/#startScreen \.heroSprite\{[\s\S]*?position:static!important;[\s\S]*?grid-column:2!important;/);
  assert.match(css,/#startScreen \.hero h1 b\{[\s\S]*?color:#e4bd62!important;/);
});

test('카드 마켓 선택 강조와 분류 라벨은 청록색 대신 중립/금색 계열로 덮어쓴다',()=>{
  assert.match(market,/\.brmCard\.is-selected/);
  assert.match(market,/\.brmEyebrow/);
  assert.match(css,/\.brmCard\.is-selected\{[\s\S]*?#a78d5e/);
  assert.match(css,/\.brmCardName\{[\s\S]*?#3b3023!important/);
  assert.match(css,/\.brmEyebrow\{[\s\S]*?#d8c38b!important/);
});

test('설명 키워드는 클릭 기능을 유지하되 파란 네모 버튼처럼 보이지 않는다',()=>{
  assert.match(compendium,/class="compKeyword"/);
  assert.match(css,/\.compKeyword,[\s\S]*?appearance:none!important;[\s\S]*?border:0!important;[\s\S]*?box-shadow:none!important;[\s\S]*?background:transparent!important;[\s\S]*?color:inherit!important;/);
  assert.match(css,/\.compKeyword:hover,[\s\S]*?color:inherit!important;[\s\S]*?text-decoration:none!important;/);
});

test('완성 도감은 동적 뷰포트 높이와 내부 스크롤 영역을 사용해 모바일 하단이 잘리지 않는다',()=>{
  assert.match(css,/#overlay\.compFixOpen>\.modal\.compFixModal\{[\s\S]*?height:100dvh!important;[\s\S]*?max-height:100dvh!important;/);
  assert.match(css,/\.compFixShell\{[\s\S]*?height:100dvh!important;[\s\S]*?overflow:hidden!important;/);
  assert.match(css,/\.compFixList\{[\s\S]*?min-height:0!important;[\s\S]*?safe-area-inset-bottom/);
});
