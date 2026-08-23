const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Resolution=require('../showdown-resolution.js');

function hand(power=40,name='테스트 족보'){
  return{id:'test',name,power,ranks:[2,3,4,5,6],suits:['S','H','D','C','S']};
}
function model(power=40,options={}){
  return Resolution.createBreakdown({playerHand:hand(power,'내 족보'),enemyHand:hand(5,'적 족보'),setIndex:1,...options});
}

test('7.5-N은 일반 추가 배율을 합산한 뒤 최종 배율을 한 번만 적용한다',()=>{
  const value=model(40);
  Resolution.addMultiplierBonus(value,'player',{id:'river',label:'리버',bonus:0.25,source:'river'});
  Resolution.addMultiplierBonus(value,'player',{id:'edge',label:'우세',bonus:0.25,source:'advantage'});
  Resolution.addMultiplierBonus(value,'player',{id:'contract',label:'계약',bonus:0.5,source:'contract'});
  Resolution.finalizeBreakdown(value);
  assert.equal(value.multiplierStage,'7.5-N');
  assert.equal(value.player.multiplierBonusTotal,1);
  assert.equal(value.player.finalMultiplier,2);
  assert.equal(value.player.finalPower,80);
  assert.equal(value.attacks.player.plannedAmount,80);
});

test('배율 등록 순서를 바꿔도 합계와 최종 위력은 변하지 않는다',()=>{
  const left=model(37),right=model(37);
  for(const bonus of [0.25,0.5,0.25])Resolution.addMultiplierBonus(left,'player',{bonus});
  for(const bonus of [0.5,0.25,0.25])Resolution.addMultiplierBonus(right,'player',{bonus});
  Resolution.finalizeBreakdown(left);Resolution.finalizeBreakdown(right);
  assert.equal(left.player.finalMultiplier,right.player.finalMultiplier);
  assert.equal(left.player.finalPower,right.player.finalPower);
  assert.equal(left.player.finalPower,74);
});

test('기존 factor 입력도 추가 배율 데이터로 정규화되어 연쇄 곱셈하지 않는다',()=>{
  const value=model(34);
  const edge=Resolution.addMultiplier(value,'player',{label:'우세',factor:1.25});
  const contract=Resolution.addMultiplier(value,'player',{label:'계약',factor:1.5});
  Resolution.finalizeBreakdown(value);
  assert.equal(edge.bonus,0.25);
  assert.equal(contract.bonus,0.5);
  assert.equal(value.player.finalMultiplier,1.75);
  assert.equal(value.player.finalPower,60,'34×1.75를 한 번 반올림한다');
  assert.deepEqual(value.player.multipliers.map(entry=>[entry.before,entry.after]),[[34,60],[34,60]],'각 배율 항목을 순차 적용하지 않는다');
});

test('일반 추가 배율은 기본 ×2.5 상한을 넘지 않는다',()=>{
  const value=model(40);
  Resolution.addMultiplierBonus(value,'player',{label:'고점 A',bonus:1});
  Resolution.addMultiplierBonus(value,'player',{label:'고점 B',bonus:1});
  Resolution.finalizeBreakdown(value);
  assert.equal(Resolution.DEFAULT_MULTIPLIER_CAP,2.5);
  assert.equal(value.player.rawMultiplier,3);
  assert.equal(value.player.capApplied,true);
  assert.equal(value.player.finalMultiplier,2.5);
  assert.equal(value.player.finalPower,100);
});

test('명시적 상한 예외 배율만 일반 상한을 넘어 추가될 수 있다',()=>{
  const value=model(40);
  Resolution.addMultiplierBonus(value,'player',{label:'일반 A',bonus:1});
  Resolution.addMultiplierBonus(value,'player',{label:'일반 B',bonus:1});
  const rare=Resolution.addMultiplierBonus(value,'player',{label:'희귀 폭주',bonus:0.5,bypassCap:true});
  Resolution.finalizeBreakdown(value);
  assert.equal(rare.bypassCap,true);
  assert.equal(rare.pool,'cap_bypass');
  assert.equal(value.player.capApplied,true);
  assert.equal(value.player.finalMultiplier,3);
  assert.equal(value.player.finalPower,120);
});

test('리버·우세·5전 전승도 모두 같은 추가 배율 풀에 들어간다',()=>{
  const value=model(40);
  Resolution.applyRiverHitBonus(value,{active:true,multiplier:1.25,snapshotId:'r',target:{name:'스트레이트'},fifth:{rank:6,suit:'S'},candidateCount:4});
  Resolution.addActiveAdvantageMultipliers({ShowdownAdvantage:{ADVANTAGE_MULTIPLIER:1.25}},null,value,{playerActive:true,enemyActive:false,multiplier:1.25,playerSource:'momentum'});
  Resolution.addPerfectSetMultiplier(value,{trickResults:['player','player','player','player','player']});
  Resolution.finalizeBreakdown(value);
  assert.deepEqual(value.player.multipliers.map(entry=>[entry.id,entry.bonus]),[['river_hit',0.25],['advantage',0.25],['perfect_set',0.5]]);
  assert.equal(value.player.finalMultiplier,2);
  assert.equal(value.player.finalPower,80);
});

test('배율 breakdown은 출처별 추가 퍼센트와 합산 최종 배율을 보여준다',()=>{
  const value=model(40);
  Resolution.addMultiplierBonus(value,'player',{label:'리버 적중',bonus:0.25});
  Resolution.addMultiplierBonus(value,'player',{label:'우세',bonus:0.25});
  Resolution.finalizeBreakdown(value);
  const text=Resolution.multiplierText(value.player);
  assert.match(text,/리버 적중 \+25%/);
  assert.match(text,/우세 \+25%/);
  assert.match(text,/합계 ×1\.5/);
});

test('사용자 지정 일반 상한도 breakdown 단위로 적용할 수 있다',()=>{
  const value=model(20,{multiplierCap:2});
  Resolution.addMultiplierBonus(value,'player',{bonus:0.75});
  Resolution.addMultiplierBonus(value,'player',{bonus:0.75});
  Resolution.finalizeBreakdown(value);
  assert.equal(value.player.multiplierCap,2);
  assert.equal(value.player.finalMultiplier,2);
  assert.equal(value.player.finalPower,40);
});

test('7.5-N 실제 계산 코드에는 배율 연쇄 곱셈이 남지 않는다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','showdown-resolution.js'),'utf8');
  assert(!source.includes('product*=entry.factor'));
  assert(!source.includes('Math.round(current*entry.factor)'));
  assert(source.includes('generalMultiplierBonus'));
  assert(source.includes('DEFAULT_MULTIPLIER_CAP=2.5'));
  assert(source.includes("pool:bypassCap===true?'cap_bypass':'general'"));
});
