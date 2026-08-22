const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const BattleLayout = require('../battle-layout.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');


test('모바일 대결 영역은 내 카드, VS, 적 카드 순서를 유지한다', () => {
  const versus = html.match(/<div id="versus">([\s\S]*?)<\/div>\s*<div id="slotRow">/)[1];

  assert.ok(versus.indexOf('id="playerStage"') < versus.indexOf('class="vsText"'));
  assert.ok(versus.indexOf('class="vsText"') < versus.indexOf('id="enemyStage"'));
  assert.match(html, /#versus\{[^}]*grid-template-columns:minmax\(0,1fr\) max-content minmax\(0,1fr\)/);
  assert.match(html, /\.vsText\{[^}]*z-index:3/);
});

test('카드 애니메이션은 clone과 임시 stage 스타일을 항상 정리한다', () => {
  assert.match(html, /finally\{clone\.getAnimations\(\)\.forEach\(animation=>animation\.cancel\(\)\);src\.style\.visibility=originalVisibility;clone\.remove\(\)\}/);
  assert.match(html, /\['transform','filter','position','left','top','z-index'\]\.forEach\(property=>element\.style\.removeProperty\(property\)\)/);
  assert.match(html, /finally\{\s*animations\.forEach\(animation=>animation\.cancel\(\)\);\s*clearStageAnimationStyles\(enemy\);clearStageAnimationStyles\(player\);/);
});

test('이미지가 없는 네임드 카드는 인덱스가 있는 기존 대체 프레임을 유지한다', () => {
  const fallback = html.match(/function namedIconSvg\(c\)\{([\s\S]*?)\n\}/)[1];

  assert.match(html, /function existingCardArtHtml\(c\)\{if\(c\.named&&c\.named\.image\)return `<img/);
  assert.doesNotMatch(fallback, /text x="50"[^>]*>\$\{name\}<\/text>/);
  assert.doesNotMatch(fallback, /featuredNamedBody\(/);
  assert.match(fallback, /<text x="13" y="19"[^>]*>\$\{rank\}<\/text>/);
  assert.match(fallback, /<text x="13" y="33"[^>]*>\$\{sym\}<\/text>/);
});

test('텍스트 카드 모드는 네임드 카드에만 safe-area 이름을 덮는다', () => {
  const renderer = html.match(/function artHtml\(c\)\{([\s\S]*?)\n\}/)[1];

  assert.match(html, /const TEXT_CARD_MODE=true;/);
  assert.match(renderer, /if\(!TEXT_CARD_MODE\|\|!c\.named\)return existingArt/);
  assert.doesNotMatch(renderer, /순수 카드/);
  assert.match(renderer, /c\.named\.name/);
  assert.match(renderer, /class="textCardName"/);
  assert.match(html, /\.textCardName>span\{[^}]*-webkit-line-clamp:2/);
});


test('모바일 손패는 전술 드로어 없이 document flow 3열을 유지한다', () => {
  assert.match(html, /#handPanel\{position:static/);
  assert.match(html, /#handRow\{display:grid;grid-template-columns:repeat\(3,minmax\(0,92px\)\)/);
  assert.doesNotMatch(html, /id="tacticPanel"/);
  assert.doesNotMatch(html, /#tacticPanel/);
});

test('레거시 전술 실행 코드와 전술 전투 상태가 index에서 제거됐다', () => {
  for(const token of ['const TACTICS=','function useTactic(','function drawT(','tdeck:','thand:','tdisc:','selectedTactic','tacticsOpen','tacticUsing'])assert.equal(html.includes(token),false,token);
  assert.doesNotMatch(html, /grid-area:tactic/);
});

test('모바일에서 낸 카드와 적 카드는 손패 최대 폭과 같은 92px로 표시한다', () => {
  assert.equal(BattleLayout.MOBILE_STAGE_WIDTH, 92);
  assert.equal(BattleLayout.MOBILE_STAGE_HEIGHT, 140);
  assert.match(BattleLayout.STYLE_TEXT, /@media \(max-width:899px\)/);
  assert.match(BattleLayout.STYLE_TEXT, /\.stageInner\{width:min\(92px,100%\)\}/);
  assert.match(BattleLayout.STYLE_TEXT, /\.stageCard\{height:140px;min-height:140px\}/);
});

test('전장 카드 확대 보정은 모바일 범위에만 적용한다', () => {
  assert.doesNotMatch(BattleLayout.STYLE_TEXT, /@media \(min-width:900px\)/);
  assert.match(BattleLayout.STYLE_TEXT, /#versus\{min-height:140px\}/);
});

test('브라우저 부트스트랩은 상태 시스템 뒤에 전투 레이아웃 보정을 로드한다', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'enemy-behavior.js'), 'utf8');
  assert.match(source, /function loadBattleLayout\(\)/);
  assert.match(source, /battle-layout\.js/);
  assert.match(source, /trick-battle-layout-runtime/);
  assert.ok(source.indexOf('status-system.js') < source.indexOf('battle-layout.js'));
});
