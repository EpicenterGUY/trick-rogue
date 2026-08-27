const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Preview=require('../trick-outcome-preview.js');
const EnemyInformation=require('../enemy-information.js');

function card(suit,rank,extra={}){return{suit,rank,...extra}}
function battleWith(enemyCard,extra={}){return{trump:'S',enemyCard,enemy:{},playerStage:null,phase:'trick',mods:{paint:false,plus:0,reverse:false},...extra}}

function fakeClassList(){const values=new Set(['collapsed']);return{add(...items){items.forEach(item=>values.add(item))},remove(...items){items.forEach(item=>values.delete(item))},contains(item){return values.has(item)}}}
function fakeDocument(){
  const elements={
    inspect:{classList:fakeClassList()},
    inspectTitle:{textContent:''},inspectDesc:{innerHTML:''},inspectApply:{textContent:'',dataset:{}},systemLegend:{innerHTML:''},termRow:{innerHTML:''},playBtn:{textContent:'',disabled:false}
  };
  return{getElementById(id){return elements[id]||null},elements};
}

test('공개 정보가 없으면 실제 적 카드가 있어도 결과 불확실로 남는다',()=>{
  assert.equal(Preview.outcomeForResults([]).id,'uncertain');
  assert.equal(Preview.previewText({label:'결과 불확실',knowledge:'none',enemyMin:null,enemyMax:null}),'결과 불확실');
});

test('부분 정보는 실제 숨은 숫자가 아니라 공개된 강도 구간과 트럼프 여부만 후보군으로 사용한다',()=>{
  const a=battleWith(card('H',7)),b=battleWith(card('D',10));
  const ka=Preview.currentKnowledge(a),kb=Preview.currentKnowledge(b);
  assert.deepEqual(ka,{knowledge:'partial',strength:'mid',isTrump:false});
  assert.deepEqual(kb,ka);
  assert.deepEqual(Preview.candidateCards(ka,'S'),Preview.candidateCards(kb,'S'));
  assert.equal(Preview.candidateCards(ka,'S').length,12);
  assert.ok(Preview.candidateCards(ka,'S').every(candidate=>candidate.suit!=='S'&&candidate.rank>=7&&candidate.rank<=10));
});

test('부분 정보 범위 전체를 이길 때만 승리 확정으로 표시한다',()=>{
  const battle=battleWith(card('H',9));
  const preview=Preview.previewForCard(card('S',10),battle);
  assert.equal(preview.id,'win');
  assert.equal(preview.label,'승리 확정');
  assert.equal(preview.playerValue,13);
  assert.equal(preview.enemyMin,7);
  assert.equal(preview.enemyMax,10);
});

test('부분 정보 범위 안에서 승패가 갈리면 실제 숨은 카드가 무엇이든 결과 불확실이다',()=>{
  const lowHidden=Preview.previewForCard(card('C',8),battleWith(card('H',7)));
  const highHidden=Preview.previewForCard(card('C',8),battleWith(card('D',10)));
  assert.equal(lowHidden.id,'uncertain');
  assert.equal(highHidden.id,'uncertain');
  assert.equal(lowHidden.enemyMin,highHidden.enemyMin);
  assert.equal(lowHidden.enemyMax,highHidden.enemyMax);
});

test('정찰 등으로 현재 카드가 정확 공개된 경우에만 정확한 무승부 판정을 허용한다',()=>{
  const battle=battleWith(card('H',8));
  EnemyInformation.revealCurrentEnemyCard(battle);
  const preview=Preview.previewForCard(card('C',8),battle);
  assert.equal(preview.knowledge,'exact');
  assert.equal(preview.candidateCount,1);
  assert.equal(preview.id,'draw');
  assert.equal(preview.label,'무승부 확정');
});

test('트럼프 부분 정보도 공개 후보 범위 전체로 판정한다',()=>{
  const battle=battleWith(card('S',12));
  const preview=Preview.previewForCard(card('C',10),battle);
  assert.equal(Preview.currentKnowledge(battle).isTrump,true);
  assert.equal(preview.enemyMin,14);
  assert.equal(preview.enemyMax,17);
  assert.equal(preview.id,'loss');
  assert.equal(preview.label,'패배 확정');
});

test('손패 상세 어댑터는 기존 숨은 카드 compare를 호출하지 않고 안전한 확정/불확실 문구로 덮는다',()=>{
  const document=fakeDocument(),battle=battleWith(card('H',9));let legacyCalls=0,compareCalls=0;
  const root={
    document,battle,
    inspectCard(){legacyCalls++;throw new Error('legacy inspect must not run when safe UI hosts exist')},
    compare(){compareCalls++;throw new Error('hidden enemy compare must not run')},
    suitObj(suit){return{sym:{S:'♠',H:'♥',D:'♦',C:'♣'}[suit]}},
    rankLabel(rank){return String(rank)},cardTerms(){return[]},cardDetailHtml(){return'효과 설명'}
  };
  assert.equal(Preview.installInspectAdapter(root),true);
  const result=root.inspectCard(card('S',10));
  assert.equal(result.id,'win');
  assert.equal(legacyCalls,0);
  assert.equal(compareCalls,0);
  assert.match(document.elements.inspectApply.textContent,/승리 확정/);
  assert.match(document.elements.inspectApply.textContent,/공개 범위 7~10/);
  assert.equal(document.elements.inspectApply.dataset.trickOutcomePreview,'win');
  assert.equal(document.elements.playBtn.disabled,false);
});

test('브라우저 로더는 적 공개 정보 뒤 안전한 트릭 미리보기를 적재하고 런 흐름으로 진행한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','enemy-behavior.js'),'utf8');
  const previewStart=source.indexOf('function loadTrickOutcomePreview()'),enemyStart=source.indexOf('function loadEnemyInformation()'),startStart=source.indexOf('function loadRunStartV2()');
  assert.ok(startStart>=0&&previewStart>startStart&&enemyStart>previewStart,'함수 선언 역순에서 run-start ← preview ← enemy-information 순서여야 한다');
  const previewBlock=source.slice(previewStart,enemyStart),enemyBlock=source.slice(enemyStart,source.indexOf('function loadDeckBoundaries()'));
  assert.match(previewBlock,/trick-outcome-preview\.js/);
  assert.match(previewBlock,/loadRunStartV2/);
  assert.match(enemyBlock,/enemy-information\.js/);
  assert.match(enemyBlock,/loadTrickOutcomePreview/);
});
