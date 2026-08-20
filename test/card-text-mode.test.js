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

test('전술 카드도 아이콘 없이 비용/이름/설명 텍스트만 렌더한다',()=>{
  const html=CardTextMode.tacticTextFace({id:'paint',name:'페인트',cost:1,desc:'다음 카드의 트릭 무늬를 트럼프로 바꾼다.'});
  assert.match(html,/페인트/);
  assert.match(html,/비용/);
  assert.match(html,/트릭 무늬/);
  assert.doesNotMatch(html,/<img/i);
  assert.doesNotMatch(html,/<svg/i);
});

test('카드 문자열은 HTML을 이스케이프한다',()=>{
  const html=CardTextMode.textCardFace({suit:'C',rank:6,name:'<script>alert(1)</script>',effects:[{trigger:'on_play',action:'gain_chips',value:1,duration:'trick'}]});
  assert.doesNotMatch(html,/<script>/i);
  assert.match(html,/&lt;script&gt;/);
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
