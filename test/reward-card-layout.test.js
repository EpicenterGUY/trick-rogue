const test=require('node:test');
const assert=require('node:assert/strict');
const Layout=require('../battle-layout.js');

test('보상 카드 그림은 전투용 cardArt 높이 100%를 상속하지 않는다',()=>{
  assert.match(Layout.STYLE_TEXT,/#overlay \.rewardBox>\.cardArt\{height:auto!important;aspect-ratio:100\/148/);
  assert.match(Layout.STYLE_TEXT,/#overlay \.rewardBox\{display:flex;flex-direction:column;min-width:0;overflow:hidden\}/);
});

test('보상 출처와 받기 버튼은 각 rewardBox 내부 하단에 유지된다',()=>{
  assert.match(Layout.STYLE_TEXT,/#overlay \.rewardBox>\.tiny\{display:block;margin-top:auto;padding-top:4px\}/);
  assert.match(Layout.STYLE_TEXT,/#overlay \.rewardBox>\.rewardBtns\{margin-top:4px\}/);
});
