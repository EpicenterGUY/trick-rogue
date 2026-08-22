const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CardTextMode=require('../card-text-mode.js');

test('네임드 카드는 기존 이미지 대신 수트/랭크와 텍스트만 가진 얼굴을 만든다',()=>{
  const card={
    suit:'S',rank:7,
    named:{name:'검은 탄환',description:'트릭 승리 시 피해 3.',effects:[{trigger:'on_trick_win',action:'damage_enemy',value:3,duration:'trick'}]}
  };
  const html=CardTextMode.textCardFace(card);
  assert.match(html,/검은 탄환/);
  assert.match(html,/♠/);
  assert.match(html,/>7</);
  assert.match(html,/피해/);
  assert.doesNotMatch(html,/<img/i);
  assert.doesNotMatch(html,/<svg/i);
});

test('효과 없는 기본 트럼프는 텍스트 카드 대상으로 분류하지 않는다',()=>{
  const pure={suit:'H',rank:10,named:null,definition:null,effects:[]};
  assert.equal(CardTextMode.shouldUseTextFace(pure),false);
});

test('네임드 분류가 없어도 effects와 이름이 있는 일반 카드는 텍스트 카드가 된다',()=>{
  const card={suit:'D',rank:4,name:'시험 카드',effects:[{trigger:'on_play',action:'gain_shield',value:2,duration:'trick'}]};
  assert.equal(CardTextMode.shouldUseTextFace(card),true);
  const html=CardTextMode.textCardFace(card);
  assert.match(html,/시험 카드/);
  assert.match(html,/♦/);
  assert.match(html,/보호막 \+2/);
});


test('텍스트 카드 모드는 레거시 전술 렌더러를 노출하지 않는다',()=>{
  assert.equal('tacticTextFace' in CardTextMode,false);
  assert.equal(CardTextMode.ACTION_LABELS.draw_tactic,undefined);
});

test('카드 문자열은 HTML을 이스케이프한다',()=>{
  const html=CardTextMode.textCardFace({suit:'C',rank:6,name:'<script>alert(1)</script>',effects:[{trigger:'on_play',action:'gain_chips',value:1,duration:'trick'}]});
  assert.doesNotMatch(html,/<script>/i);
  assert.match(html,/&lt;script&gt;/);
});

test('카드 면은 원문 대신 별도의 compact 발동/효과 요약을 렌더한다',()=>{
  const card={cardId:'pack01.recursive_function',suit:'C',rank:8,named:{id:'pack01.recursive_function',name:'재귀 함수',description:'아주 긴 전체 규칙 원문'}};
  assert.deepEqual(CardTextMode.buildCardCompactText(card),{title:'재귀 함수',trigger:'승리 시',summary:'직전 네임드의 복사 가능한 수치 효과 1회 복사'});
  const html=CardTextMode.textCardFace(card,'hand');
  assert.match(html,/cardTextTrigger/);
  assert.match(html,/cardTextEffect/);
  assert.doesNotMatch(html,/아주 긴 전체 규칙 원문/);
});

test('쇼다운 미니 카드는 이름만 렌더하고 긴 효과 본문을 출력하지 않는다',()=>{
  const html=CardTextMode.textCardFace({cardId:'core.double',suit:'H',rank:2,name:'더블다운',effects:[{trigger:'on_showdown_score'}]},'mini');
  assert.match(html,/더블다운/);
  assert.doesNotMatch(html,/cardTextEffect|우세 무늬/);
});

test('손패 효과 요약은 두 줄 clamp와 한글 단어 보호를 사용한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','card-text-mode.js'),'utf8');
  assert.match(source,/\.cardTextEffect\{[^}]*-webkit-line-clamp:2/);
  assert.match(source,/\.cardTextEffect\{[^}]*word-break:keep-all/);
});

test('텍스트 전용 모드는 런타임 토글 API를 유지한다',()=>{
  assert.equal(CardTextMode.setEnabled(false),false);
  assert.equal(CardTextMode.isEnabled(),false);
  assert.equal(CardTextMode.setEnabled(true),true);
  assert.equal(CardTextMode.isEnabled(),true);
});

test('effects.js는 별도 텍스트 카드 런타임을 브라우저에서 로드한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','effects.js'),'utf8');
  assert.match(source,/loadTextCardRuntime\(\)/);
  assert.match(source,/card-text-mode\.js/);
  assert.match(source,/data-trick-text-card-runtime|trickTextCardRuntime/);
});
