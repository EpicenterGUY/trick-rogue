const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Cards=require('../cards.js');
const Effects=require('../effects.js');

const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('3-3B는 별도 전술 런타임 소스를 물리적으로 제거한다',()=>{
  for(const file of ['tactic-effects.js','legacy-tactic-retirement.js','migrated-tactic-runtime.js'])assert.equal(fs.existsSync(path.join(root,file)),false,file);
  assert.equal(Effects.ACTIONS.includes('draw_tactic'),false);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'effects.js'),'utf8'),/loadLegacyTacticRuntime/);
});

test('스타팅 패키지는 일반 효과 카드 ID 10장만 사용한다',()=>{
  const block=index.match(/const PACKS=\[([\s\S]*?)\n\];/)[1];
  assert.doesNotMatch(block,/\bt:/);
  const ids=[...block.matchAll(/'core\.[^']+'/g)].map(match=>match[0].slice(1,-1));
  assert.equal(ids.length,30);
  assert(ids.every(id=>Cards.CARD_DEFINITION_BY_ID[id]?.category==='general'));
});

test('기본 덱 생성은 12개 일반 효과 카드 정의와 effects를 보존한다',()=>{
  assert.match(index,/function baseDeck\(\)\{return createBaseCardSlots\(\)\.map\(cloneDeckCard\)\}/);
  const base=Cards.createBaseCardSlots();
  assert.equal(base.filter(card=>card.definition?.category==='general').length,12);
});

test('전투 덱 복제는 effects가 없는 네임드 카드에 빈 effects 배열을 덮어쓰지 않는다',()=>{
  const clone=index.match(/function cloneDeckCard\(card\)\{([^\n]+)\}/)[1];
  assert.match(clone,/if\(Array\.isArray\(card\.effects\)\)/);
  assert.match(clone,/else delete next\.effects/);
  assert.doesNotMatch(clone,/effects:Array\.isArray\(card\.effects\).*:\[\]/);
});

test('황금손과 재귀 함수는 전술 카드 의존 문구와 액션이 없다',()=>{
  const golden=Cards.CARD_DEFINITION_BY_ID['pack01.golden_hand'];
  assert.deepEqual(golden.effects.map(effect=>effect.action),['gain_chips','grant_next_trick_hand_capacity']);
  assert.equal(golden.effects.some(effect=>effect.condition==='chips_spent'),false);
  assert.doesNotMatch(golden.description,/전술/);
  assert.doesNotMatch(Cards.CARD_DEFINITION_BY_ID['pack01.recursive_function'].description,/전술/);
});

test('상점 정찰은 전술 목록이 아니라 core.scout 일반 카드를 덱에 추가한다',()=>{
  assert.match(index,/run\.deck\.push\(makeGeneral\('core\.scout'\)\)/);
  assert.doesNotMatch(index,/run\.tactics/);
});
