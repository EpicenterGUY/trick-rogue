const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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

test('이미지가 없는 네임드 카드는 프레임 중앙에 카드 이름을 표시한다', () => {
  const fallback = html.match(/function namedIconSvg\(c\)\{([\s\S]*?)\n\}/)[1];

  assert.match(html, /if\(c\.named&&c\.named\.image\)return `<img/);
  assert.match(fallback, /<text x="50" y="63" text-anchor="middle"[^>]*>\$\{name\}<\/text>/);
  assert.doesNotMatch(fallback, /featuredNamedBody\(/);
  assert.match(fallback, /<text x="13" y="19"[^>]*>\$\{rank\}<\/text>/);
  assert.match(fallback, /<text x="13" y="33"[^>]*>\$\{sym\}<\/text>/);
});
