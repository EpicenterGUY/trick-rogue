const test=require('node:test');
const assert=require('node:assert/strict');
const Glossary=require('../rules-glossary-sync.js');

test('최신 용어 사전은 트럼프 +3, 명시적 우세 +25%, 차이 피해 쇼다운을 설명한다',()=>{
  const trump=Glossary.RULE_TERMS['트럼프'];
  const advantage=Glossary.RULE_TERMS['우세'];
  const showdown=Glossary.RULE_TERMS['쇼다운'];
  assert.match(trump,/적용 숫자 \+3/);
  assert.match(trump,/자동 승리나 우선권은 없/);
  assert.match(advantage,/명시적 효과로만 부여/);
  assert.match(advantage,/\+25%/);
  assert.match(advantage,/무늬 수 비교로 자동 발생하지 않/);
  assert.match(showdown,/최종 위력의 차이만큼 피해/);
  assert.match(showdown,/동점이면 피해가 없다/);
});

test('더블다운·순수 카드·칩·리버 설명도 현재 확정 규칙과 일치한다',()=>{
  assert.match(Glossary.RULE_TERMS['더블다운'],/트릭을 3번 이상/);
  assert.match(Glossary.RULE_TERMS['더블다운'],/\+6/);
  assert.match(Glossary.RULE_TERMS['순수 카드'],/표준 52장/);
  assert.match(Glossary.RULE_TERMS['칩'],/최대 5개/);
  assert.match(Glossary.RULE_TERMS['칩'],/2개를 소비/);
  assert.match(Glossary.RULE_TERMS['칩'],/트릭당 1회/);
  assert.match(Glossary.RULE_TERMS['리버 적중'],/4번째 트릭 종료/);
  assert.match(Glossary.RULE_TERMS['리버 적중'],/\+25%/);
});

test('동기화는 기존 TERMS와 SYSTEM_NOTES를 제자리에서 갱신하고 무늬 우세 라벨을 제거한다',()=>{
  const terms={우세:'옛 우세',트럼프:'옛 트럼프',더블다운:'옛 더블다운'};
  const systemNotes={조건:'예: 우세 무늬 2개 이상'};
  const label={nodeType:3,textContent:'쇼다운 무늬 우세'};
  const edge={textContent:'5장 확정 후 판정'};
  const status={childNodes:[label,edge],dataset:{},querySelector:selector=>selector==='#edgeText'?edge:null};
  const doc={querySelector:selector=>selector==='#statusTop .midStat'?status:null};
  const result=Glossary.applyRuleGlossary({terms,systemNotes,document:doc});
  assert.deepEqual(result,{termsUpdated:true,systemNotesUpdated:true,labelUpdated:true});
  assert.match(terms.우세,/명시적 효과로만 부여/);
  assert.match(terms.트럼프,/\+3/);
  assert.match(terms.더블다운,/3번 이상/);
  assert.doesNotMatch(systemNotes.조건,/우세 무늬 2개/);
  assert.equal(label.textContent,'명시적 우세');
  assert.equal(edge.textContent,'효과로만 부여');
  assert.equal(status.dataset.advantageRule,'explicit-only');
});

test('최신 용어 정의는 폐기된 자동 무늬 우세와 트럼프 우선권을 다시 설명하지 않는다',()=>{
  const text=Object.values(Glossary.RULE_TERMS).join('\n');
  assert.doesNotMatch(text,/우세 무늬가 하나 이상|무늬 수를 상대와 비교/);
  assert.doesNotMatch(text,/트릭 승패에 우선권을 주는/);
});
