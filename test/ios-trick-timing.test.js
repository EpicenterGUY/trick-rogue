const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','battle-hand-polish.js'),'utf8');

test('iOS/Safari 트릭 연출은 최소 판독 시간을 상수로 보장한다',()=>{
  assert.match(source,/const CARD_COMMIT_MIN_MS=220;/);
  assert.match(source,/const TRICK_RESULT_MIN_MS=980;/);
  assert.match(source,/function keepMinimum\(startedAt,minMs\)/);
});

test('동작 줄이기에서는 모션만 생략하고 카드 제출 대기 시간을 건너뛰지 않는다',()=>{
  assert.doesNotMatch(source,/if\(!src\|\|!appEl\|\|!vs\|\|reduced\(\)\)return;/);
  assert.match(source,/if\(!src\|\|!appEl\|\|!vs\|\|reduced\(\)\)\{\s*await keepMinimum\(startedAt,CARD_COMMIT_MIN_MS\);/);
});

test('동작 줄이기에서도 트릭 승패 표시를 최소 시간 유지한다',()=>{
  assert.doesNotMatch(source,/!player\?\.classList\.contains\('show'\)\|\|reduced\(\)\)return/);
  assert.match(source,/if\(reduced\(\)\)\{[\s\S]*?await keepMinimum\(startedAt,TRICK_RESULT_MIN_MS\);[\s\S]*?return;/);
});

test('Safari Web Animations 조기 종료가 전체 판정 시간을 단축하지 않는다',()=>{
  assert.match(source,/Promise\.allSettled\(\[ea\.finished,pa\.finished\]\)/);
  assert.match(source,/await keepMinimum\(startedAt,TRICK_RESULT_MIN_MS\);/);
});
