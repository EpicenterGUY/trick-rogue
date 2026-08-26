const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardTextMode=require('../card-text-mode.js');
const Cards=require('../cards.js');

test('효과 카드는 수트/랭크와 텍스트만 가진 얼굴을 만든다',()=>{
  const card={suit:'S',rank:7,named:{name:'검은 탄환',description:'승리 — 적에게 피해 4.',effects:[{trigger:'on_trick_win',action:'damage_enemy',value:4,duration:'trick'}]}};
  const html=CardTextMode.textCardFace(card);assert.match(html,/검은 탄환/);assert.match(html,/♠/);assert.match(html,/>7</);assert.match(html,/피해/);assert.doesNotMatch(html,/<img/i);assert.doesNotMatch(html,/<svg/i);
});
test('효과 없는 기본 트럼프는 텍스트 카드 대상으로 분류하지 않는다',()=>{const pure={suit:'H',rank:10,named:null,definition:null,effects:[]};assert.equal(CardTextMode.shouldUseTextFace(pure),false)});
test('네임드 분류가 없어도 effects와 이름이 있는 일반 카드는 텍스트 카드가 된다',()=>{const card={suit:'D',rank:4,name:'시험 카드',effects:[{trigger:'on_play',action:'gain_shield',value:2,duration:'trick'}]};assert.equal(CardTextMode.shouldUseTextFace(card),true);const html=CardTextMode.textCardFace(card);assert.match(html,/시험 카드/);assert.match(html,/♦/);assert.match(html,/보호막 \+2/)});
test('텍스트 카드 모드는 레거시 전술 렌더러를 노출하지 않는다',()=>{assert.equal('tacticTextFace' in CardTextMode,false);assert.equal(CardTextMode.ACTION_LABELS.draw_tactic,undefined)});
test('카드 문자열은 HTML을 이스케이프한다',()=>{const html=CardTextMode.textCardFace({suit:'C',rank:6,name:'<script>alert(1)</script>',effects:[{trigger:'on_play',action:'gain_chips',value:1,duration:'trick'}]});assert.doesNotMatch(html,/<script>/i);assert.match(html,/&lt;script&gt;/)});

test('카드 면은 원문을 40자에서 자르지 않고 구조화된 완결 요약을 만든다',()=>{
  const card={cardId:'pack01.recursive_function',suit:'C',rank:8,named:{id:'pack01.recursive_function',name:'재귀 함수',description:'아주 긴 전체 규칙 원문'}};
  assert.deepEqual(CardTextMode.buildCardCompactText(card),{title:'재귀 함수',trigger:'승리',summary:'직전 효과 카드의 복사 가능한 수치 효과 1회 복사'});
  const source=fs.readFileSync(path.join(__dirname,'..','card-text-mode.js'),'utf8');
  assert.doesNotMatch(source,/shortEffect\(card\)/);
  assert.doesNotMatch(source,/slice\(0\s*,\s*40\)/);
});

test('긴 복합 효과는 카드 앞면 요약에서 중요한 두 조건을 모두 보존한다',()=>{
  const river=Cards.createDefinitionCard('pack02.river_ticket',{uid:'river'});
  const riverPreview=CardTextMode.buildCardCompactText(river);
  assert.equal(riverPreview.trigger,'쇼다운');
  assert.match(riverPreview.summary,/리버 적중/);
  assert.match(riverPreview.summary,/\+12/);
  assert.match(riverPreview.summary,/리버 실패/);
  assert.match(riverPreview.summary,/-4/);

  const first=Cards.createDefinitionCard('pack02.first_strike',{uid:'first'});
  const firstPreview=CardTextMode.buildCardCompactText(first);
  assert.equal(firstPreview.trigger,'복합');
  assert.match(firstPreview.summary,/1번째 트릭/);
  assert.match(firstPreview.summary,/트릭 숫자 \+4/);
  assert.match(firstPreview.summary,/피해 4/);
});

test('기록형 카드도 티어 수치를 생략하지 않는다',()=>{
  const card=Cards.createDefinitionCard('pack02.long_game',{uid:'long'});
  const preview=CardTextMode.buildCardCompactText(card);
  assert.match(preview.summary,/승리 횟수 기록/);
  assert.match(preview.summary,/1\/2\/3/);
  assert.match(preview.summary,/\+2\/\+4\/\+8/);
});

test('카드 앞면 HTML은 전체 원문을 접근 가능한 데이터로 보존한다',()=>{
  const card=Cards.createDefinitionCard('pack02.trump_forge',{uid:'forge'});
  const full=CardTextMode.fullEffectText(card);
  const html=CardTextMode.textCardFace(card,'hand');
  assert.ok(full.length>40);
  assert.match(html,/data-full-effect=/);
  assert.match(html,/인쇄값과 쇼다운값은 유지/);
});

test('랭크 부스트와 더블다운 축약 문구는 최신 수치와 칩 승부를 표시한다',()=>{assert.match(CardTextMode.COMPACT_TEXT['core.plus2'].summary,/\+3/);assert.match(CardTextMode.COMPACT_TEXT['core.double'].summary,/칩 1/);assert.match(CardTextMode.COMPACT_TEXT['core.double'].summary,/\+5/);assert.match(CardTextMode.COMPACT_TEXT['core.double'].summary,/칩 \+2/)});
test('쇼다운 미니 카드는 이름만 렌더하고 긴 효과 본문을 출력하지 않는다',()=>{const html=CardTextMode.textCardFace({cardId:'core.double',suit:'H',rank:2,name:'더블다운',effects:[{trigger:'on_play'}]},'mini');assert.match(html,/더블다운/);assert.doesNotMatch(html,/cardTextEffect/)});

test('손패 효과 요약은 강제 2줄 clamp 없이 밀도에 따라 글자 크기를 조절한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-text-mode.js'),'utf8');
  assert.match(source,/\.cardTextEffect\{display:block/);
  assert.match(source,/cardTextEffect--compact/);
  assert.match(source,/cardTextEffect--dense/);
  assert.doesNotMatch(source,/\.cardTextEffect\{[^}]*-webkit-line-clamp:2/);
});

test('작은 카드에서도 효과 본문을 통째로 숨기지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-text-mode.js'),'utf8');
  const compactBlock=source.match(/@container cardface \(max-width:72px\)\{([^]*?)\}\n/);
  assert.ok(compactBlock);
  assert.match(compactBlock[1],/\.cardTextEffect\{display:block/);
  assert.doesNotMatch(compactBlock[1],/\.cardTextEffect\{display:none/);
});

test('텍스트 전용 모드는 런타임 토글 API를 유지한다',()=>{assert.equal(CardTextMode.setEnabled(false),false);assert.equal(CardTextMode.isEnabled(),false);assert.equal(CardTextMode.setEnabled(true),true);assert.equal(CardTextMode.isEnabled(),true)});
test('effects.js는 별도 텍스트 카드 런타임을 브라우저에서 로드한다',()=>{const source=fs.readFileSync(path.join(__dirname,'..','effects.js'),'utf8');assert.match(source,/loadTextCardRuntime\(\)/);assert.match(source,/card-text-mode\.js/);assert.match(source,/data-trick-text-card-runtime|trickTextCardRuntime/)});
