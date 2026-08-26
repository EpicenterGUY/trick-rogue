const test=require('node:test');
const assert=require('node:assert/strict');
const Compendium=require('../compendium-8-h.js');
const Bridge=require('../compendium-8-h-runtime-bridge.js');

test('완성 도감은 내부 pack 구분 대신 실제 플레이 분류를 사용한다',()=>{
  assert.deepEqual(Bridge.CARD_FILTERS,['all','pure','effect','signature','trick','showdown','loss','chip','hand','chain','owned','locked']);
  assert.equal(Bridge.CARD_FILTERS.includes('pack01'),false);
  assert.equal(Bridge.CARD_FILTERS.includes('pack02'),false);
  const html=Bridge.fixedCompendiumHtml({run:null});
  assert.match(html,/규칙·용어/);
  assert.match(html,/보스 시그니처/);
  assert.doesNotMatch(html,/>pack01</);
  assert.doesNotMatch(html,/>pack02</);
});

test('카드 도감은 최신 전체 카드 레지스트리를 순수/효과 기준으로 다시 집계한다',()=>{
  const counts=Bridge.catalogCounts(null);
  assert.equal(counts.cards,Compendium.cardCatalog().length);
  assert.equal(counts.pure,52);
  assert.equal(counts.pure+counts.effect+counts.signature,counts.cards);
  assert(counts.effect>0);
});

test('규칙·용어가 독립 도감 탭으로 노출되고 검색 가능하다',()=>{
  const terms=Bridge.termsCatalog();
  assert.equal(terms.length,Compendium.keywordCatalog().length);
  assert(terms.some(item=>item.name==='트럼프'));
  const found=Bridge.filteredCatalog('terms',{query:'자동 승리',runState:null});
  assert(found.some(item=>item.name==='트럼프'));
});

test('보스 시그니처 카드는 해당 보스 처치 전 잠기고 처치 후 해금 상태를 읽는다',()=>{
  const raw={
    kind:'card',id:'boss.test.signature',name:'시험 시그니처',suit:'H',rank:7,category:'boss_signature',packId:'boss-signature',rewardEligible:false,
    description:'패배 — 보호막 5.',source:{definition:{id:'boss.test.signature',category:'boss_signature',signatureBossId:'three_face_dealer'}}
  };
  const locked=Bridge.decorateCardItem(raw,{deck:[]});
  assert.equal(locked.uiCategory,'signature');
  assert.equal(locked.unlocked,false);
  assert.equal(locked.rewardEligible,false);
  assert.equal(locked.signatureBossLabel,'삼면 딜러');
  assert.ok(Bridge.itemBadges(locked).includes('보스 시그니처'));assert.ok(Bridge.itemBadges(locked).includes('잠김'));assert.ok(Bridge.itemBadges(locked).includes('보상 제외'));
  assert.match(Bridge.detailHtml(locked),/해금 조건: 삼면 딜러 처치/);

  const unlocked=Bridge.decorateCardItem(raw,{deck:[],bossSignatureState:{defeatedBossIds:['three_face_dealer'],unlockedDefinitionIds:[]}});
  assert.equal(unlocked.unlocked,true);
  assert.equal(unlocked.rewardEligible,true);
  assert.ok(Bridge.itemBadges(unlocked).includes('보스 시그니처'));assert.ok(Bridge.itemBadges(unlocked).includes('해금됨'));assert.ok(Bridge.itemBadges(unlocked).includes('보상 후보'));
});

test('이번 런 보유 필터는 실제 덱의 순수 카드와 효과 카드를 읽는다',()=>{
  const pure=Compendium.cardCatalog().find(item=>item.id==='pure.S3');
  const effect=Compendium.cardCatalog().find(item=>item.id==='core.plus2');
  assert(pure);assert(effect);
  const run={deck:[{suit:'S',rank:3,uid:'pure-s3'},{suit:effect.suit,rank:effect.rank,definition:{id:effect.id},uid:'effect-plus2'}]};
  assert.equal(Bridge.decorateCardItem(pure,run).owned,true);
  assert.equal(Bridge.decorateCardItem(effect,run).owned,true);
  const owned=Bridge.filteredCatalog('cards',{cardFilter:'owned',runState:run});
  assert(owned.some(item=>item.id==='pure.S3'));
  assert(owned.some(item=>item.id==='core.plus2'));
});

test('카드 선택 상세 UI와 모바일 전체 화면 스크롤 구조를 함께 유지한다',()=>{
  const item=Bridge.decorateCardItem(Compendium.cardCatalog().find(x=>x.id==='core.plus2'),{deck:[]});
  const detail=Bridge.detailHtml(item);
  assert.match(detail,/data-comp-fix-detail/);
  assert.match(detail,/data-comp-fix-detail-close/);
  assert.match(detail,/효과 카드/);
  const css=Bridge.layoutCss();
  assert.match(css,/\.compFixDetail\{/);
  assert.match(css,/\.compFixList\{flex:1;min-height:0;overflow-y:auto/);
});

test('도감 상세는 긴 카드 원문의 앞뒤 규칙을 모두 보존한다',()=>{
  const item=Bridge.decorateCardItem(Compendium.cardCatalog().find(x=>x.id==='pack02.river_ticket'),{deck:[]});
  assert(item);
  assert.ok(item.description.length>60);
  const detail=Bridge.detailHtml(item);
  assert.match(detail,/리버 적중/);
  assert.match(detail,/\+12/);
  assert.match(detail,/-4/);
  assert.match(detail,/후보가 없었다면 페널티 없음/);
});
