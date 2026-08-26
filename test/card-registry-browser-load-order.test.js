const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Cards=require('../cards.js');
const Compendium=require('../compendium-8-h.js');
const Bridge=require('../compendium-8-h-runtime-bridge.js');

const ROOT=path.join(__dirname,'..');

test('브라우저 카드 선로더는 pack02·pack03·보스 시그니처·pack04를 레지스트리보다 먼저 요청한다',()=>{
  const source=fs.readFileSync(path.join(ROOT,'card-packs','pack01.js'),'utf8');
  const writes=[];
  const document={readyState:'loading',querySelector(){return null},write(html){writes.push(html)}};
  vm.runInNewContext(source,{document});
  const html=writes.join('');
  const expected=['card-packs/pack02.js','card-packs/pack03.js','card-packs/boss-signatures.js','card-packs/pack04.js'];
  let previous=-1;
  for(const src of expected){const index=html.indexOf(src);assert.ok(index>previous,`${src}가 선로딩 순서에 있어야 함`);previous=index}

  const indexHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.ok(indexHtml.indexOf('card-packs/pack01.js')<indexHtml.indexOf('card-packs/index.js'));
  assert.ok(indexHtml.indexOf('card-packs/index.js')<indexHtml.indexOf('cards.js'));
});

test('현재 전체 효과 카드 레지스트리의 모든 카드는 도감 카탈로그에 존재한다',()=>{
  const catalogIds=new Set(Compendium.cardCatalog().map(item=>item.id));
  for(const definition of Cards.ALL_CARD_DEFINITIONS)assert.ok(catalogIds.has(definition.id),`${definition.id} 도감 누락`);
});

test('M4 pack03 카드와 빌드 아이덴티티 pack04 12장은 완성 도감의 효과 카드 필터에 모두 노출된다',()=>{
  const recent=Cards.CARD_DEFINITIONS.filter(card=>card.packId==='pack03'||card.packId==='pack04');
  const pack04=recent.filter(card=>card.packId==='pack04');
  assert.equal(pack04.length,12);
  assert.ok(recent.some(card=>card.packId==='pack03'));

  const visible=new Set(Bridge.filteredCatalog('cards',{cardFilter:'effect',runState:{deck:[]}}).map(item=>item.id));
  for(const definition of recent)assert.ok(visible.has(definition.id),`${definition.id} 효과 카드 도감 누락`);

  const searched=Bridge.filteredCatalog('cards',{cardFilter:'all',query:'카피캣',runState:{deck:[]}});
  assert.ok(searched.some(item=>item.id==='pack04.copycat'));
});
