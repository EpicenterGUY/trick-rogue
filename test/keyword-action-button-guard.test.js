const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Compendium=require('../compendium-8-h.js');

test('키워드 설명 데코레이터는 실제 액션 컨트롤 내부를 건드리지 않는다',()=>{
  const seen=[];
  const actionParent={closest(selector){seen.push(selector);return selector.includes('button')?{}:null}};
  const copyParent={closest(){return null}};

  assert.equal(Compendium.keywordDecorationBlocked(actionParent),true);
  assert.equal(Compendium.keywordDecorationBlocked(copyParent),false);
  assert.equal(seen.length,1);
  assert.match(seen[0],/button/);
  assert.match(seen[0],/\[role="button"\]/);
  assert.match(seen[0],/\[role="link"\]/);
  assert.match(seen[0],/a/);
  assert.match(seen[0],/label/);
});

test('공용 모달 키워드 처리에는 액션 컨트롤 차단 가드가 항상 적용된다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','compendium-8-h.js'),'utf8');
  assert.match(source,/function keywordDecorationBlocked\(parent\)/);
  assert.match(source,/while\(\(node=walker\.nextNode\(\)\)\)\{const parent=node\.parentElement;if\(!node\.nodeValue\?\.trim\(\)\|\|keywordDecorationBlocked\(parent\)\)continue/);
  assert.doesNotMatch(source,/parent\?\.closest\?\.\('\.compKeyword,script,style,input,textarea,button\[data-keyword\]'/);
});
