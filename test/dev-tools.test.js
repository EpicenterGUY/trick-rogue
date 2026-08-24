const assert=require('node:assert/strict');
const test=require('node:test');
const Dev=require('../dev-tools.js');

test('개발자 모드는 dev=1 쿼리에서만 활성화된다',()=>{assert.equal(Dev.isDeveloperMode('?dev=1'),true);assert.equal(Dev.isDeveloperMode('?foo=1&dev=1'),true);assert.equal(Dev.isDeveloperMode('?dev=0'),false);assert.equal(Dev.isDeveloperMode('?debug=1'),false);assert.equal(Dev.isDeveloperMode(''),false)});
test('개발자 수치 입력은 허용 범위의 정수로 제한된다',()=>{assert.equal(Dev.clampInteger(4.6,0,5),5);assert.equal(Dev.clampInteger(-10,0,5),0);assert.equal(Dev.clampInteger(99,0,5),5);assert.equal(Dev.clampInteger('3',0,5),3);assert.equal(Dev.clampInteger('x',0,5,2),2)});
test('개발자 패널 1차 도구는 전투·상태·트럼프·카드 소환을 제공한다',()=>{const html=Dev.panelHtml();for(const marker of ['data-dev-battle="battle"','data-dev-battle="elite"','data-dev-battle="boss"','data-dev-stat="playerHp"','data-dev-stat="enemyHp"','data-dev-stat="chip"','data-dev-stat="shield"','data-dev-trump="S"','data-dev-card="deck"','data-dev-card="hand"'])assert.match(html,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))});
test('개발자 패널은 모바일 안전영역과 제한된 화면 폭을 사용한다',()=>{const css=Dev.panelCss();assert.match(css,/safe-area-inset-bottom/);assert.match(css,/width:min\(360px,calc\(100vw - 24px\)\)/);assert.match(css,/max-height:min\(70vh,620px\)/)});
test('런타임 카드 정의가 없는 Node 환경에서도 카드 검색 API는 안전하다',()=>{assert.deepEqual(Dev.cardCandidates(),[]);assert.equal(Dev.findCandidate('없는 카드'),undefined)});
