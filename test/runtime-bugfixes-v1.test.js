const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','game-ui.js'),'utf8');

test('예측 표시는 덱 재순환이나 셔플을 실행하지 않는다',()=>{
  const match=index.match(/function forecastText\(target\)\{[\s\S]*?\n\nfunction cardArtKey/);
  assert.ok(match,'forecastText를 찾을 수 있어야 한다');
  assert.doesNotMatch(match[0],/recycleP\(\)/);
  assert.match(match[0],/battle\.discard\.length\?'셔플 대기':'없음'/);
});

test('전투 덱 HUD는 전체 런 덱 대신 남은 전투 덱과 버림 더미를 연다',()=>{
  assert.match(index,/function showBattlePile\(kind='deck'\)/);
  assert.match(index,/deck:battle\.deck\|\|\[\],discard:battle\.discard\|\|\[\]/);
  assert.match(ui,/showBattlePile==='function'\)runtimeRoot\.showBattlePile\('deck'\)/);
  assert.match(ui,/showBattlePile==='function'\)runtimeRoot\.showBattlePile\('discard'\)/);
});

test('손패 제목은 덱과 버림 수량을 중복 표시하지 않는다',()=>{
  assert.match(index,/drawInfo\.textContent='';/);
  assert.doesNotMatch(index,/drawInfo\.textContent=`덱 \${battle\.deck\.length} · 버림 \${battle\.discard\.length}`/);
});
