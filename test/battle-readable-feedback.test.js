const assert=require('node:assert/strict');
const test=require('node:test');
const Readable=require('../battle-readable-feedback.js');
const Feedback=require('../battle-feedback.js');

test('트릭 결과 문구는 승패 주체를 직접 표시한다',()=>{
  assert.deepEqual(Readable.outcomeMeta(1),{label:'플레이어 승리',short:'승리',className:'player'});
  assert.deepEqual(Readable.outcomeMeta(-1),{label:'적 승리',short:'패배',className:'enemy'});
  assert.deepEqual(Readable.outcomeMeta(0),{label:'동점',short:'동점',className:'draw'});
});

test('쇼다운 데미지는 큰 위력에서 작은 위력을 빼는 식으로 읽힌다',()=>{
  assert.deepEqual(Readable.damageEquation(32,18),{diff:14,winner:'플레이어',loser:'적',formula:'플레이어 32 - 적 18 = 14'});
  assert.deepEqual(Readable.damageEquation(12,27),{diff:15,winner:'적',loser:'플레이어',formula:'적 27 - 플레이어 12 = 15'});
  assert.deepEqual(Readable.damageEquation(20,20),{diff:0,winner:null,loser:null,formula:'플레이어 20 = 적 20'});
});

test('일반 연출은 결과와 데미지 계산을 사람이 읽을 수 있게 충분히 유지한다',()=>{
  const t=Readable.timing(false);
  assert.ok(t.values>=250);
  assert.ok(t.result>=600);
  assert.ok(t.finalPower>=500);
  assert.ok(t.damageCalc>=650);
  assert.ok(t.preImpact>=120);
});

test('모션 감소 환경은 같은 정보 문구를 유지하면서 대기만 짧춘다',()=>{
  const normal=Readable.timing(false),reduced=Readable.timing(true);
  assert.ok(reduced.result<normal.result);
  assert.ok(reduced.damageCalc<normal.damageCalc);
  assert.match(Readable.styleText(),/플레이어 승리|trickOutcomeBanner/);
});

test('읽기 쉬운 전투 피드백 런타임은 DOM 준비 뒤 한 번 연결된다',()=>{
  const scripts=[],events={};
  const doc={
    readyState:'loading',
    addEventListener(type,listener){events[type]=listener},
    querySelector(selector){return selector===Feedback.READABLE_FEEDBACK_SELECTOR?scripts.find(script=>script.dataset.trickReadableFeedback)||null:null},
    createElement(){return{dataset:{}}},
    head:{appendChild(script){scripts.push(script)}}
  };
  assert.equal(Feedback.loadReadableFeedbackRuntime(doc),true);
  assert.equal(scripts.length,0);
  events.DOMContentLoaded();
  assert.equal(scripts.length,1);
  assert.equal(scripts[0].src,'battle-readable-feedback.js');
  assert.equal(scripts[0].async,false);
  assert.equal(scripts[0].dataset.trickReadableFeedback,'true');
  doc.readyState='complete';
  assert.equal(Feedback.loadReadableFeedbackRuntime(doc),false);
  assert.equal(scripts.length,1);
});
